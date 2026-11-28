// Run from the explicitly selected App directory with Flutter; no App edits.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/eval/javascript/service.dart';
import 'package:mangayomi/models/source.dart';
import 'package:mangayomi/services/http/m_client.dart' show cfPort;

void main() {
  final build = Platform.environment['NODELANE_PLUGIN_BUILD']!;
  final catalog =
      jsonDecode(File('$build/index.json').readAsStringSync()) as List;
  JsExtensionService create([String slug = 'comix']) {
    final entry = (catalog.singleWhere((e) => e['nodelane']['slug'] == slug) as Map)
        .cast<String, dynamic>();
    final source = Source.fromJson(entry)
      ..sourceCode = File('$build/${entry['sourceCodeUrl']}')
          .readAsStringSync();
    final service = JsExtensionService(source);
    addTearDown(service.dispose);
    service.getHeaders();
    return service;
  }

  Future<void> host(Future<String> Function(List<dynamic>) respond) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    cfPort = server.port;
    addTearDown(() async {
      await server.close(force: true);
      cfPort = 0;
    });
    server.listen((request) async {
      expect(request.uri.path, '/evaluateJavascriptViaWebview');
      final body = jsonDecode(await utf8.decoder.bind(request).join()) as Map;
      final response = await respond([
        body['url'],
        body['headers'],
        body['scripts'],
        body['time'],
      ]);
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({'result': response}));
      await request.response.close();
    });
  }

  Future<String> runPage(List<dynamic> args, Map<String, dynamic> fixture) async {
    final fixtures = Platform.environment['NODELANE_PLUGIN_FIXTURES']!;
    final process = await Process.start('node', ['$fixtures/../helpers/webview-page.mjs', '--stdin']);
    process.stdin.write(jsonEncode({'script': (args[2] as List).single, 'url': args[0], ...fixture}));
    await process.stdin.close();
    final output = await utf8.decoder.bind(process.stdout).join();
    final errors = await utf8.decoder.bind(process.stderr).join();
    expect(await process.exitCode, 0, reason: errors);
    return output;
  }

  test('Comix propagates a redirected page, decodes a later page list and reports bridge timeout', () async {
    const work = 'https://comix.to/title/test-fixture';
    final service = create();
    String? response;
    await host((args) async {
      expect(args[0], work);
      expect(args[1]['Referer'], 'https://comix.to/');
      expect(args[3], 120);
      // 直接执行 QuickJS 生成的脚本，用跳转后的真实返回值验证桥接。
      return response ?? await runPage(args, {'html': '', 'url': 'https://redirect.test'});
    });
    await expectLater(
      service.getDetail(work),
      throwsA(predicate((e) => e.toString().contains('页面已跳转'))),
    );
    response = jsonEncode({
      'ok': true,
      'value': [
        {
          'url': 'https://images.fixture.test/page.jpg',
          'headers': {'Referer': ''},
          'imageProcessing': {
            'type': 'tile-shuffle-v1',
            'algorithm': 3,
            'seedMasks': {'03632': 58414, '02900': 117532},
          },
        },
      ],
    });
    final pages = await service.getPageList('$work/1-chapter-0');
    expect(pages.single.imageProcessing!.toJson()['type'], 'tile-shuffle-v1');
    expect(pages.single.headers!['Referer'], '');
    response = '';
    await expectLater(
      service.getDetail(work),
      throwsA(predicate((e) => e.toString().contains('超时'))),
    );
  });
  test('Hachiraw page program crosses real QuickJS and App deserialization', () async {
    final service = create('hachiraw');
    final fixtures = Platform.environment['NODELANE_PLUGIN_FIXTURES']!;
    final detailHtml = File('$fixtures/hachiraw-detail.html').readAsStringSync();
    final readerHtml = File('$fixtures/hachiraw-reader.html').readAsStringSync();
    await host((args) async {
      expect(args[0], 'https://hachiraw.net/manga/sample-book');
      expect(args[3], 35);
      return runPage(args, {'html': detailHtml, 'reader': readerHtml});
    });
    const work = 'https://hachiraw.net/manga/sample-book';
    final detail = await service.getDetail(work);
    expect(detail.name, 'Sample & Book 🌊');
    expect(detail.chapters!.length, 4);
    expect(detail.chapters!.last.url, '$work/chapter-1');
    expect(detail.chapters!.last.dateUpload, '1791763200000');
    final pages = await service.getPageList('$work/chapter-1');
    expect(pages.length, 2);
    expect(pages.first.url, pages.last.url);
    expect(pages.first.headers!['Referer'], 'https://hachiraw.net/');
    expect(pages.first.headers!['User-Agent'], 'Fixture device WebView');
  });
  test('Hipmh reads the public reader’s ordered lazy slots through the App bridge', () async {
    final service = create('hipmh');
    final fixtures = Platform.environment['NODELANE_PLUGIN_FIXTURES']!;
    final html = File('$fixtures/hipmh-reader.html').readAsStringSync();
    const reader = 'https://reader.hipmh.top/';
    const chapter = '${reader}chapter/bTo0Mi1jOjc-NDI6MC41MA';
    await host((args) async {
      expect(args[0], chapter);
      return runPage(args, {'html': html, 'delayedBridge': true});
    });
    final pages = await service.getPageList(chapter);
    expect(pages.map((p) => p.url), ['https://example.test/page?quality=2&v=1',
      'https://example.test/page?quality=2&v=1', '${reader}other/last.webp']);
    expect(pages.last.headers?['Referer'], reader);
  });
}

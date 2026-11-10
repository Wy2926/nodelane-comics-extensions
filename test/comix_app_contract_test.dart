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
  final entry = (catalog.singleWhere((e) => e['id'] == 86001001) as Map)
      .cast<String, dynamic>();
  JsExtensionService create() {
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

  test('real QuickJS serializes the complete page program through the existing host bridge', () async {
    final service = create();
    var calls = 0;
    await host((args) async {
      calls++;
      expect(args[0], 'https://comix.to/title/test-fixture');
      expect(args[1]['Referer'], 'https://comix.to/');
      expect(args[3], 120);
      final scripts = args[2] as List;
      expect(scripts.length, 1);
      final script = scripts.single as String;
      expect(script, isNot(contains('[native code]')));
      expect(script, contains('fetch(url'));
      expect(script, contains('callHandler'));
      // Parse and execute the exact QuickJS-produced source in a fresh JS realm.
      // Failure uses the actual page runner, before network/API mocks are involved.
      final process = await Process.start('node', [
        '--input-type=module',
        '-e',
        'import vm from "node:vm"; let source=""; '
            'for await (const part of process.stdin) source+=part; '
            'const context={location:{origin:"https://redirect.test"},'
            'flutter_inappwebview:{callHandler:async(name,result)=>process.stdout.write(result)}}; '
            'context.window=context; vm.runInNewContext(source,context);',
      ]);
      process.stdin.write(script);
      await process.stdin.close();
      final result = jsonDecode(await utf8.decoder.bind(process.stdout).join());
      expect(await process.exitCode, 0);
      expect(result['ok'], false);
      expect(result['error'], contains('页面已跳转'));
      return jsonEncode({
        'ok': true,
        'value': {
          'name': '漫画🌊',
          'link': args[0],
          'status': 0,
          'chapters': [
            {
              'name': 'Chapter 0.5',
              'url': '${args[0]}/1-chapter-0.5',
              'dateUpload': '1767225600000',
            },
          ],
        },
      });
    });
    final detail = await service.getDetail(
      'https://comix.to/title/test-fixture',
    );
    expect(detail.name, '漫画🌊');
    expect(detail.chapters!.single.name, 'Chapter 0.5');
    expect(detail.chapters!.single.dateUpload, '1767225600000');
    expect(calls, 1);
  });

  test('page restoration survives real App deserialization; bridge errors stay visible', () async {
    final service = create();
    String response = jsonEncode({
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
    await host((args) async => response);
    final pages = await service.getPageList('/title/test-fixture/1-chapter-0');
    expect(pages.single.imageProcessing!.toJson()['type'], 'tile-shuffle-v1');
    expect(pages.single.headers!['Referer'], '');
    response = jsonEncode({'ok': false, 'error': 'Comix 目录不完整，请重试。'});
    await expectLater(
      service.getDetail('/title/test-fixture'),
      throwsA(predicate((e) => e.toString().contains('目录不完整'))),
    );
    response = '';
    await expectLater(
      service.getDetail('/title/test-fixture'),
      throwsA(predicate((e) => e.toString().contains('超时'))),
    );
  });
}

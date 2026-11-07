import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const index = JSON.parse(readFileSync(new URL('../.build/index.json', import.meta.url), 'utf8'));
const code = readFileSync(new URL('../.build/' + index.find(e => e.id === 86001001).sourceCodeUrl, import.meta.url), 'utf8');
function runtime(handler = () => { throw new Error('unexpected network'); }) {
    const requests = [];
    const context = vm.createContext({MProvider: class {}, Client: class {
        async get(url, headers) { requests.push({url, headers}); return handler(url, headers); }
    }});
    const exposed = code.replace('return ComixExtension;', 'globalThis.helpers = {parseProtocolSource, TextEncoder, TextDecoder, atob, btoa}; return ComixExtension;');
    vm.runInContext(exposed + '\nglobalThis.plugin = new DefaultExtension();', context);
    return {...context, requests, context};
}
function fixtureBundle(version = 'fixture') {
    const encode = text => Buffer.from(text).toString('base64').replace(/[a-zA-Z]/g, ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
    const table = ['kid', version, 'material', ...Array.from({length: 13}, (_, i) => 'unused' + i)].map(encode);
    const bytes = Array.from({length: 1088}, (_, i) => (i * 17 + 3) % 256);
    return 'const lookup=decode;function decode(n){n-=100;const table=values();}' +
        'function values(){const table=' + JSON.stringify(table) + ';}' +
        'const alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";' +
        'pool["chunk"]=' + JSON.stringify(bytes) + ';const a={};a.id="chunk";a["start"]=0;a["mask"]=0;a["enc"]=0;var descriptors=[a];' +
        'const m={};m[lookup(100)]=lookup(101),m[lookup(102)]=function(){const p=new Uint8Array(1088);};' +
        'globalThis.remoteExecuted=true;';
}
function apiResponse(result) { return {statusCode: 200, body: JSON.stringify({status: 'ok', result}), headers: {}}; }
function pagination(items, page = 1, total = items.length, perPage = 28) {
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    return {items, meta: {page, total, perPage, lastPage, hasNext: page < lastPage}};
}
const book = {id: 1, hid: 'test', title: '漫画🌊', url: '/title/test-fixture', contentRating: 'safe', poster: {medium: '/images/fixture.jpg'}};
function seed(context) { context.plugin.protocol = context.helpers.parseProtocolSource(fixtureBundle()); }

test('QuickJS-local codecs match UTF-8 and Base64, including long text and invalid bytes', () => {
    const {helpers: h} = runtime();
    const text = '漫画🌊"\\\n'.repeat(5000);
    assert.deepEqual(Buffer.from(new h.TextEncoder().encode(text)), Buffer.from(text));
    assert.equal(new h.TextDecoder().decode(Buffer.from(text)), text);
    assert.throws(() => new h.TextDecoder().decode(new Uint8Array([255])));
    for (const value of ['', 'a', 'ab', 'abc', '\0\xff\x80']) {
        assert.equal(h.btoa(value), Buffer.from(value, 'latin1').toString('base64'));
        assert.equal(h.atob(h.btoa(value)), value);
    }
});
test('protocol loader parses literals, shares work, and never executes downloaded source', async () => {
    const context = runtime(url => ({statusCode: 200, headers: {}, body: url.endsWith('/browse')
        ? '<script type="module" src="/assets/build/abc/dist/main-fixture.js"></script>'
        : url.includes('main-fixture') ? 'import "./apicore-fixture.js";' : fixtureBundle()}));
    const [first, second] = await Promise.all([context.plugin.getProtocol(), context.plugin.getProtocol()]);
    assert.strictEqual(first, second);
    assert.equal(first.version, 'fixture');
    assert.equal(first.data.length, 1088);
    assert.equal(context.requests.length, 3);
    assert.equal(context.remoteExecuted, undefined);
    await context.plugin.getProtocol();
    assert.equal(context.requests.length, 3);
    assert.throws(() => context.helpers.parseProtocolSource('globalThis.remoteExecuted=true;'));
});
test('unknown layout and failed loads can be retried; off-site protocol assets are rejected', async () => {
    const context = runtime(() => ({statusCode: 200, headers: {}, body: '<script src="https://evil.test/assets/build/abc/dist/main-fixture.js"></script>'}));
    await assert.rejects(context.plugin.getProtocol(), /协议/);
    await assert.rejects(context.plugin.getProtocol(), /协议/);
    assert.equal(context.requests.length, 2);
    assert.equal(context.plugin.pendingProtocol, null);
});
test('signed search preserves special characters, pagination and site identity', async () => {
    const context = runtime(() => apiResponse(pagination([book]))); seed(context);
    const result = await context.plugin.search(' 中文 & + 🌊 ', 1);
    assert.equal(result.list[0].name, book.title);
    assert.equal(result.list[0].link, 'https://comix.to/title/test-fixture');
    const request = new URL(context.requests[0].url);
    assert.equal(request.searchParams.get('keyword'), '中文 & + 🌊');
    assert.match(request.searchParams.get('_'), /^fixture\.[\w-]{16}$/);
    assert.equal(result.hasNextPage, false);
    assert.deepEqual(context.requests[0].headers, context.plugin.getHeaders());
    await assert.rejects(context.plugin.search('x', 0));
    await assert.rejects(context.plugin.getDetail('https://comix.to.evil.test/title/test-fixture'));
    assert.equal(context.requests.length, 1);
});
test('valid empty results are distinct from malformed responses', async () => {
    const context = runtime(() => apiResponse(pagination([]))); seed(context);
    assert.equal((await context.plugin.search('nothing', 1)).list.length, 0);
    context.plugin.api = async () => pagination([book], 1, 90);
    await assert.rejects(context.plugin.getPopular(1), /协议/);
});
test('only an explicit retired key refreshes once; captcha and CF do not loop', async () => {
    let calls = 0;
    const context = runtime(() => ++calls <= 2
        ? {statusCode: 403, headers: {}, body: '{"code":"key_retired"}'} : apiResponse({}));
    seed(context); let reloads = 0;
    context.plugin.loadProtocol = async () => { reloads++; return context.helpers.parseProtocolSource(fixtureBundle('new')); };
    await assert.rejects(context.plugin.api('/manga'), /协议/);
    assert.equal(calls, 2); assert.equal(reloads, 1);
    for (const response of [
        {statusCode: 403, body: '{"error":"captcha_required"}', headers: {}},
        {statusCode: 403, body: '<html>challenge</html>', headers: {'Cf-Mitigated': 'challenge'}},
    ]) {
        const blocked = runtime(() => response); seed(blocked);
        await assert.rejects(blocked.plugin.api('/manga'), /验证/);
        assert.equal(blocked.requests.length, 1);
    }
});
test('full chapter pagination preserves uploads, chapter zero and decimals; partial data fails', async () => {
    const context = runtime();
    const chapter = i => ({id: i + 1, mangaId: 1, number: i / 2, language: 'en', url: '/title/test-fixture/' + (i + 1) + '-chapter-' + (i / 2)});
    const rows = Array.from({length: 101}, (_, i) => chapter(i));
    context.plugin.api = async (path, params) => path.endsWith('/chapters')
        ? pagination(params.page === '1' ? rows.slice(0, 100) : rows.slice(100), Number(params.page), 101, 100) : book;
    const result = await context.plugin.getDetail(book.url);
    assert.equal(result.chapters.length, 101);
    assert.equal(result.chapters[0].name, 'Chapter 0');
    assert.equal(result.chapters[1].name, 'Chapter 0.5');
    context.plugin.api = async path => path.endsWith('/chapters') ? pagination(rows.slice(0, 1), 1, 101, 100) : book;
    await assert.rejects(context.plugin.getDetail(book.url), /协议/);
});
test('retirement recovery refreshes cached HTML and modules exactly once', async () => {
    const context = runtime(value => {
        const url = new URL(value);
        if (url.pathname.startsWith('/api/')) {
            return url.searchParams.get('_').startsWith('new.') ? apiResponse({success: true})
                : {statusCode: 403, headers: {}, body: '{"code":"key_retired"}'};
        }
        const body = url.pathname === '/browse' ? '<script src="/assets/build/abc/dist/main-fixture.js"></script>'
            : url.pathname.includes('main-fixture') ? 'import "./apicore-fixture.js";'
            : fixtureBundle(url.searchParams.has('nodelane_refresh') ? 'new' : 'old');
        return {statusCode: 200, headers: {}, body};
    });
    assert.equal((await context.plugin.api('/manga')).success, true);
    const fresh = context.requests.filter(request => request.url.includes('nodelane_refresh='));
    assert.equal(fresh.length, 3);
    assert.equal(context.requests.filter(request => request.url.includes('/api/')).length, 2);
    assert.equal(context.plugin.protocol.version, 'new');
});
test('image lists declare native restoration, require host support, and reject foreign or unknown pages', async () => {
    const context = runtime(), chapterUrl = '/title/test-fixture/1-chapter-0';
    let result = {id: 1, url: chapterUrl, pages: {baseUrl: 'https://cdn.example.test/', items: [{url: 'page.jpg', s: 0}]}};
    context.plugin.api = async () => result;
    assert.equal((await context.plugin.getPageList(chapterUrl))[0].url, 'https://cdn.example.test/page.jpg');
    result.pages.items[0].s = 1;
    await assert.rejects(context.plugin.getPageList(chapterUrl), /打乱图片/);
    context.context.NodeLane = {capabilities:['image.tile-shuffle.v1']};
    const page = (await context.plugin.getPageList(chapterUrl))[0];
    assert.equal(page.imageProcessing.type, 'tile-shuffle-v1');
    assert.equal(page.imageProcessing.seedMasks['03632'],58414);
    assert.equal(page.headers.Referer,'');
    result.pages.items[0].s = 9;
    await assert.rejects(context.plugin.getPageList(chapterUrl), /协议/);
    result = {...result, id: 2};
    await assert.rejects(context.plugin.getPageList(chapterUrl), /协议/);
});

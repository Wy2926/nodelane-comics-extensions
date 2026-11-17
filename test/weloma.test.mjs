import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin = 'https://weloma.net', book = origin + '/m/M1', chapter = origin + '/c/C3';
const bound = chapter + '#nodelane-weloma=' + encodeURIComponent(book);
const fixtures = Object.fromEntries(await Promise.all(['detail','reader','list'].map(async name =>
    [name, await readFile(new URL('./fixtures/weloma-' + name + '.html', import.meta.url), 'utf8')])));
const ok = body => ({statusCode:200,body,headers:{}});
const runtime = responses => mockPlugin('weloma', (request, count) => {
    if (typeof responses === 'function') return responses(request, count);
    assert.ok(responses[count - 1], 'unexpected request');
    return typeof responses[count - 1] === 'string' ? ok(responses[count - 1]) : responses[count - 1];
});
test('Weloma list methods preserve query, pagination and covers', async () => {
    const {plugin,requests} = await runtime(({url}) => ok(fixtures.list.replace('class="active">1', 'class="active">' + new URL(url).searchParams.get('page'))));
    assert.equal((await plugin.getPopular(1)).hasNextPage, true);
    await plugin.getPopular(2);
    await plugin.getLatestUpdates(1);
    const result = await plugin.search(' 漫画 & + 🌊 ', 1);
    assert.equal(new URL(requests[1].url).searchParams.get('page'), '2');
    assert.equal(new URL(requests[0].url).searchParams.get('sort'), 'views');
    assert.equal(new URL(requests[2].url).searchParams.get('sort'), 'last_update');
    assert.equal(new URL(requests[3].url).searchParams.get('name'), '漫画 & + 🌊');
    assert.equal(result.list[0].imageUrl, 'https://covers.fixture.test/one.jpg');
    assert.equal(result.list[1].imageUrl, '');
});
test('Weloma distinguishes a confirmed empty listing from failed or mismatched pages', async () => {
    const empty = '<html><body><div class="card-body"><div id="history"></div><div class="pagination-wrap"><ul class="pagination"></ul></div></div></body></html>';
    assert.equal((await (await runtime([empty])).plugin.search('none', 1)).list.length, 0);
    const last = fixtures.list.replace(/<li><a href="\/l\/Next">.*?<\/li>/g, '');
    assert.equal((await (await runtime([last])).plugin.search('fixture', 1)).hasNextPage, false);
    for (const body of [empty.replace('id="history"','id="missing"'),empty.replace('id="history">','id="history">Unavailable'),
        fixtures.list.replace('class="active">1','class="active">2'),
        fixtures.list.replace('</html>',''),fixtures.list.replaceAll('href="/l/Next">2','href="/l/Last">9').replace('<li><a href="/l/Next">»</a></li>','')])
        await assert.rejects((await runtime([body])).plugin.search('fixture',1), /Weloma:/);
});
test('Weloma binds the complete reader menu to its book and retains distinct same-name chapters', async () => {
    const {plugin} = await runtime([fixtures.detail,fixtures.reader]);
    const detail = await plugin.getDetail(book);
    assert.equal(detail.name, '契約漫画 🌊');
    assert.equal(detail.author, '作者 A'); assert.equal(detail.status, 0);
    assert.deepEqual(Array.from(detail.genre), ['Adventure']);
    assert.match(detail.description, /Other names: Fixture Story/);
    assert.deepEqual(Array.from(detail.chapters, c => c.name), ['特別編','第0話','第0話','序章']);
    assert.equal(detail.chapters[0].url, bound);
    assert.equal(detail.chapters[1].url, origin + '/c/C2?edition=2#nodelane-weloma=' + encodeURIComponent(book));
    assert.equal(detail.chapters[1].dateUpload, String(Date.UTC(2024,1,29)));
    assert.equal(detail.chapters[2].dateUpload, ''); assert.equal(detail.chapters[3].dateUpload, '');
    const badDate = fixtures.detail.replace('29/02/2024','29/02/2023');
    assert.equal((await (await runtime([badDate,fixtures.reader])).plugin.getDetail(book)).chapters[1].dateUpload, '');
});
test('Weloma rejects incomplete catalogs, wrong owners and changed chapter menus', async () => {
    for (const [detail,reader] of [
        [fixtures.detail.replace('/c/C1','/c/FOREIGN'),fixtures.reader],
        [fixtures.detail,fixtures.reader.replace('/m/M1','/m/M2')],
        [fixtures.detail.replace('</ul></body>','<a rel="next" href="?page=2">More</a></ul></body>'),fixtures.reader],
        [fixtures.detail.replace('list-chapters','missing'),fixtures.reader],
    ]) await assert.rejects((await runtime([detail,reader])).plugin.getDetail(book), /Weloma:/);
});
test('Weloma decodes UTF-8 images without eval, preserves duplicate slots and sends the chapter Referer', async () => {
    const {plugin,requests} = await runtime([fixtures.reader,fixtures.reader]);
    const pages = await plugin.getPageList(bound);
    assert.equal(pages.length,3); assert.equal(pages[1].url,pages[2].url);
    assert.equal(pages[0].url,'https://images.fixture.test/一.jpg?v=1&size=full');
    assert.ok(pages.every(p => p.headers.Referer === chapter));
    assert.equal(requests[0].url, chapter);
    assert.equal(JSON.stringify(await plugin.getPageList(bound)), JSON.stringify(pages));
    const relative = fixtures.reader.replace(/data-img="[^"]+"/, 'data-img="../images/one.jpg"');
    assert.equal(new URL((await (await runtime([relative])).plugin.getPageList(chapter))[0].url).href, origin + '/images/one.jpg');
});
test('Weloma fails the whole reader for bad identity, missing slots or malformed encoding', async () => {
    for (const body of [fixtures.reader.replace('/m/M1','/m/M2'),fixtures.reader.replace('href="/c/C3"','href="/c/C4"'),
        fixtures.reader.replace('selected value="/c/C3"','selected value="/c/C4"'),fixtures.reader.replace('chapter-images','missing'),
        ...['AAAAA','/w==','file:///tmp/image.jpg',''].map(value => fixtures.reader.replace(/data-img="[^"]+"/, 'data-img="' + value + '"'))])
        await assert.rejects((await runtime([body])).plugin.getPageList(bound), /Weloma:/);
});
test('Weloma exposes network failures and retries freshly without cached partial results', async () => {
    for (const [statusCode,headers,code] of [[403,{'cf-mitigated':'challenge'},'verification'],[429,{},'rate-limit'],[403,{},'access'],[503,{},'http']]) {
        const {plugin,requests} = await runtime([{statusCode,headers,body:'Unavailable'},fixtures.reader]);
        await assert.rejects(plugin.getPageList(bound), new RegExp('Weloma:' + code));
        assert.equal(requests.length,1);
        assert.equal((await plugin.getPageList(bound)).length,3); assert.equal(requests.length,2);
    }
});
test('Weloma rejects invalid input before requesting', async () => {
    const {plugin,requests} = await runtime([]);
    for (const url of [book.replace('https:','http:'),book+'#foreign',book.replace('/m/M1','/m/../M1'),book.replace('.net/','.net@evil.test/')])
        await assert.rejects(plugin.getDetail(url), /Weloma:url/);
    await assert.rejects(plugin.getPageList(chapter+'#nodelane-weloma=%'), /Weloma:url/);
    await assert.rejects(plugin.getPopular(0), /Weloma:page/);
    assert.equal(requests.length,0);
});

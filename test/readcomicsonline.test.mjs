import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin = 'https://readcomicsonline.ru', book = origin + '/comic/fixture', chapter = book + '/1.1';
const fixtures = Object.fromEntries(await Promise.all(['search','detail','pages'].map(async name =>
    [name, await readFile(new URL('./fixtures/readcomicsonline-' + name + '.html', import.meta.url), 'utf8')])));
function runtime(body, statusCode = 200, headers = {}) {
    return mockPlugin('readcomicsonline', ({url}, count) =>
        typeof body === 'function' ? body(url, count) : {statusCode, body, headers});
}
function listing(url, total = 61) {
    const u = new URL(url), page = Number(u.searchParams.get('page')), search = u.pathname === '/advanced-search';
    const count = Math.min(60, Math.max(0, total - (page - 1) * 60));
    const cards = Array.from({length: count}, (_, i) => {
        const link = '/comic/book-' + ((page - 1) * 60 + i);
        return search ? '<a class="group" href="'+link+'"><p>Book '+i+'</p></a>' :
            '<div class="group"><a class="block text-sm font-semibold" href="'+link+'">Book '+i+'</a></div>';
    }).join('');
    const next = new URL(u); next.searchParams.set('page', String(page + 1));
    return '<html><head><link rel="canonical" href="'+u.origin+u.pathname+'"></head><body><main>' +
        (search ? '<h2>Search results ('+total+')</h2>'+cards : '<div class="comic-list-layout"><div class="grid">'+cards+'</div></div>') +
        (count ? '' : '<p>No comics match those filters.</p>') +
        '<nav><span aria-current="page">'+page+'</span>'+(page*60<total?'<a rel="next" href="'+next.href.replaceAll('&','&amp;')+'">Next</a>':'')+'</nav></main></body></html>';
}
test('RCO popular/latest and filtered search preserve request parameters through the last page', async () => {
    const {plugin, requests} = await runtime(url => ({statusCode:200, headers:{}, body:listing(url)}));
    const popular = await plugin.getPopular(1);
    assert.equal(popular.list.length,60);assert.equal(popular.hasNextPage,true);
    assert.equal((await plugin.getLatestUpdates(2)).hasNextPage,false);
    assert.equal(new URL(requests[1].url).searchParams.get('sort'),'latest');
    const filters = plugin.getFilterList();
    assert.deepEqual(Array.from(filters,f=>f.values.length),[3,4,83]);
    filters[0].state=2;filters[1].state=1;filters[2].state=filters[2].values.findIndex(v=>v.value==='33');
    const result = await plugin.search('漫画 & + 🌊',2,filters);
    assert.equal(result.list.length,1);assert.equal(result.hasNextPage,false);
    assert.deepEqual(Object.fromEntries(new URL(requests[2].url).searchParams),{name:'漫画 & + 🌊',status_id:'2',type_id:'1',category:'33',page:'2'});
    assert.equal(plugin.getFilterList()[0].state,0);
    await plugin.search('',1);
    assert.equal(new URL(requests.at(-1).url).pathname,'/comic-list');
});
test('RCO missing covers and explicit empty search remain valid, malformed pages do not', async () => {
    const result = await (await runtime(fixtures.search)).plugin.search('fixture',1);
    assert.equal(result.list.length,2);assert.equal(result.list[1].imageUrl,'');
    const empty = await runtime(url=>({statusCode:200,headers:{},body:listing(url,0)}));
    assert.equal((await empty.plugin.search('none',1)).list.length,0);
    for (const body of ['<html>unavailable</html>',fixtures.search.replace('(2)','(3)'),
        fixtures.search.replace('/comic/another','https://foreign.test/comic/another')])
        await assert.rejects((await runtime(body)).plugin.search('fixture',1),/RCO:/);
    const next = listing(origin+'/advanced-search?name=fixture&page=1');
    for (const body of [next.replace('name=fixture&amp;page=2','name=other&amp;page=2'),next.replace('aria-current="page">1','aria-current="page">2')])
        await assert.rejects((await runtime(body)).plugin.search('fixture',1),/RCO:pagination/);
});
test('RCO catalog keeps specials and same-named chapters, deduplicates only normalized URLs, parses real calendar dates', async () => {
    const {plugin, requests} = await runtime(fixtures.detail), result = await plugin.getDetail(book);
    assert.equal(result.name,'契约漫画 🌊');assert.equal(result.status,1);assert.equal(result.author,'Test Author');assert.equal(result.artist,'Test Artist');
    assert.equal(result.description,'第一段\n\n第二段');assert.deepEqual(Array.from(result.genre),['Publisher']);
    assert.deepEqual(Array.from(result.chapters,c=>c.name),['#Annual 2025','#1','#1']);
    assert.deepEqual(Array.from(result.chapters,c=>c.dateUpload),[String(new Date(2024,1,29).getTime()),'','']);
    assert.equal(JSON.stringify(await plugin.getDetail(book)),JSON.stringify(result));assert.equal(requests.length,2);
    for (const body of [fixtures.detail.replace('/comic/fixture/annual2025','/comic/other/annual2025'),
        fixtures.detail.replace('Chapters</h2>','Missing</h2>'),fixtures.detail.replace('</section>','<a rel="next" href="?page=2">Next</a></section>')])
        await assert.rejects((await runtime(body)).plugin.getDetail(book),/RCO:(chapter-owner|catalog)/);
});
test('RCO reader returns all slots with repeated URLs and validates ownership, count and order', async () => {
    const pages = await (await runtime(fixtures.pages)).plugin.getPageList(chapter);
    assert.equal(pages.length,3);assert.equal(pages[1].url,pages[2].url);assert.equal(pages[0].headers.Referer,origin+'/');
    for (const body of [fixtures.pages.replace('rel="canonical" href="'+chapter,'rel="canonical" href="'+book+'/2'),
        fixtures.pages.replace('selected value="/comic/fixture/1.1"','selected value="/comic/other/1.1"'),
        fixtures.pages.replace('<option value="/comic/fixture/1.1/3">Page 3</option>',''),
        fixtures.pages.replace('/1.1/3','/1.1/4'),fixtures.pages.replace('cdn.readcomicsonline.ru','cdn.readcomicsonline.ru.evil.test'),
        fixtures.pages.replace('/fixture/chapters','/other/chapters'),fixtures.pages.replace('id="reader-all"','id="broken"')])
        await assert.rejects((await runtime(body)).plugin.getPageList(chapter),/RCO:/);
});
test('RCO verification, rate limits and HTTP errors remain visible, and retry uses a fresh response', async () => {
    for (const [status, body, headers, code] of [[403,'challenge',{'cf-mitigated':'challenge'},'verification'],
        [200,'<title>Just a moment...</title>',{},'verification'],[403,'Sorry, you have been blocked',{},'verification'],
        [403,'denied',{},'access'],[429,'limited',{},'rate-limit'],[503,'unavailable',{},'http']]) {
        const {plugin,requests}=await runtime(body,status,headers);
        await assert.rejects(plugin.getDetail(book),new RegExp('RCO:'+code));assert.equal(requests.length,1);
    }
    const {plugin}=await runtime((url,call)=>({statusCode:call===1?503:200,body:fixtures.detail,headers:{}}));
    await assert.rejects(plugin.getDetail(book),/RCO:http/);assert.equal((await plugin.getDetail(book)).chapters.length,3);
});
test('RCO unsupported identities and stale filters fail before making requests', async () => {
    const {plugin, requests}=await runtime(fixtures.detail);
    for (const url of [book+'?id=2',book.replace('/fixture','/%2e%2e'),book.replace('/fixture','/a%2fb'),book.replace('https:','http:'),book.replace('.ru/','.ru@evil.test/'),book+'/%GG'])
        await assert.rejects(plugin.getDetail(url),/RCO:url/);
    await assert.rejects(plugin.getPopular(0),/RCO:page/);
    const filters=plugin.getFilterList();filters[0].state=99;
    assert.throws(()=>plugin.search('',1,filters),/RCO:filter/);
    assert.equal(requests.length,0);
});

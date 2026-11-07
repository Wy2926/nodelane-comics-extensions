import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin = 'https://www.guazimanhua.com';
const book = origin + '/comic.php?id=123', chapter = origin + '/chapter.php?id=91#nodelane-guazimanhua=123';
const fixtures = Object.fromEntries(await Promise.all(['list','detail','empty','pages'].map(async name =>
    [name, await readFile(new URL('./fixtures/guazimanhua-' + name + '.html', import.meta.url), 'utf8')])));
function runtime(body, statusCode = 200, headers = {}) {
    return mockPlugin('guazimanhua', ({url}, count) =>
        typeof body === 'function' ? body(url, count) : {statusCode, body, headers});
}
function listing(url, total) {
    const u = new URL(url), page = Number(u.searchParams.get('page') || 1), last = Math.max(1, Math.ceil(total / 36));
    const entries = Array.from({length: Math.min(36, Math.max(0, total - (page - 1) * 36))}, (_, i) =>
        ({'@type':'ListItem',position:i+1,url:origin+'/comic.php?id='+((page-1)*36+i+1),name:'作品 '+i}));
    const pager = [page, ...(page < last ? [page + 1] : [])].map((p, i) => {
        u.searchParams.delete('page'); if (p > 1) u.searchParams.set('page', String(p));
        return '<a '+(i ? '' : 'class="on" ')+'href="'+u.href.replaceAll('&','&amp;')+'">'+p+'</a>';
    }).join('');
    const data = {'@type':'CollectionPage',url:origin+'/category.php',mainEntity:{'@type':'ItemList',numberOfItems:entries.length,itemListElement:entries}};
    return '<html><head><link rel="canonical" href="'+origin+'/category.php"><script type="application/ld+json">'+JSON.stringify(data)+'</script></head><body>'+
        '<div class="filter-head"><p>当前筛选 '+total+' 部作品 · 第 '+page+' / '+last+' 页 · 每页 36 部</p></div>'+
        entries.map(e=>'<article class="card"><h3><a href="'+e.url+'">'+e.name+'</a></h3></article>').join('')+
        (entries.length?'':'<div class="empty">当前筛选暂无漫画</div>')+'<nav class="pager">'+pager+'</nav></body></html>';
}
test('Guazi popular, latest, search and five filters preserve parameters through pagination', async () => {
    const {plugin, requests} = await runtime(url => ({statusCode:200,headers:{},body:listing(url,37)}));
    assert.equal(plugin.supportsLatest, true);
    assert.equal((await plugin.getPopular(1)).hasNextPage, true);
    assert.equal(new URL(requests[0].url).searchParams.get('sort'), 'hits');
    const last = await plugin.getLatestUpdates(2); assert.equal(last.list.length, 1); assert.equal(last.hasNextPage, false);
    assert.equal(new URL(requests[1].url).searchParams.get('sort'), 'update');
    const filters = plugin.getFilterList(); assert.equal(filters.length, 5);
    for (const filter of filters) filter.state = 1;
    await plugin.search('漫画 & + 🌊', 2, filters);
    assert.deepEqual(Object.fromEntries(new URL(requests[2].url).searchParams),
        {keyword:'漫画 & + 🌊',cid:'41',city:'42',audience:'1',is_end:'2',sort:'daily',page:'2'});
    assert.equal(plugin.getFilterList()[0].state, 0); // UI edits cannot mutate defaults.
    assert.equal(plugin.getSourcePreferences().length, 0);
    const empty = await runtime(url => ({statusCode:200,headers:{},body:listing(url,0)}));
    assert.deepEqual(JSON.parse(JSON.stringify(await empty.plugin.search('none',1))),{list:[],hasNextPage:false});
});
test('Guazi malformed or mismatched listing data cannot become a successful empty page', async () => {
    const body = listing(origin+'/category.php?sort=hits',37);
    const broken = [body.replace('第 1 /','第 2 /'),body.replace('numberOfItems":36','numberOfItems":35'),
        body.replace('作品 0</a>','其他作品</a>'),body.replaceAll('sort=hits','sort=update'),body.replace('class="on"','class="off"'),
        body.replace('https://www.guazimanhua.com/comic.php?id=1"','https://foreign.test/comic.php?id=1"')];
    for (const html of broken) await assert.rejects((await runtime(html)).plugin.getPopular(1), /GZ:/);
    await assert.rejects((await runtime('<html>unavailable</html>')).plugin.getPopular(1), /GZ:/);
    const result = await (await runtime(fixtures.list)).plugin.search('测试 & +',1);
    assert.equal(result.list.length, 2); assert.equal(result.list[1].imageUrl, '');
});
test('Guazi SEO identity accepts the requested sort but rejects a conflicting canonical', async () => {
    const body = listing(origin+'/category.php?sort=hits',37).replaceAll(origin+'/category.php"',origin+'/category.php?sort=hits"');
    assert.equal((await (await runtime(body)).plugin.getPopular(1)).list.length,36);
    await assert.rejects((await runtime(body)).plugin.getLatestUpdates(1),/GZ:identity/);
});
test('Guazi a short search page follows the pager when visible cards and JSON-LD agree', async () => {
    const url=origin+'/category.php?keyword='+encodeURIComponent('我');
    const body=listing(url,37).replace(',{"@type":"ListItem","position":36,"url":"'+origin+'/comic.php?id=36","name":"作品 35"}','')
        .replace('numberOfItems":36','numberOfItems":35').replace('<article class="card"><h3><a href="'+origin+'/comic.php?id=36">作品 35</a></h3></article>','');
    const result=await (await runtime(body)).plugin.search('我',1);
    assert.equal(result.list.length,35);assert.equal(result.hasNextPage,true);
});
test('Guazi complete catalog keeps source order, extras, ownership and unknown upload dates', async () => {
    const {plugin, requests} = await runtime(fixtures.detail);
    const result = await plugin.getDetail(book);
    assert.equal(result.name, '契约漫画 🌊'); assert.equal(result.author, '作者'); assert.equal(result.status, 1);
    assert.deepEqual(Array.from(result.chapters,c=>c.name),['第1.5话 番外','第1话 同名','第0话 开始']);
    assert.deepEqual(Array.from(result.chapters,c=>c.dateUpload),['','','']);
    assert.ok(result.chapters.every(c=>c.url.endsWith('#nodelane-guazimanhua=123')));
    assert.equal(JSON.stringify(await plugin.getDetail(book)), JSON.stringify(result));
    assert.equal(requests.length, 2); // No chapter fan-out or mutable directory cache.
});
test('Guazi accepts explicitly empty catalogs without mistaking missing data for zero chapters', async () => {
    const detail = await (await runtime(fixtures.empty)).plugin.getDetail(book);
    assert.equal(detail.name, '契约漫画 🌊'); assert.equal(detail.chapters.length, 0);
    for (const body of [fixtures.empty.replace('章节总数：0', '章节总数：3'),
        fixtures.empty.replace('章节总数：0 话', ''), fixtures.empty.replace('all-chapter-grid', 'missing-grid')])
        await assert.rejects((await runtime(body)).plugin.getDetail(book), /GZ:/);
});
test('Guazi rejects truncated, duplicate, reordered and foreign catalogs', async () => {
    for (const body of [fixtures.detail.replace('numberOfItems":3','numberOfItems":4'),
        fixtures.detail.replace('id=70">','id=12">'),fixtures.detail.replace('id=70">','id=70#nodelane-guazimanhua=999">'),
        fixtures.detail.replace('position":1','position":3'),fixtures.detail.replace('ComicStory','Article'),
        fixtures.detail.replace('comic.php?id=123','comic.php?id=999')]) {
        await assert.rejects((await runtime(body)).plugin.getDetail(book),/GZ:/);
    }
});
test('Guazi returns all 21 image slots beyond the SEO preview and preserves repeated URLs', async () => {
    const {plugin, requests} = await runtime(fixtures.pages);
    const pages = await plugin.getPageList(chapter);
    assert.equal(pages.length, 21); assert.equal(pages[19].url, pages[20].url);
    assert.equal(pages[0].headers.Referer, origin+'/');
    assert.equal(requests[0].url, origin+'/chapter.php?id=91'); // Binding never leaves the device.
    assert.ok(pages.every(p=>p.url.startsWith('https://img.guazicdn.com/')));
});
test('Guazi fails whole chapters on wrong ownership, missing pages, bad order or foreign images', async () => {
    const changes = [body=>body.replace('comic.php?id=123','comic.php?id=999'),body=>body.replace('numberOfItems":21','numberOfItems":22'),
        body=>body.replace('data-page="21"','data-page="22"'),body=>body.replace('position":1','position":2'),
        body=>body.replaceAll('img.guazicdn.com','img.guazicdn.com.evil.test'),body=>body.replaceAll('https://img.guazicdn.com','http://img.guazicdn.com')];
    for (const change of changes) await assert.rejects((await runtime(change(fixtures.pages))).plugin.getPageList(chapter),/GZ:/);
    await assert.rejects((await runtime(fixtures.pages)).plugin.getPageList(chapter.replace('=123','=456')),/GZ:chapter-owner/);
});
test('Guazi verification, rate limits and server errors remain visible and manual retry recovers', async () => {
    for (const [status, body, headers, code] of [[403,'challenge',{'cf-mitigated':'challenge'},'verification'],[200,'<title>Just a moment</title>',{},'verification'],
        [401,'login',{},'access'],[429,'limited',{},'rate-limit'],[503,'unavailable',{},'http']]) {
        const {plugin, requests} = await runtime(body,status,headers);
        await assert.rejects(plugin.getDetail(book),new RegExp('GZ:'+code)); assert.equal(requests.length,1);
    }
    const {plugin, requests} = await runtime((url,call)=>({statusCode:call===1?503:200,body:call===1?'error':fixtures.detail,headers:{}}));
    await assert.rejects(plugin.getDetail(book),/GZ:http/);
    assert.equal((await plugin.getDetail(book)).chapters.length,3);assert.equal(requests.length,2);
});
test('Guazi invalid URLs, unbound chapters and stale filter states fail before requesting', async () => {
    const {plugin, requests} = await runtime(fixtures.detail);
    for (const url of [book.replace('www.guazimanhua.com','www.guazimanhua.com@evil.test'),book+'&id=123',book.replace('id=123','id=%GG'),book+'#owner'])
        await assert.rejects(plugin.getDetail(url),/GZ:url/);
    await assert.rejects(plugin.getPageList(origin+'/chapter.php?id=91'),/GZ:chapter-binding/);
    await assert.rejects(plugin.getPopular(10001),/GZ:page/);
    for (const change of [f=>f[0].state=99,f=>f.push(f[0]),f=>f[0].type='unknown']) {
        const filters=plugin.getFilterList();change(filters);
        assert.throws(()=>plugin.search('',1,filters),/GZ:filter/);
    }
    assert.equal(requests.length,0);
});

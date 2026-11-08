import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin='https://rawotaku.com',book=origin+'/read/fixture-raw/',chapter=origin+'/read/fixture/ja/chapter-0.5-raw/';
const fixtures=Object.fromEntries(await Promise.all(['search.html','empty.html','detail.html','reader.html','pages.json'].map(async name=>
    [name,await readFile(new URL('./fixtures/rawotaku-'+name,import.meta.url),'utf8')])));
const ok=body=>({statusCode:200,body,headers:{}});
function runtime(responses) {
    return mockPlugin('rawotaku', (request,count)=>{
        if(typeof responses==='function') return responses(request,count);
        const response=responses[count-1];assert.ok(response,'unexpected request');
        return typeof response==='string'?ok(response):response;
    });
}
function listing(url, {empty=false,next=false}={}) {
    const u=new URL(url), q=u.searchParams.get('q'), page=u.searchParams.get('p');
    const canonical=q===null?origin+'/filter/':origin+'/?q='+encodeURIComponent(q);
    const form=q!==null?'':['type','status','language','sort'].map(k=>
        '<select name="'+k+'"><option selected value="'+u.searchParams.get(k)+'">Selected</option></select>').join('');
    const cards=empty?'<div>データなし！</div>':'<div class="flw-item"><a class="manga-poster" href="/read/fixture-raw/"></a><h3 class="manga-name">契約漫画 🌊</h3></div>';
    return '<html><head><link rel="canonical" href="'+canonical+'"></head><body>'+form+'<div class="manga_list-sbs">'+cards+'</div>'+
        (empty?'':'<ul class="pagination"><li class="active">'+page+'</li>'+(next?'<li><a href="?p='+(Number(page)+1)+'">Next</a></li>':'')+'</ul>')+'</body></html>';
}
test('RawOtaku filters, keyword search and page-only navigation preserve request semantics',async()=>{
    const {plugin,requests}=await runtime(({url})=>ok(listing(url,{next:new URL(url).searchParams.get('p')==='1'})));
    assert.equal((await plugin.getPopular(1)).hasNextPage,true);
    assert.equal((await plugin.getPopular(2)).hasNextPage,false);
    assert.equal(new URL(requests[1].url).searchParams.get('sort'),'most-viewed');
    await plugin.getLatestUpdates(1);assert.equal(new URL(requests[2].url).searchParams.get('sort'),'latest-updated');
    const filters=plugin.getFilterList();
    filters[1].state=1;filters[2].state=2;filters[3].state=1;filters[4].state=3;
    await plugin.search('',2,filters);
    assert.deepEqual(Object.fromEntries(new URL(requests[3].url).searchParams),{type:'Raw Manga',status:'Finished',language:'ja',sort:'title-az',p:'2'});
    await plugin.search(' 漫画 & + 🌊 ',1,filters);
    assert.deepEqual(Object.fromEntries(new URL(requests[4].url).searchParams),{q:'漫画 & + 🌊',p:'1'});
    assert.equal(plugin.getFilterList()[1].state,0);
});
test('RawOtaku missing covers and explicit empty results work; mismatched or incomplete lists fail',async()=>{
    const result=await (await runtime([fixtures['search.html']])).plugin.search('漫画 & + 🌊',1);
    assert.equal(result.list.length,2);assert.equal(result.list[1].imageUrl,'');
    const shared=fixtures['search.html'].replace('mgoimg.view47.com/thumb/220/upload','f002.backblazeb2.com/file/WCMS-Images/MangaOnline');
    assert.equal((await (await runtime([shared])).plugin.search('漫画 & + 🌊',1)).list.length,2);
    assert.equal((await (await runtime([shared.replace('WCMS-Images','other-bucket')])).plugin.search('漫画 & + 🌊',1)).list.length,2);
    assert.equal((await (await runtime([fixtures['empty.html']])).plugin.search('none',1)).list.length,0);
    await assert.rejects((await runtime([fixtures['empty.html'].replace('データなし！','unavailable')])).plugin.search('none',1),/RO:listing/);
    const {plugin:emptyFilter}=await runtime(({url})=>ok(listing(url,{empty:true})));
    assert.equal((await emptyFilter.search('',1)).list.length,0);
    for(const change of [s=>s.replace('class="active">1','class="active">2'),s=>s.replace('?p=2','?p=2&sort=default'),
        s=>s.replace('selected value="most-viewed"','selected value="default"'),s=>s.replace('manga_list-sbs','missing'),
        s=>s.replace('/read/fixture-raw/','https://foreign.test/read/fixture-raw/'),s=>s.replace('</html>','')]) {
        const {plugin}=await runtime(({url})=>ok(change(listing(url,{next:true}))));await assert.rejects(plugin.getPopular(1),/RO:/);
    }
    const {plugin}=await runtime(({url})=>ok(listing(url,{empty:true}).replace('データなし！','unavailable')));
    await assert.rejects(plugin.search('',1),/RO:listing/);
});
test('RawOtaku catalog keeps metadata, specials and distinct URLs and validates normalized ownership',async()=>{
    const {plugin}=await runtime([fixtures['detail.html']]);const detail=await plugin.getDetail(book);
    assert.equal(detail.author,'作者 A, 作者 B');assert.equal(detail.status,0);
    assert.deepEqual(Array.from(detail.genre),['冒険','コメディ']);assert.match(detail.description,/別名：Fixture Story/);
    assert.deepEqual(Array.from(detail.chapters,c=>c.name),['特別編','第0話','第0話']);
    assert.deepEqual(Array.from(detail.chapters,c=>c.dateUpload),['','','']);
    const unicode=fixtures['detail.html'].replaceAll('/read/fixture','/read/作品 空');
    assert.equal((await (await runtime([unicode])).plugin.getDetail(origin+'/read/'+encodeURIComponent('作品 空')+'-raw/')).chapters.length,3);
    for(const body of [fixtures['detail.html'].replace('/read/fixture/ja/special','/read/foreign/ja/special'),
        fixtures['detail.html'].replace('id="ja-chaps"','id="unloaded"'),
        fixtures['detail.html'].replace('https://rawotaku.com/read/fixture/ja/chapter-0-raw','https://rawotaku.com/read/other/ja/chapter-0-raw'),
        fixtures['detail.html'].replace('data-id="701"','data-id="999"'),
        fixtures['detail.html'].replace('</ul>','</ul><a rel="next" href="?p=2">Next</a>')])
        await assert.rejects((await runtime([body])).plugin.getDetail(book),/RO:(chapter-owner|catalog)/);
});
test('RawOtaku reader refetches the current menu ID instead of trusting stale wrapper data',async()=>{
    const {plugin,requests}=await runtime([fixtures['reader.html'],fixtures['pages.json'],fixtures['reader.html'],fixtures['pages.json']]);
    const pages=await plugin.getPageList(chapter);
    assert.equal(pages.length,3);assert.equal(pages[1].url,pages[2].url);assert.equal(pages[0].headers.Referer,pages[0].url);
    assert.equal(new URL(requests[1].url).searchParams.get('id'),'702');assert.equal(requests[1].headers.Referer,encodeURIComponent(chapter));
    assert.equal(requests[1].headers['X-Requested-With'],'XMLHttpRequest');
    assert.equal(JSON.stringify(await plugin.getPageList(chapter)),JSON.stringify(pages));assert.equal(requests.length,4);
    const migrated=fixtures['pages.json'].replaceAll('https://sv1.freeimgmg.online/files/fixture','http://images.fixture.test:8080/new-layout');
    assert.equal((await (await runtime([fixtures['reader.html'],migrated])).plugin.getPageList(chapter))[0].url,'http://images.fixture.test:8080/new-layout/one.jpg');
});
test('RawOtaku rejects foreign readers, missing menu entries, invalid JSON, missing slots and invalid image URLs',async()=>{
    for(const body of [fixtures['reader.html'].replace('href="/read/fixture-raw/"','href="/read/other-raw/"'),
        fixtures['reader.html'].replace('href="/read/fixture/ja/chapter-0.5-raw/"','href="/read/fixture/ja/chapter-2-raw/"'),
        fixtures['reader.html'].replace('id="ja-chapters"','id="en-chapters"')]) {
        const {plugin,requests}=await runtime([body]);await assert.rejects(plugin.getPageList(chapter),/RO:(chapter-owner|catalog)/);assert.equal(requests.length,1);
    }
    const body=JSON.parse(fixtures['pages.json']);
    for(const response of ['invalid',JSON.stringify({...body,status:0}),
        ...[s=>s.replace('mrt-bottom','missing'),s=>s.replace('alt="1"','alt="4"'),s=>s.replaceAll('https://sv1.freeimgmg.online','file://images'),
            s=>s.replaceAll('data-src=','missing=')].map(change=>JSON.stringify({...body,html:change(body.html)}))])
        await assert.rejects((await runtime([fixtures['reader.html'],response])).plugin.getPageList(chapter),/RO:(pages|page-order|image-url)/);
});
test('RawOtaku errors remain explicit and manual retry fetches fresh responses without loops',async()=>{
    for(const [statusCode,body,headers,code] of [[403,'challenge',{'cf-mitigated':'challenge'},'verification'],
        [200,'<title>Just a moment...</title>',{},'verification'],[429,'limited',{},'rate-limit'],[403,'denied',{},'access']]) {
        const {plugin,requests}=await runtime([{statusCode,body,headers}]);await assert.rejects(plugin.getDetail(book),new RegExp('RO:'+code));assert.equal(requests.length,1);
    }
    const {plugin,requests}=await runtime([{statusCode:503,body:'unavailable'},fixtures['detail.html']]);
    await assert.rejects(plugin.getDetail(book),/RO:http/);assert.equal(requests.length,1);
    assert.equal((await plugin.getDetail(book)).chapters.length,3);assert.equal(requests.length,2);
});
test('RawOtaku invalid identities and stale filters fail before requests',async()=>{
    const {plugin,requests}=await runtime([]);
    for(const url of [book+'?id=2',book+'#701',book.replace('fixture-raw','%2e%2e'),book.replace('fixture','a%2fb'),book.replace('.com/','.com@evil.test/'),book.replace('https:','http:')])
        await assert.rejects(plugin.getDetail(url),/RO:url/);
    await assert.rejects(plugin.getPopular(0),/RO:page/);
    const filters=plugin.getFilterList();filters[1].state=99;assert.throws(()=>plugin.search('',1,filters),/RO:filter/);
    assert.equal(requests.length,0);
});

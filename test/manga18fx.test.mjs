import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin='https://manga18fx.com',book=origin+'/manga/fixture',chapter=book+'/chapter-0.5';
const fixtures=Object.fromEntries(await Promise.all(['search','empty','detail','reader'].map(async name=>[name,await readFile(new URL('./fixtures/manga18fx-'+name+'.html',import.meta.url),'utf8')])));
const ok=body=>({statusCode:200,body,headers:{}});
const runtime=responses=>mockPlugin('manga18fx',(request,count)=>{
    if(typeof responses==='function')return responses(request,count);
    const response=responses[count-1];assert.ok(response,'unexpected request');return typeof response==='string'?ok(response):response;
});
function listing(url,next=true){
    const u=new URL(url),query=u.searchParams.get('q'),sort=u.searchParams.get('orderby'),page=Number(u.searchParams.get('page')||u.pathname.split('/').at(-1));
    const path=u.pathname.replace(/\/\d+$/,''),canonical=path==='/page'?origin+'/':origin+path;
    const pageUrl=n=>{const v=new URL(u);if(v.searchParams.has('page'))v.searchParams.set('page',n);else v.pathname=path+'/'+n;return v.pathname+v.search;};
    const title=query===null?'Manga':'RESULTS FOR "'+query+'"';
    return '<html><head>'+(query===null?'<link rel="canonical" href="'+canonical+'">':'')+'</head><body><div class="site-body"><div class="bixbox"><h1>'+title+'</h1>'+
        (sort?'<a class="active" href="'+path+'?orderby='+sort+'">Sort</a>':'')+
        '<div class="listupd"><div class="page-item"><h3><a href="/manga/fixture">Fixture</a></h3></div></div><div id="blog-pager"><ul>'+
        '<li class="active"><a data-page="'+(page-1)+'" href="'+pageUrl(page)+'">'+page+'</a></li>'+
        (next?'<li class="next"><a data-page="'+page+'" href="'+pageUrl(page+1)+'">Next</a></li>':'')+'</ul></div></div></div></body></html>';
}
test('Manga18fx routes preserve page and filter conditions; keyword search normalizes apostrophes',async()=>{
    const {plugin,requests}=await runtime(({url})=>ok(listing(url)));
    assert.equal((await plugin.getPopular(2)).hasNextPage,true);assert.equal(new URL(requests[0].url).pathname,'/hot-manga');
    await plugin.getLatestUpdates(2);assert.equal(new URL(requests[1].url).pathname,'/page/2');
    const filters=plugin.getFilterList();filters[1].state=1;filters[2].state=1;filters[3].state=2;
    await plugin.search('',2,filters);assert.match(requests[2].url,/\/manga-genre\/action\/2\?orderby=rating$/);
    filters[1].state=0;await plugin.search('',1,filters);assert.match(requests[3].url,/\/manhwa-raw\/1\?orderby=rating$/);
    await plugin.search(" Doctor's  & + 🌊 ",1,filters);assert.deepEqual(Object.fromEntries(new URL(requests[4].url).searchParams),{q:'Doctor’s & + 🌊',page:'1'});
    filters[2].state=0;assert.throws(()=>plugin.search('',1,filters),/M18:filter/);assert.equal(requests.length,5);
    assert.equal(plugin.getFilterList()[1].state,0);
});
test('Manga18fx lists preserve optional covers and explicit empty results, and reject mismatched pages',async()=>{
    const result=await (await runtime([fixtures.search])).plugin.search("Doctor's & + 🌊",1);
    assert.equal(result.list.length,2);assert.equal(result.list[1].imageUrl,'');
    assert.equal(result.list[0].imageUrl,origin+'/uploads/fixture%20cover.jpg');
    assert.deepEqual(JSON.parse(JSON.stringify(await (await runtime([fixtures.empty])).plugin.search('none',1))),{list:[],hasNextPage:false});
    for(const body of [fixtures.empty.replace('No result','Unavailable'),fixtures.empty.replaceAll('none','other')])
        await assert.rejects((await runtime([body])).plugin.search('none',1),/M18:(listing|identity)/);
    for(const change of [s=>s.replace('>2</a>','>1</a>'),s=>s.replaceAll('page=3','page=4'),s=>s.replace('hot-manga?page=3','search?page=3'),
        s=>s.replace('https://manga18fx.com/hot-manga','https://manga18fx.com/'),s=>s.replace('class="listupd"','class="missing"'),s=>s.replace('</html>','')]) {
        const {plugin}=await runtime(({url})=>ok(change(listing(url))));await assert.rejects(plugin.getPopular(2),/M18:/);
    }
    const {plugin}=await runtime(({url})=>ok(listing(url,false)));assert.equal((await plugin.getPopular(2)).hasNextPage,false);
});
test('Manga18fx full catalog retains specials and dates without treating NEW as a timestamp',async()=>{
    const {plugin}=await runtime([fixtures.detail,fixtures.detail.replace('29 Feb 24','29 Feb 23')]);const result=await plugin.getDetail(book+'/');
    assert.equal(result.author,'作者 A, 作者 B');assert.equal(result.artist,'画师 C');assert.equal(result.status,0);
    assert.deepEqual(Array.from(result.genre),['Action','Fantasy','Manhwa']);assert.match(result.description,/Alternative names: Fixture Adventure/);
    assert.deepEqual(Array.from(result.chapters,c=>[c.name,c.dateUpload]),[['Extra',String(Date.UTC(2024,1,29))],['Chapter 0',''],['Chapter 0',String(Date.UTC(2026,10,7))]]);
    assert.equal((await plugin.getDetail(book)).chapters[0].dateUpload,'');
    for(const body of [fixtures.detail.replace('/manga/fixture/extra','/manga/foreign/extra'),fixtures.detail.replace('https://manga18fx.com/manga/fixture/chapter-0/','https://manga18fx.com/manga/other/chapter-0/'),
        fixtures.detail.replace('row-content-chapter','unloaded'),fixtures.detail.replace('</ul>','</ul><a rel="next" href="?page=2">Next</a>')])
        await assert.rejects((await runtime([body])).plugin.getDetail(book),/M18:(chapter-owner|catalog)/);
});
test('Manga18fx reader validates identity, navigation and image slots while retaining duplicate URLs',async()=>{
    const {plugin}=await runtime([fixtures.reader]);const pages=await plugin.getPageList(chapter);
    assert.equal(pages.length,3);assert.equal(pages[1].url,pages[2].url);assert.equal(pages[0].headers.Referer,origin+'/');
    assert.deepEqual(Array.from(pages,p=>new URL(p.url).hostname),['img02.manga18fx.com','images.fixture.test','images.fixture.test']);
    for(const change of [s=>s.replace('href="/manga/fixture"','href="/manga/foreign"'),s=>s.replace('data-c="chapter-0.5" selected','data-c="chapter-2" selected'),
        s=>s.replace('class="chapchange"','class="missing"'),s=>s.replace('loading p2','loading p4'),s=>s.replace('Page 3','Page 5'),
        s=>s.replace('https://img02.manga18fx.com','file://images'),s=>s.replaceAll('data-src=','missing=')])
        await assert.rejects((await runtime([change(fixtures.reader)])).plugin.getPageList(chapter),/M18:(chapter-owner|pages|page-order|image-url)/);
});
test('Manga18fx verification, access and rate limits remain errors; manual retry is fresh and bounded',async()=>{
    for(const [statusCode,body,headers,code] of [[403,'challenge',{'cf-mitigated':'challenge'},'verification'],[200,'<title>Just a moment...</title>',{},'verification'],[429,'limited',{},'rate-limit'],[403,'denied',{},'access']]){
        const {plugin,requests}=await runtime([{statusCode,body,headers}]);await assert.rejects(plugin.getDetail(book),new RegExp('M18:'+code));assert.equal(requests.length,1);
    }
    const {plugin,requests}=await runtime([{statusCode:503,body:'unavailable'},fixtures.detail]);await assert.rejects(plugin.getDetail(book),/M18:http/);
    assert.equal(requests.length,1);assert.equal((await plugin.getDetail(book)).chapters.length,3);assert.equal(requests.length,2);
});
test('Manga18fx rejects invalid input before requesting',async()=>{
    const {plugin,requests}=await runtime([]);
    for(const url of [book+'#1',book+'?page=2',book.replace('fixture','..'),book.replace('fixture','a%2fb'),book.replace('.com/','.com@evil.test/'),book.replace('https:','http:')])
        await assert.rejects(plugin.getDetail(url),/M18:url/);
    await assert.rejects(plugin.getPopular(0),/M18:page/);const f=plugin.getFilterList();f[1].state=99;assert.throws(()=>plugin.search('',1,f),/M18:filter/);assert.equal(requests.length,0);
});

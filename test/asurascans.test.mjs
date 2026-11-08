import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin='https://asurascans.com',book=origin+'/comics/fixture',chapter=book+'/chapter/0';
const [list,detail,reader]=await Promise.all(['list.json','detail.html','reader.html'].map(name=>readFile(new URL('./fixtures/asurascans-'+name,import.meta.url),'utf8')));
const ok=body=>({statusCode:200,body,headers:{}});
const runtime=responses=>mockPlugin('asurascans',(request,count)=>{const response=responses[count-1];assert.ok(response,'unexpected request');return typeof response==='string'?ok(response):response;});
function withProps(html,key,change) {
  return html.replace(/props='([^']*)'/g,(attribute,raw)=>{const props=JSON.parse(raw);if(!(key in props))return attribute;change(props);return "props='"+JSON.stringify(props)+"'";});
}
test('Asura API pagination, combined filters, Unicode and stable book identities',async()=>{
  const {plugin,requests}=await runtime([list,list,list,JSON.stringify({data:null,meta:{per_page:20}})]);
  const popular=await plugin.getPopular(2);assert.equal(popular.list.length,2);assert.equal(popular.list[0].link,book);assert.equal(popular.list[1].imageUrl,'');assert.equal(popular.hasNextPage,false);
  assert.equal(new URL(requests[0].url).searchParams.get('offset'),'20');
  await plugin.getLatestUpdates(1);assert.equal(new URL(requests[1].url).searchParams.get('sort'),'latest');
  const filters=plugin.getFilterList();filters[0].state={index:3,ascending:true};filters[1].state=1;filters[2].state=1;filters[3].state[0].state=true;filters[3].state[1].state=true;filters[4].state='作者 & A';filters[5].state='Artist B';filters[6].state='100';
  await plugin.search('漫画 & + 🌊',1,filters);assert.deepEqual(Object.fromEntries(new URL(requests[2].url).searchParams),{offset:'0',limit:'20',search:'漫画 & + 🌊',sort:'title',order:'asc',status:'ongoing',type:'manhwa',genres:'action,adventure',author:'作者 & A',artist:'Artist B',min_chapters:'100'});
  assert.deepEqual(JSON.parse(JSON.stringify(await plugin.search('none',1))),{list:[],hasNextPage:false});assert.equal(plugin.getFilterList()[3].state[0].state,false);
});
test('Asura accepts source values and large valid results without arbitrary admission limits',async()=>{
  const entries=JSON.parse(list);entries.data[0].slug='Fixture_漫画';entries.data[0].public_url='/new-display-route';
  const largeDetail=withProps(detail,'chapters',p=>{p.chapters=[1,Array.from({length:10001},(_,n)=>[0,{number:[0,n]}])];p.totalChapters=[0,10001];delete p.publicUrl;});
  const largeReader=withProps(reader,'pages',p=>{p.pages=[1,Array(2001).fill(p.pages[1][0])];});
  const {plugin,requests}=await runtime([JSON.stringify(entries),largeDetail,largeReader]);
  const filters=plugin.getFilterList();filters[3].state.push({value:'new-site-genre',state:true});filters[4].state='作者'.repeat(110);filters[6].state='100000';filters.push({type_name:'HeaderFilter',name:'说明'});
  const query='漫画'.repeat(110),result=await plugin.search(query,501,filters);assert.equal(result.list[0].link,origin+'/comics/Fixture_%E6%BC%AB%E7%94%BB');
  const params=new URL(requests[0].url).searchParams;assert.equal(params.get('offset'),'10000');assert.equal(params.get('search'),query);assert.equal(params.get('genres'),'new-site-genre');assert.equal(params.get('author'),filters[4].state);assert.equal(params.get('min_chapters'),'100000');
  assert.equal((await plugin.getDetail(book+'/?language=en#info')).chapters.length,10001);assert.equal(requests[1].url,book+'/?language=en');
  assert.equal((await plugin.getPageList(chapter+'?mode=full#reader')).length,2001);assert.equal(requests[2].url,chapter+'?mode=full');
});
test('Asura Astro details retain locked, fractional and zero chapters with valid publication dates',async()=>{
  const {plugin}=await runtime([detail]);const result=await plugin.getDetail(book);
  assert.equal(result.name,'契约漫画 🌊');assert.equal(result.link,book);assert.match(result.description,/简介 & Adventure/);assert.equal(result.status,0);
  assert.deepEqual(Array.from(result.chapters,c=>[c.name,c.dateUpload]),[['🔒 Chapter 1.5 - Special',String(Date.UTC(2024,1,29,12,0,0,123))],['Chapter 1 - Opening',''],['Chapter 0 - Prologue',String(Date.UTC(2024,2,1,12))]]);
  for(const [body,error] of [[detail.replace('"totalChapters":[0,3]','"totalChapters":[0,4]'),'catalog'],[detail.replace('"series_slug":[0,"fixture"]','"series_slug":[0,"foreign"]'),'chapter-owner']])
    await assert.rejects((await runtime([body])).plugin.getDetail(book),new RegExp('ASURA:'+error));
  await assert.rejects((await runtime([detail])).plugin.getDetail(origin+'/comics/foreign'),/ASURA:identity/);
});
test('Asura reader accepts rotating suffixes and arbitrary image hosts, preserving duplicate slots',async()=>{
  const {plugin}=await runtime([reader]);const pages=await plugin.getPageList(chapter);assert.equal(pages.length,3);assert.equal(pages[1].url,pages[2].url);assert.equal(pages[0].headers.Referer,origin+'/');assert.match(pages[1].url,/^http:/);
  const canonical=book+'-warriors/chapter/0',publicReader=reader.replace('fixture-deadbeef','fixture-warriors-deadbeef');
  assert.equal((await (await runtime([publicReader])).plugin.getPageList(canonical)).length,3);
  for(const [body,error] of [[reader.replace('"chapterNumber":[0,0]','"chapterNumber":[0,1]'),'chapter-owner'],[reader.replace('fixture-deadbeef','foreign-deadbeef'),'chapter-owner'],[reader.replace('"isLocked":[0,false]','"isLocked":[0,true]'),'access'],[reader.replace('//cdn.example.test/first.webp?sig=fixture','file:///first.webp'),'image-url'],[reader.replace('"url":[0,"//cdn.example.test/first.webp?sig=fixture"]','"url":[0,"//cdn.example.test/first.webp?sig=fixture"],"tiles":[1,[[0,1],[0,0]]]'),'image-protocol']])
    await assert.rejects((await runtime([body])).plugin.getPageList(chapter),new RegExp('ASURA:'+error));
});
test('Asura malformed, partial and empty responses never become empty successes',async()=>{
  for(const data of [{},{data:[]},{data:null,meta:{total:2,per_page:20}},{data:[],meta:{total:2,has_more:true}}])
    await assert.rejects((await runtime([JSON.stringify(data)])).plugin.getPopular(1),/ASURA:/);
  for(const body of ['<html>Unavailable</html>',reader.replace('"pages":[1,[[0,','"pages":[1,[[9,')])
    await assert.rejects((await runtime([body])).plugin.getPageList(chapter),/ASURA:(structure|response)/);
});
test('Asura access, CF and rate limit remain distinct; retry is fresh and has no cached failure',async()=>{
  for(const [statusCode,body,headers,code] of [[403,'challenge',{'cf-mitigated':'challenge'},'verification'],[200,'<title>Just a moment</title>',{},'verification'],[429,'limited',{},'rate-limit'],[403,'denied',{},'access']]){
    const {plugin,requests}=await runtime([{statusCode,body,headers}]);await assert.rejects(plugin.getDetail(book),new RegExp('ASURA:'+code));assert.equal(requests.length,1);
  }
  const {plugin,requests}=await runtime([{statusCode:503,body:'unavailable'},detail]);await assert.rejects(plugin.getDetail(book),/ASURA:http/);assert.equal((await plugin.getDetail(book)).chapters.length,3);assert.equal(requests.length,2);
});
test('Asura invalid page and filter input fails before network access',async()=>{
  const {plugin,requests}=await runtime([]);await assert.rejects(plugin.getPopular(0),/ASURA:page/);
  const filters=plugin.getFilterList();filters[6].state='-1';assert.throws(()=>plugin.search('',1,filters),/ASURA:filter/);
  assert.equal(requests.length,0);
});

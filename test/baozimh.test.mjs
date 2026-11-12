import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin='https://cn.baozimh.com',book=origin+'/comic/fixture',chapter=origin+'/user/page_direct?comic_id=fixture&section_slot=0&chapter_slot=0';
const [detail,reader]=await Promise.all(['detail','reader'].map(n=>readFile(new URL('./fixtures/baozimh-'+n+'.html',import.meta.url),'utf8')));
const shortDetail=await readFile(new URL('./fixtures/baozimh-short-detail.html',import.meta.url),'utf8');
const last=reader.replace('0_0.html','0_0_2.html').replace('(1/2)','(2/2)').replace('0_0_2.html">下一页','0_1.html">下一话');
const list=JSON.stringify({items:[{comic_id:'fixture',name:'漫画🌊',topic_img:'book.jpg'}],next:'/api/bzmhq/amp_comic_list?page=2'});
const runtime=responses=>mockPlugin('baozimh',(_,n)=>{const r=responses[n-1];assert.ok(r,'unexpected request');return typeof r==='string'?{statusCode:200,body:r}:r;});
test('Baozi classification pagination and filters use source values without input caps',async()=>{
 const {plugin,requests}=await runtime([list,JSON.stringify({items:[]})]);const result=await plugin.getPopular(1);assert.equal(result.list[0].link,book);assert.equal(result.list[0].imageUrl,'https://static-tw.baozimh.com/cover/book.jpg');assert.equal(result.hasNextPage,true);
 const filters=plugin.getFilterList();filters[1].state=2;filters[2].state=2;filters[3].state=11;filters[4].state=4;
 assert.equal((await plugin.search('',501,filters)).list.length,0);assert.deepEqual(Object.fromEntries(new URL(requests[1].url).searchParams),{type:'mouxian',region:'jp',state:'pub',filter:'MNOP',page:'501',limit:'36',language:'cn'});assert.equal(plugin.getFilterList()[1].state,0);
 for(const data of [{items:null},{items:[{name:'lost'}],next:''}]) await assert.rejects((await runtime([JSON.stringify(data)])).plugin.getPopular(1),/BAOZI:/);
});
test('Baozi HTML search preserves Unicode, ignores templates and recognizes explicit empty results',async()=>{
 const html='<html><body>相近搜索结果(1)<div class="comics-card"><a class="comics-card__poster" href="/comic/fixture"><amp-img src="//cdn.example.test/book.jpg"></amp-img></a><div class="comics-card__title">漫画🌊</div></div><div class="comics-card"><div class="comics-card__title">{{name}}</div></div></body></html>';
 const {plugin,requests}=await runtime([html,'<html><body>相近搜索结果(0)</body></html>',html]);assert.equal((await plugin.search('漫画 & + 🌊',1)).list.length,1);assert.equal(new URL(requests[0].url).searchParams.get('q'),'漫画 & + 🌊');assert.equal((await plugin.search('none',1)).list.length,0);assert.equal((await plugin.getLatestUpdates(1)).hasNextPage,false);assert.equal((await plugin.getLatestUpdates(2)).list.length,0);
 await assert.rejects((await runtime(['<html><body>Unavailable</body></html>'])).plugin.search('x',1),/BAOZI:list/);
});
test('Baozi complete hidden catalog keeps special chapters, URL identity and only known dates',async()=>{
 const {plugin}=await runtime([detail]);const result=await plugin.getDetail(book);assert.equal(result.name,'漫画🌊');assert.equal(result.status,0);assert.equal(result.chapters.length,3);assert.deepEqual(Array.from(result.chapters,c=>c.dateUpload),[String(Date.UTC(2024,1,28,16)),'','']);assert.match(result.chapters[0].url,/edition=extra$/);assert.equal(result.chapters[0].name,result.chapters[1].name);
 assert.ok(result.chapters.every(c=>c.url.startsWith(origin+'/')));
 assert.equal((await (await runtime([detail])).plugin.getDetail(origin+'/comic/old-alias')).chapters.length,3);
 for(const [body,code] of [[detail.replace('chapter_slot=2','comic_id=foreign&chapter_slot=2'),'chapter-owner'],[detail.replace('chapter_slot=3','chapter_slot=4'),'catalog'],[detail.replace('2024年02月29日','2023年02月29日'),null],[detail.replace('简介 &amp; Story','章节数据缺少，进行屏蔽处理'),'access']]) {const ext=(await runtime([body])).plugin;if(code)await assert.rejects(ext.getDetail(book),new RegExp('BAOZI:'+code));else assert.equal((await ext.getDetail(book)).chapters[0].dateUpload,'');}
 await assert.rejects((await runtime([detail])).plugin.getDetail(origin+'/comic/foreign'),/BAOZI:identity/);
});
test('Baozi collects all reader parts, preserves duplicate slots and stops before next chapter',async()=>{
 for(const url of [chapter,origin+'/comic/chapter/fixture/0_0.html','https://cn.twbzmg.com/comic/chapter/fixture/0_0.html']) {
  const {plugin,requests}=await runtime([reader,last]);const pages=await plugin.getPageList(url);assert.equal(pages.length,4);assert.equal(pages[0].url,pages[2].url);assert.equal(pages[1].url,'http://new-cdn.example.test/arbitrary/two.webp');assert.equal(pages[0].headers.Referer,origin+'/');assert.equal(requests[0].url,'https://tw.twbzmg.com/comic/chapter/fixture/0_0.html');assert.equal(requests[1].url,'https://tw.twbzmg.com/comic/chapter/fixture/0_0_2.html');
 }
 assert.equal((await (await runtime([reader,last])).plugin.getPageList(chapter.replace('comic_id=fixture','comic_id=old-alias'))).length,4);
});
test('Baozi latest-only short catalogs retain newest-first order and never replace a missing full catalog',async()=>{
 const result=await (await runtime([shortDetail])).plugin.getDetail(book);
 assert.deepEqual(Array.from(result.chapters,c=>c.name),['第2话','第1话','序章']);
 assert.deepEqual(Array.from(result.chapters,c=>c.dateUpload),[String(Date.UTC(2024,1,28,16)),'','']);
 const button='<button id="button_show_all_chatper">查看全部3章节</button>';
 assert.equal((await (await runtime([detail.replace('</body>',button+'</body>')])).plugin.getDetail(book)).chapters.length,3);
 for(const body of [shortDetail.replace('</body>',button+'</body>'),shortDetail.replace('</body>','<div id="chapter-items"></div></body>'),detail.replace('</body>',button.replace('全部3','全部4')+'</body>'),shortDetail.replace('chapter_slot=2','chapter_slot=4')]) await assert.rejects((await runtime([body])).plugin.getDetail(book),/BAOZI:catalog/);
 await assert.rejects((await runtime([shortDetail.replace('comic_id=fixture','comic_id=foreign')])).plugin.getDetail(book),/BAOZI:chapter-owner/);
});
test('Baozi reader rejects missing, repeated, foreign parts and invalid image protocols without returning partial pages',async()=>{
 for(const body of [last.replace('(2/2)','(1/2)'),last.replace('0_0_2.html','0_1_2.html'),last.replaceAll('/fixture','/foreign')]) await assert.rejects((await runtime([reader,body])).plugin.getPageList(chapter),/BAOZI:(pagination|chapter-owner)/);
 for(const [body,code] of [[reader.replace('0_0_2.html">下一页','0_1.html">下一页'),'pagination'],[reader.replace('//cdn.example.test/one.jpg?signature=fixture','data:image/png;base64,fixture'),'url']])await assert.rejects((await runtime([body])).plugin.getPageList(chapter),new RegExp('BAOZI:'+code));
});
test('Baozi verification, blocked work and HTTP failure stay distinct; retry re-fetches every reader part',async()=>{
 for(const [statusCode,body,headers,code] of [[403,'{"error":"challenge_required"}',{},'verification'],[403,'blocked',{'x-gatekeeper-challenge':'required'},'verification'],[200,'<title>Just a moment</title>',{},'verification'],[429,'limited',{},'rate-limit'],[403,'denied',{},'access']])await assert.rejects((await runtime([{statusCode,body,headers}])).plugin.getPopular(1),new RegExp('BAOZI:'+code));
 const {plugin,requests}=await runtime([reader,{statusCode:503,body:'down'},reader,last]);await assert.rejects(plugin.getPageList(chapter),/BAOZI:http/);assert.equal((await plugin.getPageList(chapter)).length,4);assert.equal(requests.length,4);
});
test('Baozi selects a reachable source CDN with HEAD and retries selection on the next chapter load',async()=>{
 const body=reader.replace('<div class="title">第0话(1/2)</div>','').replace('0_0_2.html">下一页','0_1.html">下一话').replace('//cdn.example.test/one.jpg?signature=fixture','//s2.bzcdn.net/arbitrary/new/path.jpg?signature=fixture');
 let reachable='s1-dpa1-cnhk.bzcdn.net';
 const {plugin,requests}=await mockPlugin('baozimh',request=>{
  if(request.method==='GET')return {statusCode:200,body};
  assert.equal(request.method,'HEAD');const host=new URL(request.url).host;
  if(host===reachable)return {statusCode:200,headers:{'Content-Type':'image/jpeg'},body:''};
  if(host==='s1-rsa1-usla.bzcdn.net')throw Error('TLS connection failed');
  return {statusCode:200,headers:{'content-type':'text/html'},body:''};
 });
 const pages=await plugin.getPageList(chapter);assert.equal(pages[0].url,'https://s2-dpa1-cnhk.bzcdn.net/arbitrary/new/path.jpg?signature=fixture');assert.equal(pages[1].url,'http://new-cdn.example.test/arbitrary/two.webp');assert.equal(requests.filter(r=>r.method==='HEAD').length,3);
 reachable='s1-rsa1-usla.bzcdn.net';assert.match((await plugin.getPageList(chapter))[0].url,/s2-rsa1-usla/);assert.equal(requests.filter(r=>r.method==='HEAD').length,4);
 reachable='';assert.equal((await plugin.getPageList(chapter))[0].url,'https://s2.bzcdn.net/arbitrary/new/path.jpg?signature=fixture');assert.equal(requests.filter(r=>r.method==='HEAD').length,9);
});

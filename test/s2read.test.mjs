import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const detail=await readFile(new URL('./fixtures/s2read-detail.html',import.meta.url),'utf8');
const pages=await readFile(new URL('./fixtures/s2read-pages.html',import.meta.url),'utf8');
const variants=await readFile(new URL('./fixtures/s2read-chapter-variants.html',import.meta.url),'utf8');
function card(id) {return `<div class="c-tabs-item__content"><div class="post-title"><a href="https://s2read.com/manga/book-${id}/">Book ${id}</a></div><div class="tab-thumb"><img src="https://cdn-1.s2read.com/cover-${id}.jpg"></div></div>`;}
function runtime(body,statusCode=200,globals={}) {
 return mockPlugin('s2read',()=>({statusCode,body,headers:{}}),globals);
}
test('HTML search uses one bounded read-only form request and preserves pagination',async()=>{
 const {plugin,requests}=await runtime(Array.from({length:12},(_,i)=>card(i)).join(''));
 const first=await plugin.search('comic & +',2);assert.equal(first.list.length,12);assert.equal(first.hasNextPage,true);
 assert.equal(requests.length,1);assert.equal(requests[0].method,'POST');assert.equal(requests[0].body['vars[s]'],'comic & +');assert.equal(requests[0].body.page,'1');
 const last=await runtime(card(1)+'<div class="no-posts"></div>');assert.equal((await last.plugin.search('x',1)).hasNextPage,false);
 const empty=await runtime('');assert.equal((await empty.plugin.search('x',1)).list.length,0);
});
test('malformed, truncated, duplicate and challenge fragments do not become empty results',async()=>{
 for(const body of ['0','<html>challenge</html>','<script>run()</script>',card(1),card(1)+card(1)+'<div class="no-posts"></div>',card(1).replace('s2read.com/manga','s2read.com.evil.test/manga')+'<div class="no-posts"></div>']) {
  const {plugin}=await runtime(body);await assert.rejects(plugin.search('x',1));
 }
 const {plugin}=await runtime('limited',429);await assert.rejects(plugin.getPopular(1),/频繁/);
});
test('a missing optional cover preserves a valid search result; foreign covers still fail',async()=>{
 const body=card(1).replace(/<img[^>]+>/,'')+'<div class="no-posts"></div>';
 const {plugin}=await runtime(body);const result=await plugin.search('Soul',1);
 assert.equal(result.list.length,1);assert.equal(result.list[0].imageUrl,'');
 const foreign=await runtime(card(1).replace('cdn-1.s2read.com','foreign.test')+'<div class="no-posts"></div>');
 await assert.rejects(foreign.plugin.search('Soul',1));
 const broken=await runtime(pages.replace(/src="[^"]+"/g,'src=""'));
 await assert.rejects(broken.plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/'));
});
test('complete static catalog preserves zero and decimal chapters and validates work ownership',async()=>{
 const {plugin}=await runtime(detail);const result=await plugin.getDetail('https://s2read.com/manga/fixture/');
 assert.equal(result.name,'测试漫画 🌊');assert.deepEqual(Array.from(result.chapters,e=>e.name),['Chapter 0','Chapter 0.5']);
 for(const broken of [detail.replaceAll('/manga/fixture/','/manga/other/'),detail.replace('listing-chapters_wrap','unloaded'),detail.replace('<ul>','<div id="manga-chapters-holder"></div><ul>')]) {
  const {plugin}=await runtime(broken);await assert.rejects(plugin.getDetail('https://s2read.com/manga/fixture/'));
 }
});
test('chapter navigation, page order and duplicate image slots are preserved',async()=>{
 const {plugin}=await runtime(pages);const result=await plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/');
 assert.equal(result.length,2);assert.equal(result[0].url,result[1].url);assert.equal(result[0].headers.Referer,'https://s2read.com/');
 for(const broken of [pages.replace('image-1','image-3'),pages.replace('cdn-1.s2read.com','foreign.test')]) {
  const {plugin}=await runtime(broken);await assert.rejects(plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/'));
 }
});
test('real-site chapter slug variants and repeated links retain distinct page identities',async()=>{
 const {plugin}=await runtime(variants);
 const result=await plugin.getDetail('https://s2read.com/manga/fixture/');
 assert.deepEqual(Array.from(result.chapters,c=>c.url.split('/').at(-2)),['chapter-116_1','chapter-116-1','chapter-45.5']);
 for(const chapter of ['chapter-45.5','chapter-64.20','chapter-116_1']) {
  const {plugin}=await runtime(pages.replaceAll('chapter-0',chapter));
  assert.equal((await plugin.getPageList('https://s2read.com/manga/fixture/'+chapter+'/')).length,2);
 }
});
test('chapter deduplication never hides foreign works or unsafe path variants',async()=>{
 const foreign=await runtime(variants.replace('/manga/fixture/chapter-116-1/','/manga/other/chapter-116-1/'));
 await assert.rejects(foreign.plugin.getDetail('https://s2read.com/manga/fixture/'),/S2:chapter-owner/);
 for(const suffix of ['../','%2e%2e/','chapter-1%2fother/','chapter-1/extra/','chapter-1/?redirect=https://foreign.test/']) {
  const r=await runtime(variants.replace('chapter-45.5/',suffix));
  await assert.rejects(r.plugin.getDetail('https://s2read.com/manga/fixture/'),/S2:chapter-url/);
 }
 const otherHost=await runtime(variants.replace('https://s2read.com/manga','https://s2read.com.evil.test/manga'));
 await assert.rejects(otherHost.plugin.getDetail('https://s2read.com/manga/fixture/'),/S2:work-url/);
 const wrongNavigation=await runtime(pages.replace('value="chapter-0"','value="chapter-0.5"'));
 await assert.rejects(wrongNavigation.plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/'),/S2:chapter-navigation/);
});
test('verified image hosts normalize the legacy HTTP CDN without accepting other origins',async()=>{
 for(const origin of ['https://s2read.com','https://cdn.s2read.com','http://cdn.s2read.com','https://cdn-1.s2read.com','https://cdn2.s2read.com','https://vps1.s2read.com']) {
  const {plugin}=await runtime(pages.replaceAll('https://cdn-1.s2read.com/page.jpg',origin+'/page%20one.jpg?size=full&v=1'));
  const result=await plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/');
  assert.equal(result.length,2);
  assert.deepEqual(Array.from(result,p=>p.url),Array(2).fill(origin.replace('http:','https:')+'/page%20one.jpg?size=full&v=1'));
  assert.equal(result[0].headers.Referer,'https://s2read.com/');
  const cover=await runtime(card(1).replace('https://cdn-1.s2read.com',origin)+'<div class="no-posts"></div>');
  assert.equal((await cover.plugin.search('x',1)).list[0].imageUrl,origin.replace('http:','https:')+'/cover-1.jpg');
 }
 for(const origin of ['https://cdn2.s2read.com.evil.test','https://vps1.s2read.com@evil.test','https://evil.test','https://unknown.s2read.com','http://cdn.s2read.com.evil.test','http://cdn.s2read.com@evil.test','http://cdn-1.s2read.com','https://cdn.s2read.com:444','//cdn.s2read.com','file://cdn.s2read.com']) {
  const {plugin}=await runtime(pages.replaceAll('https://cdn-1.s2read.com',origin));
  await assert.rejects(plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/'),/S2:image-url/);
 }
});
test('a verified chapter with no image slots is reported as empty source content',async()=>{
 const {plugin}=await runtime(pages.replace(/<div class="page-break">.*?<\/div>/g,''));
 await assert.rejects(plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/'),/S2:chapter-empty/);
});
test('chapter dates preserve local calendar days and resolve relative times once per response',async()=>{
 const now=Date.UTC(2026,10,4,12), Clock=class extends Date {static now(){return now;}};
 const html=await readFile(new URL('./fixtures/s2read-dates.html',import.meta.url),'utf8');
 const {plugin}=await runtime(html,200,{Date:Clock});
 const result=await plugin.getDetail('https://s2read.com/manga/fixture/');
 assert.equal(result.chapters.length,10);
 assert.deepEqual(Array.from(result.chapters,c=>c.dateUpload),[
  String(new Date(2026,10,4).getTime()),String(new Date(2024,1,29).getTime()),
  String(now-2*86400000),String(now-3*3600000),String(now-45*60000),String(now-8000),
  '','','',String(now-604800000)
 ]);
});
test('unknown or invalid dates stay unknown without shifting another chapter date',async()=>{
 for(const text of ['February 29, 2023','April 31, 2024','November 0, 2026','Other 4, 2026','1000000000 days ago','']) {
  const html=detail.replace('</a></li>',`</a><span class="chapter-release-date"><i>${text}</i></span></li>`);
  const {plugin}=await runtime(html);
  const result=await plugin.getDetail('https://s2read.com/manga/fixture/');
  assert.deepEqual(Array.from(result.chapters,c=>c.dateUpload),['','']);
 }
});

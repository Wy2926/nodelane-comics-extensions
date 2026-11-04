import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPlugin} from '../scripts/runtime.mjs';
const detail=await readFile(new URL('./fixtures/s2read-detail.html',import.meta.url),'utf8');
const pages=await readFile(new URL('./fixtures/s2read-pages.html',import.meta.url),'utf8');
function card(id) {return `<div class="c-tabs-item__content"><div class="post-title"><a href="https://s2read.com/manga/book-${id}/">Book ${id}</a></div><div class="tab-thumb"><img src="https://cdn-1.s2read.com/cover-${id}.jpg"></div></div>`;}
async function runtime(body,statusCode=200) {
 const requests=[]; const plugin=await loadPlugin('s2read', class {
  async get(url,headers) {requests.push({url,headers});return {statusCode,body,headers:{}};}
  async post(url,headers,data) {requests.push({url,headers,data});return {statusCode,body,headers:{}};}
 });return {plugin,requests};
}
test('HTML search uses one bounded read-only form request and preserves pagination',async()=>{
 const {plugin,requests}=await runtime(Array.from({length:12},(_,i)=>card(i)).join(''));
 const first=await plugin.search('comic & +',2);assert.equal(first.list.length,12);assert.equal(first.hasNextPage,true);
 assert.equal(requests.length,1);assert.equal(requests[0].data['vars[s]'],'comic & +');assert.equal(requests[0].data.page,'1');
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
 for(const broken of [pages.replace('image-1','image-3'),pages.replace('value="chapter-0"','value="chapter-1"'),pages.replace('cdn-1.s2read.com','foreign.test')]) {
  const {plugin}=await runtime(broken);await assert.rejects(plugin.getPageList('https://s2read.com/manga/fixture/chapter-0/'));
 }
});

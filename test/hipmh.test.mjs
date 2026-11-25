import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
import {runPage} from './helpers/webview-page.mjs';

const home = 'https://m.hipmh.com', reader = 'https://reader.hipmh.top', mid = 'bTo0Mg';
const hid = 'bTo0Mi1jOjc-NDI6MC41MA', chapter = reader + '/chapter/' + hid;
const ok = data => ({statusCode:200, body:JSON.stringify({code:200, data})});
const rawReader = await readFile(new URL('./fixtures/hipmh-reader.html', import.meta.url), 'utf8');
const book = {id:42, title:'星海', total_chapters:2};
const first = {hid, title:'番外'}, second = {...first, hid:'bTo0Mi1jOjg-NDI6Mi4wMA'};
const part = (page, item) => ({page, total_pages:2, total:2, items:[item]});

test('lists use source sorting and filter values and distinguish no hits from failed requests', async () => {
  const {plugin, requests} = await mockPlugin('hipmh', ({url}) => {
    const q = new URL(url);
    if (q.searchParams.has('q')) return ok({page:1, total:0, total_pages:1, data:[]});
    return ok({page:1, total:1, total_pages:1, items:[{mid:mid+'-alias', title:'星海', vertical_image_url:'//other.test/cover'}]});
  });
  await plugin.getPopular(1); await plugin.getLatestUpdates(1);
  const filters = plugin.getFilterList();
  filters.forEach(f => { f.state = 1; });
  const result = await plugin.search('', 1, filters);
  assert.equal(result.list[0].link, home + '/works/' + mid);
  assert.equal(result.list[0].imageUrl, 'https://other.test/cover');
  assert.deepEqual(requests.slice(0,2).map(r=>new URL(r.url).searchParams.get('sort')), ['popular','updated']);
  assert.deepEqual(Object.fromEntries(new URL(requests[2].url).searchParams), {
    sort:'updated', category:'2', status:'ongoing', genre:'67', page:'1', per_page:'18'});
  assert.equal((await plugin.search('无结果',1,filters)).list.length, 0);
  assert.equal(new URL(requests[3].url).searchParams.has('genre'), false);
  for (const [response, error] of [
    [{statusCode:200,body:'<html>oops</html>'}, /JSON/],
    [{statusCode:403,headers:{'cf-mitigated':'challenge'}}, /验证/],
    [{statusCode:403}, /拒绝访问/],
    [{statusCode:404}, /源站找不到该内容（404）/],
    [ok({page:1,total:1,total_pages:1,data:[]}), /总数/],
  ]) {
    const {plugin} = await mockPlugin('hipmh', () => response);
    await assert.rejects(plugin.search('星',1), error);
  }
});

test('failed or misbound later catalog pages never return a partial directory; retry starts at page one', async () => {
  let later = {statusCode:429};
  const {plugin, requests} = await mockPlugin('hipmh', ({url}) => {
    const q = new URL(url);
    assert.equal(q.searchParams.get('mid'), mid);
    if (q.pathname === '/v1/manga') return ok(book);
    assert.equal(q.pathname, '/v1/manga/chapters');
    return q.searchParams.get('page') === '1' ? ok(part(1, first)) : later;
  });
  const detail = () => plugin.getDetail(home + '/zh/works/' + mid + '-star');
  await assert.rejects(detail(), /限流/);
  later = ok(part(2, {...second, hid:'bTo0My1jOjc-NDI6MC41MA'}));
  await assert.rejects(detail(), /不属于/);
  later = ok(part(1, first)); await assert.rejects(detail(), /分页/);
  later = ok(part(2, first)); await assert.rejects(detail(), /不完整/);
  later = ok(part(2, second));
  const result = await detail();
  assert.deepEqual(Array.from(result.chapters, c=>[c.name,c.url]), [
    ['番外',chapter], ['番外',reader+'/chapter/'+second.hid]]);
  assert.deepEqual(requests.slice(-2).map(r=>new URL(r.url).searchParams.get('page')), ['1','2']);
});

test('reader rejects a foreign chapter, placeholders, partial counts and broken slots; retry uses a fresh page', async () => {
  let html;
  const {plugin} = await mockPlugin('hipmh', () => assert.fail('unexpected HTTP request'), {
    evaluateJavascriptViaWebview:(url, _, [script]) => runPage(script, {url, html, wait:true}),
  });
  for (const [input,error] of [
    [rawReader.replace(hid,second.hid), /章节不符/],
    [rawReader.replace('data-total-images="3"', 'data-total-images="4"'), /页数/],
    [rawReader.replace('data-index="1"', 'data-index="0"'), /页位/],
    [rawReader.replace('data-src="//example.test', 'data-src="data:image/png,'), /图片协议/],
    [rawReader.replace('data-total-images="3"',''), /超时/],
    ['<div id="chapcontent"><div class="chapter-error-container" data-state="unavailable"></div></div>', /下架/],
  ]) {
    html = input; await assert.rejects(plugin.getPageList(chapter),error);
  }
  html = rawReader;
  assert.equal((await plugin.getPageList(chapter)).length, 3);
});

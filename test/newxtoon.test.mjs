import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin = 'https://newxtoon5.com', book = origin + '/comics/42', chapter = book + '/chapters/10';
const [list, detail, reader, first, last] = await Promise.all(
  ['list.html','detail.html','reader.html','chapters-1.json','chapters-2.json']
    .map(name => readFile(new URL('./fixtures/newxtoon-' + name, import.meta.url), 'utf8')));
const runtime = responses => mockPlugin('newxtoon', (_, n) => {
  const response = responses[n - 1];
  assert.ok(response, 'unexpected request');
  return typeof response === 'string' ? {statusCode:200, body:response} : response;
});
const listing = list.replace('/search"', '/comics"').replace('search-result-title', 'comic-list-title')
  .replace('/search?q=%EB%A7%88%EB%B2%95%20%26%20%2B&amp;', '/comics?sort=popular&amp;');
test('New XTOON lists exclude advertisements, deduplicate works, encode search and expose category', async () => {
  const {plugin, requests} = await runtime([listing, list, listing, listing]);
  const result = await plugin.getPopular(1);
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].link, book);
  assert.equal(result.list[0].imageUrl, 'https://cdn.example.test/cover.webp');
  assert.equal(result.hasNextPage, true);
  assert.equal((await plugin.search('마법 & +', 1)).list[0].name, '마법 🌊');
  assert.equal(new URL(requests[1].url).searchParams.get('q'), '마법 & +');
  const filters = plugin.getFilterList(); filters[0].state = 2;
  await plugin.search('', 1, filters);
  assert.equal(new URL(requests[2].url).searchParams.get('category'), '성인');
  await plugin.getLatestUpdates(1);
  assert.equal(new URL(requests[3].url).searchParams.get('sort'), 'latest');
});
test('New XTOON distinguishes empty search, last page, malformed lists and wrong pagination', async () => {
  const empty = '<html><link rel="canonical" href="' + origin + '/search"><input id="page-search" value="none"><h1 id="search-result-title">검색 결과 <span>0</span></h1></html>';
  assert.equal((await (await runtime([empty])).plugin.search('none', 1)).list.length, 0);
  const end = list.replace(/<a aria-label="다음 페이지"[\s\S]*?<\/a>/, '').replace('page">1', 'page">2');
  assert.equal((await (await runtime([end])).plugin.search('마법 & +', 2)).hasNextPage, false);
  for (const body of [empty.replace('>0<', '>9<'), list.replace('page">1', 'page">2'), list.replace('page=2', 'page=1'), list.replace('마법 &amp; +', 'other')])
    await assert.rejects((await runtime([body])).plugin.search('마법 & +', 1), /NX:(listing|pagination|identity)/);
});
test('New XTOON fetches the full catalog, validates ownership before deduplication, preserves dates and special chapters', async () => {
  const {plugin, requests} = await runtime([detail, first, last]);
  const result = await plugin.getDetail(book);
  assert.equal(result.name, '마법 🌊');
  assert.equal(result.author, '작가, 그림');
  assert.equal(result.status, 0);
  assert.deepEqual(Array.from(result.chapters, c => c.name), ['1.5화','1.5화','0화']);
  assert.deepEqual(Array.from(result.chapters, c => c.dateUpload), [String(Date.UTC(2024, 1, 29)), '', '']);
  assert.equal(result.chapters[0].url, book + '/chapters/12?edition=extra');
  assert.equal(requests[2].url, book + '/chapters?sort=latest&page=2');
  assert.equal(requests[1].headers['X-Requested-With'], 'XMLHttpRequest');
  for (const change of [
    {html:JSON.parse(first).html.replace('https://newxtoon5.com/comics/42', 'https://newxtoon5.com/comics/99')},
    {total:4}, {current_page:2}, {next_page:1}, {chapters:[]}, {last_page:1}, {html:''},
  ]) await assert.rejects((await runtime([detail, JSON.stringify({...JSON.parse(first), ...change})])).plugin.getDetail(book), /NX:(catalog|pagination|chapter-owner)/);
  await assert.rejects((await runtime([detail, first, last.replace('"id":10', '"id":99')])).plugin.getDetail(book), /NX:chapter-owner/);
  await assert.rejects((await runtime([detail, first, JSON.stringify({...JSON.parse(last), chapters:[], html:''})])).plugin.getDetail(book), /NX:catalog/);
});
test('New XTOON preserves image slots and CDN URLs but rejects foreign chapters, gaps, missing pages and unsafe protocols', async () => {
  const result = await (await runtime([reader])).plugin.getPageList(chapter);
  assert.equal(result.length, 3);
  assert.equal(result[0].url, result[1].url);
  assert.equal(result[0].headers.Referer, origin + '/');
  assert.equal(result[2].url, 'http://another-cdn.example.test/any/path.webp');
  for (const [body, error] of [
    [reader.replace('href="/comics/42"', 'href="/comics/99"'), 'chapter-owner'],
    [reader.replace('data-reader-chapter-id="10"', 'data-reader-chapter-id="11"'), 'chapter-owner'],
    [reader.replace('position="2"', 'position="4"'), 'page-order'],
    [reader.replace('//cdn.example.test/page.webp?size=full&amp;v=1', 'javascript:alert(1)'), 'url'],
    [reader.replaceAll('data-reader-image', 'data-ad-image'), 'pages'],
    [reader.replace('</html>', ''), 'structure'],
  ]) await assert.rejects((await runtime([body])).plugin.getPageList(chapter), new RegExp('NX:' + error));
});
test('New XTOON failed catalog requests return no partial data and retry starts from the first page', async () => {
  const {plugin, requests} = await runtime([detail, first, {statusCode:503, body:'down'}, detail, first, last]);
  await assert.rejects(plugin.getDetail(book), /NX:http/);
  assert.equal((await plugin.getDetail(book)).chapters.length, 3);
  assert.equal(requests.length, 6);
  for (const [statusCode, body, code] of [[200,'<title>Just a moment</title>','verification'],[429,'limited','rate-limit'],[403,'denied','access']])
    await assert.rejects((await runtime([{statusCode, body}])).plugin.getPopular(1), new RegExp('NX:' + code));
  await assert.rejects((await runtime([detail, '<html>Login</html>'])).plugin.getDetail(book), /NX:response/);
});

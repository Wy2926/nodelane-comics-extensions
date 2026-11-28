import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {mockPlugin} from './helpers/runtime.mjs';

const origin = 'https://mangapill.com', book = origin + '/manga/42/sky', chapter = origin + '/chapters/42-10/first';
const [list, detail, reader] = await Promise.all(['search','detail','reader'].map(name =>
  readFile(new URL(`./fixtures/mangapill-${name}.html`, import.meta.url), 'utf8')));
const run = (...bodies) => mockPlugin('mangapill', (_, n) => {
  const body = bodies[n-1]; assert.ok(body, 'unexpected request');
  return typeof body === 'string' ? {statusCode:200, body} : body;
});

test('browser entry reads the pressed card or chapter owner without the provider or any network', async () => {
  const {plugin} = await run();
  function preview(html, url, selector) {
    const {document} = parseHTML(html);
    Object.defineProperty(document, 'baseURI', {value:origin + '/'});
    const anchor = selector ? document.querySelector(selector) : null;
    return vm.runInNewContext(`({${plugin.browserMangaPreview}}).browserMangaPreview({document,url,anchor})`,
      {document, url, anchor, URL});
  }
  const other = '<div><a href="/manga/99/other"><div class="line-clamp-2">Other</div></a></div>';
  const card = preview(list.replace('<div><a href=', other + '<div><a href='), book, 'a[href="/manga/42/sky"]');
  assert.equal(card.name, 'Sky & Sea');
  assert.equal(card.imageUrl, 'https://covers.example.test/sky');
  const featured = `<div class="featured-grid"><div><a href="${chapter}"><img src="/sky.jpg"></a>
    <a href="${chapter}">#0</a><a href="${book}"><div class="line-clamp-2">Sky</div></a></div></div>`;
  const latest = preview(featured, chapter, 'a');
  assert.deepEqual([latest.name,latest.link,latest.chapterName,latest.imageUrl], ['Sky',book,'#0',origin+'/sky.jpg']);
  const ch = preview(detail, chapter, 'a[href="/chapters/42-10/first"]');
  assert.deepEqual([ch.link,ch.chapterName,ch.status], [book,'Chapter 0',1]);
  const page = preview(reader.replace('<img src="/banner">','<h1>Sky &amp; Sea Group 2 Chapter 0</h1>'), chapter);
  assert.deepEqual([page.name,page.link,page.chapterName], ['Sky & Sea',origin+'/manga/42','Group 2 Chapter 0']);
  assert.equal(preview(detail, origin+'/search?q=sky'), null);
  assert.equal(await plugin.resolveBrowserManga(origin+'/account'), null);
});

test('MangaPill uses the directional pager, not arbitrary buttons; preserves repeated genre filters', async () => {
  const previous = /<a class="btn btn-sm" href="\/search[^<]+<\/a>/;
  const first = list.replace(previous, '<a href="/search?page=2&amp;genre=Action&amp;type=manga&amp;q=Sky%20%26%20Sea&amp;genre=Isekai">Next</a>');
  const {plugin, requests} = await run(first, list, first.replace('page=2','page=3'));
  const filters = plugin.getFilterList();
  filters[0].state = 1;
  for (const g of filters[2].state) g.state = ['Action','Isekai'].includes(g.name);
  assert.equal((await plugin.search('Sky & Sea', 1, filters)).hasNextPage, true);
  assert.deepEqual(new URL(requests[0].url).searchParams.getAll('genre'), ['Action','Isekai']);
  assert.equal((await plugin.search('Sky & Sea', 2)).hasNextPage, false);
  await assert.rejects(plugin.search('Sky & Sea', 1, filters), /翻页/);
});

test('MangaPill binds full chapter identities before deduplication and refuses incomplete readers', async () => {
  const {plugin} = await run(detail, detail.replace('/42-20','/99-20'), reader.replace('page 2/2','page 2/3'),
    reader.replace('42-10/first','42-22/extra'), {statusCode:429,body:'limited'}, reader);
  const result = await plugin.getDetail(book);
  assert.equal(result.link, book);
  assert.deepEqual(Array.from(result.chapters, c => [c.name,c.url]), [['Extra',origin+'/chapters/42-21/extra?edition=second'],
    ['Extra',origin+'/chapters/42-20/extra'],['Chapter 0',chapter]]);
  await assert.rejects(plugin.getDetail(book), /归属/);
  await assert.rejects(plugin.getPageList(chapter), /页序或总数/);
  await assert.rejects(plugin.getPageList(chapter), /章节不符/);
  await assert.rejects(plugin.getPageList(chapter), /限流/);
  const pages = await plugin.getPageList(chapter);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].url, pages[1].url);
});

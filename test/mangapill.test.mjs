import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';

const origin = 'https://mangapill.com', book = origin + '/manga/42/sky', chapter = origin + '/chapters/42-10/first';
const [list, detail, reader] = await Promise.all(['search','detail','reader'].map(name =>
  readFile(new URL(`./fixtures/mangapill-${name}.html`, import.meta.url), 'utf8')));
const run = (...bodies) => mockPlugin('mangapill', (_, n) => {
  const body = bodies[n-1]; assert.ok(body, 'unexpected request');
  return typeof body === 'string' ? {statusCode:200, body} : body;
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

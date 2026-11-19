import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';

const [listing, detail, first, last, reader] = await Promise.all(
  ['list','detail','chapters-1','chapters-2','pages'].map(async name =>
    JSON.parse(await readFile(new URL('./fixtures/omegascans-' + name + '.json', import.meta.url), 'utf8'))));
const origin = 'https://omegascans.org', api = 'https://api.omegascans.org', series = origin + '/series/paper-moon';
const book = series + '#42', chapter = series + '/chapter-1-5#103';
const runtime = (responses, paid = false) => mockPlugin('omegascans', (_, n) => {
  const result = responses[n - 1];
  assert.ok(result, 'unexpected request');
  return result.statusCode ? result : {statusCode:200, body:JSON.stringify(result)};
}, {SharedPreferences:class { get(key) { assert.equal(key, 'pref_show_paid_chap'); return paid; } }});

test('Omega sorting, tag IDs and keyword survive search; only confirmed end/empty lists succeed', async () => {
  const page2 = {...listing, meta:{current_page:2, last_page:3, total:26}};
  const empty = {data:[], meta:{current_page:1, last_page:1, total:0}};
  const {plugin, requests} = await runtime([page2, listing, listing, empty, {...empty, meta:listing.meta}]);
  assert.equal((await plugin.getPopular(2)).hasNextPage, true);
  await plugin.getLatestUpdates(1);
  const filters = plugin.getFilterList();
  filters[0].state = 4;
  filters[1].state = {index:0, ascending:true};
  filters[2].state[0].state = filters[2].state[2].state = true;
  const result = await plugin.search(' 星 & + ', 1, filters);
  assert.equal(result.list[0].link, book);
  assert.equal(result.list[0].imageUrl, api + '/covers/moon.jpg');
  assert.equal(result.list[1].imageUrl, '');
  assert.equal(result.hasNextPage, false);
  const urls = requests.map(r => new URL(r.url));
  assert.equal(urls[0].searchParams.get('orderBy'), 'total_views');
  assert.equal(urls[1].searchParams.get('orderBy'), 'latest');
  assert.deepEqual(Object.fromEntries(urls[2].searchParams), {query_string:'星 & +', status:'Completed', order:'asc',
    orderBy:'title', series_type:'Comic', page:'1', perPage:'12', tags_ids:'[2,1]', adult:'true'});
  assert.equal((await plugin.search('none', 1)).list.length, 0);
  await assert.rejects(plugin.search('broken', 1), /Omega:pagination/);
});

test('Omega checks all pages before filtering paid/future chapters and uses numeric IDs for the format badge', async () => {
  const data = [detail, {...listing, data:[...listing.data].reverse()}, first, last];
  const {plugin, requests} = await runtime(data);
  const result = await plugin.getDetail(series + '?edition=main#42');
  assert.equal(requests[0].url, api + '/series/paper-moon?edition=main');
  assert.equal(result.link, series + '?edition=main#42');
  assert.equal(requests[3].url, api + '/chapter/query?page=2&perPage=1000&series_id=42');
  assert.deepEqual(Array.from(result.genre), ['Drama','Doujinshi']);
  assert.match(result.description, /Paper & ink\.\n\nSecond paragraph\./);
  assert.match(result.description, /Updates: Fri/);
  assert.deepEqual(Array.from(result.chapters, c => [c.name,c.url,c.dateUpload]), [
    ['Chapter 1.5',chapter,String(Date.parse('2024-02-29T08:15:00.123Z'))],
    ['Chapter 1.5',series + '/extra#102',''],
  ]);
  const paid = await (await runtime(data, true)).plugin.getDetail(series);
  assert.equal(paid.chapters[0].name, 'Special - Preview 🔒');
  assert.equal(paid.chapters.length, 3);
});

test('Omega partial, repeated or foreign chapters fail, including duplicate rows; a retry starts over', async () => {
  const data = [detail, listing, first];
  const {plugin, requests} = await runtime([...data, {statusCode:503,body:'unavailable'}, ...data, last]);
  await assert.rejects(plugin.getDetail(book), /Omega:http/);
  assert.equal((await plugin.getDetail(book)).chapters.length, 2);
  assert.deepEqual(requests.slice(0,4).map(r => r.url), requests.slice(4).map(r => r.url));
  for (const [bad, error] of [
    [{...last, meta:first.meta}, 'pagination'],
    [{...last, meta:{...last.meta,total:5}}, 'catalog'],
    [{...last, data:last.data.slice(0,1)}, 'catalog'],
    [{...last, data:[{...last.data[0],series:{id:81,series_slug:'other'}}, ...last.data.slice(1)]}, 'owner'],
  ]) await assert.rejects((await runtime([...data, bad])).plugin.getDetail(book), new RegExp('Omega:' + error));
  await assert.rejects((await runtime([detail])).plugin.getDetail(series + '#81'), /Omega:identity/);
  const zero = await runtime([{...detail, badge:'Manga',meta:{chapters_count:'0'}}, {data:[],meta:{current_page:1,last_page:1,total:0}}]);
  assert.equal((await zero.plugin.getDetail(book)).chapters.length, 0);
});

test('Omega refuses wrong readers, incomplete pages and access errors without leaking responses', async () => {
  for (const [change, error] of [
    [{id:99}, 'owner'], [{chapter_slug:'extra'}, 'owner'], [{series:{id:42,series_slug:'another'}}, 'owner'],
    [{chapter_data:{images:[]}}, 'pages'], [{chapter_data:{images:['/ok.jpg','']}}, 'image'],
    [{chapter_data:{images:['file:///a.jpg']}}, 'image'],
  ]) await assert.rejects((await runtime([{chapter:{...reader.chapter,...change}}])).plugin.getPageList(chapter), new RegExp('Omega:' + error));
  const {plugin, requests} = await runtime([]);
  await assert.rejects(plugin.getPageList(chapter.replace('omegascans.org','elsewhere.test')), /Omega:url/);
  assert.equal(requests.length, 0);
  for (const [statusCode, body, headers, code] of [
    [429,'private',{},'rate-limit'], [403,'private',{},'access'], [403,'private',{'Cf-Mitigated':'challenge'},'verification'],
    [200,'<title>Just a moment...</title>',{},'verification'], [200,'private',{},'response'],
  ]) await assert.rejects((await runtime([{statusCode,body,headers}])).plugin.getPopular(1),
    e => e.message.includes('Omega:' + code) && !e.message.includes('private'));
});

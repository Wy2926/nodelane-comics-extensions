import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';

const origin = 'https://www.00jf.com', book = origin + '/comic_42.html', chapter = origin + '/chapter_42_2.html';
const [search,detail,reader] = await Promise.all(['search','detail','reader'].map(name=>
  readFile(new URL(`./fixtures/jf00-${name}.html`,import.meta.url),'utf8')));
const run = (...rows) => mockPlugin('jf00',(_,n) => {
  const body = rows[n-1]; assert.ok(body,'unexpected request');
  return typeof body === 'string' ? {statusCode:200,body} : body;
});

test('漫画猫 encodes the keyword in subsequent page paths and binds the pager to the source count', async () => {
  const query = '星 & 海+';
  const page2 = search.replaceAll('/search/星海','/search/' + encodeURIComponent(query) + '/2')
    .replaceAll('星海',query.replace('&','&amp;')).replace('共1部','共31部');
  const empty = search.replace('共1部','共0部').replace(/<div class="comic-item">.*?<\/div>/,'');
  const {plugin, requests} = await run(page2, empty, empty.replaceAll('星海','50%'),
    empty.replaceAll('星海','A B'), page2.replace('共31部','共32部'));
  assert.equal((await plugin.search(query,2)).hasNextPage,false);
  assert.equal(requests[0].url,origin+'/search/'+encodeURIComponent(query)+'/2');
  assert.equal((await plugin.search('星海',1)).list.length,0);
  assert.equal((await plugin.search('50%',1)).hasNextPage,false);
  assert.equal((await plugin.search('A+B',1)).hasNextPage,false);
  await assert.rejects(plugin.search(query,2),/分页或总数/);
});

test('漫画猫 preserves chapter identities and rejects truncated catalogs, paid chapters, wrong pages and HTTP failures', async () => {
  const {plugin} = await run(detail,detail.replace('/chapter_42_1','/chapter_41_1'),detail.replace('</html>',''),
    reader.replace('42,2,0,0','42,2,0,1'),reader.replace('第2张图','第3张图'),reader.replace('www.00jf.com/comic_42','www.00jf.com/comic_43'),
    {statusCode:429,body:'limited'},reader);
  assert.deepEqual(Array.from((await plugin.getDetail(book)).chapters,c=>[c.name,c.url]),[
    ['番外',origin+'/chapter_42_3.html'],['番外',chapter+'?part=1'],['第0话',origin+'/chapter_42_1.html']]);
  await assert.rejects(plugin.getDetail(book),/归属/);
  await assert.rejects(plugin.getDetail(book),/不完整/);
  for(const err of [/登录或付费/,/页序/,/归属/,/限流/]) await assert.rejects(plugin.getPageList(chapter),err);
  assert.equal((await plugin.getPageList(chapter)).length,2);
});

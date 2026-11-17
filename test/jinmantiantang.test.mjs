import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash, createDecipheriv} from 'node:crypto';
import {mockPlugin} from './helpers/runtime.mjs';
const [encrypted, album, pages] = await Promise.all(['list','album','pages'].map(async name =>
  JSON.parse(await readFile(new URL('./fixtures/jinmantiantang-' + name + '.json', import.meta.url), 'utf8'))));
const origin = 'https://18comic.vip', book = origin + '/album/500000/', chapter = origin + '/photo/500001?album_id=500000';
const md5 = text => createHash('md5').update(text).digest('hex');
const globals = {
  Date:class extends Date { static now() { return 1800000000000; } },
  md5,
  decryptAESECB(data, key) {
    const cipher = createDecipheriv('aes-' + key.length * 4 + '-ecb', Buffer.from(key, 'hex'), null);
    return Buffer.concat([cipher.update(data, 'base64'), cipher.final()]).toString('utf8');
  },
};
const runtime = responses => mockPlugin('jinmantiantang', (_, n) => {
  const response = responses[n - 1]; assert.ok(response, 'unexpected request');
  if (response instanceof Error) throw response;
  return response.statusCode ? response : {statusCode:200, body:JSON.stringify(response)};
}, globals);
const changed = (fixture, patch) => ({...fixture, data:{...fixture.data, ...patch}});
test('JM decodes encrypted UTF-8 responses, signs requests and keeps keyword/sort pagination', async () => {
  const {plugin, requests} = await runtime([encrypted, encrypted, encrypted]);
  const first = await plugin.search('fixture & +', 1);
  assert.equal(first.list[0].name, 'Fixture & 测试 🌊');
  assert.equal(first.list[0].link, book);
  assert.equal(first.hasNextPage, false);
  const url = new URL(requests[0].url);
  assert.equal(url.searchParams.get('search_query'), 'fixture & +');
  assert.equal(requests[0].headers.Token, '8cfb3f3e758920f655c817f7882c9548');
  assert.equal(requests[0].headers.Tokenparam, '1800000000,2.1.12');
  const filters = plugin.getFilterList(); filters[0].state = 2;
  await plugin.search('', 2, filters);
  assert.equal(new URL(requests[1].url).searchParams.get('o'), 'tf');
  assert.equal(new URL(requests[1].url).searchParams.get('page'), '2');
  await plugin.getLatestUpdates(1);
  assert.equal(new URL(requests[2].url).searchParams.get('o'), 'mr');
  const list = {code:200,data:{total:81,content:Array.from({length:80}, (_,i)=>({id:String(i+1),name:'Fixture'}))}};
  const paged = (await runtime([list, changed(list,{content:[{id:'81',name:'Last'}]})])).plugin;
  assert.equal((await paged.getPopular(1)).hasNextPage, true);
  assert.equal((await paged.getPopular(2)).hasNextPage, false);
});
test('JM confirms missing ID and empty searches, resolves chapter IDs once, and rejects malformed lists', async () => {
  const {plugin, requests} = await runtime([{code:200,data:[]}, {code:200,data:{total:0,content:[]}},
    changed(album,{id:500001}), album]);
  assert.equal((await plugin.search('JM:999',1)).list.length, 0);
  assert.equal((await plugin.search('none',1)).list.length, 0);
  assert.equal((await plugin.search('JM500001',1)).list[0].link, book);
  assert.equal((await plugin.search('JM500001',2)).list.length, 0);
  assert.equal(requests.length, 4);
  for (const data of [{}, {total:80,content:[]}, {total:0,content:[{id:'1'}]}])
    await assert.rejects((await runtime([{code:200,data}])).plugin.getPopular(1), /JM:(listing|response)/);
  await assert.rejects((await runtime([changed(album,{series_id:'500001'}), changed(album,{id:500001,series_id:'500000'})])).plugin.search('500000',1), /JM:identity/);
});
test('JM preserves full catalog order, special names, identity and source date semantics', async () => {
  const {plugin} = await runtime([album, changed(album,{series:[],series_id:'0',addtime:'bad'})]);
  const detail = await plugin.getDetail(book);
  assert.equal(detail.name, 'Fixture & 测试 🌊');
  assert.deepEqual(Array.from(detail.chapters,c=>c.name), ['1.5话','序章']);
  assert.deepEqual(Array.from(detail.chapters,c=>c.dateUpload), ['1699963200000','']);
  assert.equal(detail.chapters[1].url, chapter);
  assert.equal((await plugin.getDetail(book)).chapters[0].dateUpload, '');
  for (const patch of [{id:500003},{series_id:'500003'},{series:null},{series:[album.data.series[0],album.data.series[0]]}])
    await assert.rejects((await runtime([changed(album,patch)])).plugin.getDetail(book), /JM:(identity|catalog)/);
});
test('JM binds pages to both identities, keeps duplicate slots and computes every strip regime without CDN restrictions', async () => {
  const {plugin} = await runtime([pages]);
  const result = await plugin.getPageList(chapter);
  assert.equal(result.length, 3);
  assert.equal(result[0].url, result[1].url);
  assert.equal(result[2].url, pages.data.images[2].image);
  assert.equal(result[0].imageProcessing.rows, 2 * (md5('50000100001').slice(-1).charCodeAt(0) % 8) + 2);
  assert.equal(result[0].imageProcessing.skipGif, true);
  for (const [id, expected] of [[200000,null],[220980,10],[300000,2*(md5('30000000001').slice(-1).charCodeAt(0)%10)+2]]) {
    const p = await (await runtime([changed(pages,{id,series_id:String(id)})])).plugin.getPageList(origin+'/photo/'+id+'?album_id='+id);
    assert.equal(p[0].imageProcessing?.rows ?? null, expected);
  }
  for (const patch of [{id:500003},{series_id:'500003'},{total_page:4},{scramble_id:null},
    {images:pages.data.images.map((v,i)=>({...v,page:i}))},
    {images:pages.data.images.map(v=>({...v,image:'javascript:bad'}))}])
    await assert.rejects((await runtime([changed(pages,patch)])).plugin.getPageList(chapter), /JM:(chapter-owner|pages|image-protocol|page-order|image-url)/);
  await assert.rejects((await runtime([])).plugin.getPageList(origin+'/photo/500001'), /JM:chapter-owner/);
});
test('JM separates access, throttling, decoding and transport failures; retry and instances retain no partial state', async () => {
  const {plugin} = await runtime([{statusCode:503,body:'Unavailable'}, album]);
  await assert.rejects(plugin.getDetail(book), /JM:http/);
  assert.equal((await plugin.getDetail(book)).chapters.length, 2);
  for (const [response, code] of [
    [{statusCode:403,body:'denied'}, 'access'], [{statusCode:429,body:'limited'}, 'rate-limit'],
    [{statusCode:403,body:'<title>Just a moment</title>'}, 'verification'],
    [{code:401}, 'access'], [{code:500}, 'api'], [{code:200,data:'not encrypted'}, 'decode'],
    [new Error('private response and URL'), 'network'],
  ]) await assert.rejects((await runtime([response])).plugin.getPopular(1), new RegExp('JM:'+code));
  assert.equal((await (await runtime([album])).plugin.getDetail(book)).chapters.length, 2);
});

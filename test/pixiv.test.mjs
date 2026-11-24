import test from 'node:test';
import assert from 'node:assert/strict';
import {mockPlugin} from './helpers/runtime.mjs';

const origin = 'https://www.pixiv.net', book = origin + '/user/30/series/12', art = origin + '/artworks/81';
const ok = body => ({statusCode:200, body:JSON.stringify({error:false, body})});
const work = {id:'81', userId:'30', title:'Sky', illustType:0, pageCount:2};
const part = (ids, total = 2) => ({illustSeries:[{id:'12',userId:'30',title:'Sky'}],
  page:{seriesId:12,total,series:ids.map(workId => ({workId}))},
  thumbnails:{illust:ids.map(id => ({...work,id}))}});
const runtime = (...responses) => mockPlugin('pixiv', (_, n) => { assert.ok(responses[n-1], 'unexpected request'); return responses[n-1]; });

test('Pixiv rejects incomplete rankings and uses the site pagination', async () => {
  const {plugin,requests} = await runtime(ok({ranking:[{illustId:'81'},{illustId:'82'},{illustId:'83'}]}),
    ok({illust_details:[]}),
    ok({ranking:[]}), ok({lastPage:10,illusts:[{type:'1',id:'81',title:'New'}]}));
  await assert.rejects(plugin.getPopular(2),/榜单作品资料不完整/);
  assert.equal((await plugin.getPopular(3)).hasNextPage,false);
  assert.equal((await plugin.getLatestUpdates(9)).hasNextPage,true);
  assert.equal(new URL(requests[0].url).searchParams.get('page'),'2');
  assert.deepEqual(new URL(requests[1].url).searchParams.getAll('illust_ids[]'),['81','82','83']);
  assert.equal(new URL(requests[3].url).pathname,'/touch/ajax/latest');
});

test('Pixiv keeps a standalone illustration and rejects mismatched or incomplete reader responses', async () => {
  const {plugin} = await runtime(ok(work));
  const detail = await plugin.getDetail(origin + '/en/artworks/81?utm_source=share');
  assert.equal(detail.link,art);
  assert.equal(detail.chapters[0].url,art);
  const bound = art + '#series=12&user=30';
  for (const [url,responses,error] of [
    [art,[ok({...work,id:'80'})],/投稿与请求/],
    [bound,[ok({...work,seriesNavData:{seriesId:'13'}})],/当前系列/],
    [art,[ok({...work,illustType:2})],/动图/],
    [art,[ok({...work,isLoginOnly:true})],/受限/],
    [art,[ok(work),ok([{urls:{original:'https://example.test/1'}}])],/页数/],
    [art,[ok({...work,pageCount:1}),ok([{urls:{regular:'https://example.test/preview'}}])],/图片地址/],
  ]) await assert.rejects((await runtime(...responses)).plugin.getPageList(url),error);
});

test('Pixiv series never returns partial data; retry starts with page one', async () => {
  const first = part(['81']), last = part(['80']);
  for (const [page,error] of [[part([]),/提前结束/],[first,/分页重复/],[part(['80'],1),/已变化/],
    [{...last,thumbnails:{illust:[{...work,id:'80',userId:'31'}]}},/归属/]]) {
    await assert.rejects((await runtime(ok(first),ok(page))).plugin.getDetail(book),error);
  }
  const {plugin,requests} = await runtime(ok(first),{statusCode:429},ok(first),ok(last));
  await assert.rejects(plugin.getDetail(book),/频繁/);
  const detail = await plugin.getDetail(book);
  assert.deepEqual(Array.from(detail.chapters,c=>c.url),[art+'#series=12&user=30',origin+'/artworks/80#series=12&user=30']);
  assert.deepEqual(requests.map(r=>new URL(r.url).searchParams.get('p')),['1','2','1','2']);
});

test('Pixiv retries a login-only work in the current site session without plugin credentials', async () => {
  const source = {...work, isLoginOnly:true, urls:{original:'https://images.example.test/page-1'}};
  const pages = [{urls:source.urls},{urls:{original:'https://images.example.test/page-2'}}];
  const {plugin,requests} = await runtime({statusCode:401},ok(source),ok(source),ok(pages));
  await assert.rejects(plugin.search(art,1),/浏览器登录/);
  assert.equal((await plugin.search(art,1)).list[0].link,art);
  const result = await plugin.getPageList(art);
  assert.deepEqual(Array.from(result,p=>p.url),pages.map(p=>p.urls.original));
  assert.ok([...requests,...result].every(r=>!Object.keys(r.headers).some(k=>/^(authorization|cookie)$/i.test(k))));
});

test('Pixiv distinguishes a genuine empty search from blocked or broken responses', async () => {
  assert.equal((await (await runtime(ok({illusts:[],lastPage:1,total:0}))).plugin.search('absent',1)).list.length,0);
  for (const [response,error] of [[{statusCode:200,body:'{"error":true}'},/核对可见性/],
    [{statusCode:200,body:'{}'},/数据不完整/],[ok({}),/列表缺失/],
    [{statusCode:403,headers:{'cf-mitigated':'challenge'},body:''},/验证/],
    [{statusCode:403,body:'Forbidden'},/拒绝访问/],[{statusCode:200,body:'<html>bad</html>'},/JSON/]]) {
    await assert.rejects((await runtime(response)).plugin.search('absent',1),error);
  }
});

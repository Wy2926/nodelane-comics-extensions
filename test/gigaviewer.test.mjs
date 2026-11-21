import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';

const fixture = name => readFile(new URL('./fixtures/gigaviewer-'+name,import.meta.url),'utf8');
const series = JSON.parse(await fixture('series.json')).data.series;
const book = 'https://comic-seasons.com/series/'+series.databaseId+'/first_episode';
const reader = await fixture('reader.html'), url = 'https://feelweb.jp/episode/300#series='+series.databaseId;
const row = (id,kind='episode',gone=false) => ({title:'番外',viewer_uri:`/${kind}/${id}`,readable_product_id:id,
  purchase_info:{can_read:!gone,unavailable:gone}});
const response = value => ({statusCode:200,body:typeof value==='string' ? value : JSON.stringify(value)});

test('catalog checks every page before filtering, keeps distinct types, and retries from the beginning', async () => {
  let next, hideGone = false;
  const {plugin} = await mockPlugin('comicseasons',({url,body})=>{
    if (body) { assert.equal(body.variables.id,series.databaseId); return response({data:{series}}); }
    const q = new URL(url).searchParams;
    assert.equal(q.get('aggregate_id'),series.databaseId);
    return response(q.get('type')==='volume' ? [row('300','volume')] :
      q.get('offset')==='0' ? [row('302','episode',true)] : next);
  },{SharedPreferences:class { get(k) { return hideGone && k==='hide_unavailable'; } }});
  for (next of [[],[row('302','episode',true)],[row('300','volume')]]) {
    await assert.rejects(plugin.getDetail(book),/目录分页|归属/);
  }
  next=[row('300')];
  assert.deepEqual(Array.from((await plugin.getDetail(book)).chapters,c=>[c.name,c.url.split('.com/')[1]]),[
    ['🔒 番外','episode/302#series='+series.databaseId],['番外','episode/300#series='+series.databaseId],
    ['(Volume) 番外','volume/300#series='+series.databaseId]]);
  hideGone=true;
  assert.equal((await plugin.getDetail(book)).chapters.length,2);
});

test('reader binds chapter and series, respects unavailable pages and never returns unknown image encodings', async () => {
  let raw=reader;
  const {plugin} = await mockPlugin('feelweb',()=>response(raw));
  await assert.rejects(plugin.getPageList(url.replace('300#','301#')),/归属/);
  await assert.rejects(plugin.getPageList(url+'1'),/归属/);
  raw=reader.replace('"pageStructure":{','"pageStructure":null,"unused":{');
  await assert.rejects(plugin.getPageList(url),/购买|停止公开/);
  raw=reader.replace('"baku"','"unknown"');
  await assert.rejects(plugin.getPageList(url),/分块协议/);
  raw=reader;
  const result=await plugin.getPageList(url);
  assert.deepEqual(JSON.parse(JSON.stringify(result[0].imageProcessing)),{type:'tile-transpose-v1',grid:4,alignment:8});
  assert.equal(result[1].url,result[0].url);
  raw=reader.replace('"baku"','"usagi"');
  assert.equal((await plugin.getPageList(url))[0].imageProcessing,undefined);
});

test('search follows opaque cursors, isolates keywords, and distinguishes empty results, limits and verification', async () => {
  const card={...series,firstEpisode:{permalink:'/episode/300'}};
  let failure, cursors=[];
  const {plugin}=await mockPlugin('shonenjumpplus',({body})=>{
    if (failure) return failure;
    const {q,after}=body.variables; cursors.push([q,after]);
    return response({data:{searchSeries:{edges:q==='none' ? [] : [{node:card}],
      pageInfo:{hasNextPage:!after && q!=='none',endCursor:'next+/='}}}});
  });
  assert.equal((await plugin.search('空',2)).list[0].name,'空の旅');
  assert.deepEqual(cursors,[['空',null],['空','next+/=']]);
  assert.equal((await plugin.search('none',1)).list.length,0);
  for (const [r,err] of [[{statusCode:429},/限流/],[{statusCode:403,headers:{'cf-mitigated':'challenge'}},/验证/],
    [response({data:{searchSeries:null},errors:[{}]}),/查询失败/]]) {
    failure=r; await assert.rejects(plugin.search('空',1),err);
  }
  failure=null; assert.equal((await plugin.search('空',1)).hasNextPage,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {mockPlugin} from './helpers/runtime.mjs';

const origin = 'https://batcave.biz', path = '/42-sky-/-sea.html', book = origin + path, chapter = origin + '/reader/42/71?edition=one';
const [detail, reader] = await Promise.all(['detail','reader'].map(type =>
  readFile(new URL(`./fixtures/batcave-${type}.html`, import.meta.url), 'utf8')));
const card = `<div class="readed"><a href="${path}"><img data-src="/art/cover"></a>
  <h2 class="readed__title"><a href="${book}">Sky &amp; Sea</a></h2><a href="${chapter}">Read</a></div>`;
const run = (...responses) => mockPlugin('batcave', (_,n) => {
  const res = responses[n-1]; assert.ok(res, 'unexpected request');
  return typeof res === 'string' ? {statusCode:200,body:res} : res;
});

test('detached browser preview binds the pressed card and the current reader to the same work', async () => {
  const {plugin} = await run();
  function preview(html, page, target = page, selector) {
    const {document} = parseHTML(html);
    Object.defineProperties(document, {baseURI:{value:page}, URL:{value:page}});
    return vm.runInNewContext(`({${plugin.browserMangaPreview}}).browserMangaPreview({document,url,anchor})`,
      {document, url:target, anchor:selector ? document.querySelector(selector) : null, URL});
  }
  const page = origin + '/search/sky/', two = card.replaceAll('42-', '900-').replace('Sky &amp; Sea','Other') + card;
  const hit = preview(two,page,book,`a[href="${path}"]`);
  assert.deepEqual([hit.name, hit.link, hit.imageUrl], ['Sky & Sea',book,origin+'/art/cover']);
  assert.equal(preview(card,page,chapter,'a:last-child')?.link, book);
  assert.equal(preview(detail,book).link, book);
  assert.equal(preview(detail,book,chapter,'main > a').chapterName, 'Annual');
  assert.equal(preview(reader,chapter).link, book);
  assert.equal(preview(reader.replace('42-sky','99-sky'),chapter), null);
  assert.equal(preview('<h1>Checking your browser</h1>',book), null);
  assert.equal(preview(card,page), null);
  assert.equal(await plugin.resolveBrowserManga(origin+'/search/sky/'), null);
  assert.equal(await plugin.resolveBrowserManga('https://other.example.test'+path), null);
});

test('ranked POST, latest and escaped keyword searches only follow their own next page', async () => {
  const query = 'Sky & Sea', search = '/search/Sky%20%26%20Sea/';
  const listing = (p) => `<html><body><main>${card}<div class="pagination__pages"><a href="${p}">2</a></div></main></body></html>`;
  const latest = `<div id="content-load">${card.replace('class="readed"','class="latest grid-item"').replace('readed__title','latest__title')}</div>`;
  const {plugin,requests} = await run(listing('/comix/page/2/'), latest, listing(search+'page/2/'), listing(search),
    '<main><div class="message-info">Your query found 0 answers:</div></main>', '<main></main>',
    {statusCode:403, body:'<title>Just a moment...</title>'}, {statusCode:429, body:''});
  assert.equal((await plugin.getPopular(1)).hasNextPage, true);
  assert.deepEqual([requests[0].method,requests[0].body.dlenewssortby], ['POST','rating']);
  assert.equal((await plugin.getLatestUpdates(2)).list[0].link,book);
  assert.equal(requests[1].url, origin+'/page/2/');
  const first = await plugin.search(query,1);
  assert.deepEqual([first.hasNextPage,first.list[0].name], [true,'Sky & Sea']);
  assert.equal((await plugin.search(query,2)).hasNextPage, false);
  assert.equal(requests[3].url,origin+search+'page/2/');
  assert.equal((await plugin.search('absent',1)).list.length, 0);
  await assert.rejects(plugin.search('absent',1), /空搜索结果/);
  await assert.rejects(plugin.getPopular(1), /验证/);
  await assert.rejects(plugin.getPopular(1), /限流/);
});

test('incomplete catalogs can be retried; missing or foreign pages never replace a complete chapter', async () => {
  const ajax = reader.replace(/"images":\[[^\]]+\]/,'"images":[]').replace('"rdr_ajax":false','"rdr_ajax":true');
  const reply = id => JSON.stringify({data:{chapter_id:id,images:['/first','https://other.example.test/last','/ad']}});
  const {plugin,requests} = await run(detail.replace('Chapters (3)','Chapters (4)'),detail,
    detail.replace('"news_id":42','"news_id":99'), reader.replace('"pages":"2"','"pages":"4"'),
    ajax,reply(70),ajax,reply(71));
  await assert.rejects(plugin.getDetail(book), /目录不完整/);
  const {chapters} = await plugin.getDetail(book);
  assert.deepEqual(Array.from(chapters,c=>c.name), ['Annual','Annual','Prologue };']);
  assert.equal(chapters[1].url, chapter);
  await assert.rejects(plugin.getDetail(book), /作品或章节不符/);
  await assert.rejects(plugin.getPageList(chapter), /页数不完整/);
  await assert.rejects(plugin.getPageList(chapter), /归属不符/);
  const pages = await plugin.getPageList(chapter);
  assert.deepEqual(Array.from(pages,p=>p.url), [origin+'/first','https://other.example.test/last']);
  const req = requests.at(-1);
  assert.deepEqual([req.method,req.body.news_id,req.body.chapter_id,req.headers.Referer],['POST','42','71',chapter]);
});

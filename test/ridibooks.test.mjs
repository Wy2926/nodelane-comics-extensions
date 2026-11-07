import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mockPlugin} from './helpers/runtime.mjs';
const origin = 'https://ridibooks.com', book = origin + '/books/100';
const chapter = origin + '/books/101/view#nodelane-ridibooks=100';
const fixtures = Object.fromEntries(await Promise.all(['detail.html','episodes.json','reader.html','pages.json','search.html','search.json'].map(async file =>
    [file, await readFile(new URL('./fixtures/ridibooks-' + file, import.meta.url), 'utf8')])));
const ok = body => ({statusCode: 200, body, headers: {}});
function runtime(responses) {
    return mockPlugin('ridibooks', (_, count) => {
        const response = responses[count - 1];
        assert.ok(response, 'unexpected request');
        if (response instanceof Error) throw response;
        return typeof response === 'string' ? ok(response) : response;
    });
}
function apiListing(path, page = 1, category = '1600') {
    const params = {adults_only:'0',category_includes:category,limit:'18',...(path === 'bestsellers' ? {period:'WEEKLY',only_rent_available:'0'} : {}),offset:String(page*18)};
    return JSON.stringify({success:true,data:{items:[{book:{book_id:'101',title:'章节',serial:{serial_id:'100',title:'作品'},adults_only:false,file:{comic:true}}}],
        pagination:{next_page:page === 1 ? '/v2/'+path+'?'+new URLSearchParams(params) : null}}});
}
test('RIDI popular/latest and category browsing preserve pagination conditions', async () => {
    const {plugin, requests} = await runtime([apiListing('bestsellers'),apiListing('new-releases',2),apiListing('bestsellers',1,'1500')]);
    assert.equal((await plugin.getPopular(1)).hasNextPage,true);
    assert.equal((await plugin.getLatestUpdates(2)).hasNextPage,false);
    const filters=plugin.getFilterList();filters[0].state=1;
    await plugin.search('',1,filters);
    assert.equal(new URL(requests[1].url).searchParams.get('offset'),'18');
    assert.equal(new URL(requests[2].url).searchParams.get('category_includes'),'1500');
    assert.equal(plugin.getFilterList()[0].state,0);
    await assert.rejects((await runtime([apiListing('bestsellers').replace('offset=18','offset=36')])).plugin.getPopular(1),/RIDI:pagination/);
    await assert.rejects((await runtime([apiListing('bestsellers').replace('bestsellers?','new-releases?')])).plugin.getPopular(1),/RIDI:pagination/);
});
test('RIDI search uses filtered GraphQL results rather than the unfiltered SSR list', async () => {
    const {plugin,requests}=await runtime([fixtures['search.html'],fixtures['search.json']]);
    const result=await plugin.search('漫画 & + 🌊',1);
    assert.equal(result.list[0].name,'契约漫画 🌊');assert.equal(result.list[0].link,book);assert.equal(result.hasNextPage,false);
    assert.equal(new URL(requests[0].url).searchParams.get('q'),'漫画 & + 🌊');
    const context=requests[1].body.variables.context;
    assert.equal(context.adultOption,'EXCLUDE_ADULT');assert.equal(context.parentTab,'WEBTOON');
    assert.equal(context.pageLimitInput.page,1);assert.equal(requests[1].headers['Content-Type'],'application/json');
    const empty=JSON.parse(fixtures['search.json']), response=empty.data.riGrid.cells.search.bookListWithTabCell;
    response.cell={aggregations:[{tab:'COMIC',docCount:0}],books:[]};
    response.context={adultOption:'EXCLUDE_ADULT',parentTab:'COMIC',keyword:['none'],pageLimitInput:{page:2,limit:24}};
    const next=await runtime([fixtures['search.html'],JSON.stringify(empty)]);const filters=next.plugin.getFilterList();filters[0].state=1;
    assert.equal((await next.plugin.search('none',2,filters)).list.length,0);
    assert.equal(next.requests[1].body.variables.context.parentTab,'COMIC');
    assert.equal(next.requests[1].body.variables.context.pageLimitInput.page,2);
    await assert.rejects((await runtime([fixtures['search.html'],fixtures['search.json'].replace('"webtoon"','"novel"')])).plugin.search('漫画 & + 🌊',1),/RIDI:search/);
    await assert.rejects((await runtime([fixtures['search.html'],fixtures['search.json']])).plugin.search('different',1),/RIDI:search-context/);
});
test('RIDI full catalog preserves same-name chapters, metadata and Korean dates', async () => {
    const {plugin,requests}=await runtime([fixtures['detail.html'],fixtures['episodes.json']]);
    const detail=await plugin.getDetail(book);
    assert.equal(detail.name,'契约漫画 🌊');assert.equal(detail.author,'作者');assert.equal(detail.artist,'画师');assert.equal(detail.status,1);
    assert.equal(detail.description,'合成简介 & 内容');assert.equal(detail.chapters.length,3);
    assert.equal(detail.chapters[0].url,chapter);assert.notEqual(detail.chapters[0].url,detail.chapters[1].url);
    assert.equal(detail.chapters[0].dateUpload,String(new Date(2024,2,3).getTime()));
    assert.equal(detail.chapters[1].dateUpload,'');assert.match(detail.chapters[1].scanlator,/阅读权限/);
    assert.equal(requests.length,2);assert.equal(requests[1].body.variables.context.pagination.offset,1);
});
test('RIDI rejects missing, foreign, duplicate, looping or failed catalog pages and can retry', async () => {
    const bad = [fixtures['episodes.json'].replace('"seriesId": "100"','"seriesId": "999"'),
        fixtures['episodes.json'].replace('"bookId": "103"','"bookId": "102"'),
        fixtures['episodes.json'].replace('"nextPage": null','"unknown": null')];
    for (const body of bad) await assert.rejects((await runtime([fixtures['detail.html'],body])).plugin.getDetail(book),/RIDI:/);
    await assert.rejects((await runtime([fixtures['detail.html'].replace('"offset": 1','"offset": 0')])).plugin.getDetail(book),/RIDI:pagination/);
    const {plugin,requests}=await runtime([fixtures['detail.html'],{statusCode:503,body:'unavailable'},fixtures['detail.html'],fixtures['episodes.json']]);
    await assert.rejects(plugin.getDetail(book),/RIDI:http/);
    assert.equal((await plugin.getDetail(book)).chapters.length,3);assert.equal(requests.length,4);
    await assert.rejects((await runtime([fixtures['detail.html'],JSON.stringify({errors:[{message:'private response must not leak'}]})])).plugin.getDetail(book),/RIDI:graphql/);
    const invalidDate=await (await runtime([fixtures['detail.html'],fixtures['episodes.json'].replace('2024.03.04','2024.02.31')])).plugin.getDetail(book);
    assert.equal(invalidDate.chapters[2].dateUpload,'');
});
test('RIDI explicitly empty series and single books remain distinct from incomplete catalogs', async () => {
    const data=JSON.parse(fixtures['detail.html'].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
    const cells=data.props.pageProps.sectionProps.gridQuery.riGrid.grid.cells;
    cells[0].cell__BookDetailHomeHeader.information.series.openedBookCount=0;
    cells[2].cell__BookDetailHomeEpisodeBookList.books=[];
    cells[2].cell__BookDetailHomeEpisodeBookList.pagination.nextPage=null;
    const html=()=>'<script id="__NEXT_DATA__">'+JSON.stringify(data)+'</script>';
    assert.equal((await (await runtime([html()])).plugin.getDetail(book)).chapters.length,0);
    cells[0].cell__BookDetailHomeHeader.information.series=null;
    const single=await (await runtime([html()])).plugin.getDetail(book);
    assert.equal(single.chapters.length,1);assert.equal(single.chapters[0].dateUpload,'');
    assert.equal(single.chapters[0].url,book+'/view#nodelane-ridibooks=100');
});
test('RIDI plain image pages retain repeat slots and request only the bound chapter', async () => {
    const {plugin,requests}=await runtime([fixtures['reader.html'],fixtures['pages.json']]);
    const pages=await plugin.getPageList(chapter);
    assert.equal(pages.length,2);assert.equal(pages[0].url,pages[1].url);
    assert.equal(pages[0].headers.Referer,origin+'/books/101/view');
    assert.equal(requests[1].body.book_id,'101');assert.equal(new URL(requests[0].url).hash,'');
    for (const body of [fixtures['pages.json'].replaceAll('/101/webtoon/','/102/webtoon/'),
        fixtures['pages.json'].replaceAll('webview-cache.ridibooks.com','webview-cache.ridibooks.com.evil.test'),
        fixtures['pages.json'].replace('"comic"','"epub"')])
        await assert.rejects((await runtime([fixtures['reader.html'],body])).plugin.getPageList(chapter),/RIDI:/);
    await assert.rejects((await runtime([fixtures['reader.html'].replace('"series_id": "100"','"series_id": "999"')])).plugin.getPageList(chapter),/RIDI:chapter-owner/);
});
test('RIDI access, verification and rate limits fail explicitly without preview or automatic retries', async () => {
    const blocked=fixtures['reader.html'].replace('rental_free','none');
    await assert.rejects((await runtime([blocked])).plugin.getPageList(chapter),/RIDI:access/);
    const retry=await runtime([new Error('timeout with private request details'),fixtures['reader.html'],fixtures['pages.json']]);
    await assert.rejects(retry.plugin.getPageList(chapter),e=>e.message.includes('RIDI:network')&&!e.message.includes('private'));
    assert.equal((await retry.plugin.getPageList(chapter)).length,2);assert.equal(retry.requests.length,3);
    for (const [statusCode,body,headers,code] of [[403,'challenge',{'cf-mitigated':'challenge'},'verification'],[429,'limited',{},'rate-limit'],[401,'login',{},'access']]) {
        const {plugin,requests}=await runtime([{statusCode,body,headers}]);
        await assert.rejects(plugin.getPopular(1),new RegExp('RIDI:'+code));assert.equal(requests.length,1);
    }
    const {plugin,requests}=await runtime([]);
    for (const url of [book.replace('ridibooks.com','ridibooks.com@foreign.test'),book+'#other']) await assert.rejects(plugin.getDetail(url),/RIDI:url/);
    await assert.rejects(plugin.getPageList(origin+'/books/101/view'),/RIDI:chapter-binding/);
    await assert.rejects(plugin.getPopular(1001),/RIDI:page/);
    await assert.rejects(plugin.search('',1,[{type:'category',type_name:'SelectFilter',state:2}]),/RIDI:filter/);
    assert.equal(requests.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPlugin} from '../scripts/runtime.mjs';
import {runPage} from './helpers/hachiraw-page.mjs';

const origin = 'https://hachiraw.net', work = origin + '/manga/sample-book';
const detail = await readFile(new URL('./fixtures/hachiraw-detail.html', import.meta.url), 'utf8');
const reader = await readFile(new URL('./fixtures/hachiraw-reader.html', import.meta.url), 'utf8');
function listing(total, page, query = 'search=sample') {
    const cards = Array.from({length: Math.max(0, Math.min(20, total - (page - 1) * 20))}, (_, i) => {
        const slug = 'sample-' + ((page - 1) * 20 + i);
        return `<div class="top-15" ng-repeat="Series in vm.Directory"><a class="SeriesName" href="/manga/${slug}"><img src="https://images.fixture.test/mangacover/${slug}.jpg"></a><a class="SeriesName" ng-bind-html="Series.s" href="/manga/${slug}">Sample ${i}</a></div>`;
    }).join('');
    return '<html><head><title>Search</title></head><body><div class="BoxHeader">Search Manga ( ' + total + ')</div>' + cards +
        (total > 20 ? `<ul class="pagination"><li class="active"><a href="#">${page}</a></li>` +
            (page > 1 ? '<a href="/list-manga" rel="prev" data-ci-pagination-page="1">Previous</a>' : '') +
            (page * 20 < total ? `<a href="/list-manga/${page + 1}?${query}" rel="next" data-ci-pagination-page="${page + 1}">Next</a>` : '') + '</ul>' : '') + '</body></html>';
}
async function runtime(options = {}) {
    const calls = [];
    const plugin = await loadPlugin('hachiraw', class { constructor() { throw Error('Use page transport'); } }, {
        evaluateJavascriptViaWebview: async (url, headers, scripts, time) => {
            assert.equal(time, 35); assert.equal(headers.Referer, origin + '/'); assert.equal(scripts.length, 1);
            calls.push(url);
            if ('raw' in options) return options.raw;
            const html = typeof options.html === 'function' ? options.html(new URL(url)) : options.html || detail;
            return runPage(scripts[0], {reader, url, ...options, html});
        },
    });
    return {plugin, calls};
}
test('Hachiraw keeps hidden/special chapters, dates and cover ownership', async () => {
    const {plugin} = await runtime({delayedBridge: true});
    const result = await plugin.getDetail(work);
    assert.equal(result.name, 'Sample & Book 🌊'); assert.equal(result.author, '作者 A');
    assert.match(result.imageUrl, /^https:\/\/cdn.hachiraw.net\//);
    assert.deepEqual(Array.from(result.chapters, c => c.url), ['chapter-92-fix','chapter-92','250-raw','chapter-1'].map(id => work + '/' + id));
    assert.deepEqual(Array.from(result.chapters, c => c.dateUpload), ['1791763200000','','','1791763200000']);
    assert.equal(result.link, work);
    for (const html of [detail.replace('sample-book.jpg','other.jpg'), detail.replace('chapter-92-fix','chapter-92'),
        detail.replace('/sample-book/chapter-92-fix','/other/chapter-92-fix'), detail.replace('</div><span class="chapter_more">','<a href="?page=2">Next</a></div><span class="chapter_more">')])
        await assert.rejects((await runtime({html})).plugin.getDetail(work), /Hachiraw/);
});
test('Hachiraw lists preserve query, sorting, pagination and explicit empty results', async () => {
    const {plugin, calls} = await runtime({html: url => listing(21, Number(url.pathname.split('/')[2] || 1), url.search.slice(1))});
    assert.equal((await plugin.search('sample', 1)).hasNextPage, true);
    assert.equal((await plugin.search('sample', 2)).list.length, 1);
    await plugin.getPopular(1); await plugin.getLatestUpdates(1);
    assert.equal(new URL(calls[2]).searchParams.get('order_by'), 'views');
    assert.equal(new URL(calls[3]).searchParams.get('order_by'), 'lastest');
    assert.equal((await (await runtime({html: listing(0, 1)})).plugin.search('none', 1)).list.length, 0);
    for (const html of [listing(21, 1).replace('search=sample','search=other'),listing(21, 1).replace('Search Manga','Unavailable'),
        listing(21, 1).replace('data-ci-pagination-page="2"','data-ci-pagination-page="3"'),listing(21, 1).replace('Search Manga ( 21)','Search Manga ( 20)')])
        await assert.rejects((await runtime({html})).plugin.search('sample', 1), /Hachiraw/);
});
test('Hachiraw page transport checks identity/count and retains duplicate page slots', async () => {
    const {plugin, calls} = await runtime();
    const pages = await plugin.getPageList(work + '/chapter-1');
    assert.equal(calls[0], work); assert.equal(pages.length, 2); assert.equal(pages[0].url, pages[1].url);
    assert.equal(pages[0].headers.Referer, origin + '/');
    assert.equal(pages[0].headers['User-Agent'], 'Fixture device WebView');
    for (const html of [reader.replace('Page 2','Page 3'), reader.replace('/chapter-1','/chapter-2'), reader.replace('data-original=','missing=')])
        await assert.rejects((await runtime({reader: html})).plugin.getPageList(work + '/chapter-1'), /Hachiraw/);
});
test('Hachiraw verification, timeout and fetch failures stay visible and can be retried', async () => {
    for (const options of [{raw:''},{raw:'invalid'},{challenge:true},{status:429},
        {html:'<html><head><title>Just a moment...</title></head></html>',wait:true}]) {
        const {plugin} = await runtime(options);
        await assert.rejects(plugin.getPageList(work + '/chapter-1'), /Hachiraw/);
    }
    const options = {status:503}; const {plugin} = await runtime(options);
    await assert.rejects(plugin.getPageList(work + '/chapter-1'), /HTTP 503/);
    options.status = 200; assert.equal((await plugin.getPageList(work + '/chapter-1')).length, 2);
    const {plugin: invalid, calls} = await runtime();
    for (const url of ['https://foreign.test/manga/a', '/manga/a', origin + '/manga/a%2Fb', work + '?x=1', origin + '/manga/..', origin + '/manga/%'])
        await assert.rejects(invalid.getDetail(url), /地址无效/);
    assert.equal(calls.length, 0);
});

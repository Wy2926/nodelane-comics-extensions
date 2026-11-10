import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {loadPlugin} from '../scripts/runtime.mjs';

// Synthetic public-bundle layout and API records; no website content or live keys.
function fixtureBundle(version = 'fixture') {
    const encode = text => Buffer.from(text).toString('base64').replace(/[a-zA-Z]/g,
        ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
    const table = ['kid', version, 'material', ...Array.from({length: 13}, (_, i) => 'unused' + i)].map(encode);
    const bytes = Array.from({length: 1088}, (_, i) => (i * 17 + 3) % 256);
    return 'const lookup=decode;function decode(n){n-=100;const table=values();}' +
        'function values(){const table=' + JSON.stringify(table) + ';}' +
        'const alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";' +
        'pool["chunk"]=' + JSON.stringify(bytes) + ';const a={};a.id="chunk";a["start"]=0;a["mask"]=0;a["enc"]=0;var descriptors=[a];' +
        'const m={};m[lookup(100)]=lookup(101),m[lookup(102)]=function(){const p=new Uint8Array(1088);};' +
        'globalThis.remoteExecuted=true;';
}
const html = '<script type="module" src="/assets/build/fixture/dist/main-fixture.js"></script>';
function json(result) { return new Response(JSON.stringify({status: 'ok', result})); }
function pagination(items, page = 1, total = items.length, perPage = 28) {
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    return {items, meta: {page, total, perPage, lastPage, hasNext: page < lastPage}};
}
const book = {id: 1, hid: 'test', title: '漫画🌊', url: '/title/test-fixture', contentRating: 'safe', poster: {medium: '/images/fixture.jpg'}};
const chapter = i => ({id: i + 1, mangaId: 1, number: i / 2, language: 'en',
    url: '/title/test-fixture/' + (i + 1) + '-chapter-' + (i / 2)});
function readyPage(url, {hasChapters = true, rows = true, scripts = html} = {}) {
    const hid = new URL(url).pathname.match(/^\/title\/([a-z0-9]+)-/)?.[1];
    const initial = hid ? {page: 'manga', queries: {[JSON.stringify(['manga', 'detail', hid])]: {...book, hid, hasChapters}}}
        : {page: 'browse', queries: {}};
    return '<html><head>' + scripts + '<script id="initial-data" type="application/json">' + JSON.stringify(initial) + '</script></head><body>' +
        (rows ? hid ? '<div class="mchap-row"><a href="' + chapter(0).url + '">Chapter</a></div>'
            : '<article><a href="' + book.url + '">Book</a></article>' : '') + '</body></html>';
}

async function runtime(respond, options = {}) {
    const sessions = [], requests = [];
    const plugin = await loadPlugin('comix', class { constructor() { throw Error('Ordinary HTTP must not be used'); } }, {
        ...(options.capabilities ? {NodeLane: {capabilities: options.capabilities}} : {}),
        evaluateJavascriptViaWebview: async (url, headers, scripts, timeout) => {
            const session = {url, headers, scripts, timeout, replies: [], disposed: false, polls: 0};
            sessions.push(session);
            if ('raw' in options) return options.raw;
            let resolve;
            const completed = new Promise(done => resolve = done);
            const timers = new Set();
            const {document} = parseHTML(options.html ?? readyPage(url, options));
            document.readyState = 'complete';
            let clock = Date.now();
            const context = vm.createContext({TextEncoder, TextDecoder, atob, btoa, AbortController, TypeError,
                Date: class extends Date { static now() { return clock; } },
                setTimeout: (fn, delay) => {
                    const timer = setTimeout(() => {
                        timers.delete(timer);
                        if (delay === 250) {
                            session.polls++;
                            clock += options.waitTimeout ? 60000 : delay;
                            options.onPoll?.({document, context, session, requests});
                        }
                        fn();
                    }, options.fastTimeout || delay === 250 ? 1 : delay);
                    timers.add(timer); return timer;
                }, clearTimeout: timer => { clearTimeout(timer); timers.delete(timer); },
                location: new URL(url), document,
                fetch: async (value, init) => {
                    assert.equal(session.disposed, false, 'no request after page release');
                    const target = new URL(value);
                    requests.push({url: target, init});
                    assert.equal(init.credentials, 'same-origin');
                    if (target.pathname.startsWith('/api/')) return respond(target, init);
                    if (target.pathname.includes('main-fixture')) return new Response('import "./apicore-fixture.js";');
                    if (target.pathname.includes('apicore-fixture')) return new Response(fixtureBundle(target.search ? 'fresh' : 'fixture'));
                    if (target.searchParams.has('nodelane_refresh')) return new Response(html);
                    throw Error('Unexpected page request');
                },
            });
            context.window = context;
            const bridge = {callHandler: async (name, value) => {
                assert.equal(name, 'setResponse');
                session.replies.push(value); resolve(value);
            }};
            const listeners = new Map();
            context.addEventListener = (event, callback, opts) => {
                if (!listeners.has(event)) listeners.set(event, new Map());
                listeners.get(event).set(callback, opts);
            };
            context.removeEventListener = (event, callback) => listeners.get(event)?.delete(callback);
            context.dispatchEvent = event => {
                for (const [callback, opts] of listeners.get(event.type) || []) {
                    if (opts?.once) listeners.get(event.type).delete(callback);
                    callback(event);
                }
            };
            if (!options.delayedBridge) context.flutter_inappwebview = bridge;
            options.onPage?.({document, context, session, requests});
            for (const script of scripts) {
                vm.runInContext(script, context);
                vm.runInContext(script, context); // duplicate onLoadStop, while the first batch is pending
            }
            if (options.delayedBridge) { context.flutter_inappwebview = bridge; context.dispatchEvent({type: 'flutterInAppWebViewPlatformReady'}); }
            try {
                const result = await completed;
                assert.equal(context.remoteExecuted, undefined, 'downloaded protocol source is data, never evaluated');
                assert.equal(timers.size, 0, 'request timers released before reporting');
                assert.equal(listeners.get('message')?.size, 0, 'verification listener released before reporting');
                return result;
            } finally { session.disposed = true; for (const timer of timers) clearTimeout(timer); }
        },
    });
    return {plugin, sessions, requests};
}

test('search runs only in one temporary page, signs special characters and waits for bridge readiness', async () => {
    const r = await runtime(() => json(pagination([book])), {delayedBridge: true});
    const result = await r.plugin.search(' 中文 & + 🌊 ', 1);
    assert.equal(result.list[0].name, book.title);
    assert.equal(result.hasNextPage, false);
    assert.equal(r.sessions.length, 1);
    assert.equal(r.sessions[0].url, 'https://comix.to/browse');
    assert.equal(r.sessions[0].timeout, 120);
    assert.equal(r.sessions[0].disposed, true);
    assert.equal(r.sessions[0].replies.length, 1);
    assert.equal(r.sessions[0].polls, 0, 'already usable pages do not sleep before requesting');
    assert.equal(r.requests.length, 3, 'uses loaded HTML, one main, one protocol, one API');
    const query = r.requests.at(-1).url.searchParams;
    assert.equal(query.get('keyword'), '中文 & + 🌊');
    assert.match(query.get('_'), /^fixture\.[\w-]{16}$/);
});

test('waits for Comix verification and own chapter rows, not load completion or a fixed delay', async () => {
    const r = await runtime(url => url.pathname.endsWith('/chapters') ? json(pagination([chapter(0)], 1, 1, 100)) : json(book), {
        rows: false,
        onPage: ({document}) => { document.body.innerHTML = '<div class="wafcap"><iframe src="/@waf/challenge"></iframe></div>'; },
        onPoll: ({document, context, session, requests}) => {
            assert.equal(requests.length, 0, 'no protocol or API requests while verification/content is pending');
            if (session.polls === 1) {
                context.dispatchEvent({type: 'message', origin: 'https://foreign.test', data: {type: 'waf-captcha-solved'}});
                context.dispatchEvent({type: 'message', origin: 'https://comix.to', data: {type: 'waf-captcha-solved'}});
                // Even a genuine notification does not suffice while the challenge is still present.
            } else if (session.polls === 2) {
                document.querySelector('.wafcap').remove();
                document.body.innerHTML = '<a href="' + chapter(0).url + '">Hero read link</a>' +
                    '<li><a href="/title/other-work/1-chapter-1">Other work</a></li>';
            } else if (session.polls === 3) {
                document.body.innerHTML += '<div class="mchap-row"><a href="' + chapter(0).url + '">Chapter</a></div>';
                document.readyState = 'interactive';
            } else {
                assert.equal(session.polls, 4);
                document.readyState = 'complete';
                context.dispatchEvent({type: 'message', origin: 'https://comix.to', data: {type: 'waf-captcha-solved'}});
            }
        },
    });
    assert.equal((await r.plugin.getDetail(book.url)).chapters.length, 1);
    assert.equal(r.sessions[0].polls, 4);
    assert.equal(r.sessions[0].replies.length, 1);
});

test('existing verification dialog blocks even rendered rows; unresolved verification times out without requests', async () => {
    const r = await runtime(() => { throw Error('Unexpected API'); }, {
        waitTimeout: true,
        onPage: ({document}) => { document.body.innerHTML += '<div class="wafcap">Security check</div>'; },
    });
    await assert.rejects(r.plugin.getDetail(book.url), /网站验证.*超时/);
    assert.equal(r.requests.length, 0);
    assert.equal(r.sessions[0].disposed, true);
});

test('verified chapterless titles do not wait for nonexistent rows or return invented chapters', async () => {
    const r = await runtime(url => url.pathname.endsWith('/chapters') ? json(pagination([], 1, 0, 100)) : json(book),
        {hasChapters: false, rows: false});
    assert.equal((await r.plugin.getDetail(book.url)).chapters.length, 0);
    assert.equal(r.sessions[0].polls, 0);
});

test('a top-level challenge may clear naturally before the browse page becomes usable', async () => {
    const r = await runtime(() => json(pagination([book])), {
        html: '<html><head><title>Just a moment...</title></head><body><form id="challenge-form"></form></body></html>',
        onPoll: ({document, session, requests}) => {
            assert.equal(requests.length, 0);
            assert.equal(session.polls, 1);
            document.documentElement.innerHTML = parseHTML(readyPage('https://comix.to/browse')).document.documentElement.innerHTML;
        },
    });
    assert.equal((await r.plugin.getPopular(1)).list.length, 1);
    assert.equal(r.sessions[0].polls, 1);
});

test('all catalog pages share a page session and preserve upload identities, zero and decimal chapters', async () => {
    const rows = Array.from({length: 101}, (_, i) => chapter(i));
    rows[1] = {...rows[1], number: 0, url: '/title/test-fixture/2-chapter-0', group: {name: 'Other upload'}};
    rows[2].createdAt = '2026-01-01T00:00:00Z';
    const r = await runtime(url => url.pathname.endsWith('/chapters')
        ? json(pagination(rows.slice((Number(url.searchParams.get('page')) - 1) * 100, Number(url.searchParams.get('page')) * 100),
            Number(url.searchParams.get('page')), 101, 100)) : json(book));
    const result = await r.plugin.getDetail(book.url);
    assert.equal(result.chapters.length, 101);
    assert.equal(result.chapters[0].name, 'Chapter 0');
    assert.equal(result.chapters[1].scanlator, 'Other upload');
    assert.notEqual(result.chapters[0].url, result.chapters[1].url);
    assert.equal(result.chapters[3].name, 'Chapter 1.5');
    assert.equal(result.chapters[2].dateUpload, String(Date.parse(rows[2].createdAt)));
    assert.equal(r.sessions.length, 1);
    assert.equal(r.sessions[0].url, 'https://comix.to' + book.url);
    assert.equal(r.requests.filter(r => r.url.pathname.includes('apicore')).length, 1);
    assert.equal(r.sessions[0].replies.length, 1);
});

test('broken, duplicate, changing or foreign pagination fails without returning partial catalogs', async () => {
    for (const mutate of [
        value => { value.items = []; },
        value => { value.items[0] = chapter(0); },
        value => { value.meta.total++; },
        value => { value.meta.hasNext = true; },
        value => { value.items[0].mangaId = 99; },
    ]) {
        const r = await runtime(url => {
            if (!url.pathname.endsWith('/chapters')) return json(book);
            const page = Number(url.searchParams.get('page'));
            const result = pagination(page === 1 ? Array.from({length: 100}, (_, i) => chapter(i)) : [chapter(100)], page, 101, 100);
            if (page === 2) mutate(result);
            return json(result);
        });
        await assert.rejects(r.plugin.getDetail(book.url), /协议|目录/);
        const response = JSON.parse(r.sessions[0].replies[0]);
        assert.equal(response.ok, false);
        assert.equal(response.value, undefined);
        assert.equal(r.sessions[0].disposed, true);
    }
});

test('empty listings are valid, malformed data is not; popular/latest keep their ordering', async () => {
    const r = await runtime(() => json(pagination([])));
    assert.equal((await r.plugin.getPopular(1)).list.length, 0);
    assert.equal((await r.plugin.getLatestUpdates(1)).hasNextPage, false);
    assert.equal(r.requests.filter(r => r.url.pathname.startsWith('/api/'))[0].url.searchParams.get('order[views_30d]'), 'desc');
    assert.equal(r.requests.at(-1).url.searchParams.get('order[chapter_updated_at]'), 'desc');
    const invalid = await runtime(() => json(pagination([book], 1, 90)));
    await assert.rejects(invalid.plugin.getPopular(1), /协议/);
});

test('retired keys refresh HTML/modules once in the same page; repeated retirement terminates', async () => {
    for (const forever of [false, true]) {
        let calls = 0;
        const r = await runtime(url => {
            calls++;
            return !forever && url.searchParams.get('_').startsWith('fresh.') ? json(pagination([book]))
                : new Response('{"code":"key_retired"}', {status: 403});
        });
        if (forever) await assert.rejects(r.plugin.search('x', 1), /协议/);
        else assert.equal((await r.plugin.search('x', 1)).list.length, 1);
        assert.equal(calls, 2);
        assert.equal(r.sessions.length, 1);
        const refreshes = r.requests.filter(r => r.url.searchParams.has('nodelane_refresh'));
        assert.equal(refreshes.length, 3);
        assert.ok(refreshes.every(r => r.init.cache === 'no-store'));
    }
});

test('challenge, HTTP failure and timeout are errors, not empty results; retry opens a fresh session', async () => {
    for (const [response, error] of [
        [() => new Response('{"error":"captcha_required"}', {status: 403}), /验证/],
        [() => new Response('challenge', {status: 403, headers: {'cf-mitigated': 'challenge'}}), /验证/],
        [() => new Response('<html>server error</html>', {status: 522}), /HTTP 522/],
        [() => { throw new TypeError('Failed fetch: signed URL must not be printed'); }, /网络请求失败/],
    ]) {
        let fail = true;
        const r = await runtime(() => fail ? response() : json(pagination([])));
        await assert.rejects(r.plugin.search('x', 1), error);
        assert.equal(r.requests.filter(r => r.url.pathname.startsWith('/api/')).length, 1);
        fail = false;
        assert.equal((await r.plugin.search('x', 1)).list.length, 0);
        assert.equal(r.sessions.length, 2);
    }
    const timeout = await runtime((url, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
    }), {fastTimeout: true});
    await assert.rejects(timeout.plugin.search('x', 1), /超时/);
    assert.equal(timeout.sessions[0].disposed, true);
});

test('page lists load the work page, preserve restoration metadata and require existing host support', async () => {
    const url = '/title/test-fixture/1-chapter-0';
    const result = {id: 1, url, pages: {baseUrl: 'https://images.fixture.test/', items: [{url: 'one.jpg', s: 1}, {url: 'two.jpg', s: 0}]}};
    const r = await runtime(() => json(result));
    const pages = await r.plugin.getPageList(url);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].imageProcessing.type, 'tile-shuffle-v1');
    assert.equal(pages[0].imageProcessing.seedMasks['03632'], 58414);
    assert.equal(pages[0].headers.Referer, '');
    assert.equal(r.sessions[0].url, 'https://comix.to/title/test-fixture');
    const unsupported = await runtime(() => json(result), {capabilities: []});
    await assert.rejects(unsupported.plugin.getPageList(url), /打乱图片/);
    result.id = 99;
    await assert.rejects(r.plugin.getPageList(url), /协议/);
});

test('missing host, missing result, invalid JSON and foreign URLs fail explicitly', async () => {
    const unsupported = await loadPlugin('comix');
    await assert.rejects(unsupported.getPopular(1), /未提供网页脚本接口/);
    for (const raw of ['', '<html>', '{}', 'null']) {
        const r = await runtime(() => {}, {raw});
        await assert.rejects(r.plugin.getPopular(1), /未返回结果|结果无效/);
    }
    const r = await runtime(() => {});
    for (const url of ['https://comix.to.evil.test/title/test-fixture', '/test-fixture']) {
        assert.throws(() => r.plugin.getDetail(url), /来源地址无效/);
    }
    assert.equal(r.sessions.length, 0);
});

test('persistent challenge, unknown layout and foreign protocol assets fail before making API requests', async () => {
    for (const [page, error] of [
        ['<title>Just a moment...</title><form id="challenge-form"></form>', /验证/],
        [readyPage('https://comix.to/browse', {scripts: '<script src="https://foreign.test/assets/build/fixture/dist/main-fixture.js"></script>'}), /协议/],
        ['<html>unknown source layout</html>', /加载超时/],
    ]) {
        const r = await runtime(() => { throw Error('Unexpected API'); }, {html: page, waitTimeout: true});
        await assert.rejects(r.plugin.getPopular(1), error);
        assert.equal(r.requests.length, 0);
        assert.equal(r.sessions[0].disposed, true);
    }
});

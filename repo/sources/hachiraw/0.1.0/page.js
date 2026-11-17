// SPDX-License-Identifier: GPL-3.0-only
// Adapted from NodeLane's Hachiraw adapter; provenance is in THIRD_PARTY.md.
function createHachirawParser() {
    const origin = 'https://hachiraw.net';
    const all = (node, selector) => Array.from(node.querySelectorAll(selector));
    function one(values, label) {
        if (values.length !== 1) throw Error('Hachiraw ' + label + '缺失或重复。');
        return values[0];
    }
    function text(value) {
        if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value.trim()))
            throw Error('Hachiraw 页面数据无效。');
        return value.trim();
    }
    const label = node => text(node.textContent.replace(/\s+/g, ' '));
    function location(value) {
        let path;
        try { path = decodeURIComponent(text(value).replace(/^https:\/\/hachiraw\.net(?=\/)/, '')); }
        catch { throw Error('Hachiraw 来源地址无效。'); }
        const match = /^\/manga\/([^/]+)(?:\/(chapter-\d+(?:-[a-z0-9]+)*|\d+-raw))?\/?$/.exec(path);
        if (!match || ['.', '..'].includes(match[1]) || /[\u0000-\u0020\u007f/%?#\\]/.test(match[1]))
            throw Error('Hachiraw 来源地址无效。');
        const work = origin + '/manga/' + encodeURIComponent(match[1]);
        return {slug: match[1], chapter: match[2], work, url: work + (match[2] ? '/' + match[2] : '')};
    }
    function imageUrl(value) {
        const url = new URL(text(value), origin);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash)
            throw Error('Hachiraw 图片地址无效。');
        return url.href;
    }
    function cover(value, slug) {
        const url = new URL(imageUrl(value));
        if (!decodeURIComponent(url.pathname).endsWith('/mangacover/' + slug + '.jpg'))
            throw Error('Hachiraw 封面作品归属错误。');
        // The site's old cover proxy returns 403; the homepage uses this CDN for the same files.
        return url.href.replace('https://i0.wp.com/cdn.kumaraw.com/', 'https://cdn.hachiraw.net/');
    }
    function date(value) {
        const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim());
        if (!m) return '';
        const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
        return d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1] && d.getTime() > 0
            ? String(d.getTime()) : '';
    }
    function detail(doc, input) {
        const loc = location(input);
        if (loc.chapter) throw Error('请使用 Hachiraw 作品详情页读取目录。');
        const info = one(all(doc, '.BoxBody').filter(e => e.querySelector('a.ChapterLink')), '作品信息');
        const box = one(all(info, '.col-12').filter(e => e.querySelector('a.ChapterLink')), '完整目录');
        const rows = all(box, 'a.ChapterLink');
        if (!rows.length || all(box, 'a').length !== rows.length) throw Error('Hachiraw 目录不完整或结构已变化。');
        const seen = new Set();
        const chapters = rows.map(row => {
            const target = location(row.getAttribute('href'));
            if (!target.chapter || target.slug !== loc.slug || seen.has(target.url))
                throw Error('Hachiraw 章节重复或作品归属错误。');
            seen.add(target.url);
            return {name: label(one(all(row, 'span.ng-binding:not(.float-right):not(.badge)'), '章节标题')),
                url: target.url, dateUpload: date(row.querySelector('.float-right')?.textContent || '')};
        });
        const metadata = all(doc, 'li.list-group-item');
        const author = metadata.find(e => e.querySelector('.mlabel')?.textContent.includes('著者'));
        const genres = metadata.find(e => e.querySelector('.mlabel')?.textContent.includes('ジャンル'));
        return {name: label(one(all(doc, 'h1'), '作品标题')), link: loc.url, chapters,
            imageUrl: cover(one(all(doc, 'img.bottom-5'), '作品封面').getAttribute('src'), loc.slug),
            author: author ? author.textContent.replace(author.querySelector('.mlabel').textContent, '').trim() : '',
            genre: genres ? all(genres, 'a').map(label) : [],
            description: all(doc, '.Content').map(e => e.textContent.trim()).join('\n'), status: 5};
    }
    function pages(doc, input) {
        const loc = location(input);
        if (!loc.chapter) throw Error('Hachiraw 章节地址无效。');
        const modal = one(all(doc, '#ChapterModal'), '章节选择器');
        const current = one(all(modal, 'a.btn-success'), '当前章节');
        if (location(current.getAttribute('href')).url !== loc.url) throw Error('Hachiraw 当前章节归属错误。');
        const title = label(current), navs = all(doc, '.DesktopNav');
        if (!navs.length) throw Error('Hachiraw 阅读导航缺失。');
        const totals = navs.map(nav => {
            const owner = location(one(all(nav, 'a'), '所属作品').getAttribute('href'));
            if (owner.chapter || owner.slug !== loc.slug) throw Error('Hachiraw 正文作品归属错误。');
            const buttons = all(nav, 'button').map(label);
            if (!buttons.includes(title)) throw Error('Hachiraw 章节标题不一致。');
            return Number(one(buttons.filter(s => /^Page [1-9]\d*$/.test(s)), '正文总数').slice(5));
        });
        const gallery = one(all(doc, '#TopPage.ImageGallery'), '正文列表');
        const images = all(gallery, 'img').map(img => {
            if (!img.classList.contains('lazy')) throw Error('Hachiraw 正文图片结构已变化。');
            return imageUrl(img.getAttribute('data-original'));
        }).filter(url => url !== origin + '/01.png'); // Site promotion is outside its declared page count.
        if (!images.length || totals.some(total => total !== images.length)) throw Error('Hachiraw 正文清单不完整。');
        // The image CDN rejects generic HTTP clients; use the actual device WebView's user agent.
        return images.map(url => ({url, headers: {Referer: origin + '/', 'User-Agent': navigator.userAgent}}));
    }
    function listing(doc, input, page) {
        const request = new URL(input), heading = label(one(all(doc, '.BoxHeader'), '列表标题'));
        const match = /^Search Manga\s*\(\s*(\d+)\)$/.exec(heading);
        if (!match) throw Error('Hachiraw 列表结构已变化。');
        const total = Number(match[1]), cards = all(doc, 'div.top-15[ng-repeat^="Series in vm.Directory"]');
        if (!Number.isSafeInteger(total) || cards.length !== Math.max(0, Math.min(20, total - (page - 1) * 20)) ||
            page > Math.max(1, Math.ceil(total / 20))) throw Error('Hachiraw 列表不完整。');
        const seen = new Set();
        const list = cards.map(card => {
            const links = all(card, 'a.SeriesName'), name = one(links.filter(a => a.getAttribute('ng-bind-html') === 'Series.s'), '列表作品');
            const loc = location(name.getAttribute('href'));
            if (loc.chapter || seen.has(loc.url) || links.length !== 2) throw Error('Hachiraw 列表作品重复或无效。');
            seen.add(loc.url);
            const poster = one(links.filter(a => all(a, 'img').length === 1), '列表封面');
            if (location(poster.getAttribute('href')).url !== loc.url) throw Error('Hachiraw 封面作品归属错误。');
            return {name: label(name), link: loc.url, imageUrl: cover(poster.querySelector('img').getAttribute('src'), loc.slug)};
        });
        const pagers = all(doc, 'ul.pagination');
        if (pagers.length > 1 || total > 20 && !pagers.length) throw Error('Hachiraw 分页缺失。');
        let next = false;
        if (pagers.length) {
            const pager = pagers[0];
            if (label(one(all(pager, 'li.active'), '当前页码')) !== String(page)) throw Error('Hachiraw 分页错位。');
            for (const a of all(pager, 'a')) {
                if (a.getAttribute('href') === '#') continue;
                const url = new URL(text(a.getAttribute('href')), origin), path = /^\/list-manga(?:\/([1-9]\d*))?\/?$/.exec(url.pathname);
                const target = Number(path?.[1] || 1), rel = a.getAttribute('rel');
                const unfilteredStart = page > 1 && target === 1 && ['prev', 'start'].includes(rel) && !url.search;
                if (url.origin !== origin || url.username || url.password || url.hash || !path ||
                    target !== Number(a.getAttribute('data-ci-pagination-page')) || !unfilteredStart &&
                    (url.searchParams.size !== request.searchParams.size || [...request.searchParams].some(([k, v]) => url.searchParams.get(k) !== v)))
                    throw Error('Hachiraw 分页参数不一致。');
                if (rel === 'next') {
                    if (next || target !== page + 1) throw Error('Hachiraw 下一页无效。');
                    next = true;
                }
            }
        }
        if (next !== (page * 20 < total)) throw Error('Hachiraw 分页不完整。');
        return {list, hasNextPage: next};
    }
    return {location, detail, pages, listing};
}

function runHachirawPage(request, createParser) {
    if (window.__nodeLaneHachirawRequest) return;
    window.__nodeLaneHachirawRequest = true;
    const run = async () => {
        let response, timer;
        const controller = new AbortController();
        const challenge = doc => /just a moment|请稍候|security verification/i.test(doc.title) ||
            !!doc.querySelector('#challenge-form, #challenge-running, iframe[src*="challenges.cloudflare.com"]');
        try {
            if (location.origin !== 'https://hachiraw.net') throw Error('Hachiraw 页面已跳转，请重新打开来源。');
            const deadline = Date.now() + 30000;
            timer = setTimeout(() => controller.abort(), 30000);
            while (document.readyState !== 'complete' || challenge(document)) {
                if (Date.now() >= deadline) throw Error('Hachiraw 网站验证未完成，请在 App 浏览器完成验证后重试。');
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            const parser = createParser();
            let doc = document;
            if (request.method === 'pages') {
                // Fetch inert chapter HTML from the work page, without loading its images and ads.
                const result = await fetch(parser.location(request.url).url, {credentials: 'include', signal: controller.signal});
                if (new URL(result.url).origin !== location.origin) throw Error('Hachiraw 正文请求已跳转。');
                if (result.headers.get('cf-mitigated') === 'challenge') throw Error('Hachiraw 正文需要网站验证，请在 App 浏览器完成验证后重试。');
                if (!result.ok) throw Error('Hachiraw 正文请求失败（HTTP ' + result.status + '）。');
                doc = new DOMParser().parseFromString(await result.text(), 'text/html');
                if (challenge(doc)) throw Error('Hachiraw 正文需要网站验证，请在 App 浏览器完成验证后重试。');
            }
            response = {ok: true, value: parser[request.method](doc, request.url, request.page)};
        } catch (error) {
            response = {ok: false, error: error.name === 'AbortError' ? 'Hachiraw 请求超时，请重试。' :
                error.message?.startsWith('Hachiraw') || error.message?.startsWith('请使用 Hachiraw') ? error.message : 'Hachiraw 页面请求失败。'};
        } finally { clearTimeout(timer); }
        await window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(response));
    };
    if (typeof window.flutter_inappwebview?.callHandler === 'function') void run();
    else window.addEventListener('flutterInAppWebViewPlatformReady', () => { void run(); }, {once: true});
}

// SPDX-License-Identifier: GPL-3.0-only
// Restored from Comix 0.2.3. All network I/O runs in the source page, not QuickJS.
function createComixClient(protocolApi, protocolSource) {
    const {encodeRequest, decodeResponse} = protocolApi;
    const {parseProtocolSource, protocolChanged} = protocolSource;
    const origin = 'https://comix.to';
    function object(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolChanged();
        return value;
    }
    function locationOf(value) {
        if (typeof value !== 'string') throw protocolChanged();
        const path = value.startsWith(origin + '/') ? value.slice(origin.length) : value;
        const match = /^\/title\/([a-z0-9]+)-([a-z0-9-]+)(?:\/(\d+)-chapter-(\d+(?:\.\d+)?))?$/.exec(path);
        if (!match) throw new Error('Comix 来源地址无效。');
        return {hid: match[1], chapterId: match[3], path, url: origin + path};
    }
    function imageUrl(value) {
        if (typeof value !== 'string') throw protocolChanged();
        value = value.trim().replace(/ /g, '%20');
        if (value.startsWith('//')) value = 'https:' + value;
        else if (value.startsWith('/')) value = origin + value;
        if (!/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(value)) throw protocolChanged();
        return value;
    }
    function assetUrl(value, base = origin + '/browse') {
        const resolved = value.startsWith('./') ? base.slice(0, base.lastIndexOf('/') + 1) + value.slice(2)
            : value.startsWith('/') ? origin + value
            : value.startsWith('https://') ? value : base.slice(0, base.lastIndexOf('/') + 1) + value;
        if (!/^https:\/\/comix\.to\/assets\/(?:build\/[a-z0-9]+\/dist|t3\/dist)\/[\w-]+\.js$/.test(resolved)) throw protocolChanged();
        return resolved;
    }
    function single(values) {
        const unique = [...new Set(values)];
        if (unique.length !== 1) throw protocolChanged();
        return unique[0];
    }
    function pageNumber(page) {
        if (!Number.isSafeInteger(page) || page < 1) throw new Error('Comix 页码无效。');
        return page;
    }
    function paginated(result, page, limit) {
        const meta = object(result.meta);
        if (!Array.isArray(result.items) || !Number.isSafeInteger(meta.total) || meta.total < 0 ||
            meta.page !== page || meta.perPage !== limit || meta.lastPage !== Math.max(1, Math.ceil(meta.total / limit)) ||
            meta.hasNext !== (page < meta.lastPage) ||
            result.items.length !== Math.min(limit, Math.max(0, meta.total - (page - 1) * limit))) throw protocolChanged();
        return meta;
    }

    class ComixClient {
        constructor() {
            this.protocol = null;
        }
        waitForVerification() {
            const hid = location.pathname.startsWith('/title/') ? locationOf(location.pathname).hid : null;
            const ready = () => {
                if (location.origin !== origin) throw new Error('Comix 页面已跳转，请重新打开来源后重试。');
                if (document.readyState !== 'complete' || /^Just a moment/i.test(document.title) ||
                    document.querySelector('#challenge-form, .wafcap, iframe[src*="/@waf/challenge"]')) return false;
                const data = document.querySelector('script#initial-data');
                if (!data) return false;
                let initial;
                try { initial = object(JSON.parse(data.textContent)); } catch { throw protocolChanged(); }
                if (hid) {
                    const detail = initial.queries?.[JSON.stringify(['manga', 'detail', hid])];
                    if (detail?.hid !== hid) return false;
                    if (detail.hasChapters === false) return true;
                } else if (initial.page !== 'browse') return false;
                // Real chapter rows prove the site's own protected request succeeded.
                // Hero/recommendation links and HTML load completion are not that signal.
                return [...document.querySelectorAll(hid ? '.mchap-row a[href], li a[href]' : 'a[href]')].some(anchor => {
                    try {
                        const loc = locationOf(anchor.getAttribute('href'));
                        return hid ? loc.hid === hid && !!loc.chapterId : !loc.chapterId;
                    } catch { return false; }
                });
            };
            return new Promise((resolve, reject) => {
                const deadline = Date.now() + 60000;
                let timer;
                const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onSolved); };
                const check = () => {
                    clearTimeout(timer);
                    try {
                        if (ready()) { cleanup(); resolve(); return; }
                        if (Date.now() >= deadline) throw new Error('Comix 网站验证或页面内容加载超时，请在来源网页完成验证后重试。');
                        // Poll state, never sleep a fixed duration before requesting.
                        timer = setTimeout(check, 250);
                    } catch (error) { cleanup(); reject(error); }
                };
                const onSolved = event => {
                    // The message only wakes the check; it cannot bypass DOM readiness.
                    if (event.origin === origin && event.data?.type === 'waf-captcha-solved') check();
                };
                window.addEventListener('message', onSolved);
                check();
            });
        }
        async response(url, refresh = false) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 25000);
            try {
                const response = await fetch(url, {credentials: 'same-origin', signal: controller.signal,
                    headers: {Accept: 'application/json, text/html'},
                    ...(refresh ? {cache: 'no-store'} : {})});
                if (response.headers.get('cf-mitigated') === 'challenge') {
                    throw new Error('Comix 需要 Cloudflare 验证，请在来源网页完成验证后重试。');
                }
                return {statusCode: response.status, body: await response.text()};
            } catch (error) {
                if (controller.signal.aborted) throw new Error('Comix 页面内请求超时，请重试。');
                // Native fetch errors can contain signed request URLs; do not expose them.
                if (error instanceof TypeError) throw new Error('Comix 页面内网络请求失败，请检查网络后重试。');
                throw error;
            } finally {
                clearTimeout(timer);
            }
        }
        async text(url, refresh = false) {
            const response = await this.response(url, refresh);
            if (response.statusCode !== 200) throw new Error('Comix 请求失败（HTTP ' + response.statusCode + '）。');
            return response.body;
        }
        async loadProtocol(refresh = false) {
            // A retired key can remain in CDN-cached HTML and modules. Only the
            // explicit retirement recovery bypasses those caches, once per call.
            const suffix = refresh ? '?nodelane_refresh=' + Date.now() : '';
            const read = url => this.text(url + suffix, refresh);
            // Reuse the page already loaded by the host; fetch HTML again only for retired keys.
            const html = refresh ? await read(location.href.split(/[?#]/)[0]) : document.documentElement.outerHTML;
            if (/id=["']challenge-form["']|<title>\s*Just a moment/i.test(html)) {
                throw new Error('Comix 需要网站验证，请在来源网页完成验证后重试。');
            }
            const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
            const direct = scripts.filter(src => /(?:^|\/)apicore-[\w-]+\.js$/.test(src));
            let url;
            if (direct.length) url = single(direct.map(src => assetUrl(src)));
            else {
                const main = single(scripts.filter(src => /(?:^|\/)main-[\w-]+\.js$/.test(src)).map(src => assetUrl(src)));
                const bootstrap = await read(main);
                url = single([...bootstrap.matchAll(/["']((?:\.\/)?apicore-[\w-]+\.js)["']/g)].map(match => assetUrl(match[1], main)));
            }
            return parseProtocolSource(await read(url));
        }
        async getProtocol(refresh = false) {
            // One operation per page; its API requests are sequential.
            if (refresh || !this.protocol) this.protocol = await this.loadProtocol(refresh);
            return this.protocol;
        }
        async api(path, params = {}) {
            const pairs = Object.keys(params).sort().map(key => key + '=' + params[key]).join('&');
            let protocol = await this.getProtocol();
            for (let attempt = 0; attempt < 2; attempt++) {
                const query = {...params, _: encodeRequest(path + (pairs ? '?' + pairs : ''), protocol)};
                const url = origin + '/api/v1' + path + '?' + Object.keys(query).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key])).join('&');
                const response = await this.response(url);
                let raw;
                try { raw = object(JSON.parse(response.body)); } catch {
                    if (response.statusCode !== 200) throw new Error('Comix 请求失败（HTTP ' + response.statusCode + '）。');
                    throw protocolChanged();
                }
                if (raw.error === 'captcha_required') {
                    throw new Error('Comix 要求站点验证（captcha_required），请在来源章节网页完成后重试。');
                }
                if (raw.code === 'key_retired') {
                    if (attempt) throw protocolChanged();
                    protocol = await this.getProtocol(true);
                    continue;
                }
                if (response.statusCode !== 200) throw new Error('Comix 请求失败（HTTP ' + response.statusCode + '）。');
                let decoded;
                try { decoded = typeof raw.e === 'string' ? object(JSON.parse(decodeResponse(raw.e, protocol))) : raw; }
                catch { throw protocolChanged(); }
                if (decoded.status !== 'ok') throw protocolChanged();
                return object(decoded.result);
            }
            throw protocolChanged();
        }
        async listing(page, params) {
            pageNumber(page);
            const result = await this.api('/manga', {...params, limit: '28', page: String(page), 'content_rating[0]': 'safe', 'content_rating[1]': 'suggestive'});
            const meta = paginated(result, page, 28), seen = new Set();
            const list = result.items.map(value => {
                const row = object(value), loc = locationOf(row.url);
                if (loc.chapterId || loc.hid !== row.hid || seen.has(loc.hid) || typeof row.title !== 'string' || !row.title.trim()) throw protocolChanged();
                seen.add(loc.hid);
                return {name: row.title, link: loc.url, imageUrl: imageUrl(row.poster?.medium || row.poster?.large), rating: row.contentRating};
            }).filter(row => row.rating === 'safe' || row.rating === 'suggestive')
                .map(({rating, ...row}) => row);
            return {list, hasNextPage: meta.hasNext};
        }
        getPopular(page) { return this.listing(page, {'order[views_30d]': 'desc'}); }
        getLatestUpdates(page) { return this.listing(page, {'order[chapter_updated_at]': 'desc'}); }
        search(query, page) { return this.listing(page, {keyword: query.trim(), 'order[relevance]': 'desc'}); }

        async getDetail(url) {
            const loc = locationOf(url);
            if (loc.chapterId) throw new Error('请使用 Comix 作品链接。');
            const detail = await this.api('/manga/' + loc.hid);
            if (detail.hid !== loc.hid || locationOf(detail.url).hid !== loc.hid || !Number.isSafeInteger(detail.id)) throw protocolChanged();
            if (!['safe', 'suggestive'].includes(detail.contentRating)) throw new Error('此来源仅收录普通分级作品。');
            const chapters = [], seen = new Set();
            let total;
            for (let page = 1; ; page++) {
                const result = await this.api('/manga/' + loc.hid + '/chapters', {limit: '100', page: String(page), 'order[number]': 'desc'});
                const meta = paginated(result, page, 100);
                if (total !== undefined && total !== meta.total) throw new Error('Comix 目录正在变化，请重试。');
                total = meta.total;
                for (const row of result.items) {
                    const chapter = locationOf(row.url);
                    if (chapter.hid !== loc.hid || Number(chapter.chapterId) !== row.id || row.mangaId !== detail.id ||
                        !Number.isSafeInteger(row.id) || seen.has(row.id) || row.language !== 'en' || !Number.isFinite(Number(row.number))) throw protocolChanged();
                    seen.add(row.id);
                    const date = Date.parse(row.createdAt || '');
                    chapters.push({name: 'Chapter ' + row.number + (row.name ? ' · ' + row.name : ''), url: chapter.url,
                        scanlator: row.group?.name || (row.isOfficial ? 'Official' : ''),
                        ...(Number.isFinite(date) ? {dateUpload: String(date)} : {})});
                }
                if (!meta.hasNext) break;
            }
            if (chapters.length !== total) throw new Error('Comix 目录不完整，请重试。');
            // Preserve each upload's URL/scanlator as its identity, including chapter 0 and decimals.
            return {name: detail.title, link: loc.url, imageUrl: imageUrl(detail.poster?.large || detail.poster?.medium),
                description: detail.synopsis || '', author: (detail.authors || []).map(row => row.title).join(', '),
                artist: (detail.artists || []).map(row => row.title).join(', '), genre: (detail.genres || []).map(row => row.title),
                status: {releasing: 0, finished: 1, completed: 1, hiatus: 2, cancelled: 3}[detail.status] ?? 5, chapters};
        }
        async getPageList(url) {
            const loc = locationOf(url);
            if (!loc.chapterId) throw new Error('请使用 Comix 章节链接。');
            const result = await this.api('/chapters/' + loc.chapterId);
            const returned = locationOf(result.url);
            if (String(result.id) !== loc.chapterId || returned.chapterId !== loc.chapterId || returned.hid !== loc.hid) throw protocolChanged();
            const pages = object(result.pages);
            if (!Array.isArray(pages.items) || !pages.items.length) throw protocolChanged();
            return pages.items.map(row => {
                if (row.s !== undefined && row.s !== 0 && row.s !== 1) throw protocolChanged();
                return {url: imageUrl((pages.baseUrl || '') + row.url), headers: {Referer: ''},
                    ...(row.s === 1 ? {imageProcessing: {type: 'tile-shuffle-v1', algorithm: 3,
                        seedMasks: {'03632': 58414, '02900': 117532}}} : {})};
            });
        }
    }
    return new ComixClient();
}

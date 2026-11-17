// SPDX-License-Identifier: GPL-3.0-only
class HachirawExtension extends MProvider {
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: 'https://hachiraw.net/'}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }

    async inPage(method, url, page) {
        if (typeof url !== 'string' || !url.startsWith('https://hachiraw.net/')) throw Error('Hachiraw 来源地址无效。');
        const work = method === 'listing' ? url : createHachirawParser().location(url).work;
        if (typeof evaluateJavascriptViaWebview !== 'function') throw Error('当前 App 未提供网页脚本接口，请更新 App。');
        const script = '(' + runHachirawPage.toString() + ')(' + JSON.stringify({method, url, page}) + ',' + createHachirawParser.toString() + ');';
        const raw = await evaluateJavascriptViaWebview(work, this.getHeaders(), [script], 35);
        if (!raw) throw Error('Hachiraw 网页未返回结果或已超时，请检查网络及网站验证状态后重试。');
        let response;
        try { response = JSON.parse(raw); } catch { throw Error('Hachiraw 网页返回结果无效。'); }
        if (!response || typeof response.ok !== 'boolean') throw Error('Hachiraw 网页返回结果无效。');
        if (!response.ok) throw Error(response.error || 'Hachiraw 页面请求失败。');
        return response.value;
    }
    listing(page, query, sort) {
        if (!Number.isSafeInteger(page) || page < 1 || typeof query !== 'string' || /[\u0000-\u001f\u007f]/.test(query))
            throw Error('Hachiraw 搜索参数无效。');
        const url = 'https://hachiraw.net/list-manga' + (page > 1 ? '/' + page : '') +
            (query.trim() ? '?search=' + encodeURIComponent(query.trim()) : sort ? '?order_by=' + sort : '');
        return this.inPage('listing', url, page);
    }
    getPopular(page) { return this.listing(page, '', 'views'); }
    getLatestUpdates(page) { return this.listing(page, '', 'lastest'); }
    search(query, page) { return this.listing(page, query); }
    getDetail(url) { return this.inPage('detail', url); }
    getPageList(url) { return this.inPage('pages', url); }
}

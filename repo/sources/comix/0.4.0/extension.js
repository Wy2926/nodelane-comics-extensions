// SPDX-License-Identifier: GPL-3.0-only
// This function and its dependencies are serialized into the loaded source page.
function runComixPage(request, createProtocol, createProtocolSource, createClient) {
    // onLoadStop may run more than once for the same document. Never start a second batch.
    if (window.__nodeLaneComixRequest) return;
    window.__nodeLaneComixRequest = true;
    const run = async () => {
        let response;
        try {
            if (location.origin !== 'https://comix.to') throw new Error('Comix 页面已跳转，请重新打开来源后重试。');
            const client = createClient(createProtocol(), createProtocolSource());
            await client.waitForVerification();
            response = {ok: true, value: await client[request.method](...request.args)};
        } catch (error) {
            response = {ok: false, error: error.message || 'Comix 页面请求失败。'};
        }
        // The host disposes this page after the callback: send only the complete result.
        await window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(response));
    };
    if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
        void run();
    } else {
        window.addEventListener('flutterInAppWebViewPlatformReady', () => { void run(); }, {once: true});
    }
}

class ComixExtension extends MProvider {
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: 'https://comix.to/'}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }

    async inPage(method, args, url = 'https://comix.to/browse') {
        if (typeof evaluateJavascriptViaWebview !== 'function') {
            throw new Error('当前 App 未提供网页脚本接口，请更新 App 后重试。');
        }
        const script = '(' + runComixPage.toString() + ')(' + JSON.stringify({method, args}) + ',' +
            createComixProtocol.toString() + ',' + createComixProtocolSource.toString() + ',' +
            createComixClient.toString() + ');';
        const raw = await evaluateJavascriptViaWebview(url, this.getHeaders(), [script], 120);
        if (!raw) throw new Error('Comix 网页未返回结果或已超时，请检查网络及来源验证状态后重试。');
        let response;
        try { response = JSON.parse(raw); } catch { throw new Error('Comix 网页返回结果无效，请重试。'); }
        if (!response || typeof response.ok !== 'boolean') throw new Error('Comix 网页返回结果无效，请重试。');
        if (!response.ok) throw new Error(response.error || 'Comix 页面请求失败。');
        return response.value;
    }
    workPage(url) {
        const origin = 'https://comix.to';
        const path = typeof url === 'string' && url.startsWith(origin + '/') ? url.slice(origin.length) : url;
        const match = typeof path === 'string' && /^\/title\/[a-z0-9]+-[a-z0-9-]+(?:\/\d+-chapter-\d+(?:\.\d+)?)?$/.exec(path);
        if (!match) throw new Error('Comix 来源地址无效，请从当前来源重新打开作品。');
        // Even page-list requests start at the work page, avoiding eager chapter image loads.
        return origin + path.replace(/\/\d+-chapter-\d+(?:\.\d+)?$/, '');
    }
    getPopular(page) { return this.inPage('getPopular', [page]); }
    getLatestUpdates(page) { return this.inPage('getLatestUpdates', [page]); }
    search(query, page) { return this.inPage('search', [query, page]); }
    getDetail(url) { return this.inPage('getDetail', [url], this.workPage(url)); }
    async getPageList(url) {
        const pages = await this.inPage('getPageList', [url], this.workPage(url));
        if (pages.some(page => page.imageProcessing) &&
            (typeof NodeLane === 'undefined' || !NodeLane.capabilities.includes('image.tile-shuffle.v1'))) {
            throw new Error('此章节使用打乱图片，请更新 NodeLane App 后再试。');
        }
        return pages;
    }
}

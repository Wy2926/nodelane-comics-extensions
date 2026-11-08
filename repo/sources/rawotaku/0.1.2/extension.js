// SPDX-License-Identifier: GPL-3.0-only
class SourceExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: RO_ORIGIN + '/'}; }
    getSourcePreferences() { return []; }
    getFilterList() {
        return [{name:'关键词搜索时，网站不应用以下筛选', type_name:'HeaderFilter'},
            ...RO_FILTERS.map(([type,name,values]) => ({type,name,type_name:'SelectFilter',state:0,
                values:values.map(([name,value]) => ({name,value,type_name:'SelectOption'}))}))];
    }
    async read(url, headers = this.getHeaders()) {
        const response = await this.client.get(url, headers), body = response.body;
        if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body || ''))
            throw roError('verification', 'Cloudflare 验证或封禁，请在来源网页处理后重试');
        if (response.statusCode === 429) throw roError('rate-limit', '请求过于频繁，请稍后重试');
        if (response.statusCode === 401 || response.statusCode === 403) throw roError('access', '源站拒绝访问，请在来源网页核对');
        if (response.statusCode !== 200) throw roError('http', '请求失败（HTTP ' + response.statusCode + '）');
        roRequire(typeof body === 'string' && body.length <= 4 * 1024 * 1024, 'response', '响应格式或大小无效');
        return body;
    }
    async listing(params, page) {
        roRequire(Number.isInteger(page) && page >= 1 && page <= 10000, 'page', '页码无效');
        const query = Object.entries({...params, p:String(page)}).map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
        const path = Object.prototype.hasOwnProperty.call(params, 'q') ? '/' : '/filter/';
        return roListing(await this.read(RO_ORIGIN + path + '?' + query), params, page);
    }
    getPopular(page) { return this.listing({type:'all',status:'all',language:'all',sort:'most-viewed'}, page); }
    getLatestUpdates(page) { return this.listing({type:'all',status:'all',language:'all',sort:'latest-updated'}, page); }
    search(query, page, filters = []) {
        roRequire(typeof query === 'string' && query.length <= 200 && Array.isArray(filters), 'search', '搜索条件无效');
        const params = {type:'all',status:'all',language:'all',sort:'default'}, seen = new Set();
        for (const filter of filters) {
            if (filter?.type_name === 'HeaderFilter') continue;
            const def = RO_FILTERS.find(([type]) => type === filter?.type);
            roRequire(def && !seen.has(filter.type) && filter.type_name === 'SelectFilter' && Number.isInteger(filter.state) &&
                filter.state >= 0 && filter.state < def[2].length, 'filter', '筛选选项无效，请重置筛选');
            seen.add(filter.type); params[filter.type] = def[2][filter.state][1];
        }
        return this.listing(query.trim() ? {q:query.trim()} : params, page);
    }
    async getDetail(url) {
        const loc = roLocation(url);
        return roDetail(await this.read(loc.url), loc);
    }
    async getPageList(url) {
        const loc = roLocation(url, true), id = roReaderId(await this.read(loc.url), loc);
        const headers = {...this.getHeaders(), Accept:'application/json, text/javascript, */*; q=0.01',
            Referer:encodeURIComponent(loc.url), 'X-Requested-With':'XMLHttpRequest'};
        return roPages(await this.read(RO_ORIGIN + '/json/chapter?mode=vertical&id=' + id, headers));
    }
}

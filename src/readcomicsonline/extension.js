// SPDX-License-Identifier: GPL-3.0-only
class SourceExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: RCO_ORIGIN + '/'}; }
    getSourcePreferences() { return []; }
    getFilterList() {
        return RCO_FILTERS.map(([type, name, values]) => ({type, name, type_name: 'SelectFilter', state: 0,
            values: values.map(([name, value]) => ({name, value, type_name: 'SelectOption'}))}));
    }
    async read(url) {
        const response = await this.client.get(url, this.getHeaders());
        const body = response.body || '';
        if (Object.entries(response.headers || {}).some(([key, value]) => key.toLowerCase() === 'cf-mitigated' && value === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body))
            throw rcoError('verification', 'Cloudflare 验证或封禁，请在来源网页处理后重试');
        if (response.statusCode === 429) throw rcoError('rate-limit', '请求过于频繁，请稍后重试');
        if (response.statusCode === 401 || response.statusCode === 403) throw rcoError('access', '源站拒绝访问，请在来源网页核对访问状态');
        if (response.statusCode !== 200) throw rcoError('http', '请求失败（HTTP ' + response.statusCode + '）');
        rcoRequire(typeof body === 'string' && body.length <= 4 * 1024 * 1024, 'response', '响应格式或大小无效');
        return body;
    }
    async listing(path, params, page) {
        rcoRequire(Number.isInteger(page) && page >= 1 && page <= 10000, 'page', '页码无效');
        const query = Object.entries({...params, page: String(page)}).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
        return rcoListing(await this.read(RCO_ORIGIN + '/' + path + '?' + query), path, params, page);
    }
    getPopular(page) { return this.listing('comic-list', {sort: 'views'}, page); }
    getLatestUpdates(page) { return this.listing('comic-list', {sort: 'latest'}, page); }
    search(query, page, filters = []) {
        rcoRequire(typeof query === 'string' && query.length <= 200 && Array.isArray(filters), 'search', '搜索条件无效');
        const params = query.trim() ? {name: query.trim()} : {}, seen = new Set();
        for (const filter of filters) {
            const definition = RCO_FILTERS.find(([type]) => type === filter.type);
            rcoRequire(definition && !seen.has(filter.type) && filter.type_name === 'SelectFilter' && Number.isInteger(filter.state) &&
                filter.state >= 0 && filter.state < definition[2].length, 'filter', '筛选选项无效，请重置筛选');
            seen.add(filter.type);
            const value = definition[2][filter.state][1];
            if (value) params[filter.type] = value;
        }
        return Object.keys(params).length ? this.listing('advanced-search', params, page) : this.getPopular(page);
    }
    async getDetail(url) {
        const loc = rcoLocation(url);
        return rcoDetail(await this.read(loc.url), loc);
    }
    async getPageList(url) {
        const loc = rcoLocation(url, true);
        return rcoPages(await this.read(loc.url), loc);
    }
}

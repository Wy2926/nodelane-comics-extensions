// SPDX-License-Identifier: GPL-3.0-only
const GZ_FILTERS = [
    ['cid', '题材', [['全部', ''], ['耽美', '41'], ['恋爱', '9'], ['校园', '29'], ['霸总', '5'], ['都市', '42'], ['穿越', '8'],
        ['古风', '23'], ['玄幻', '25'], ['奇幻', '31'], ['科幻', '22'], ['灵异', '21'], ['动作', '54'], ['悬疑', '11'],
        ['冒险', '30'], ['搞笑', '15'], ['热血', '13'], ['恐怖', '14'], ['系统', '148'], ['逆袭', '97'], ['脑洞', '55'], ['复仇', '61'], ['真人', '17'], ['其它', '27']]],
    ['city', '地区', [['全部', ''], ['大陆', '42'], ['欧美', '43'], ['港台', '77'], ['日韩', '78'], ['国漫', '338']]],
    ['audience', '受众', [['全部', ''], ['男频', '1'], ['女频', '2']]],
    ['is_end', '连载状态', [['全部', ''], ['连载中', '2'], ['已完结', '1']]],
    ['sort', '排序', [['默认', ''], ['今日热门', 'daily'], ['人气', 'hits'], ['更新', 'update'], ['评分', 'score']]],
];
class SourceExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: GZ_ORIGIN + '/'}; }
    getSourcePreferences() { return []; }
    getFilterList() {
        return GZ_FILTERS.map(([type, name, values]) => ({type, name, type_name: 'SelectFilter', state: 0,
            values: values.map(([name, value]) => ({name, value, type_name: 'SelectOption'}))}));
    }
    async read(url) {
        const response = await this.client.get(url, this.getHeaders());
        if (Object.entries(response.headers || {}).some(([k, v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']/i.test(response.body || ''))
            throw gzError('verification', '需要网站验证，请在来源网页完成后重试');
        if (response.statusCode === 429) throw gzError('rate-limit', '请求过于频繁，请稍后重试');
        if (response.statusCode === 401 || response.statusCode === 403) throw gzError('access', '源站拒绝访问，请在网页核对验证或登录状态');
        if (response.statusCode !== 200) throw gzError('http', '请求失败（HTTP ' + response.statusCode + '）');
        gzRequire(typeof response.body === 'string' && response.body.length <= 2 * 1024 * 1024, 'response', '响应格式或大小超出处理范围');
        return response.body;
    }
    async listing(params, page) {
        gzRequire(Number.isInteger(page) && page >= 1 && page <= 10000, 'page', '页码无效');
        const query = Object.entries({...params, ...(page > 1 ? {page: String(page)} : {})})
            .map(([key, value]) => key + '=' + encodeURIComponent(value)).join('&');
        return gzListing(await this.read(GZ_ORIGIN + '/category.php' + (query ? '?' + query : '')), params, page);
    }
    getPopular(page) { return this.listing({sort: 'hits'}, page); }
    getLatestUpdates(page) { return this.listing({sort: 'update'}, page); }
    search(query, page, filters = []) {
        gzRequire(typeof query === 'string' && query.length <= 200 && Array.isArray(filters), 'search', '搜索条件无效');
        const params = query.trim() ? {keyword: query.trim()} : {}, seen = new Set();
        for (const filter of filters) {
            const definition = GZ_FILTERS.find(([type]) => type === filter.type);
            gzRequire(definition && !seen.has(filter.type) && filter.type_name === 'SelectFilter' && Number.isInteger(filter.state) &&
                filter.state >= 0 && filter.state < definition[2].length, 'filter', '筛选选项无效，请重置筛选');
            seen.add(filter.type);
            const value = definition[2][filter.state][1];
            if (value) params[filter.type] = value;
        }
        return this.listing(params, page);
    }
    async getDetail(url) {
        const loc = gzLocation(url, 'comic');
        return gzDetail(await this.read(loc.url), loc);
    }
    async getPageList(url) {
        const loc = gzLocation(url, 'chapter');
        gzRequire(loc.owner, 'chapter-binding', '章节缺少作品归属，请刷新作品目录后重试');
        return gzPages(await this.read(loc.url), loc);
    }
}

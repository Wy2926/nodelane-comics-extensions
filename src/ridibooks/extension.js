// SPDX-License-Identifier: GPL-3.0-only
const RD_EPISODES_QUERY = `query($id: UUID!, $context: BookDetailHomeEpisodeBookListCellContext!) {
    riGrid { cells { bookDetailHome { episodeBookListCell(id: $id, context: $context) { cell {
        seriesId currentOrder currentTabType books { bookId title button { action } metadata { regDate } }
        pagination { nextPage { order offset limit } }
    } } } } }
}`;
const RD_SEARCH_QUERY = `query($id: UUID!, $context: SearchBookListWithTabCellContext!) {
    riGrid { cells { search { bookListWithTabCell(id: $id, context: $context) { context cell {
        aggregations { tab docCount } books { id book { id isAdultOnly title { main } categories { genre }
            series { id title thumbnail { large } } } }
    } } } } }
}`;
class SourceExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: RD_ORIGIN + '/'}; }
    getSourcePreferences() { return []; }
    getFilterList() {
        return [{type: 'category', name: '内容类型', type_name: 'SelectFilter', state: 0, values: [
            {name: '条漫', value: 'WEBTOON', type_name: 'SelectOption'},
            {name: '漫画', value: 'COMIC', type_name: 'SelectOption'},
        ]}];
    }
    page(page) { rdRequire(Number.isInteger(page) && page >= 1 && page <= 1000, 'page', '页码超出范围'); }
    async read(url, body, referer = RD_ORIGIN + '/') {
        const headers = {Referer: referer, Origin: RD_ORIGIN, Accept: body ? 'application/json' : '*/*'};
        if (body) headers['Content-Type'] = 'application/json';
        let response;
        try { response = body ? await this.client.post(url, headers, body) : await this.client.get(url, headers); }
        catch { throw rdError('network', '网络请求超时或连接失败，请稍后重试'); }
        if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']/i.test(response.body || ''))
            throw rdError('verification', '需要网站验证，请在来源网页完成后重试');
        if (response.statusCode === 429) throw rdError('rate-limit', '请求过于频繁，请稍后重试');
        if ([401,403,302,303].includes(response.statusCode)) throw rdError('access', '请在 RIDI 核对登录、购买或年龄验证状态');
        rdRequire(response.statusCode === 200, 'http', '请求失败（HTTP ' + response.statusCode + '）');
        rdRequire(typeof response.body === 'string' && response.body.length <= 4 * 1024 * 1024, 'response', '网站响应格式或大小超出上限');
        return response.body;
    }
    async graph(query, id, context, referer) {
        rdRequire(typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id), 'structure', '页面区域编号无效');
        const data = rdJson(await this.read(RD_ORIGIN + '/graphql', {query, variables: {id, context}}, referer));
        rdRequire(!data.errors?.length && data.data?.riGrid?.cells, 'graphql', '网站查询失败，请稍后重试或更新插件');
        return data.data.riGrid.cells;
    }
    async listing(endpoint, page, category = 'WEBTOON') {
        this.page(page);
        const params = {adults_only: '0', category_includes: category === 'WEBTOON' ? '1600' : '1500', limit: '18',
            ...(endpoint === 'bestsellers' ? {period: 'WEEKLY', only_rent_available: '0'} : {}), offset: String((page - 1) * 18)};
        const query = Object.entries(params).map(([k,v]) => k + '=' + v).join('&');
        return rdApiList(rdJson(await this.read(RD_API + '/v2/' + endpoint + '?' + query)), endpoint, params);
    }
    getPopular(page) { return this.listing('bestsellers', page); }
    getLatestUpdates(page) { return this.listing('new-releases', page); }
    async search(query, page, filters = []) {
        this.page(page);
        rdRequire(typeof query === 'string' && query.length <= 64 && Array.isArray(filters), 'search', '搜索词最长 64 个字符');
        rdRequire(filters.length <= 1 && filters.every(f => f.type === 'category' && f.type_name === 'SelectFilter' && [0,1].includes(f.state)),
            'filter', '筛选状态无效，请重置筛选');
        const category = filters[0]?.state === 1 ? 'COMIC' : 'WEBTOON';
        query = query.trim();
        if (!query) return this.listing('bestsellers', page, category);
        const url = RD_ORIGIN + '/search?q=' + encodeURIComponent(query) + '&page=' + page + '&tab=' + category + '&adult_exclude=y';
        const data = rdNext(await this.read(url), '/search').props.pageProps;
        const cell = rdCell(data.gridData?.riGrid?.grid?.cells, 'SearchBookListWithTab');
        // Server HTML contains the unfiltered initial results; the site applies tabs through this query.
        const context = {adultOption: 'EXCLUDE_ADULT', parentTab: category, childTab: null, keyword: [query], order: 'SCORE',
            pageLimitInput: {limit: 24, page}, rent: false, what: 'BASE'};
        const response = (await this.graph(RD_SEARCH_QUERY, cell.id, context, url)).search?.bookListWithTabCell;
        const result = response?.cell;
        const returned = response?.context;
        rdRequire(returned?.parentTab === category && returned.adultOption === context.adultOption && returned.keyword?.length === 1 &&
            returned.keyword[0] === query && returned.pageLimitInput?.page === page && returned.pageLimitInput.limit === 24,
            'search-context', '搜索条件与返回结果不一致');
        const counts = Array.isArray(result?.aggregations) ? result.aggregations.filter(a => a.tab === category) : [];
        rdRequire(counts?.length === 1 && Number.isInteger(counts[0].docCount) && counts[0].docCount >= 0 && Array.isArray(result.books) && result.books.length <= 24,
            'search', '搜索结果结构无效');
        const total = counts[0].docCount;
        rdRequire(result.books.length > 0 || total <= (page - 1) * 24, 'pagination', '搜索结果被截断');
        const list = [], seen = new Set();
        for (const shell of result.books) {
            const book = shell.book, id = book?.series?.id || book?.id, name = rdText(book?.series?.title || book?.title?.main);
            rdRequire(rdId(id) && name && Array.isArray(book.categories) && book.categories.some(c => /comic|webtoon/.test(c.genre)), 'search', '搜索返回了非漫画作品');
            rdRequire(book.isAdultOnly === false, 'search', '搜索未应用年龄筛选');
            if (seen.has(id)) continue;
            seen.add(id); list.push({name, link: rdBookUrl(id), imageUrl: rdImage(book.series?.thumbnail?.large)});
        }
        return {list, hasNextPage: page * 24 < total};
    }
    async getDetail(url) {
        const loc = rdLocation(url), result = rdDetail(await this.read(loc.url), loc);
        if (!result.cell) return result.detail;
        let cell = result.cell.cell__BookDetailHomeEpisodeBookList, offset = 0, requests = 0;
        const order = cell.currentOrder, tab = cell.currentTabType, seen = new Set();
        rdRequire(order === 'SEQUENTIAL' && ['RENT','BUY'].includes(tab), 'pagination', '目录排序或类型变化');
        while (true) {
            const next = rdEpisodes(cell, loc.id, order, tab, seen, result.detail.chapters);
            offset += cell.books.length;
            rdRequire(offset <= 10000 && result.detail.chapters.length <= result.total, 'chapter-count', '目录数量超出作品总数');
            if (next == null) break;
            rdRequire(cell.books.length > 0 && next.order === order && next.offset === offset && Number.isInteger(next.limit) && next.limit > 0 && next.limit <= 100 && ++requests <= 100,
                'pagination', '目录分页缺失、循环或超出上限');
            cell = (await this.graph(RD_EPISODES_QUERY, result.cell.id, {bookId: loc.id, deviceType: 'DESKTOP', order, tabType: tab,
                pagination: {offset: next.offset, limit: next.limit}}, loc.url)).bookDetailHome?.episodeBookListCell?.cell;
        }
        rdRequire(result.detail.chapters.length === result.total, 'chapter-count', '未取得完整目录，请重试；不会保存部分章节');
        return result.detail;
    }
    async getPageList(url) {
        const loc = rdLocation(url, true);
        rdReader(await this.read(loc.url), loc);
        return rdPages(rdJson(await this.read(RD_ORIGIN + '/apps/books/api/web-viewer/generate', {book_id: loc.id}, loc.url)), loc);
    }
}

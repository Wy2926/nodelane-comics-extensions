// SPDX-License-Identifier: GPL-3.0-only
// NodeLane ridibooks; corresponding source: sources/ridibooks/0.1.0/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
const RD_ORIGIN = 'https://ridibooks.com';
const RD_API = 'https://api.ridibooks.com';
function rdError(code, message) { return new Error('[RIDI:' + code + '] ' + message); }
function rdRequire(value, code, message) { if (!value) throw rdError(code, message); }
function rdId(value) { return typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value); }
function rdJson(text) {
    try { return JSON.parse(text); } catch { throw rdError('response', '网站数据格式无效'); }
}
function rdText(value) {
    return typeof value === 'string' ? new Document('<div id="ridi-text">' + value + '</div>').selectFirst('#ridi-text').text.trim() : '';
}
function rdBookUrl(id) {
    rdRequire(rdId(id), 'identity', '作品编号无效');
    return RD_ORIGIN + '/books/' + id;
}
function rdLocation(url, chapter = false) {
    const match = typeof url === 'string' && url.match(/^https:\/\/ridibooks\.com\/books\/([1-9]\d{0,15})(\/view)?(?:\?[^#\s]*)?(?:#nodelane-ridibooks=([1-9]\d{0,15}))?$/);
    rdRequire(match && Boolean(match[2]) === chapter && (chapter || !match[3]), 'url', '作品或章节地址无效');
    if (chapter) rdRequire(match[3], 'chapter-binding', '章节缺少作品归属，请刷新目录后重试');
    return {id: match[1], owner: match[3], url: rdBookUrl(match[1]) + (chapter ? '/view' : '')};
}
function rdCover(value) {
    if (!value) return '';
    rdRequire(typeof value === 'string' && /^https:\/\/img\.ridicdn\.net\/(?:cover|thumbnail)\/[1-9]\d*\/(?:small|large|xxlarge)(?:#[^\s]*)?$/.test(value), 'cover', '封面地址不受支持');
    return value;
}
function rdNext(html, page) {
    const node = new Document(html).selectFirst('#__NEXT_DATA__');
    const data = rdJson(node ? node.text : '');
    rdRequire(data.page === page && data.props && data.props.pageProps, 'structure', '网站页面类型变化');
    return data;
}
function rdCell(cells, type) {
    rdRequire(Array.isArray(cells), 'structure', '缺少页面数据');
    const matches = cells.filter(cell => cell.type === type);
    rdRequire(matches.length === 1 && matches[0]['cell__' + type], 'structure', '缺少或重复的页面区域：' + type);
    return matches[0];
}
function rdDate(value) {
    if (!value) return '';
    const match = typeof value === 'string' && value.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (!match) return '';
    // Only a calendar date is supplied: preserve its day in the device's local zone.
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[3])
        ? String(date.getTime()) : '';
}
function rdApiList(data, endpoint, params) {
    rdRequire(data && data.success === true && Array.isArray(data.data?.items) && data.data.pagination &&
        Object.prototype.hasOwnProperty.call(data.data.pagination, 'next_page'), 'listing', '缺少列表或分页数据');
    const list = [], seen = new Set();
    for (const item of data.data.items) {
        const book = item.book, id = book?.serial?.serial_id || book?.book_id;
        const name = rdText(book?.serial?.title || book?.title);
        rdRequire(rdId(id) && name && book.file?.comic === true, 'listing', '列表包含无效或非漫画作品');
        if (book.adults_only === true || seen.has(id)) continue;
        seen.add(id);
        list.push({name, link: rdBookUrl(id), imageUrl: rdCover(book.serial?.cover?.large || book.cover?.large)});
    }
    rdRequire(data.data.items.length <= 18, 'listing', '列表大小超出预期');
    const next = data.data.pagination.next_page;
    if (next != null) {
        const match = typeof next === 'string' && next.match(/^\/v2\/(bestsellers|new-releases)\/?\?([^#]+)$/);
        rdRequire(match && match[1] === endpoint, 'pagination', '列表下一页地址变化');
        const actual = {};
        for (const part of match[2].split('&')) {
            const pair = part.split('=');
            rdRequire(pair.length === 2 && !(pair[0] in actual), 'pagination', '重复分页参数');
            try { actual[pair[0]] = decodeURIComponent(pair[1]); } catch { throw rdError('pagination', '分页参数无效'); }
        }
        const expected = {...params, offset: String(Number(params.offset) + 18)};
        rdRequire(Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([k,v]) => actual[k] === v) && data.data.items.length > 0,
            'pagination', '列表分页条件或位置不一致');
    }
    return {list, hasNextPage: next != null};
}
function rdDetail(html, loc) {
    const next = rdNext(html, '/books/[bookId]'), props = next.props.pageProps;
    rdRequire(next.query?.bookId === loc.id && props.sectionProps?.bookId === loc.id, 'identity', '作品页面与请求不一致');
    const cells = props.sectionProps.gridQuery?.riGrid?.grid?.cells;
    const header = rdCell(cells, 'BookDetailHomeHeader').cell__BookDetailHomeHeader, info = header.information;
    rdRequire(info?.bookId === loc.id && info.title?.title, 'identity', '作品信息与请求不一致');
    rdRequire(info.isAdultOnly !== true, 'access', '此作品需要在 RIDI 完成年龄验证');
    const series = info.series;
    rdRequire(!series || series.id === loc.id, 'chapter-owner', '目录作品归属不一致');
    const total = series ? series.openedBookCount : 1;
    rdRequire(Number.isInteger(total) && total >= 0 && total <= 10000, 'chapter-count', '章节总数无效或超出上限');
    const intro = rdCell(cells, 'BookDetailHomeBookIntroduction').cell__BookDetailHomeBookIntroduction;
    const authors = [], artists = [];
    for (const group of info.authorGroups || []) for (const author of group.authors || []) {
        if (author.name) (author.role === 'ILLUSTRATOR' ? artists : authors).push(rdText(author.name));
    }
    const detail = {name: rdText(info.title.title), link: loc.url, imageUrl: rdCover(header.thumbnail?.cover?.large),
        description: rdText(intro.introductionHtml), author: [...new Set(authors)].join(', '), artist: [...new Set(artists)].join(', '),
        genre: [...new Set((info.category || []).map(c => c.childCategory?.name).filter(Boolean))],
        status: typeof series?.isCompleted === 'boolean' ? (series.isCompleted ? 1 : 0) : 5, chapters: []};
    rdRequire(detail.name, 'identity', '作品标题为空');
    if (!series) {
        detail.chapters.push({name: detail.name, url: loc.url + '/view#nodelane-ridibooks=' + loc.id, dateUpload: ''});
        return {detail, total, cell: null};
    }
    return {detail, total, cell: rdCell(cells, 'BookDetailHomeEpisodeBookList')};
}
function rdEpisodes(cell, owner, order, tab, seen, chapters) {
    rdRequire(cell && cell.seriesId === owner, 'chapter-owner', '章节目录归属不一致');
    rdRequire(cell.currentOrder === order && cell.currentTabType === tab && Array.isArray(cell.books) && cell.books.length <= 100 && cell.pagination &&
        Object.prototype.hasOwnProperty.call(cell.pagination, 'nextPage'),
        'pagination', '目录分页条件或结构变化');
    for (const book of cell.books) {
        rdRequire(rdId(book.bookId) && typeof book.title === 'string' && book.title.trim(), 'chapter', '章节编号或标题无效');
        const url = rdBookUrl(book.bookId) + '/view#nodelane-ridibooks=' + owner;
        const dateUpload = rdDate(book.metadata?.regDate);
        if (seen.has(url)) continue;
        seen.add(url);
        chapters.push({name: rdText(book.title), url, dateUpload,
            scanlator: book.button?.action === 'VIEW_WEB_VIEWER' ? '' : '需在 RIDI 获取阅读权限'});
    }
    return cell.pagination.nextPage;
}
function rdReader(html, loc) {
    const node = new Document(html).selectFirst('#app_init');
    if (!node?.text) throw rdError('access', '无法打开阅读器，请在 RIDI 核对登录、购买或年龄验证状态');
    const book = rdJson(node.text)?.detail?.book;
    rdRequire(book?.b_id === loc.id && (book.series_id || book.b_id) === loc.owner, 'chapter-owner', '正文与章节或作品归属不一致');
    rdRequire(book.content_type?.is_comic === true, 'format', '此内容不是图片漫画');
    rdRequire(book.is_adult_only !== true && book.payment_info?.available && book.payment_info.available !== 'none' && !book.payment_info.is_expired,
        'access', '此章节需要在 RIDI 登录并获取阅读权限；不会用试读替代正文');
}
function rdPages(data, loc) {
    rdRequire(data?.success === true, 'access', 'RIDI 未授予此章节的阅读权限，请在原站核对');
    rdRequire(data.data?.type === 'comic', 'format', '此阅读格式尚不受支持');
    const pages = data.data.pages;
    rdRequire(Array.isArray(pages) && pages.length > 0 && pages.length <= 1500, 'page-count', '正文为空或页数超出上限');
    return pages.map(page => {
        const match = typeof page?.src === 'string' && page.src.match(/^https:\/\/(webview-cache2?\.ridibooks\.com)\/([1-9]\d*)\/(webtoon|bom)\/[^\s?#]+(?:\?[^\s#]+)?$/);
        rdRequire(match && match[2] === loc.id, 'page-owner', '图片地址或章节归属变化');
        rdRequire(Number.isInteger(page.width) && page.width > 0 && Number.isInteger(page.height) && page.height > 0,
            'page-shape', '图片尺寸无效');
        return {url: page.src, headers: {Referer: loc.url}};
    });
}

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
            seen.add(id); list.push({name, link: rdBookUrl(id), imageUrl: rdCover(book.series?.thumbnail?.large)});
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

return SourceExtension;
})();

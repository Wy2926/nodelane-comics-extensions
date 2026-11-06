// SPDX-License-Identifier: GPL-3.0-only
// NodeLane guazimanhua; corresponding source: sources/guazimanhua/0.1.2/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Adapted protocol checks from NodeLane Comics; provenance: ../../THIRD_PARTY.md.
const GZ_ORIGIN = 'https://www.guazimanhua.com';
const GZ_BINDING = 'nodelane-guazimanhua=';
function gzError(code, message) { return new Error('瓜子漫画：' + message + ' [GZ:' + code + ']'); }
function gzRequire(ok, code, message) { if (!ok) throw gzError(code, message); }
function gzOne(items, code) {
    gzRequire(items.length === 1, code, '页面缺少唯一的必要数据');
    return items[0];
}
function gzText(value) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''; }
function gzObject(value) {
    gzRequire(value && typeof value === 'object' && !Array.isArray(value), 'schema', '结构化数据格式无效');
    return value;
}
function gzAddress(value) {
    const match = /^(?:https:\/\/www\.guazimanhua\.com)?\/(comic|chapter|category)\.php(?:\?([^#]*))?(?:#([^\s]*))?$/.exec(String(value || ''));
    gzRequire(match, 'url', '来源地址格式不受支持');
    const params = {};
    for (const part of (match[2] || '').split('&').filter(Boolean)) {
        const at = part.indexOf('=');
        gzRequire(at > 0, 'url', '来源参数无效');
        let key, value;
        try { key = decodeURIComponent(part.slice(0, at).replace(/\+/g, ' ')); value = decodeURIComponent(part.slice(at + 1).replace(/\+/g, ' ')); }
        catch (_) { throw gzError('url', '来源参数编码无效'); }
        gzRequire(['id', 'cid', 'city', 'audience', 'is_end', 'sort', 'keyword', 'page'].includes(key) && !(key in params), 'url', '来源参数重复或未知');
        params[key] = value;
    }
    return {kind: match[1], params, fragment: match[3] || ''};
}
function gzLocation(value, kind) {
    const parsed = gzAddress(value), id = parsed.params.id;
    gzRequire(parsed.kind === kind && /^[1-9]\d{0,9}$/.test(id || '') && Object.keys(parsed.params).length === 1, 'url', '作品或章节地址无效');
    const owner = parsed.fragment ? new RegExp('^' + GZ_BINDING + '([1-9]\\d{0,9})$').exec(parsed.fragment) : null;
    gzRequire(!parsed.fragment || kind === 'chapter' && owner, 'url', '章节归属标记无效');
    return {id, owner: owner ? owner[1] : '', url: GZ_ORIGIN + '/' + kind + '.php?id=' + id};
}
function gzImage(value, required = false) {
    value = typeof value === 'string' ? value.trim() : '';
    if (!value && !required) return '';
    const hosts = required ? 'img\\.guazicdn\\.com' : '(?:img\\.guazicdn\\.com|api\\.guaziapp\\.com)';
    gzRequire(new RegExp('^https://' + hosts + '/[^\\s#]+$').test(value), 'image-url', '图片地址不在已核实的 HTTPS 范围');
    return value;
}
function gzCategoryIdentity(value, params, page) {
    const target = gzAddress(value);
    // SEO URLs may retain sort/category while omitting search and other filters.
    return target.kind === 'category' && !target.fragment && Object.entries(target.params).every(([key, value]) =>
        key === 'page' ? value === String(page) : params[key] === value);
}
function gzDocument(html, expected) {
    const root = new Document(html);
    const canonicalUrl = gzOne(root.select('link[rel="canonical"]'), 'identity').attr('href'), canonical = gzAddress(canonicalUrl);
    gzRequire(canonical.kind === expected.kind && !canonical.fragment &&
        (expected.kind === 'category' ? gzCategoryIdentity(canonicalUrl, expected.params, expected.page) : canonical.params.id === expected.id && Object.keys(canonical.params).length === 1),
        'identity', '返回页面与请求身份不符');
    const data = [];
    for (const script of root.select('script[type="application/ld+json"]')) {
        let decoded;
        try { decoded = JSON.parse(script.text); } catch (_) { throw gzError('schema', '结构化数据无法解析'); }
        for (const row of Array.isArray(decoded) ? decoded : decoded['@graph'] || [decoded]) data.push(gzObject(row));
    }
    return {root, data};
}
function gzSchema(data, type) { return gzOne(data.filter(row => row['@type'] === type), 'schema-' + type); }
function gzItems(list, max) {
    gzRequire(list['@type'] === 'ItemList' && Number.isSafeInteger(list.numberOfItems) && list.numberOfItems >= 0 && list.numberOfItems <= max &&
        Array.isArray(list.itemListElement), 'item-list', '列表数量或结构无效');
    return list.itemListElement;
}
function gzPreview(entries, length) {
    gzRequire(entries.length <= length && (length === 0 ? entries.length === 0 : entries.length > 0), 'preview', '结构化预览与完整数据不一致');
}
function gzListing(html, params, page) {
    const {root, data} = gzDocument(html, {kind: 'category', params, page});
    const collection = gzSchema(data, 'CollectionPage'), list = gzObject(collection.mainEntity), entries = gzItems(list, 36);
    gzRequire(gzCategoryIdentity(collection.url, params, page), 'listing-identity', '列表身份不符');
    const cards = root.select('article.card');
    gzRequire(entries.length === list.numberOfItems && cards.length === entries.length, 'listing-count', '列表数量不完整');
    const summary = /当前筛选\s*([\d,]+)\s*部作品\s*·\s*第\s*(\d+)\s*\/\s*(\d+)\s*页\s*·\s*每页\s*(\d+)\s*部/.exec(root.selectFirst('.filter-head p').text);
    gzRequire(summary, 'pagination', '未识别列表分页');
    const total = Number(summary[1].replace(/,/g, '')), pages = Number(summary[3]);
    gzRequire(Number(summary[2]) === page && Number(summary[4]) === 36 && pages === Math.max(1, Math.ceil(total / 36)) && page <= pages &&
        cards.length <= Math.min(36, Math.max(0, total - (page - 1) * 36)) &&
        (cards.length > 0 || total === 0 && root.select('.empty').length === 1),
        'pagination', '列表被截断或返回了其他页');
    const pager = gzOne(root.select('nav.pager'), 'pagination'), seen = new Set();
    let current = 0, next = false;
    for (const anchor of pager.select('a')) {
        const target = gzAddress(anchor.attr('href')), targetPage = Number(target.params.page || '1');
        delete target.params.page;
        gzRequire(target.kind === 'category' && !target.fragment && Number.isSafeInteger(targetPage) && targetPage >= 1 && targetPage <= pages &&
            JSON.stringify(Object.entries(target.params).sort()) === JSON.stringify(Object.entries(params).sort()), 'pagination-query', '翻页条件与请求不一致');
        if (anchor.attr('class').split(/\s+/).includes('on')) { gzRequire(targetPage === page, 'pagination', '当前页标识不符'); current++; }
        if (targetPage === page + 1) next = true;
    }
    gzRequire(current === 1 && next === (page < pages), 'pagination', '下一页标识不完整');
    return {list: cards.map((card, index) => {
        const anchor = gzOne(card.select('h3 a'), 'listing-title'), loc = gzLocation(anchor.attr('href'), 'comic');
        const name = gzText(anchor.text), row = gzObject(entries[index]);
        gzRequire(name && !seen.has(loc.id) && row['@type'] === 'ListItem' && row.position === index + 1 &&
            gzLocation(row.url, 'comic').id === loc.id && gzText(row.name) === name, 'listing-item', '作品身份、名称或顺序不一致');
        seen.add(loc.id);
        return {name, link: loc.url, imageUrl: gzImage(card.selectFirst('img.cover').attr('src'))};
    }), hasNextPage: next};
}
function gzDetail(html, loc) {
    const {root, data} = gzDocument(html, {kind: 'comic', id: loc.id}), story = gzSchema(data, 'ComicStory');
    gzRequire(gzLocation(story.url, 'comic').id === loc.id, 'work-owner', '目录不属于当前作品');
    const name = gzText(story.name);
    gzRequire(name && gzText(root.selectFirst('#cinema-title').text) === name, 'work-title', '作品名称不一致');
    const anchors = gzOne(root.select('.all-chapter-grid'), 'catalog').select('a');
    const lists = data.filter(row => row['@type'] === 'ItemList');
    let preview = [];
    if (!anchors.length && !lists.length) {
        // Empty works omit ItemList; require the site's explicit zero count.
        const counts = root.select('.side-card p').map(e => /章节总数[：:]\s*(\d+)\s*话/.exec(e.text)).filter(Boolean);
        gzRequire(counts.length === 1 && counts[0][1] === '0', 'catalog-count', '未确认空目录，章节数据可能缺失');
    } else {
        const list = gzOne(lists, 'schema-ItemList');
        preview = gzItems(list, 10000);
        gzRequire(anchors.length === list.numberOfItems, 'catalog-count', '章节目录不完整');
    }
    gzPreview(preview, anchors.length);
    const seen = new Set();
    // Keep source order (newest first), including extras and nonmonotonic IDs.
    const chapters = anchors.map(anchor => {
        const chapter = gzLocation(anchor.attr('href'), 'chapter'), title = gzText(anchor.text);
        gzRequire(title && (!chapter.owner || chapter.owner === loc.id) && !seen.has(chapter.id), 'chapter-owner', '章节归属错误或重复');
        seen.add(chapter.id);
        // The catalog has no per-chapter upload date. Page dateModified is not one.
        return {name: title, url: chapter.url + '#' + GZ_BINDING + loc.id, dateUpload: ''};
    });
    preview.forEach((value, index) => {
        const row = gzObject(value), expected = chapters[chapters.length - index - 1];
        gzRequire(row['@type'] === 'ListItem' && row.position === index + 1 && gzLocation(row.url, 'chapter').url === gzLocation(expected.url, 'chapter').url &&
            gzText(row.name) === expected.name, 'catalog-order', '章节预览与完整目录顺序不一致');
    });
    const statuses = root.select('.cinema-info .meta .badge').map(e => gzText(e.text));
    const authors = Array.isArray(story.author) ? story.author : story.author ? [story.author] : [];
    return {name, link: loc.url, imageUrl: gzImage(story.image), description: gzText(story.description),
        author: authors.map(a => gzText(typeof a === 'string' ? a : a.name)).filter(Boolean).join('、'),
        genre: (Array.isArray(story.genre) ? story.genre : []).map(gzText).filter(Boolean),
        status: statuses.includes('完结') ? 1 : statuses.includes('连载') ? 0 : 5, chapters};
}
function gzPages(html, loc) {
    const {root, data} = gzDocument(html, {kind: 'chapter', id: loc.id}), article = gzSchema(data, 'Article');
    const parent = gzObject(article.isPartOf), owner = gzLocation(parent.url, 'comic');
    gzRequire(gzLocation(article.url, 'chapter').id === loc.id && parent['@type'] === 'ComicStory' && owner.id === loc.owner,
        'chapter-owner', '章节不属于当前作品');
    const list = gzSchema(data, 'ItemList'), preview = gzItems(list, 1500);
    gzRequire(list.numberOfItems > 0, 'chapter-empty', '源站没有提供可读取的正文，请在网页核对访问权限');
    const images = gzOne(root.select('section.reader-images'), 'reader').select('img');
    gzRequire(images.length === list.numberOfItems, 'page-count', '正文图片缺页');
    gzPreview(preview, images.length);
    return images.map((image, index) => {
        const url = gzImage(image.attr('src'), true);
        gzRequire(image.attr('id') === 'page-' + (index + 1) && image.attr('data-page') === String(index + 1) &&
            image.attr('class').split(/\s+/).includes('reading-image'), 'page-order', '正文图片页序不连续');
        if (index < preview.length) {
            const row = gzObject(preview[index]), item = gzObject(row.item);
            gzRequire(row['@type'] === 'ListItem' && row.position === index + 1 && item['@type'] === 'ImageObject' && item.url === url,
                'page-preview', '正文图片与预览不一致');
        }
        return {url, headers: {Referer: GZ_ORIGIN + '/'}};
    });
}

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

return SourceExtension;
})();

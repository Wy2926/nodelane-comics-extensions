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

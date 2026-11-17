// SPDX-License-Identifier: GPL-3.0-only
const NX_ORIGIN = 'https://newxtoon5.com';
const NX_CATEGORIES = [['一般漫画', ''], ['BL·GL', 'BL·GL'], ['成人漫画', '성인']];
function nxRequire(value, code, message) {
  if (!value) throw Error('[NX:' + code + '] ' + message);
}
function nxText(element) { return (element?.text || '').replace(/\s+/g, ' ').trim(); }
function nxUrl(value, base = NX_ORIGIN + '/') {
  nxRequire(typeof value === 'string' && value.trim() && !/[\\\u0000-\u001f]/.test(value), 'url', '地址格式无效');
  let url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = NX_ORIGIN + url;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = base.replace(/[^/]*$/, '') + url;
  nxRequire(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url), 'url', '图片或页面地址协议无效');
  return url;
}
function nxLocation(value, chapter = false) {
  const url = nxUrl(value).split('#')[0];
  const match = /^https:\/\/newxtoon5\.com\/comics\/([1-9]\d*)(?:\/chapters\/([1-9]\d*))?(\?[^#]*)?$/.exec(url);
  nxRequire(match && Boolean(match[2]) === chapter, 'url', '作品或章节地址不属于 New XTOON');
  return {url, owner:match[1], chapter:match[2], path:url.split('?')[0]};
}
function nxDocument(html, identity) {
  nxRequire(typeof html === 'string' && /<\/html\s*>/i.test(html), 'structure', '页面响应不完整');
  const doc = new Document(html);
  nxRequire(doc.selectFirst('link[rel="canonical"]').attr('href') === identity, 'identity', '响应页面与请求身份不一致');
  return doc;
}
function nxDate(text) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(text || '');
  if (!match) return '';
  const [, y, m, d] = match.map(Number), date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? String(date.getTime()) : '';
}
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:NX_ORIGIN + '/'}; }
  getSourcePreferences() { return []; }
  getFilterList() {
    return [{type:'category', name:'分类（关键词搜索时忽略）', type_name:'SelectFilter', state:0,
      values:NX_CATEGORIES.map(([name,value]) => ({name,value,type_name:'SelectOption'}))}];
  }
  async read(url, json = false) {
    const response = await this.client.get(url, {...this.getHeaders(),
      ...(json ? {Accept:'application/json', 'X-Requested-With':'XMLHttpRequest'} : {})});
    const body = response.body;
    if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
        /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body || ''))
      throw Error('[NX:verification] 请在来源网页完成验证后重试');
    nxRequire(response.statusCode !== 429, 'rate-limit', '源站限流，请稍后重试');
    nxRequire(response.statusCode !== 401 && response.statusCode !== 403, 'access', '源站拒绝访问，请在来源网页核对');
    nxRequire(response.statusCode === 200, 'http', '请求失败（HTTP ' + response.statusCode + '）');
    nxRequire(typeof body === 'string', 'response', '源站响应格式无效');
    if (!json) return body;
    try { return JSON.parse(body); } catch { throw Error('[NX:response] 章节接口未返回有效 JSON'); }
  }
  async listing(page, query = '', sort = 'latest', category = '') {
    nxRequire(Number.isSafeInteger(page) && page > 0, 'page', '页码无效');
    const path = query ? '/search' : '/comics';
    const params = query ? 'q=' + encodeURIComponent(query) : 'sort=' + sort + (category ? '&category=' + encodeURIComponent(category) : '');
    const doc = nxDocument(await this.read(NX_ORIGIN + path + '?' + params + '&page=' + page), NX_ORIGIN + path);
    const heading = doc.selectFirst(query ? '#search-result-title' : '#comic-list-title');
    const totalText = nxText(heading.selectFirst('span')).replace(/,/g, '');
    nxRequire(/^\d+$/.test(totalText), 'listing', '作品列表或结果计数缺失');
    if (query) nxRequire(doc.selectFirst('#page-search').attr('value') === query, 'identity', '搜索关键词与响应不一致');
    const list = [], seen = new Set();
    for (const card of doc.select('a.comic-link[href*="/comics/"]')) {
      const loc = nxLocation(card.attr('href')), name = nxText(card.selectFirst('h3'));
      nxRequire(name, 'listing', '作品名称缺失');
      const cover = card.selectFirst('img.cover-image').attr('src');
      if (!seen.has(loc.url)) { seen.add(loc.url); list.push({name, link:loc.url, imageUrl:cover ? nxUrl(cover) : ''}); }
    }
    const pager = doc.selectFirst('nav[data-site-pagination]');
    const current = nxText(pager.selectFirst('[aria-current="page"]'));
    nxRequire(!current || current === String(page), 'pagination', '列表页码与请求不一致');
    const next = pager.selectFirst('a[aria-label="다음 페이지"]').attr('href');
    if (next) {
      nxRequire(next.startsWith(NX_ORIGIN + path + '?') && new RegExp('[?&]page=' + (page + 1) + '(?:&|$)').test(next),
        'pagination', '下一页地址不连续');
    }
    nxRequire(list.length ? Number(totalText) >= list.length : totalText === '0' && !next, 'listing', '空结果未经源站确认');
    return {list, hasNextPage:Boolean(next)};
  }
  getPopular(page) { return this.listing(page, '', 'popular'); }
  getLatestUpdates(page) { return this.listing(page); }
  search(query, page, filters = []) {
    nxRequire(typeof query === 'string' && Array.isArray(filters), 'search', '搜索条件无效');
    const text = query.trim();
    if (text) return this.listing(page, text);
    const category = filters.find(f => f.type === 'category');
    nxRequire(!category || Number.isInteger(category.state) && NX_CATEGORIES[category.state], 'filter', '请重置分类筛选');
    return this.listing(page, '', 'latest', NX_CATEGORIES[category?.state || 0][1]);
  }
  async getDetail(url) {
    const loc = nxLocation(url), doc = nxDocument(await this.read(loc.url), loc.path);
    const info = doc.selectFirst('section[aria-labelledby="comic-title"]');
    const name = nxText(info.selectFirst('#comic-title')), catalog = doc.selectFirst('#chapters');
    nxRequire(name && catalog.attr('data-chapters-url') === loc.path + '/chapters', 'detail', '作品详情或章节接口缺失');
    const count = /총\s*([\d,]+)\s*화/.exec(nxText(catalog));
    nxRequire(count, 'catalog', '完整目录总数缺失');
    const total = Number(count[1].replace(/,/g, '')), chapters = [], seen = new Set();
    let lastPage;
    for (let page = 1; ; page++) {
      const data = await this.read(loc.path + '/chapters?sort=latest&page=' + page, true);
      nxRequire(data && Array.isArray(data.chapters) && typeof data.html === 'string' &&
        data.current_page === page && data.total === total && Number.isSafeInteger(data.last_page) && data.last_page >= page &&
        (lastPage === undefined || lastPage === data.last_page), 'catalog', '章节分页或总数发生变化，请重试');
      lastPage = data.last_page;
      nxRequire(data.has_more === (page < lastPage) && data.next_page === (data.has_more ? page + 1 : null),
        'pagination', '章节下一页状态不一致');
      const rows = new Document(data.html).select('a[data-chapter-id]');
      nxRequire(rows.length === data.chapters.length, 'catalog', '章节数据与目录链接数量不一致');
      const before = chapters.length;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], chapter = nxLocation(row.attr('href'), true), item = data.chapters[i];
        nxRequire(chapter.owner === loc.owner && chapter.chapter === String(item.id) && row.attr('data-chapter-id') === chapter.chapter,
          'chapter-owner', '章节不属于当前作品或章节身份不一致');
        nxRequire(typeof item.title === 'string' && item.title.trim(), 'catalog', '章节标题缺失');
        if (seen.has(chapter.url)) continue;
        seen.add(chapter.url);
        chapters.push({name:item.title.trim(), url:chapter.url, dateUpload:nxDate(item.date)});
      }
      nxRequire(chapters.length <= total && (!data.has_more || chapters.length > before), 'catalog', '目录分页重复或数量不一致');
      if (!data.has_more) break;
    }
    nxRequire(chapters.length === total, 'catalog', '章节目录不完整，请重试');
    const cover = info.selectFirst('img[alt$="표지"]').attr('src');
    const state = info.select('strong').map(nxText).find(s => ['연재중','완결','휴재'].includes(s));
    return {name, link:loc.url, imageUrl:cover ? nxUrl(cover) : '',
      author:info.select('#comic-title + p a').map(nxText).join(', '),
      description:nxText(info.selectFirst('[data-comic-description]')),
      genre:info.select('[data-comic-genres] a').map(nxText),
      status:({'연재중':0, '완결':1, '휴재':2})[state] ?? 5, chapters};
  }
  async getPageList(url) {
    const loc = nxLocation(url, true), doc = nxDocument(await this.read(loc.url), loc.path);
    const reader = doc.selectFirst('#comic-reader');
    nxRequire(reader.attr('data-reader-chapter-id') === loc.chapter &&
      nxLocation(reader.selectFirst('a[data-reader-detail]').attr('href')).owner === loc.owner,
      'chapter-owner', '阅读页与作品或章节身份不一致');
    const frames = reader.select('[data-reader-canvas] [data-reader-page]');
    nxRequire(frames.length, 'pages', '源站没有提供正文图片');
    return frames.map((frame, index) => {
      nxRequire(frame.attr('data-image-position') === String(index + 1), 'page-order', '正文图片页位不连续');
      const images = frame.select('img[data-reader-image]');
      nxRequire(images.length === 1, 'pages', '正文图片缺失或重复');
      return {url:nxUrl(images[0].attr('src'), loc.path), headers:this.getHeaders()};
    });
  }
}

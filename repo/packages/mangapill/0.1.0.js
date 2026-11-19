// SPDX-License-Identifier: GPL-3.0-only
// NodeLane mangapill; corresponding source: sources/mangapill/0.1.0/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
const ORIGIN = 'https://mangapill.com';
const choices = {
  type: ['manga', 'novel', 'one-shot', 'doujinshi', 'manhua', 'oel'],
  status: ['publishing', 'finished', 'on hiatus', 'discontinued', 'not yet published'],
};
const genres = 'Action|Adventure|Cars|Comedy|Dementia|Demons|Doujinshi|Drama|Ecchi|Fantasy|Game|Gender Bender|Harem|Historical|Horror|Isekai|Josei|Kids|Magic|Martial Arts|Mecha|Military|Music|Mystery|Parody|Police|Psychological|Romance|Samurai|School|Sci-Fi|Seinen|Shoujo|Shoujo Ai|Shounen|Shounen Ai|Slice of Life|Space|Sports|Super Power|Supernatural|Thriller|Tragedy|Vampire|Yaoi|Yuri'.split('|');
function check(ok, message) { if (!ok) throw Error('[MangaPill] ' + message); }
function text(el) { return (el.text || '').replace(/\s+/g, ' ').trim(); }
function locationOf(value, reader = false) {
  const m = /^(?:https:\/\/mangapill\.com)?(\/(manga|chapters)\/([1-9]\d*)(?:-(\d+))?(?:\/[\w.-]+)?\/?(?:\?[^#\s]*)?)(?:#.*)?$/.exec(value);
  check(m && (m[2] === 'chapters') === reader && !!m[4] === reader, '作品或章节地址无效');
  return {url:ORIGIN + m[1], work:m[3], chapter:m[4]};
}
function image(value, base) {
  check(typeof value === 'string' && value.trim(), '图片地址缺失');
  let url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = ORIGIN + url;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = base.split('?')[0].replace(/[^/]*$/, '') + url;
  check(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url), '图片地址无效');
  return url;
}
function cards(doc, grid, url) {
  const list = [], seen = new Set();
  for (const card of doc.select(grid + ' > div')) {
    const anchor = card.select('a[href*="/manga/"]').find(a => text(a.selectFirst('.line-clamp-2')));
    check(anchor, '作品标题缺失');
    const name = text(anchor.selectFirst('.line-clamp-2')), loc = locationOf(anchor.attr('href'));
    if (seen.has(loc.url)) continue;
    seen.add(loc.url);
    const img = card.selectFirst('img'), cover = img.attr('data-src') || img.attr('src');
    list.push({name, link:loc.url, imageUrl:cover ? image(cover, url) : ''});
  }
  return list;
}
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:ORIGIN + '/'}; }
  getSourcePreferences() { return []; }
  getFilterList() {
    return [...Object.entries(choices).map(([type, opts]) => ({type, name:type === 'type' ? '类型' : '状态', type_name:'SelectFilter', state:0,
      values:['', ...opts].map(value => ({name:value || '全部', value, type_name:'SelectOption'}))})),
      {type:'genre', name:'题材', type_name:'GroupFilter', state:genres.map(name => ({name, value:name, state:false, type_name:'CheckBox'}))}];
  }
  async document(url) {
    const {statusCode, headers, body} = await this.client.get(url, this.getHeaders());
    check(!Object.entries(headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') &&
      !/<title>\s*Just a moment|id=["']challenge-form["']/i.test(body), '请在来源网页完成验证后重试');
    check(statusCode !== 429, '源站限流，请稍后重试');
    check(statusCode !== 401 && statusCode !== 403, '源站拒绝访问');
    check(statusCode === 200, '请求失败：HTTP ' + statusCode);
    check(typeof body === 'string' && /<\/html\s*>/i.test(body), '页面响应不完整');
    return new Document(body);
  }
  async shelf(page, latest) {
    check(Number.isSafeInteger(page) && page > 0, '页码无效');
    if (page > 1) return {list:[], hasNextPage:false};
    const url = ORIGIN + (latest ? '/chapters' : '/'), doc = await this.document(url);
    const heading = latest ? 'Recently Released Chapters' : 'Trending Mangas';
    check(doc.select('h4').some(h => text(h) === heading), '榜单缺失');
    const list = cards(doc, latest ? '.grid' : '.grid.justify-end', url);
    check(list.length, '榜单没有作品');
    return {list, hasNextPage:false};
  }
  getPopular(page) { return this.shelf(page, false); }
  getLatestUpdates(page) { return this.shelf(page, true); }
  async search(query, page, filters = []) {
    check(typeof query === 'string' && Number.isSafeInteger(page) && page > 0, '搜索条件无效');
    const params = [], add = (k,v) => params.push(k + '=' + encodeURIComponent(v));
    query = query.trim();
    if (query) add('q', query);
    for (const f of filters) {
      if (f.type === 'genre') { for (const tag of f.state) if (tag.state) add('genre', tag.name); }
      else if (choices[f.type] && f.state) {
        const value = choices[f.type][f.state - 1]; check(value, '请重置筛选条件'); add(f.type, value);
      }
    }
    const url = ORIGIN + '/search?' + [...params, 'page=' + page].join('&'), doc = await this.document(url);
    check(doc.select('form input[name=q]').length === 1 && doc.selectFirst('form input[name=q]').attr('value') === query, '搜索关键词与页面不符');
    const grid = '.grid.justify-end', pager = grid + ' + .flex.justify-center';
    check(doc.select(grid).length === 1 && doc.select(pager).length === 1, '搜索结果或翻页栏缺失');
    const list = cards(doc, grid, url);
    let prev = false, next = false;
    for (const a of doc.select(pager + ' a')) {
      const label = text(a), forward = label === 'Next', target = forward ? page + 1 : page - 1;
      check(forward ? !next : label === 'Previous' && !prev, '翻页链接重复或无效');
      const m = /^(?:https:\/\/mangapill\.com)?\/search\?([^#]+)$/.exec(a.attr('href'));
      check(m, '翻页地址无效');
      const actual = m[1].split('&').filter(Boolean).map(pair => {
        const i = pair.indexOf('='); check(i > 0, '翻页参数无效');
        return pair.slice(0,i) + '=' + encodeURIComponent(decodeURIComponent(pair.slice(i+1).replace(/\+/g,' ')));
      }).filter(pair => !['q=', 'status=', 'type='].includes(pair));
      check(actual.sort().join('&') === [...params, 'page=' + target].sort().join('&'), '翻页条件与请求不符');
      if (forward) next = true; else prev = true;
    }
    check(prev === (page > 1), '搜索页码与请求不符');
    check(list.length || !next && text(doc.selectFirst('.flex.flex-col.gap-3.items-center .text-center')).startsWith('No results found'), '源站未确认空结果');
    return {list, hasNextPage:next};
  }
  async getDetail(url) {
    const loc = locationOf(url), doc = await this.document(loc.url);
    check(locationOf(doc.selectFirst('link[rel=canonical]').attr('href')).work === loc.work, '作品归属不符');
    const name = text(doc.selectFirst('h1')), links = doc.select('#chapters [data-filter-list] a');
    check(name && links.length, '作品标题或完整目录缺失');
    const chapters = [], seen = new Set();
    for (const a of links) {
      const ch = locationOf(a.attr('href'), true), title = text(a);
      check(ch.work === loc.work && title, '章节归属或名称不符');
      if (!seen.has(ch.url)) { seen.add(ch.url); chapters.push({name:title, url:ch.url, dateUpload:''}); }
    }
    const cover = doc.selectFirst('meta[property="og:image"]').attr('content');
    const state = doc.select('.grid > div').find(e => text(e.selectFirst('label')) === 'Status');
    return {name, link:loc.url, chapters, imageUrl:cover ? image(cover, loc.url) : '',
      description:text(doc.selectFirst('.mb-3 > p')), genre:doc.select('a[href*="genre="]').map(text),
      status:({'publishing':0, 'finished':1, 'on hiatus':2, 'discontinued':3})[state && text(state.selectFirst('label + div'))] ?? 5};
  }
  async getPageList(url) {
    const loc = locationOf(url, true), doc = await this.document(loc.url);
    const canonical = locationOf(doc.selectFirst('link[rel=canonical]').attr('href'), true);
    check(canonical.work === loc.work && canonical.chapter === loc.chapter &&
      locationOf(doc.selectFirst('#js-chapter-selector-modal a[data-hotkey=m]').attr('href')).work === loc.work, '阅读页与章节不符');
    const pages = doc.select('chapter-page');
    check(pages.length, '正文没有图片');
    return pages.map((p,i) => {
      check(text(p.selectFirst('[data-summary]')) === 'page ' + (i+1) + '/' + pages.length, '正文页序或总数不符');
      const imgs = p.select('img.js-page'); check(imgs.length === 1, '正文图片缺失或重复');
      return {url:image(imgs[0].attr('data-src') || imgs[0].attr('src'), loc.url), headers:this.getHeaders()};
    });
  }
}

return SourceExtension;
})();

// SPDX-License-Identifier: GPL-3.0-only
// NodeLane jf00; corresponding source: sources/jf00/0.1.0/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Port of node-comics' jf00 search, catalog and public reader protocol.
const ORIGIN = 'https://www.00jf.com';
function check(ok, why) { if (!ok) throw Error('[漫画猫] ' + why); }
function label(el) { return (el.text || '').trim(); }
function locationOf(value, reader = false) {
  const m = /^(?:(?:https:\/\/)?www\.00jf\.com)?(\/(comic|chapter)_([1-9]\d*)(?:_([1-9]\d*))?\.html(?:\?[^#\s]*)?)(?:#.*)?$/.exec(value);
  check(m && (m[2] === 'chapter') === reader && !!m[4] === reader, '作品或章节地址无效');
  return {url:ORIGIN + m[1], work:m[3], chapter:m[4]};
}
function picture(value, page) {
  check(typeof value === 'string' && value.trim(), '图片地址缺失');
  let url = value.trim().replace(/ /g,'%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = ORIGIN + url;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = page.split('?')[0].replace(/[^/]*$/, '') + url;
  check(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url), '图片地址无效');
  return url;
}
function catalogCards(section, url) {
  check(section.select('.comic-list').length === 1, '作品列表缺失');
  return section.select('.comic-list > .comic-item').map(card => {
    const a = card.selectFirst('h3 a'), link = locationOf(a.attr('href')).url;
    const name = a.attr('title') || label(a), cover = card.selectFirst('a.comic-cover');
    check(name && locationOf(cover.attr('href')).url === link, '作品标题或封面归属有误');
    const img = cover.selectFirst('img').attr('src');
    return {name, link, imageUrl:img ? picture(img,url) : ''};
  });
}
function pageNumber(href, keyword) {
  const m = /^(?:https:\/\/www\.00jf\.com)?\/search\/([^/?#]+)(?:\/([1-9]\d*))?\/?$/.exec(href);
  check(m && (m[1] === keyword || decodeURIComponent(m[1]) === keyword), '分页链接与搜索词不符');
  return m[2] ? Number(m[2]) : 1;
}
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer: ORIGIN + '/'}; }
  getSourcePreferences() { return []; }
  getFilterList() { return []; }
  async document(url) {
    const {statusCode, headers, body} = await this.client.get(url, this.getHeaders());
    check(!Object.entries(headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') &&
      !/<title>\s*Just a moment|id=["']challenge-form["']/i.test(body), '请在来源页完成验证');
    check(statusCode !== 429, '源站限流，请稍后重试');
    check(statusCode !== 401 && statusCode !== 403, '源站拒绝访问');
    check(statusCode === 200, 'HTTP ' + statusCode);
    check(typeof body === 'string' && /<\/html\s*>/i.test(body), '网页响应不完整');
    return new Document(body);
  }
  async shelf(page, latest) {
    check(Number.isSafeInteger(page) && page > 0, '页码无效');
    if (page > 1) return {list:[],hasNextPage:false};
    const url = ORIGIN + (latest ? '/custom/new' : '/custom/recom');
    const section = (await this.document(url)).selectFirst('.comic-section');
    check(label(section.selectFirst('h2')) === (latest ? '最新漫画' : '热门推荐'), '榜单与请求不符');
    const list = catalogCards(section,url);
    check(list.length, '榜单缺少作品');
    return {list,hasNextPage:false};
  }
  getPopular(page) { return this.shelf(page, false); }
  getLatestUpdates(page) { return this.shelf(page, true); }
  async search(query, page) {
    check(typeof query === 'string' && Number.isSafeInteger(page) && page > 0, '搜索条件无效');
    const keyword = query.trim();
    if (!keyword) return this.getPopular(page);
    const q = encodeURIComponent(keyword), url = ORIGIN + (page === 1 ? '/search?key=' + q : '/search/' + q + '/' + page);
    const section = (await this.document(url)).selectFirst('.comic-section');
    const echo = /^“([\s\S]*)”搜索结果$/.exec(label(section.selectFirst('h2')))?.[1];
    // The source echoes a literal '+' as a space, including in its paging links.
    check(echo === keyword || echo === keyword.replace(/\+/g,' '), '搜索词与结果不符');
    const count = /^共(\d+)部漫画$/.exec(label(section.selectFirst('.page-info')));
    check(count, '搜索结果数缺失');
    const total = Number(count[1]), list = catalogCards(section,url);
    const nav = section.selectFirst('.pagination'), current = pageNumber(nav.selectFirst('a.on').attr('href'),echo);
    const next = pageNumber(nav.selectFirst('a.next').attr('href'),echo);
    // Search serves 30 works per page; even on the last page the site renders a Next link to itself.
    const remaining = total - (page - 1) * 30, hasNextPage = remaining > 30;
    check(current === page && remaining >= 0 && list.length === Math.min(30,remaining) &&
      next === (hasNextPage ? page + 1 : page), '搜索分页或总数不一致');
    return {list,hasNextPage};
  }
  async getDetail(url) {
    const loc = locationOf(url), doc = await this.document(loc.url);
    check(locationOf(doc.selectFirst('link[rel=canonical]').attr('href')).work === loc.work, '作品归属不符');
    const info = doc.selectFirst('.comic-meta-info'), name = label(info.selectFirst('h1'));
    const directory = doc.selectFirst('#chapter-list'), rows = directory.select('.chapter-item');
    check(name && rows.length && rows.length === directory.select('a').length, '目录缺失或不完整');
    const seen = new Set(), chapters = [];
    for (const row of rows) {
      const a = row.selectFirst('a'), ch = locationOf(a.attr('href'),true), title = label(a);
      check(ch.work === loc.work && title, '目录章节归属或名称不符');
      if (!seen.has(ch.url)) { seen.add(ch.url); chapters.push({name:title,url:ch.url,dateUpload:''}); }
    }
    const cover = doc.selectFirst('.comic-cover-large img').attr('src');
    const tags = info.select('.comic-tags .tag').flatMap(el=>label(el).split(/\s+/)).filter(Boolean);
    const states = {'连载':0,'已完结':1,'完结':1}, state = tags.find(t => Object.hasOwn(states,t));
    return {name,link:loc.url,chapters:chapters.reverse(),imageUrl:cover ? picture(cover,loc.url) : '',
      author:(info.select('.comic-stats span').map(label).find(s=>/^作者[:：]/.test(s)) || '').replace(/^作者[:：]\s*/,''),
      description:label(doc.selectFirst('.comic-description p')),genre:tags.filter(t=>t!==state),status:states[state] ?? 5};
  }
  async getPageList(url) {
    const loc = locationOf(url,true), doc = await this.document(loc.url);
    const canonical = locationOf(doc.selectFirst('link[rel=canonical]').attr('href'),true);
    check(canonical.work === loc.work && canonical.chapter === loc.chapter, '章节归属不符');
    const flags = doc.select('script:not([src])').flatMap(s=>Array.from(s.text.matchAll(/\breadPic\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)));
    check(flags.length === 1 && flags[0][1] === loc.work && flags[0][2] === loc.chapter, '章节访问声明不符');
    check(flags[0][3] === '0' && flags[0][4] === '0', '本章需要源站登录或付费');
    let crumbs;
    try { crumbs = doc.select('script[type="application/ld+json"]').map(e=>JSON.parse(e.text)).find(v=>v?.['@type'] === 'BreadcrumbList'); }
    catch { throw Error('[漫画猫] 阅读导航数据无效'); }
    const owner = crumbs?.itemListElement?.find(x=>x.position === 2), current = crumbs?.itemListElement?.find(x=>x.position === 3);
    const bound = locationOf(current?.item,true);
    check(owner?.name && current.name && locationOf(owner.item).work === loc.work && bound.work === loc.work && bound.chapter === loc.chapter, '阅读导航归属不符');
    const images = doc.select('.comic-content img');
    check(images.length, '正文图片缺失');
    return images.map((img,i) => {
      check(img.attr('alt') === owner.name + ' - ' + current.name + ' - 第' + (i+1) + '张图', '正文图片页序不符');
      return {url:picture(img.attr('src'),loc.url),headers:this.getHeaders()};
    });
  }
}

return SourceExtension;
})();

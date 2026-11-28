// SPDX-License-Identifier: GPL-3.0-only
const ORIGIN = 'https://batcave.biz';
const work = /^(?:https:\/\/batcave\.biz)?(\/([1-9]\d*)-[^?#\\\s]+\.html)(?:[?#][^\s\\]*)?$/;
const reader = /^(?:https:\/\/batcave\.biz)?(\/reader\/([1-9]\d*)\/([1-9]\d*)(?:[^\d/?#\\\s][^/?#\\\s]*)?\/?(?:[?#][^\s\\]*)?)$/;
function check(ok, message) { if (!ok) throw Error('[BatCave] ' + message); }
function text(el) { return (el?.text || '').replace(/\s+/g, ' ').trim(); }
function cover(card) {
  const el = card.selectFirst('img');
  return el.attr('data-src') || el.attr('src');
}
function imageUrl(value, base) {
  check(typeof value === 'string' && value.trim(), '图片地址缺失');
  let url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = ORIGIN + url;
  else if (!/^[a-z][\w+.-]*:/i.test(url)) url = base.split(/[?#]/)[0].replace(/[^/]*$/, '') + url;
  check(/^https?:\/\/[^/@?#\\\s]+(?:[/?#][^\\\s]*)?$/i.test(url), '图片地址无效');
  return url;
}
function json(raw, message) {
  try { return JSON.parse(raw); } catch { throw Error('[BatCave] ' + message); }
}
function pageData(doc, loc) {
  // 阅读器会在 JSON 后执行截断广告图的脚本；只读取赋值，不执行站点代码。
  for (const el of doc.select('script:not([src])')) {
    const source = el.innerHtml, start = /^\s*window\.__DATA__\s*=\s*(?=\{)/.exec(source);
    if (!start) continue;
    const raw = source.slice(start[0].length);
    let depth = 0;
    for (const token of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}]/g)) {
      if (token[0] === '{') depth++;
      if (token[0] === '}' && --depth === 0) {
        const data = json(raw.slice(0, token.index+1), '页面数据无效');
        check(String(data.news_id) === loc[2] && (!loc[3] || String(data.chapter_id) === loc[3]), '页面与请求的作品或章节不符');
        return data;
      }
    }
  }
  throw Error('[BatCave] 页面数据缺失或不完整');
}
function uploaded(value) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[3], +m[2]-1, +m[1]));
  return d.getUTCMonth() === +m[2]-1 && d.getUTCDate() === +m[1] ? String(d.getTime()) : '';
}

class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:ORIGIN + '/'}; }
  getFilterList() { return []; }
  getSourcePreferences() { return []; }

  async read(url, body, headers = this.getHeaders()) {
    const res = body === undefined ? await this.client.get(url, headers) : await this.client.post(url, headers, body);
    check(res.statusCode !== 429, '源站限流，请稍后重试');
    check(!Object.entries(res.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') &&
      !/<title>\s*Just a moment|id=["']challenge-form["']|(?:location\s*=|location\.replace\()\s*["']\/_c\?/i.test(res.body),
      '请在来源网页完成验证后重试');
    check(res.statusCode !== 401 && res.statusCode !== 403, '源站拒绝访问，请在来源网页核对后重试');
    check(res.statusCode === 200 && typeof res.body === 'string', '请求失败：HTTP ' + res.statusCode);
    return res.body;
  }
  async listing(page, path, latest, sort) {
    check(Number.isSafeInteger(page) && page > 0, '页码无效');
    const at = n => ORIGIN + path + (n === 1 ? '' : 'page/' + n + '/');
    const doc = new Document(await this.read(at(page), sort));
    const list = [], seen = new Set();
    for (const card of doc.select(latest ? '#content-load > .latest.grid-item' : 'main .readed, #dle-content > .readed')) {
      const a = card.selectFirst(latest ? '.latest__title > a' : '.readed__title > a');
      const loc = work.exec(a.attr('href')), name = text(a);
      check(loc && name, '作品卡片缺少名称或链接');
      if (seen.has(loc[2])) continue;
      seen.add(loc[2]);
      const img = cover(card);
      list.push({name, link:ORIGIN + loc[1], imageUrl:img && !img.startsWith('data:') ? imageUrl(img, at(page)) : ORIGIN + '/uploads/posts/hd/' + loc[2] + '.webp'});
    }
    // 分页栏还包含上一页和末页；只接受当前条件下的下一页。
    const next = doc.select('.pagination__pages a[href], li.pagination a[href]').some(a => {
      const href = a.attr('href').replace(/\/?$/, '/');
      return href === at(page+1) || ORIGIN + href === at(page+1);
    });
    check(list.length || !next && path.startsWith('/search/') &&
      /\bYour query found 0 answers\b/i.test(text(doc.selectFirst('main'))),
      '没有取得作品列表或明确的空搜索结果');
    return {list, hasNextPage:next};
  }
  getPopular(page) {
    return this.listing(page, '/comix/', false, {dlenewssortby:'rating', dledirection:'desc', set_new_sort:'dle_sort_cat_1', set_direction_sort:'dle_direction_cat_1'});
  }
  getLatestUpdates(page) { return this.listing(page, '/', true); }
  search(query, page) {
    const q = query.trim();
    return q ? this.listing(page, '/search/' + encodeURIComponent(q) + '/', false) : this.getPopular(page);
  }

  browserMangaPreview({document:doc, url, anchor}) {
    // 此方法会脱离插件单独运行；同时兼容浏览器 DOM 与 URL 回退的 QuickJS DOM。
    const one = (root, sel) => root.querySelector ? root.querySelector(sel) : root.selectFirst(sel);
    const attr = (el,k) => el?.getAttribute ? el.getAttribute(k) : el?.attr(k);
    const label = el => (el?.textContent ?? el?.text ?? '').replace(/\s+/g,' ').trim();
    const book = href => /^(?:https:\/\/batcave\.biz)?(\/([1-9]\d*)-[^?#\\\s]+\.html)(?:[?#][^\s\\]*)?$/.exec(href);
    const issue = href => /^(?:https:\/\/batcave\.biz)?\/reader\/([1-9]\d*)\/([1-9]\d*)(?:[^\d/?#\\\s][^/?#\\\s]*)?\/?(?:[?#][^\s\\]*)?$/.exec(href);
    const target = book(url), ch = issue(url);
    if (!target && !ch) return null;
    const result = (loc, name, img, chapterName) => {
      if (!loc || !name) return null;
      let imageUrl;
      if (img && doc.baseURI) {
        try { const u = new URL(img, doc.baseURI); if (/^https?:$/.test(u.protocol)) imageUrl = u.href; } catch {}
      } else if (img && !/^data:/i.test(img)) imageUrl = img;
      return {name, link:'https://batcave.biz' + loc[1], imageUrl, chapterName:chapterName || undefined};
    };
    if (anchor) {
      const card = anchor.closest('.readed, .latest, a.poster');
      if (card) {
        const a = card.matches('a.poster') ? card : one(card, '.readed__title > a, .latest__title > a');
        const loc = book(attr(a,'href')), img = one(card,'img');
        if (loc?.[2] !== (target?.[2] || ch?.[1])) return null;
        return result(loc, label(one(card,'.poster__title') || a), attr(img,'data-src') || attr(img,'src'));
      }
      if (!ch) return null;
    }
    const canonical = attr(one(doc,'link[rel=canonical]'),'href') || doc.URL;
    const loc = book(canonical);
    if (loc) {
      if (loc[2] !== (target?.[2] || ch?.[1]) || (!anchor && !target)) return null;
      const img = one(doc,'.page__poster img');
      // 验证页也可能保留作品 URL 和 h1，必须使用作品页的标题区域。
      return result(loc, label(one(doc,'.page__header h1')), attr(img,'data-src') || attr(img,'src'), anchor && label(anchor));
    }
    const current = issue(canonical);
    if (anchor || !ch || current?.[1] !== ch[1] || current[2] !== ch[2]) return null;
    const a = one(doc,'a.header__post-link'), parent = book(attr(a,'href'));
    return parent?.[2] === ch[1] ? result(parent, label(a), undefined, label(one(doc,'h1.chapter__selector-trigger__title'))) : null;
  }
  async resolveBrowserManga(url) {
    const loc = work.exec(url) || reader.exec(url);
    if (!loc) return null;
    const doc = new Document(await this.read(ORIGIN + loc[1].split('#')[0]));
    let summary = this.browserMangaPreview({document:doc, url});
    // 部分阅读页没有标题导航；内嵌的父作品链接必须和请求的作品、章节 ID 对齐。
    if (!summary && loc[3]) {
      const canonical = reader.exec(doc.selectFirst('link[rel=canonical]').attr('href') || url);
      check(canonical?.[2] === loc[2] && canonical[3] === loc[3], '阅读页与章节不符');
      const data = pageData(doc, loc), parent = work.exec(data.post_link);
      if (parent?.[2] === loc[2] && typeof data.post_title === 'string' && data.post_title.trim())
        summary = {name:data.post_title.trim(), link:ORIGIN + parent[1]};
    }
    check(summary, '作品摘要缺失或归属不符');
    if (summary.imageUrl) summary.imageUrl = imageUrl(summary.imageUrl, summary.link);
    return summary;
  }
  async getDetail(url) {
    const loc = work.exec(url);
    check(loc, '作品地址无效');
    const doc = new Document(await this.read(ORIGIN + loc[1])), data = pageData(doc, loc);
    const canonical = work.exec(doc.selectFirst('link[rel=canonical]').attr('href') || url);
    const name = data.title || text(doc.selectFirst('h1'));
    check(canonical?.[2] === loc[2] && typeof name === 'string' && name.trim(), '作品标题或归属不符');
    check(Array.isArray(data.chapters), '完整目录缺失');
    const total = /Chapters\s*\(([\d,]+)\)/i.exec(text(doc.selectFirst('[data-tab=chapters]')));
    const chapters = [], seen = new Set();
    for (const row of data.chapters) {
      check(/^[1-9]\d*$/.test(row?.id) && typeof row.title === 'string' && row.title.trim(), '目录含无效章节');
      const url = ORIGIN + '/reader/' + loc[2] + '/' + row.id + (data.xhash ?? '');
      check(reader.exec(url)?.[3] === String(row.id), '章节地址无效');
      if (!seen.has(url)) { seen.add(url); chapters.push({name:row.title.trim(), url, dateUpload:uploaded(row.date)}); }
    }
    check(total ? chapters.length === Number(total[1].replace(/,/g,'')) : chapters.length, '目录不完整');
    const fields = {};
    for (const li of doc.select('.page__list > li')) {
      const key = text(li.selectFirst('div'));
      if (key) fields[key.replace(/:$/, '')] = text(li).slice(key.length).trim();
    }
    const img = cover(doc.selectFirst('.page__poster'));
    return {name, link:ORIGIN + canonical[1], chapters, imageUrl:img ? imageUrl(img, ORIGIN + canonical[1]) : '', description:text(doc.selectFirst('.page__text')),
      author:fields.Writer, artist:fields.Artist, genre:doc.select('.page__tags a').map(text), status:({Ongoing:0, Completed:1})[fields['Release type']] ?? 5};
  }
  async getPageList(url) {
    const loc = reader.exec(url);
    check(loc, '章节地址无效');
    const chapterUrl = ORIGIN + loc[1].split('#')[0];
    const doc = new Document(await this.read(chapterUrl)), data = pageData(doc, loc);
    const canonical = reader.exec(doc.selectFirst('link[rel=canonical]').attr('href') || url);
    check(canonical?.[2] === loc[2] && canonical[3] === loc[3], '阅读页与章节不符');
    check(!data.post_link || work.exec(data.post_link)?.[2] === loc[2], '阅读页不属于当前作品');
    const count = Number(data.pages);
    check(Number.isSafeInteger(count) && count > 0, '章节不可读或页数缺失');
    let images = data.images;
    let imageBase = chapterUrl;
    if (data.rdr_ajax && (!Array.isArray(images) || images.length < count)) {
      // 仅在阅读器声明异步加载时请求章节清单，保留原链接的后缀作 Referer。
      const response = await this.read(ORIGIN + '/engine/ajax/controller.php?mod=api&action=reader/getChapterData',
        {news_id:loc[2], chapter_id:loc[3]}, {Referer:chapterUrl, 'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest'});
      const payload = json(response, '章节接口响应无效')?.data;
      check((payload?.news_id == null || String(payload.news_id) === loc[2]) &&
        (payload?.chapter_id == null || String(payload.chapter_id) === loc[3]), '章节接口归属不符');
      images = payload?.images;
      imageBase = ORIGIN + '/';
    }
    check(Array.isArray(images) && images.length >= count, '正文页数不完整');
    // 源站在 pages 之后可能附加推广图片，正文中的重复页槽不能去重。
    return images.slice(0,count).map(value => ({url:imageUrl(value, imageBase), headers:this.getHeaders()}));
  }
}

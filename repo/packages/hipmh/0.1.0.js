// SPDX-License-Identifier: GPL-3.0-only
// NodeLane hipmh; corresponding source: sources/hipmh/0.1.0/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// The site's reader selects the image line and decodes the manifest before populating data-src.
function readHipmhPages(url, hid, owner) {
  if (window.__nodeLaneHipmhReader) return;
  window.__nodeLaneHipmhReader = true;
  const run = async () => {
    let result;
    try {
      const deadline = Date.now() + 25000, expected = new URL(url);
      for (;;) {
        if (document.querySelector('#challenge-form, #challenge-running') || /just a moment/i.test(document.title))
          throw Error('请在来源网页完成验证后重试');
        if (location.origin !== expected.origin || location.pathname !== expected.pathname)
          throw Error('阅读页已跳转，章节归属不符');
        const reader = document.getElementById('chapcontent');
        const error = reader?.querySelector('.chapter-error-container');
        if (error) throw Error(error.dataset.state === 'unavailable' ? '源站已下架本章或章节不存在' : '源站阅读器加载失败，请重试');
        if (reader?.hasAttribute('data-total-images')) {
          if (reader.dataset.frontendHid !== hid || reader.dataset.mangaId !== owner ||
              (reader.dataset.chapterNumber && reader.dataset.chapterNum && Number(reader.dataset.chapterNumber) !== Number(reader.dataset.chapterNum)))
            throw Error('阅读页与请求的作品或章节不符');
          const images = Array.from(reader.querySelectorAll('img.chapter-image'));
          if (!images.length || images.length !== Number(reader.dataset.totalImages)) throw Error('正文页数不完整');
          const urls = images.map((img, i) => {
            if (img.dataset.index !== String(i) || !img.dataset.src?.trim()) throw Error('正文页位或图片地址缺失');
            return new URL(img.dataset.src, location.href).href;
          });
          result = {urls};
          break;
        }
        if (!reader && document.readyState === 'complete') throw Error('阅读器结构缺失');
        if (Date.now() >= deadline) throw Error('等待阅读器生成正文清单超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (e) {
      // Browser URL errors can include a full image URL.
      result = {error:e instanceof TypeError ? '正文图片地址或阅读器数据无效' : e.message};
    }
    await window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(result));
  };
  if (window.flutter_inappwebview?.callHandler) void run();
  else window.addEventListener('flutterInAppWebViewPlatformReady', run, {once:true});
}

// SPDX-License-Identifier: GPL-3.0-only
const HOME = 'https://m.hipmh.com', READER = 'https://reader.hipmh.top';
const FILTERS = [
  ['sort', '排序', [['人氣','popular'], ['更新','updated'], ['新上架','latest']]],
  ['category', '地區', [['全部',''], ['國漫','2'], ['韓漫','1'], ['日漫','3']]],
  ['status', '狀態', [['全部',''], ['連載中','ongoing'], ['已完結','completed']]],
  ['genre', '熱門題材', [['全部',''], ['系統','67'], ['玄幻','27'], ['穿越','20'], ['大女主','30'],
    ['逆襲','32'], ['武俠','39'], ['重生','46'], ['動作','40'], ['冒險','38'], ['復仇','31']]],
];
function check(ok, message) { if (!ok) throw Error('嬉皮漫畫：' + message); }

// The first base64url segment identifies the owner; the chapter suffix is part of its public URL.
function identity(value, chapter = false) {
  check(typeof value === 'string' && /^[A-Za-z0-9_]+(?:-[^/?#\s\\]+)?$/.test(value), '作品或章节标识无效');
  const token = value.split('-', 1)[0], alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let bits = 0, buffer = 0, text = '';
  for (const c of token) {
    buffer = buffer << 6 | alphabet.indexOf(c);
    bits += 6;
    if (bits >= 8) { bits -= 8; text += String.fromCharCode(buffer >> bits & 255); }
  }
  const match = (chapter ? /^m:(\d+)-c:\d+$/ : /^m:(\d+)$/).exec(text);
  check(match && (!chapter || value.includes('-')), '作品或章节标识无效');
  return {mid:token, owner:match[1]};
}
function imageUrl(value) {
  check(typeof value === 'string', '图片地址无效');
  const url = value.trim().replace(/ /g, '%20');
  check(/^https?:\/\/[^/?#\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url), '图片协议或地址无效');
  return url;
}
function cover(item) {
  const path = item.vertical_image_url || item.cover_image_url;
  if (!path) return '';
  check(typeof path === 'string', '封面地址无效');
  return imageUrl(path.startsWith('//') ? 'https:' + path : /^[a-z][\w+.-]*:/i.test(path) ? path :
    'https://cover.s3imgs.top/' + path.replace(/^\//,''));
}
function checkStatus(status) {
  check(status !== 429, '源站限流，请稍后重试');
  check(status !== 401 && status !== 403, '源站拒绝访问，请在来源网页核对');
  check(status !== 404 && status !== 410, '源站找不到该内容（' + status + '）');
  check(status === 200, '请求失败（' + status + '）');
}
function pagination(data, rows, page) {
  check(Array.isArray(rows) && data.page === page && Number.isSafeInteger(data.total) && data.total >= 0 &&
    Number.isSafeInteger(data.total_pages) && data.total_pages >= 0, '分页数据不完整');
  if (data.total === 0) check(!rows.length && data.total_pages <= 1, '空列表与总数不一致');
  else check(data.total_pages >= 1 && rows.length <= data.total && (page <= data.total_pages) === (rows.length > 0),
    '列表与总数不一致');
}
class Hipmh extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:HOME + '/'}; }
  getSourcePreferences() { return []; }
  getFilterList() {
    return FILTERS.map(([type,name,options]) => ({type,name,type_name:'SelectFilter',state:0,
      values:options.map(([name,value]) => ({name,value,type_name:'SelectOption'}))}));
  }
  async api(path, params) {
    const query = Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
    const {body, statusCode, headers} = await this.client.get(this.source.apiUrl + '/v1/' + path + '?' + query,
      {...this.getHeaders(), Accept:'application/json'});
    check(!Object.entries(headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') &&
      !(/^\s*</.test(body) && /challenge-form|<title>\s*Just a moment/i.test(body)), '请在来源网页完成验证后重试');
    checkStatus(statusCode);
    let response;
    try { response = JSON.parse(body); } catch { throw Error('嬉皮漫畫：接口未返回有效 JSON'); }
    check(Number.isInteger(response?.code), '接口响应不完整');
    checkStatus(response.code);
    check(response.data && typeof response.data === 'object', '接口数据缺失');
    return response.data;
  }
  async listing(page, params) {
    check(Number.isSafeInteger(page) && page >= 1, '页码无效');
    const search = Boolean(params.q);
    const data = search ? await this.api('search', {...params, page, page_size:20}) :
      await this.api('mangas', {...params, page, per_page:18});
    const rows = search ? data.data : data.items;
    pagination(data, rows, page);
    const list = [], seen = new Set();
    for (const item of rows) {
      const {mid} = identity(search ? item?.id : item?.mid);
      if (seen.has(mid)) continue;
      check(typeof item.title === 'string' && item.title.trim(), '作品标题缺失');
      seen.add(mid);
      list.push({name:item.title.trim(), link:HOME + '/works/' + mid, imageUrl:cover(item)});
    }
    return {list, hasNextPage:page < data.total_pages};
  }
  getPopular(page) { return this.listing(page, {sort:'popular'}); }
  getLatestUpdates(page) { return this.listing(page, {sort:'updated'}); }
  search(query, page, filters = []) {
    if (query.trim()) return this.listing(page, {q:query.trim()});
    const params = {};
    for (const [type,, options] of FILTERS) {
      const state = filters.find(f => f.type === type)?.state ?? 0;
      check(Number.isInteger(state) && options[state], '筛选选项无效，请重置筛选');
      if (options[state][1]) params[type] = options[state][1];
    }
    return this.listing(page, params);
  }
  async getDetail(url) {
    const path = /^https:\/\/m\.hipmh\.com\/(?:zh\/)?works\/([^/?#]+)\/?(?:[?#].*)?$/.exec(url);
    check(path, '作品地址无效');
    const {mid, owner} = identity(path[1]), info = await this.api('manga', {mid});
    check(String(info.id) === owner, '详情不属于当前作品');
    check(typeof info.title === 'string' && info.title.trim() &&
      Number.isSafeInteger(info.total_chapters) && info.total_chapters >= 0, '作品标题或章节总数缺失');
    const chapters = [], seen = new Set();
    let last;
    for (let page = 1; ; page++) {
      const data = await this.api('manga/chapters', {mid, page, per_page:50, order:'desc'});
      pagination(data, data.items, page);
      check(data.total === info.total_chapters && (last === undefined || data.total_pages === last),
        '目录总数或分页发生变化，请重试');
      last = data.total_pages;
      const before = chapters.length;
      for (const row of data.items) {
        check(identity(row?.hid, true).owner === owner, '目录中有不属于当前作品的章节');
        const link = READER + '/chapter/' + row.hid;
        if (seen.has(link)) continue;
        const name = row.title?.trim() || (Number.isFinite(row.chapter_number) ? '第' + row.chapter_number + '話' : '');
        check(name, '章节标题缺失');
        const ms = Date.parse(row.created_at);
        seen.add(link);
        chapters.push({name, url:link, dateUpload:ms > 0 ? String(ms) : ''});
      }
      if (page >= last) break;
      check(chapters.length > before && chapters.length < data.total, '章节分页重复或未推进');
    }
    check(chapters.length === info.total_chapters, '章节目录不完整，请重试');
    const names = rows => (rows ?? []).map(row => row.name).filter(Boolean);
    return {name:info.title.trim(), link:HOME + '/works/' + mid, imageUrl:cover(info), description:info.description || '',
      author:names(info.authors).join('、'), genre:[...names(info.categories), ...names(info.genres)],
      status:({ongoing:0, completed:1, hiatus:2})[info.status] ?? 5, chapters};
  }
  async getPageList(url) {
    const path = /^https:\/\/reader\.hipmh\.top\/(?:zh\/)?chapter\/([^/?#]+)\/?(?:[?#].*)?$/.exec(url);
    check(path, '章节地址无效');
    const hid = path[1], {owner} = identity(hid, true);
    const script = '(' + readHipmhPages.toString() + ')(' + [url,hid,owner].map(v => JSON.stringify(v)).join(',') + ');';
    const raw = await evaluateJavascriptViaWebview(url, this.getHeaders(), [script], 35);
    check(raw, '阅读器未返回结果或已超时，请重试');
    let result;
    try { result = JSON.parse(raw); } catch { throw Error('嬉皮漫畫：阅读器返回格式无效'); }
    if (result?.error) throw Error('嬉皮漫畫：' + result.error);
    check(Array.isArray(result?.urls) && result.urls.length, '阅读器未提供正文图片');
    return result.urls.map(value => ({url:imageUrl(value), headers:{Referer:READER + '/'}}));
  }
}

return Hipmh;
})();

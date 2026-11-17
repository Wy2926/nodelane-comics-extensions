// SPDX-License-Identifier: GPL-3.0-only
// NodeLane jinmantiantang; corresponding source: sources/jinmantiantang/0.1.0/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// API and image protocol reference: Keiyoushi b0353107338f4d7eb110a70f0c5ff83f83f75fba, src/zh/jinmantiantang.
const JM_ORIGIN = 'https://18comic.vip';
// shortcut: 固定上游 API 节点，节点失效时更新或接入上游选线。
const JM_API = 'https://www.cdngwc.net';
const JM_SECRET = '185Hcomic3PAPP7R';
const JM_SORTS = [['最新', 'mr'], ['最多浏览', 'mv'], ['最多爱心', 'tf'], ['最多图片', 'mp']];
function jmRequire(value, code, message) {
  if (!value) throw Error('[JM:' + code + '] ' + message);
}
function jmId(value) {
  jmRequire((typeof value === 'string' || Number.isSafeInteger(value)) &&
    /^[1-9]\d*$/.test(String(value)), 'identity', '作品或章节编号无效');
  return String(value);
}
function jmLocation(value, chapter = false) {
  jmRequire(typeof value === 'string', 'url', '作品或章节地址无效');
  const match = /^https:\/\/18comic\.vip\/(album|photo)\/([1-9]\d*)\/?(?:\?([^#]*))?(?:#.*)?$/.exec(value);
  jmRequire(match && match[1] === (chapter ? 'photo' : 'album'), 'url', '地址不属于当前来源');
  const owners = (match[3] || '').split('&').filter(p => p.startsWith('album_id='));
  jmRequire(!chapter || owners.length === 1, 'chapter-owner', '章节缺少作品身份，请刷新目录');
  return {id:match[2], owner:chapter ? jmId(owners[0].slice(9)) : match[2]};
}
function jmImage(value) {
  jmRequire(typeof value === 'string' && value.trim() && !/[\\\u0000-\u001f]/.test(value), 'image-url', '图片地址无效');
  let url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = JM_ORIGIN + url;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = JM_ORIGIN + '/' + url;
  jmRequire(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url), 'image-url', '图片地址协议无效');
  return url;
}
function jmText(value) {
  jmRequire(typeof value === 'string', 'response', '文字字段格式无效');
  return new Document('<span>' + value.replace(/</g, '&lt;') + '</span>').selectFirst('span').text.trim();
}
function jmStrings(value) {
  jmRequire(value === undefined || Array.isArray(value) && value.every(v => typeof v === 'string'), 'response', '作品资料格式无效');
  return value || [];
}
function jmBook(item) {
  jmRequire(item && typeof item === 'object', 'listing', '作品资料缺失');
  const id = jmId(item.id), name = jmText(item.name);
  jmRequire(name, 'listing', '作品标题缺失');
  return {name, link:JM_ORIGIN + '/album/' + id + '/',
    imageUrl:'https://cdn-msp.18comic.vip/media/albums/' + id + '_3x4.jpg'};
}
function jmDate(seconds) {
  const n = Number(seconds) * 1000;
  return /^\d+$/.test(String(seconds)) && Number.isSafeInteger(n) && n > 0 && n <= 8640000000000000 ? String(n) : '';
}
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:JM_ORIGIN + '/'}; }
  getSourcePreferences() { return []; }
  getFilterList() {
    return [{type:'sort', name:'排序', type_name:'SelectFilter', state:0,
      values:JM_SORTS.map(([name,value]) => ({name,value,type_name:'SelectOption'}))}];
  }
  async api(path, params) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = md5(timestamp + JM_SECRET);
    let response;
    try {
      response = await this.client.get(JM_API + '/' + path + '?' +
        Object.entries({...params, lang:'CN'}).map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'),
      {...this.getHeaders(), Accept:'application/json', Token:key, Tokenparam:timestamp + ',2.1.12'});
    } catch { throw Error('[JM:network] 请求失败，请检查网络后重试'); }
    const body = response.body;
    if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
        /<title>\s*Just a moment|id=["']challenge-form["']/i.test(body || ''))
      throw Error('[JM:verification] 源站要求网页验证，请完成验证后重试');
    jmRequire(response.statusCode !== 429, 'rate-limit', '源站限流，请稍后重试');
    jmRequire(response.statusCode !== 401 && response.statusCode !== 403, 'access', '源站拒绝访问');
    jmRequire(response.statusCode === 200, 'http', '请求失败（HTTP ' + response.statusCode + '）');
    let envelope;
    try { envelope = JSON.parse(body); } catch { throw Error('[JM:response] 接口未返回有效 JSON'); }
    jmRequire(envelope && typeof envelope === 'object', 'response', '接口响应缺失');
    jmRequire(envelope.code !== 429, 'rate-limit', '源站限流，请稍后重试');
    jmRequire(envelope.code !== 401 && envelope.code !== 403, 'access', '源站拒绝访问');
    jmRequire(envelope.code === 200, 'api', '源站接口失败，请稍后重试');
    let data = envelope.data;
    if (typeof data === 'string') {
      try {
        const keyHex = Array.from(key, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
        data = JSON.parse(decryptAESECB(data, keyHex));
      } catch { throw Error('[JM:decode] 接口解码失败，请更新来源或重试'); }
    }
    jmRequire(data !== null && typeof data === 'object', 'response', '接口数据缺失');
    return data;
  }
  async listing(page, query, order) {
    jmRequire(Number.isSafeInteger(page) && page > 0, 'page', '页码无效');
    const data = await this.api(query ? 'search' : 'categories/filter', query
      ? {search_query:query, o:order, search_type:'site', page}
      : {page, c:'0', o:order});
    if (data.redirect_aid) return {list:[jmBook(await this.album(jmId(data.redirect_aid), true))], hasNextPage:false};
    const total = Number(data.total);
    jmRequire(Array.isArray(data.content) && /^\d+$/.test(String(data.total)) && Number.isSafeInteger(total),
      'listing', '作品列表或总数缺失');
    jmRequire(data.content.length || (page - 1) * 80 >= total, 'listing', '接口返回了不完整的空列表');
    const list = data.content.map(jmBook);
    return {list, hasNextPage:page * 80 < total};
  }
  getPopular(page) { return this.listing(page, '', 'mv'); }
  getLatestUpdates(page) { return this.listing(page, '', 'mr'); }
  async search(query, page, filters = []) {
    jmRequire(typeof query === 'string' && Array.isArray(filters), 'search', '搜索条件无效');
    jmRequire(Number.isSafeInteger(page) && page > 0, 'page', '页码无效');
    const text = query.trim(), id = /^(?:JM\s*:?\s*)?([1-9]\d*)$/i.exec(text);
    if (id) {
      if (page > 1) return {list:[], hasNextPage:false};
      const data = await this.album(id[1], true, true);
      return {list:data ? [jmBook(data)] : [], hasNextPage:false};
    }
    const sort = filters.find(f => f.type === 'sort');
    jmRequire(!sort || Number.isInteger(sort.state) && JM_SORTS[sort.state], 'filter', '请重置排序筛选');
    return this.listing(page, text, JM_SORTS[sort?.state || 0][1]);
  }
  async album(id, resolveParent = false, allowMissing = false) {
    let data = await this.api('album', {id});
    if (Array.isArray(data) && !data.length && allowMissing) return null;
    jmRequire(!Array.isArray(data) && jmId(data.id) === id, 'identity', '作品不存在或响应身份不一致');
    const parent = String(data.series_id);
    if (resolveParent && parent !== '0' && parent !== id) {
      data = await this.album(jmId(parent));
    } else {
      jmRequire(parent === '0' || parent === id, 'identity', '此编号属于章节，请搜索作品编号');
    }
    return data;
  }
  async getDetail(url) {
    const {id} = jmLocation(url), data = await this.album(id), book = jmBook(data);
    jmRequire(Array.isArray(data.series), 'catalog', '完整章节目录缺失');
    const date = jmDate(data.addtime), seen = new Set();
    const series = data.series.length ? data.series : [{id, name:'单章节'}];
    const chapters = series.map((item, index) => {
      const chapter = jmId(item.id);
      jmRequire(!seen.has(chapter), 'catalog', '章节目录存在重复身份，请重试');
      seen.add(chapter);
      const name = jmText(item.name);
      return {name:name || '第' + (item.sort || index + 1) + '话',
        url:JM_ORIGIN + '/photo/' + chapter + '?album_id=' + id,
        dateUpload:index === series.length - 1 ? date : ''};
    }).reverse();
    const tags = jmStrings(data.tags);
    return {...book, author:jmStrings(data.author).join(', '), description:jmText(data.description || ''),
      genre:tags, status:tags.includes('完结') ? 1 : tags.some(t => t === '连载中' || t === '连载') ? 0 : 5, chapters};
  }
  async getPageList(url) {
    const {id, owner} = jmLocation(url, true);
    const data = await this.api('comic_read', {id, express:''});
    jmRequire(jmId(data.id) === id &&
      (String(data.series_id) === owner || String(data.series_id) === '0' && owner === id),
    'chapter-owner', '正文不属于当前作品或章节');
    const total = Number(data.total_page);
    jmRequire(/^\d+$/.test(String(data.total_page)) && total > 0 && Array.isArray(data.images) &&
      data.images.length === total, 'pages', '正文图片清单不完整');
    jmRequire(/^\d+$/.test(String(data.scramble_id)), 'image-protocol', '图片还原协议缺失');
    return data.images.map((image, index) => {
      jmRequire(image && Number(image.page) === index + 1, 'page-order', '正文图片页位不连续');
      const imageUrl = jmImage(image.image), result = {url:imageUrl, headers:this.getHeaders()};
      if (Number(id) >= Number(data.scramble_id)) {
        let filename;
        try { filename = decodeURIComponent(imageUrl.split(/[?#]/)[0].split('/').pop()).split('.')[0]; }
        catch { throw Error('[JM:image-protocol] 图片文件名无法解析'); }
        jmRequire(filename, 'image-protocol', '图片还原标识缺失');
        const rows = Number(id) < 268850 ? 10 :
          2 * (md5(id + filename).slice(-1).charCodeAt(0) % (Number(id) < 421926 ? 10 : 8)) + 2;
        result.imageProcessing = {type:'strip-reverse-v1', rows, skipGif:true};
      }
      return result;
    });
  }
}

return SourceExtension;
})();

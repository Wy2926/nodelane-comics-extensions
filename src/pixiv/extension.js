// SPDX-License-Identifier: GPL-3.0-only
const origin = 'https://www.pixiv.net';
function check(ok, message) { if (!ok) throw Error('Pixiv：' + message); }
function id(value) {
  check((typeof value === 'string' || Number.isSafeInteger(value)) && /^[1-9]\d*$/.test(value), '作品或系列 ID 无效');
  return String(value);
}
function title(value) {
  check(typeof value === 'string' && value.trim(), '标题缺失');
  return value.trim();
}
function image(value) {
  check(typeof value === 'string' && /^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(value), '图片地址无效');
  return value;
}
const artwork = work => origin + '/artworks/' + id(work);
const series = (user, sid) => origin + '/user/' + id(user) + '/series/' + id(sid);
function chapter(row, binding = '') {
  const ms = Date.parse(row.createDate);
  return {name:title(row.title), url:artwork(row.id) + binding, dateUpload:ms > 0 ? String(ms) : ''};
}
function caption(html) {
  return html ? new Document('<body>' + html.replace(/<br\s*\/?>/gi, '\n') + '</body>').selectFirst('body').text.trim() : '';
}

class Pixiv extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:origin + '/'}; }

  async read(path) {
    const {statusCode, headers, body} = await this.client.get(origin + path, {...this.getHeaders(), Accept:'application/json'});
    check(statusCode !== 429, '请求过于频繁，请稍后重试');
    const challenge = Object.entries(headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
      (/^\s*</.test(body) && /challenge-form|Just a moment|captcha/i.test(body));
    check(!challenge, '请在源站完成验证后重试');
    check(statusCode !== 401, '请在 App 浏览器登录 Pixiv，然后返回来源重试');
    check(statusCode !== 403, '源站拒绝访问，请在 Pixiv 核对可见性');
    check(statusCode === 200, '请求失败（HTTP ' + statusCode + '）');
    let json;
    try { json = JSON.parse(body); } catch { throw Error('Pixiv：接口未返回有效 JSON'); }
    check(json?.error !== true, '源站未提供此内容，请在 Pixiv 核对可见性');
    check(json?.error === false && json.body != null, '接口数据不完整');
    return json.body;
  }

  async listing(page, path) {
    check(Number.isSafeInteger(page) && page >= 1, '页码无效');
    const data = await this.read(path + '&p=' + page);
    const rows = data?.illusts;
    check(Array.isArray(rows), '作品列表缺失');
    check(Number.isSafeInteger(data.lastPage) && data.lastPage >= page, '分页信息无效');
    const hasNextPage = page < data.lastPage;
    check(rows.length || (!hasNextPage && !(data.total > 0 && page === 1)), '作品列表不完整');
    return {list:this.entries(rows),hasNextPage};
  }
  entries(rows) {
    const list = [], seen = new Set();
    for (const row of rows) {
      if (row?.is_ad_container === 1 || row?.is_masked || row?.location_mask || row?.visible === false ||
          ((row?.is_private || row?.is_mypixiv) && row?.visible !== true)) continue;
      const type = String(row?.type);
      if (type === '2') continue; // Ugoira is an animation, not a still page.
      check(type === '0' || type === '1', '未知投稿类型');
      const group = row.series;
      let link, name;
      if (group) {
        const owner = id(group.user_id);
        check(owner === id(row.user_id), '系列作者不一致');
        link = series(owner, group.id);
        name = title(group.title);
      } else {
        link = artwork(row.id);
        name = title(row.title);
      }
      if (!seen.has(link)) { seen.add(link); list.push({link, name, imageUrl:row.url ? image(row.url) : ''}); }
    }
    return list;
  }
  async getPopular(page) {
    check(Number.isSafeInteger(page) && page >= 1, '页码无效');
    const {ranking} = await this.read('/touch/ajax/ranking/illust?mode=daily&type=manga&page=' + page);
    check(Array.isArray(ranking), '漫画榜单缺失');
    if (!ranking.length) return {list:[],hasNextPage:false};
    const ids = ranking.map(r => id(r.illustId));
    const {illust_details:rows} = await this.read('/touch/ajax/illust/details/many?' + ids.map(i=>'illust_ids%5B%5D='+i).join('&'));
    check(Array.isArray(rows), '榜单作品资料缺失');
    const byId = new Map(rows.map(r=>[id(r.id),r]));
    check(ids.every(i=>byId.has(i)), '榜单作品资料不完整');
    return {list:this.entries(ids.map(i=>byId.get(i))),hasNextPage:true};
  }
  getLatestUpdates(page) { return this.listing(page, '/touch/ajax/latest?type=manga'); }
  search(query, page) {
    const word = query.trim();
    if (/^https:\/\/www\.pixiv\.net\/(?:en\/)?(?:artworks\/[1-9]\d*|user\/[1-9]\d*\/series\/[1-9]\d*)\/?(?:\?[^#]*)?$/.test(word)) {
      if (page !== 1) return {list:[],hasNextPage:false};
      return this.getDetail(word).then(({link,name,imageUrl}) => ({list:[{link,name,imageUrl}],hasNextPage:false}));
    }
    return word ? this.listing(page, '/touch/ajax/search/illusts?s_mode=s_tag&mode=safe&order=date_d&word=' + encodeURIComponent(word)) : this.getPopular(page);
  }

  async work(workId) {
    const row = await this.read('/ajax/illust/' + workId);
    check(row?.id === workId, '返回的投稿与请求不一致');
    check(!row.isMasked && !row.locationMask, '投稿受限，请在 Pixiv 核对可见性');
    // A login-only work can still be readable for this viewer. Only use originals supplied by Pixiv.
    check(!row.isLoginOnly || row.urls?.original, '投稿受限，请在 App 浏览器登录 Pixiv 后重试');
    check(row.illustType !== 2, '暂不支持动图（Ugoira）');
    check(row.illustType === 0 || row.illustType === 1, '未知投稿类型');
    return row;
  }
  async getDetail(url) {
    const group = /^https:\/\/www\.pixiv\.net\/(?:en\/)?user\/([1-9]\d*)\/series\/([1-9]\d*)\/?(?:\?[^#]*)?$/.exec(url);
    if (group) return this.seriesDetail(group[1], group[2]);
    const match = /^https:\/\/www\.pixiv\.net\/(?:en\/)?artworks\/([1-9]\d*)\/?(?:\?[^#]*)?$/.exec(url);
    check(match, '不是 Pixiv 投稿或漫画系列地址');
    const row = await this.work(match[1]);
    return {name:title(row.title), link:artwork(row.id), author:row.userName, description:caption(row.description),
      imageUrl:row.urls?.small ? image(row.urls.small) : '', genre:row.tags?.tags?.map(t => t.tag) || [], chapters:[chapter(row)]};
  }
  async seriesDetail(owner, sid) {
    const chapters = [], seen = new Set();
    let total, detail;
    for (let page = 1; ; page++) {
      const body = await this.read('/ajax/series/' + sid + '?p=' + page);
      const info = body.illustSeries?.find(s => s.id === sid), part = body.page;
      check(info?.userId === owner && String(part?.seriesId) === sid, '返回的系列或作者与请求不一致');
      check(Number.isSafeInteger(part.total) && part.total >= 0 && (total === undefined || part.total === total) &&
        Array.isArray(part.series) && Array.isArray(body.thumbnails?.illust), '系列目录不完整或已变化');
      total = part.total;
      check(part.series.length <= total - chapters.length && (part.series.length || chapters.length === total), '系列目录提前结束或超出总数');
      if (!detail) detail = {link:series(owner, sid), name:title(info.title), author:body.users?.find(u => u.userId === owner)?.name,
        description:caption(info.description), imageUrl:info.url ? image(info.url) : '', chapters};
      const summaries = new Map(body.thumbnails.illust.map(row => [row.id, row]));
      for (const pos of part.series) {
        const key = id(pos.workId);
        check(!seen.has(key), '系列分页重复，请刷新目录');
        seen.add(key);
        // Some series omit an artwork from thumbnails; the ordered membership list is authoritative.
        const row = summaries.get(key) || await this.read('/ajax/illust/' + key);
        check(row.id === key && row.userId === owner && (row.seriesId == null || String(row.seriesId) === sid), '系列章节归属不一致');
        chapters.push(chapter(row, '#series=' + sid + '&user=' + owner));
      }
      if (chapters.length === total) return detail;
    }
  }
  async getPageList(url) {
    const match = /^https:\/\/www\.pixiv\.net\/(?:en\/)?artworks\/([1-9]\d*)\/?(?:\?[^#]*)?(?:#series=([1-9]\d*)&user=([1-9]\d*))?$/.exec(url);
    check(match, '不是 Pixiv 投稿地址');
    const [, key, sid, owner] = match, row = await this.work(key);
    check(!sid || (String(row.seriesNavData?.seriesId) === sid && row.userId === owner), '投稿已不属于当前系列');
    const pages = await this.read('/ajax/illust/' + key + '/pages');
    check(Array.isArray(pages) && pages.length > 0 && pages.length === row.pageCount, '投稿页数不完整');
    return pages.map(p => ({url:image(p?.urls?.original), headers:this.getHeaders()}));
  }
}

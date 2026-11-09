// SPDX-License-Identifier: GPL-3.0-only
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:AS_ORIGIN + '/'}; }
  getSourcePreferences() { return []; }
  getFilterList() {
    const options = values => values.map(([name,value]) => ({name,value,type_name:'SelectOption'}));
    return [{type:'sort',name:'排序',type_name:'SortFilter',state:{index:0,ascending:false,type_name:'SortState'},values:options(AS_SORTS)},
      ...AS_SELECTS.map(([type,name,values]) => ({type,name,type_name:'SelectFilter',state:0,values:options(values)})),
      {type:'genres',name:'题材',type_name:'GroupFilter',state:AS_GENRES.map(([name,value]) => ({name,value,type_name:'CheckBox',state:false}))},
      ...[['author','作者（网站名称）'],['artist','画师（网站名称）'],['min_chapters','最少章节数']].map(([type,name]) => ({type,name,type_name:'TextFilter',state:''}))];
  }
  async read(url) {
    const response = await this.client.get(url, this.getHeaders()), body = response.body;
    if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
      /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body || ''))
      throw asError('verification','Cloudflare 验证或封禁，请在来源网页处理后重试');
    if (response.statusCode === 429) throw asError('rate-limit','请求过于频繁，请稍后重试');
    if (response.statusCode === 401 || response.statusCode === 403) throw asError('access','源站拒绝访问，请在来源网页核对');
    if (response.statusCode !== 200) throw asError('http','请求失败（HTTP ' + response.statusCode + '）');
    return body;
  }
  async listing(page, params) {
    asRequire(Number.isInteger(page) && page >= 1, 'page', '页码应从 1 开始');
    const query = Object.entries({offset:(page-1)*20,limit:20,...params}).filter(([,v]) => v !== '').map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
    return asListing(await this.read(AS_API + '/series?' + query),page);
  }
  getPopular(page) { return this.listing(page,{sort:'popular',order:'desc'}); }
  getLatestUpdates(page) { return this.listing(page,{sort:'latest',order:'desc'}); }
  search(query,page,filters=[]) {
    const params = {search:query.trim(),sort:'latest',order:'desc'};
    for (const filter of filters) {
      const def = AS_SELECTS.find(([type]) => type === filter.type);
      if (def) {
        asRequire(def[2][filter.state], 'filter', '筛选选项无效，请重置筛选');
        params[filter.type] = def[2][filter.state][1];
      } else if (filter.type === 'sort') {
        const state = filter.state;
        asRequire(AS_SORTS[state?.index], 'filter', '排序无效');
        params.sort = AS_SORTS[state.index][1]; params.order = state.ascending ? 'asc' : 'desc';
      } else if (filter.type === 'genres') {
        params.genres = filter.state.filter(v => v.state).map(v => v.value).join(',');
      } else if (['author','artist','min_chapters'].includes(filter.type)) {
        const value = filter.state.trim();
        asRequire(filter.type !== 'min_chapters' || value === '' || /^\d+$/.test(value), 'filter', '最少章节数应为非负整数');
        params[filter.type] = value;
      }
    }
    return this.listing(page,params);
  }
  async getDetail(url) { const loc = asLocation(url); return asDetail(await this.read(loc.url),loc); }
  async getPageList(url) { const loc = asLocation(url,true); return asPages(await this.read(loc.url),loc); }
}

// SPDX-License-Identifier: GPL-3.0-only
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:M18_ORIGIN + '/'}; }
  getFilterList() {
    return [{name:'关键词搜索忽略筛选；题材优先于分类。排序需搭配题材或原文分类。', type_name:'HeaderFilter'},
      ...M18_FILTERS.map(([type,name,values]) => ({type,name,type_name:'SelectFilter',state:0,
        values:values.map(([name,value]) => ({name,value,type_name:'SelectOption'}))}))];
  }
  getSourcePreferences() { return []; }
  async read(url) {
    const response = await this.client.get(url,this.getHeaders()), body = response.body;
    if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
      /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body || ''))
      throw m18Error('verification','Cloudflare 验证或封禁，请在来源网页处理后重试');
    if (response.statusCode === 429) throw m18Error('rate-limit','请求过于频繁，请稍后重试');
    if (response.statusCode === 401 || response.statusCode === 403) throw m18Error('access','源站拒绝访问，请在来源网页核对');
    if (response.statusCode !== 200) throw m18Error('http','请求失败（HTTP ' + response.statusCode + '）');
    m18Require(typeof body === 'string' && body.length <= 4 * 1024 * 1024,'response','响应格式或大小无效');
    return body;
  }
  async listing(spec,page) { return m18Listing(await this.read(m18ListUrl(spec,page)),spec,page); }
  getPopular(page) { return this.listing({kind:'popular'},page); }
  getLatestUpdates(page) { return this.listing({kind:'latest',path:'page'},page); }
  search(query,page,filters=[]) {
    m18Require(typeof query === 'string' && query.length <= 200 && Array.isArray(filters),'search','搜索条件无效');
    const params = {genre:'',category:'',sort:''}, seen = new Set();
    for (const filter of filters) {
      if (filter?.type_name === 'HeaderFilter') continue;
      const def = M18_FILTERS.find(([type]) => type === filter?.type);
      m18Require(def && !seen.has(filter.type) && filter.type_name === 'SelectFilter' && Number.isInteger(filter.state) &&
        filter.state >= 0 && filter.state < def[2].length,'filter','筛选选项无效，请重置筛选');
      seen.add(filter.type); params[filter.type] = def[2][filter.state][1];
    }
    const text = query.trim().replace(/\s+/g,' ').replace(/'/g,'’');
    if (text) return this.listing({kind:'search',query:text},page);
    const path = params.genre ? 'manga-genre/' + params.genre : params.category;
    m18Require(path || !params.sort,'filter','请先选择题材或原文分类，再使用排序');
    return path ? this.listing({kind:'category',path,sort:params.sort},page) : this.getLatestUpdates(page);
  }
  async getDetail(url) { const loc = m18Location(url); return m18Detail(await this.read(loc.url),loc); }
  async getPageList(url) { const loc = m18Location(url,true); return m18Pages(await this.read(loc.url),loc); }
}

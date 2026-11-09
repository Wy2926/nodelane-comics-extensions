// SPDX-License-Identifier: GPL-3.0-only
class SourceExtension extends MProvider {
  constructor() {super();this.client=new Client({timeout:25,connectTimeout:10});}
  get supportsLatest() {return true;}
  getHeaders() {return {Referer:BZ_ORIGIN+'/',Accept:'text/html'};}
  getSourcePreferences() {return [];}
  getFilterList() {
    return [{type_name:'HeaderFilter',name:'关键词搜索不应用筛选；最新为网站最新上架'},...BZ_FILTERS.map(([type,name,values])=>({type,name,type_name:'SelectFilter',state:0,values:values.map(([name,value])=>({name,value,type_name:'SelectOption'}))}))];
  }
  async read(url) {
    const response=await this.client.get(url,this.getHeaders()),body=response.body||'',headers=Object.fromEntries(Object.entries(response.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
    if (headers['x-gatekeeper-challenge']==='required' || /"error"\s*:\s*"challenge_required"|__gatekeeper_challenge\/start/.test(body)) throw bzError('verification','网站需要 Gatekeeper 验证，请打开来源网页完成后重试');
    if (headers['cf-mitigated']==='challenge' || /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body)) throw bzError('verification','Cloudflare 验证或封禁，请在来源网页处理后重试');
    if (response.statusCode===429) throw bzError('rate-limit','请求过于频繁，请稍后重试');
    if (response.statusCode===401 || response.statusCode===403) throw bzError('access','源站拒绝访问，请在来源网页核对');
    if (response.statusCode!==200) throw bzError('http','请求失败（HTTP '+response.statusCode+'）');
    return body;
  }
  async listing(page,filters=[]) {
    bzRequire(Number.isInteger(page) && page>=1,'page','页码应从 1 开始');
    const params={type:'all',region:'all',state:'all',filter:'*',page,limit:36,language:'cn'};
    for(const filter of filters) {const def=BZ_FILTERS.find(([type])=>type===filter.type);if(def){bzRequire(def[2][filter.state],'filter','筛选选项无效，请重置筛选');params[filter.type]=def[2][filter.state][1];}}
    return bzApiList(await this.read(BZ_ORIGIN+'/api/bzmhq/amp_comic_list?'+Object.entries(params).map(([k,v])=>k+'='+encodeURIComponent(v)).join('&')));
  }
  getPopular(page) {return this.listing(page);}
  async getLatestUpdates(page) {return page>1?{list:[],hasNextPage:false}:bzHtmlList(await this.read(BZ_ORIGIN+'/list/new'));}
  async search(query,page,filters=[]) {query=query.trim();if(!query)return this.listing(page,filters);return page>1?{list:[],hasNextPage:false}:bzHtmlList(await this.read(BZ_ORIGIN+'/search?q='+encodeURIComponent(query)),true);}
  async getDetail(url) {const loc=bzLocation(url);return bzDetail(await this.read(loc.url),loc);}
  async routeImages(pages) {
    if (!pages.some(page=>BZ_IMAGE_ORIGIN.test(page.url))) return pages;
    // Match the website's node selection without executing its script or downloading probe pixels.
    // Retry selection for each chapter load; a failed probe must not pin a broken route.
    for (const suffix of BZ_IMAGE_ROUTES) {
      try {
        const response=await this.client.head('https://s1'+suffix+BZ_IMAGE_PROBE,this.getHeaders());
        const type=Object.entries(response.headers||{}).find(([key])=>key.toLowerCase()==='content-type')?.[1]||'';
        if (response.statusCode!==200 || !/^image\//i.test(type)) continue;
        return pages.map(page=>({...page,url:page.url.replace(BZ_IMAGE_ORIGIN,(_,prefix)=>prefix+suffix)}));
      } catch (_) { /* The next source-declared node may still be reachable. */ }
    }
    return pages;
  }
  async getPageList(url) {
    const loc=bzLocation(url,true),pages=[];let next=loc.url,total,part=1;
    do {const result=bzReader(await this.read(bzReaderUrl(next)),loc,part,total);pages.push(...result.pages);next=result.next;total=result.total;part++;} while(next);
    return this.routeImages(pages);
  }
}

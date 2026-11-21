// SPDX-License-Identifier: GPL-3.0-only
// Port of Keiyoushi GigaViewer.kt, Queries.kt and Dto.kt; see gigaviewer-license.js.
const CARD = 'databaseId title thumbnailUri firstEpisode{permalink} firstVolume{permalink} latestVolume{thumbnailUri}';
const DETAIL = `query($id:String!){series(databaseId:$id){${CARD} author{name} description
  episodes:readableProducts(types:[EPISODE],first:0){totalCount}
  volumes:readableProducts(types:[VOLUME],first:0){totalCount}}}`;
const EMPTY = () => ({list:[],hasNextPage:false});
function check(ok, why) { if (!ok) throw Error('[GigaViewer] '+why); }
function isId(value) { return typeof value === 'string' && /^[1-9]\d*$/.test(value); }
function parseJson(raw) {
  try { return JSON.parse(raw); } catch (_) { throw Error('[GigaViewer] 源站 JSON 无效'); }
}
// GraphQL node IDs are base64 of ASCII "SerialGroup:<id>" or "Genre:<id>".
function nodeId(id) {
  const s = id.includes(':') ? id : 'SerialGroup:'+id;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i=0; i<s.length; i+=3) {
    const n = s.charCodeAt(i)<<16 | s.charCodeAt(i+1)<<8 | s.charCodeAt(i+2);
    out += chars[n>>>18] + chars[n>>>12&63] + (i+1<s.length ? chars[n>>>6&63] : '=') + (i+2<s.length ? chars[n&63] : '=');
  }
  return out;
}
class GigaViewer extends MProvider {
  constructor() {
    super();
    this.origin = this.source.baseUrl;
    this.client = new Client({timeout:25,connectTimeout:10});
  }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:this.origin+'/'}; }
  getSourcePreferences() {
    return [['hide_locked','隐藏付费章节'],['hide_unavailable','隐藏已停止公开的章节']].map(([key,title])=>
      ({key,switchPreferenceCompat:{title,value:false}}));
  }
  getFilterList() {
    return [{type:'collection',name:'作品分类',type_name:'SelectFilter',state:0,
      values:collections.map(([name],i)=>({type_name:'SelectOption',name,value:String(i)}))}];
  }
  async request(path, payload) {
    const url = this.origin+path;
    const {statusCode,headers,body} = payload
      ? await this.client.post(url,{...this.getHeaders(),'Content-Type':'application/json; charset=utf-8'},payload)
      : await this.client.get(url,this.getHeaders());
    check(!Object.entries(headers||{}).some(([k,v])=>k.toLowerCase()==='cf-mitigated' && v==='challenge') &&
      !/<title>\s*Just a moment|id=["']challenge-form["']/i.test(body), '请在源站完成验证后重试');
    check(statusCode!==429,'源站限流，请稍后重试');
    check(statusCode!==401 && statusCode!==403,'源站拒绝访问，请核对阅读权限');
    check(statusCode===200,'源站请求失败：HTTP '+statusCode);
    return body;
  }
  async gql(query, variables={}) {
    const result = parseJson(await this.request('/graphql',{query,variables}));
    check(result?.data && !result.errors?.length, '源站查询失败，请重试');
    return result.data;
  }
  image(value, base) {
    check(typeof value==='string' && value.trim(), '图片地址缺失');
    let url = value.trim().replace(/ /g,'%20');
    if (url.startsWith('//')) url='https:'+url;
    else if (url.startsWith('/')) url=this.origin+url;
    else if (!/^[a-z][\w+.-]*:/i.test(url)) url=base.split(/[?#]/)[0].replace(/[^/]*$/,'')+url;
    check(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url),'图片地址无效');
    return url;
  }
  productLocation(value) {
    const path = typeof value==='string' && value.startsWith(this.origin+'/') ? value.slice(this.origin.length) : value;
    const m = /^(\/(episode|volume)\/([1-9]\d*)\/?(?:\?[^#\s]*)?)(?:#series=([1-9]\d*))?$/.exec(path);
    check(m,'章节地址不属于此站');
    return {url:this.origin+m[1],path:m[1],kind:m[2],id:m[3],series:m[4]};
  }
  bookUrl(id,kind) { return this.origin+'/series/'+id+'/first_'+kind; }
  card(n) {
    check(isId(n?.databaseId) && typeof n.title==='string' && n.title.trim() &&
      'firstEpisode' in n && 'firstVolume' in n,'作品资料缺失');
    const seed = n.firstEpisode || n.firstVolume;
    if (!seed) return null; // Some search hits are announcements with no reader.
    const kind = n.firstEpisode ? 'episode' : 'volume';
    check(this.productLocation(seed.permalink).kind===kind,'作品入口类型不符');
    const cover = n.thumbnailUri || n.latestVolume?.thumbnailUri;
    return {name:n.title,link:this.bookUrl(n.databaseId,kind),imageUrl:cover ? this.image(cover,seed.permalink) : ''};
  }
  async collection(ids, order) {
    const fields = `series{pageInfo{hasNextPage} edges{node{${CARD} likeCount latestEpisode{publishedAt}}}}`;
    const query = '{'+ids.map((id,i)=>`g${i}:node(id:"${nodeId(id)}"){... on SerialGroup{${fields}} ... on Genre{${fields}}}`).join(' ')+'}';
    const data = await this.gql(query), works = new Map();
    for (let i=0; i<ids.length; i++) {
      const conn = data['g'+i]?.series;
      check(Array.isArray(conn?.edges) && conn.pageInfo?.hasNextPage===false,'作品分类未返回完整列表');
      for (const {node} of conn.edges) works.set(node.databaseId,node);
    }
    const nodes = [...works.values()];
    if (order==='popular') nodes.sort((a,b)=>b.likeCount-a.likeCount);
    if (order==='latest') nodes.sort((a,b)=>(Date.parse(b.latestEpisode?.publishedAt)||0)-(Date.parse(a.latestEpisode?.publishedAt)||0));
    return nodes.map(n=>this.card(n)).filter(Boolean);
  }
  async shelf(page, order, index=0) {
    check(Number.isSafeInteger(page) && page>0,'页码无效');
    if (page>1) return EMPTY();
    check(collections[index],'作品分类无效');
    const list = await this.collection(collections[index][1],order);
    check(!order || list.length,'榜单未返回作品');
    return {list,hasNextPage:false};
  }
  getPopular(page) { return this.shelf(page,'popular'); }
  getLatestUpdates(page) { return this.shelf(page,'latest'); }
  async search(query,page,filters=[]) {
    const keyword = query.trim();
    if (!keyword) return this.shelf(page,'',filters.find(f=>f.type==='collection')?.state ?? 0);
    check(Number.isSafeInteger(page) && page>0,'页码无效');
    // The unpaged upstream query can return thousands of works in a single response.
    const state = page!==1 && this.paging?.keyword===keyword ? this.paging : (this.paging={keyword,cursors:[null]});
    for (let i=Math.min(page,state.cursors.length); i<=page; i++) {
      const selection = i===page ? `edges{node{${CARD}}}` : '';
      const data = await this.gql(`query($q:String!,$after:String){searchSeries(keyword:$q,first:50,after:$after){pageInfo{hasNextPage endCursor} ${selection}}}`,
        {q:keyword,after:state.cursors[i-1]});
      const conn = data.searchSeries, info = conn?.pageInfo;
      check(typeof info?.hasNextPage==='boolean','搜索分页缺失');
      state.cursors.length=i;
      if (info.hasNextPage) {
        check(typeof info.endCursor==='string' && info.endCursor && !state.cursors.includes(info.endCursor),'搜索游标未推进');
        state.cursors.push(info.endCursor);
      }
      if (i===page) {
        check(Array.isArray(conn.edges),'搜索结果缺失');
        const nodes = conn.edges.map(e=>e.node).sort((a,b)=>Number(!a.firstEpisode)-Number(!b.firstEpisode));
        return {list:nodes.map(n=>this.card(n)).filter(Boolean),hasNextPage:info.hasNextPage};
      }
      if (!info.hasNextPage) return EMPTY();
    }
  }
  async viewer(loc) {
    const doc = new Document(await this.request(loc.path));
    const canonical = this.productLocation(doc.selectFirst('link[rel=canonical]').attr('href'));
    check(canonical.id===loc.id && canonical.kind===loc.kind,'阅读页章节归属不符');
    const script = doc.selectFirst('#episode-json').attr('data-value');
    check(script,'缺少阅读数据，章节可能已停止公开');
    const p = parseJson(script)?.readableProduct;
    const link = this.productLocation(p?.permalink);
    check(p.id===loc.id && p.typeName===loc.kind && link.id===loc.id && link.kind===loc.kind &&
      isId(p.series?.id) && (!loc.series || p.series.id===loc.series),'阅读页作品或章节归属不符');
    return p;
  }
  async getDetail(url) {
    let id;
    if (url.startsWith(this.origin+'/series/')) {
      id = /^\/series\/([1-9]\d*)\/first_(?:episode|volume)\/?$/.exec(url.slice(this.origin.length))?.[1];
      check(id,'作品入口无效');
    } else id = (await this.viewer(this.productLocation(url))).series.id;
    const {series} = await this.gql(DETAIL,{id});
    check(series?.databaseId===id,'目录作品归属不符');
    const book = this.card(series);
    check(book,'作品没有阅读入口');
    const prefs = new SharedPreferences(), hidePaid = await prefs.get('hide_locked')===true, hideGone = await prefs.get('hide_unavailable')===true;
    const chapters = [];
    for (const kind of ['episode','volume']) {
      const count = series[kind+'s']?.totalCount, seen = new Set();
      check(Number.isSafeInteger(count) && count>=0,'章节总数缺失');
      while (seen.size<count) {
        const rows = parseJson(await this.request('/api/viewer/pagination_readable_products?type='+kind+'&aggregate_id='+id+'&sort_order=desc&offset='+seen.size));
        check(Array.isArray(rows) && rows.length && rows.length<=count-seen.size,'目录分页提前结束或总数不符');
        for (const row of rows) {
          const loc = this.productLocation(row.viewer_uri), rights = row.purchase_info;
          check(loc.id===row.readable_product_id && loc.kind===kind && (!loc.series || loc.series===id) && !seen.has(loc.url),'章节归属不符或目录分页重复');
          check(typeof row.title==='string' && row.title.trim() && typeof rights?.can_read==='boolean' && typeof rights.unavailable==='boolean','章节名称或阅读权限缺失');
          seen.add(loc.url);
          const gone = rights.unavailable, paid = !gone && !rights.can_read;
          if ((gone && hideGone) || (paid && hidePaid)) continue;
          const ms = Date.parse(row.display_open_at);
          chapters.push({name:(gone?'🔒 ':paid?'💴 ':'')+(kind==='volume'?'(Volume) ':'')+row.title,
            url:loc.url+'#series='+id,dateUpload:ms>0 ? String(ms) : ''});
        }
      }
      const first = kind==='episode' ? series.firstEpisode : series.firstVolume;
      check(!first || seen.has(this.productLocation(first.permalink).url),'目录缺少该作品的起始章节');
    }
    return {...book,chapters,description:series.description || '',author:series.author?.name || '',status:5};
  }
  async getPageList(url) {
    const loc = this.productLocation(url), p = await this.viewer(loc);
    check('pageStructure' in p,'阅读数据不完整');
    const s = p.pageStructure;
    check(s,'章节需要购买或已停止公开，请在源站确认');
    check([undefined,null,'','usagi','baku'].includes(s.choJuGiga),'图片分块协议不受支持');
    check(Array.isArray(s.pages),'正文页表缺失');
    const pages = [];
    for (const row of s.pages) {
      if (row?.type!=='main') {
        check(['other','link','backMatter'].includes(row?.type),'未知正文页类型');
        continue;
      }
      const page = {url:this.image(row.src,loc.url),headers:{Referer:loc.url}};
      if (s.choJuGiga==='baku') page.imageProcessing={type:'tile-transpose-v1',grid:4,alignment:8};
      pages.push(page);
    }
    check(pages.length,'章节没有公开正文'); return pages;
  }
}

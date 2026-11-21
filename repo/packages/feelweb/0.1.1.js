// SPDX-License-Identifier: GPL-3.0-only
// NodeLane feelweb; corresponding source: sources/feelweb/0.1.1/
const DefaultExtension = (() => {
/*
Upstream copyright 2015 Javier Tomás and Keiyoushi/Tachiyomi contributors.
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "{}"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright {yyyy} {name of copyright owner}

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

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

// SPDX-License-Identifier: GPL-3.0-only
// Serial groups from Keiyoushi FeelWeb.kt (Apache-2.0).
const groups = [
  ['FEEL YOUNG', ['3269754496312166681','3269754496312166688']],
  ['マンガJam', ['3269754496312166692','3269754496312166700']],
  ['onBLUE', ['3269754496312166718','3269754496312166727']],
  ['SHODENSHA COMICS', ['3269754496312166710']],
];
const collections = [['作品一覧',groups.flatMap(([,ids])=>ids)], ...groups];

return GigaViewer;
})();

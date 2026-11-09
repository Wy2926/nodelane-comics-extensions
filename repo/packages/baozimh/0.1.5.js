// SPDX-License-Identifier: GPL-3.0-only
// NodeLane baozimh; corresponding source: sources/baozimh/0.1.5/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Current /classify navigation; protocol adapted from Keiyoushi Baozi / Filters.
const BZ_FILTERS = [
  ['region','地区',[['全部','all'],['国漫','cn'],['日本','jp'],['韩国','kr'],['欧美','en']]],
  ['state','状态',[['全部','all'],['连载中','serial'],['已完结','pub']]],
  ['type','题材',[['全部','all'],['恋爱','lianai'],['纯爱','chunai'],['古风','gufeng'],['异能','yineng'],['悬疑','xuanyi'],['剧情','juqing'],['科幻','kehuan'],['奇幻','qihuan'],['玄幻','xuanhuan'],['穿越','chuanyue'],['冒险','mouxian'],['推理','tuili'],['武侠','wuxia'],['格斗','gedou'],['战争','zhanzheng'],['热血','rexie'],['搞笑','gaoxiao'],['大女主','danuzhu'],['都市','dushi'],['总裁','zongcai'],['后宫','hougong'],['日常','richang'],['韩漫','hanman'],['少年','shaonian'],['其它','qita']]],
  ['filter','首字母',[['全部','*'],...['ABCD','EFGH','IJKL','MNOP','QRST','UVW','XYZ','0-9'].map(v=>[v,v])]]
];

// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Keiyoushi Baozi (Apache-2.0); attribution and original license below.
const BZ_ORIGIN = 'https://cn.baozimh.com';
const BZ_READER_ORIGIN = 'https://tw.twbzmg.com';
// Public reader /s/page_runtime_v5.js: regional nodes and its small availability probe.
const BZ_IMAGE_ROUTES = ['-rsa1-usla.bzcdn.net','-ogsm1-uspho.bzcdn.net','-dpa1-cnhk.bzcdn.net','-mha1-nlams.bzcdn.net','.baozimh.com'];
const BZ_IMAGE_PROBE = '/scomic/wangyenujiajiangefei-boyidongman/0/12-fmo5/10.jpg';
const BZ_IMAGE_ORIGIN = /^(https?:\/\/s\d+)\.(?:bzcdn\.net|baozicdn\.com)(?=\/)/i;

const bzError = (code,message) => Error('[BAOZI:' + code + '] ' + message);
function bzRequire(ok,code,message) { if (!ok) throw bzError(code,message); }
function bzUrl(value,base=BZ_ORIGIN+'/') {
  bzRequire(typeof value==='string' && value.trim(),'url','源站地址缺失');
  let url=value.trim().replace(/ /g,'%20');
  const origin=/^https?:\/\/[^/]+/i.exec(base)?.[0];
  if (url.startsWith('//')) url='https:'+url;
  else if (url.startsWith('/')) url=origin+url;
  else if (!/^[a-z][\w+.-]*:/i.test(url)) url=base.split(/[?#]/)[0].replace(/[^/]*$/,'')+url;
  bzRequire(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url),'url','源站地址格式无效');
  return url.split('#')[0];
}
function bzParams(url) {
  const result={};
  for (const pair of (url.split('?')[1]||'').split('&')) {const at=pair.indexOf('=');if(at>=0) result[decodeURIComponent(pair.slice(0,at))]=decodeURIComponent(pair.slice(at+1).replace(/\+/g,' '));}
  return result;
}
function bzLocation(value,chapter=false) {
  const url=bzUrl(value), path=url.replace(/^https?:\/\/[^/]+/i,'').split('?')[0];
  const book=/^\/comic\/([^/]+)\/?$/.exec(path);
  if (!chapter) {bzRequire(book,'identity','作品地址无法识别');return {url,id:decodeURIComponent(book[1])};}
  let match=/^\/comic\/chapter\/([^/]+)\/(\d+)_(\d+)(?:_(\d+))?\.html$/.exec(path);
  if (match) return {url,id:decodeURIComponent(match[1]),section:match[2],slot:match[3],part:Number(match[4]||1)};
  const p=bzParams(url);
  bzRequire(path==='/user/page_direct' && p.comic_id && /^\d+$/.test(p.section_slot) && /^\d+$/.test(p.chapter_slot),'identity','章节地址无法识别');
  return {url,id:p.comic_id,section:p.section_slot,slot:p.chapter_slot,part:1};
}
function bzSameChapter(a,b) {return a.id===b.id && a.section===b.section && a.slot===b.slot;}
function bzReaderUrl(value) {
  const loc=bzLocation(value,true);
  return BZ_READER_ORIGIN+'/comic/chapter/'+encodeURIComponent(loc.id)+'/'+loc.section+'_'+loc.slot+(loc.part>1?'_'+loc.part:'')+'.html';
}
function bzMeta(doc,key) {return doc.selectFirst('meta[name="'+key+'"], meta[property="'+key+'"]').attr('content');}
function bzApiList(body) {
  let data;try {data=JSON.parse(body);} catch (_) {throw bzError('response','分类数据无法解析');}
  bzRequire(Array.isArray(data.items),'list','分类清单缺失');
  const list=data.items.map(item=>{
    bzRequire(item.comic_id && item.name,'list','分类作品信息不完整');
    return {name:item.name,link:BZ_ORIGIN+'/comic/'+encodeURIComponent(item.comic_id),imageUrl:bzUrl(item.topic_img || item.comic_id+'.jpg','https://static-tw.baozimh.com/cover/')};
  });
  return {list,hasNextPage:Boolean(data.next)};
}
function bzHtmlList(body,search=false) {
  const doc=new Document(body),list=[];
  for (const card of doc.select('.comics-card')) {
    const name=card.selectFirst('.comics-card__title').text.trim(),link=card.selectFirst('a.comics-card__poster').attr('href');
    if (!name || /{{/.test(name+link)) continue;
    const image=card.selectFirst('amp-img, img'),src=image.attr('data-src')||image.attr('src');
    list.push({name,link:bzLocation(link).url,imageUrl:src?bzUrl(src):''});
  }
  const count=/相近搜索结果\s*[（(](\d+)[)）]/.exec(doc.selectFirst('body').text);
  bzRequire(search ? count && Number(count[1])===list.length : list.length,'list','列表内容或搜索结果计数不完整');
  return {list,hasNextPage:false};
}
function bzDate(value,now=Date.now()) {
  let m=/(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(value);
  if(m){const y=+m[1],month=+m[2],day=+m[3],ms=Date.UTC(y,month-1,day)-8*3600000,d=new Date(ms+8*3600000);return d.getUTCFullYear()===y && d.getUTCMonth()===month-1 && d.getUTCDate()===day && ms>0?String(ms):'';}
  m=/(\d+)\s*(分钟|分鐘|小时|小時|天)前/.exec(value);
  return m?String(now-Number(m[1])*(/分钟|分鐘/.test(m[2])?60000:/小时|小時/.test(m[2])?3600000:86400000)):'';
}
function bzDetail(body,requested) {
  const doc=new Document(body),name=doc.selectFirst('h1.comics-detail__title').text.trim();
  const canonical=bzLocation(doc.selectFirst('link[rel=canonical]').attr('href')||bzMeta(doc,'og:url'));
  const latestUrl=bzMeta(doc,'og:novel:latest_chapter_url'),latest=latestUrl?bzLocation(latestUrl,true):null;
  // API entries can retain the old ID explicitly declared by the page's latest-chapter metadata.
  const aliases=[canonical.id,...(latest?[latest.id]:[])];
  bzRequire(aliases.includes(requested.id),'identity','作品页面归属与请求不一致');
  bzRequire(name,'detail','作品名称缺失');
  if (/章节数据缺少[\s\S]*屏蔽处理/.test(doc.selectFirst('body').text)) throw bzError('access','源站已屏蔽此作品，当前没有可读目录');
  const nodes=doc.select('#chapter-items .comics-chapters a[href], #chapters_other_list .comics-chapters a[href]');
  bzRequire(nodes.length,'catalog','未取得完整章节目录，请在来源网页核对');
  const date=bzDate(doc.selectFirst('.comics-detail em').text),seen=new Set(),chapters=[];let hasLatest=false;
  for(const node of nodes) {
    const loc=bzLocation(node.attr('href'),true),title=node.text.trim();
    bzRequire(aliases.includes(loc.id),'chapter-owner','目录混入其他作品的章节');
    bzRequire(title,'catalog','章节标题缺失');
    if (seen.has(loc.url)) continue;seen.add(loc.url);
    // The site's latest-chapter metadata may use an explicitly published old book alias.
    const isLatest=latest && latest.section===loc.section && latest.slot===loc.slot;
    if (isLatest) hasLatest=true;
    chapters.push({name:title,url:loc.url,dateUpload:isLatest?date:''});
  }
  bzRequire(!latest || hasLatest,'catalog','目录缺少页面声明的最新章节，请重试');
  const tags=doc.select('.tag-list .tag').map(n=>n.text.trim()).filter(Boolean),image=bzMeta(doc,'og:image');
  return {name,link:requested.url,imageUrl:image?bzUrl(image):'',author:doc.selectFirst('h2.comics-detail__author').text.trim(),description:doc.selectFirst('p.comics-detail__desc').text.trim(),genre:tags.filter(t=>!['连载中','已完结'].includes(t)),status:tags.includes('已完结')?1:tags.includes('连载中')?0:5,chapters:chapters.reverse()};
}
function bzReader(body,requested,part,total) {
  const doc=new Document(body),canonical=bzLocation(doc.selectFirst('link[rel=canonical]').attr('href'),true);
  const owners=[canonical.id];
  for(const node of doc.select('.header a.goto, .header a.back')) {const href=node.attr('href');if(/\/comic\/[^/?#]+(?:[?#]|$)/.test(href)) owners.push(bzLocation(href).id);}
  bzRequire(owners.includes(requested.id) && canonical.section===requested.section && canonical.slot===requested.slot,'chapter-owner','阅读页面属于其他作品或章节');
  const title=doc.selectFirst('.header .title').text.trim(),count=/[（(](\d+)\/(\d+)[)）]\s*$/.exec(title);
  const current=count?+count[1]:1,last=count?+count[2]:1;
  bzRequire(current===part && canonical.part===part && last>=part && (total===undefined || total===last),'pagination','正文分页缺失、重复或发生变化，请重试');
  let nodes=doc.select('.comic-contain amp-img.comic-contain__item');
  if (!nodes.length) nodes=doc.select('.comic-contain img[data-src]');
  bzRequire(nodes.length,'pages','源站未提供正文图片，请在来源网页核对');
  const pages=nodes.map(node=>({url:bzUrl(node.attr('data-src')||node.attr('src'),canonical.url),headers:{Referer:BZ_ORIGIN+'/'}}));
  const anchor=doc.selectFirst('#next-chapter'),href=anchor.attr('href');let next='';
  if (current<last) {
    bzRequire(href,'pagination','正文尚未结束，但下一页链接缺失');
    const loc=bzLocation(bzUrl(href,canonical.url),true);
    bzRequire(bzSameChapter(loc,canonical) && loc.part===part+1,'pagination','正文分页跳到了其他章节或页位');next=loc.url;
  } else if (/下一页/.test(anchor.text)) throw bzError('pagination','正文页数与下一页导航不一致');
  return {pages,next,total:last};
}

/*
Original Keiyoushi portions: Copyright 2015 Javier Tomás and contributors.
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

return SourceExtension;
})();

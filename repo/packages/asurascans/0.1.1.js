// SPDX-License-Identifier: GPL-3.0-only
// NodeLane asurascans; corresponding source: sources/asurascans/0.1.1/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Current /browse genre options; request parameters adapted from Keiyoushi Filters.kt.
const AS_GENRES = [
  [
    "Action",
    "action"
  ],
  [
    "Adventure",
    "adventure"
  ],
  [
    "Comedy",
    "comedy"
  ],
  [
    "Crazy MC",
    "crazy-mc"
  ],
  [
    "Dark Fantasy",
    "dark-fantasy"
  ],
  [
    "Demon",
    "demon"
  ],
  [
    "Drama",
    "drama"
  ],
  [
    "Dungeons",
    "dungeons"
  ],
  [
    "Fantasy",
    "fantasy"
  ],
  [
    "Game",
    "game"
  ],
  [
    "Genius MC",
    "genius-mc"
  ],
  [
    "Isekai",
    "isekai"
  ],
  [
    "Magic",
    "magic"
  ],
  [
    "Martial Arts",
    "martial-arts"
  ],
  [
    "Murim",
    "murim"
  ],
  [
    "Mystery",
    "mystery"
  ],
  [
    "Necromancer",
    "necromancer"
  ],
  [
    "Overpowered",
    "overpowered"
  ],
  [
    "Psychological",
    "psychological"
  ],
  [
    "Regression",
    "regression"
  ],
  [
    "Reincarnation",
    "reincarnation"
  ],
  [
    "Revenge",
    "revenge"
  ],
  [
    "Romance",
    "romance"
  ],
  [
    "School Life",
    "school-life"
  ],
  [
    "Sci-fi",
    "sci-fi"
  ],
  [
    "Shoujo",
    "shoujo"
  ],
  [
    "Shounen",
    "shounen"
  ],
  [
    "Slice of Life",
    "slice-of-life"
  ],
  [
    "Supernatural",
    "supernatural"
  ],
  [
    "System",
    "system"
  ],
  [
    "Tower",
    "tower"
  ],
  [
    "Tragedy",
    "tragedy"
  ],
  [
    "Transmigration",
    "transmigration"
  ],
  [
    "Villain",
    "villain"
  ],
  [
    "Violence",
    "violence"
  ]
];
const AS_SORTS = [["最新更新","latest"],["热门","popular"],["评分","rating"],["名称","title"],["新作","update"]];
const AS_SELECTS = [
  ["status","状态",[["全部",""],["连载","ongoing"],["完结","completed"],["休刊","hiatus"],["弃坑","dropped"],["腰斩","axed"]]],
  ["type","类型",[["全部",""],["Manhwa","manhwa"],["Manhua","manhua"],["Mangatoon","manga"]]]
];

// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Keiyoushi AsuraScans / Dto (Apache-2.0); attribution and license below.
const AS_ORIGIN = 'https://asurascans.com';
const AS_API = 'https://api.asurascans.com/api';
const asError = (code, message) => Error('[ASURA:' + code + '] ' + message);
function asRequire(ok, code, message) { if (!ok) throw asError(code, message); }
function asJson(body) {
  try { return JSON.parse(body); } catch (_) { throw asError('response', '源站数据无法解析，请重试或更新来源'); }
}
function asImage(value) {
  asRequire(typeof value === 'string', 'image-url', '源站图片地址缺失');
  let url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('/')) url = AS_ORIGIN + url;
  asRequire(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url), 'image-url', '源站图片地址格式无效');
  return url;
}
function asLocation(value, chapter = false) {
  asRequire(typeof value === 'string', 'url', '作品或章节地址无效');
  const url = value.startsWith('/') ? AS_ORIGIN + value : value;
  // Host authorization belongs to App's Client. Parse route identity without discarding query parameters.
  const path = url.replace(/^[^:]+:\/\/[^/]+/, '');
  const match = /^\/comics\/([^/?#]+)(?:\/chapter\/([^/?#]+))?\/?(?:[?#].*)?$/.exec(path);
  asRequire(match && Boolean(match[2]) === chapter, 'url', '作品或章节地址无效');
  return {url: url.split('#')[0], slug: decodeURIComponent(match[1]), number: match[2] == null ? undefined : decodeURIComponent(match[2])};
}
function asSameBook(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const plainA = a.replace(/-[a-z0-9]{8}$/, ''), plainB = b.replace(/-[a-z0-9]{8}$/, '');
  // A canonical slug can itself end in an eight-letter word; do not strip both unconditionally.
  return a === plainB || b === plainA || plainA === plainB;
}
function asStableBook(slug) {
  asRequire(typeof slug === 'string' && slug.trim(), 'identity', '作品身份缺失');
  return AS_ORIGIN + '/comics/' + encodeURIComponent(slug);
}
// Astro serializes each value as [type, value], including nested objects and arrays.
function asAstroValue(value) {
  asRequire(Array.isArray(value) && value.length <= 2, 'response', '页面数据编码已变化');
  const [type, data] = value;
  if (type === 0) return data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([key, v]) => [key, asAstroValue(v)])) : data ?? null;
  if (type === 1 && Array.isArray(data)) return data.map(asAstroValue);
  throw asError('response', '页面数据编码尚未支持，请更新来源');
}
function asProps(body, keys) {
  const nodes = new Document(body).select('[props]');
  for (const node of nodes) {
    const raw = node.attr('props');
    if (!keys.every(key => raw.includes('"' + key + '"'))) continue;
    const data = asJson(raw);
    if (keys.every(key => Object.prototype.hasOwnProperty.call(data, key)))
      return Object.fromEntries(Object.entries(data).map(([key, v]) => [key, asAstroValue(v)]));
  }
  throw asError('structure', '未找到完整的源站数据，请重试或更新来源');
}
function asDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return '';
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isFinite(ms) && ms > 0 && new Date(ms).toISOString().slice(0,10) === value.slice(0,10) ? String(ms) : '';
}
function asLocked(chapter) {
  return chapter.is_premium === true || chapter.is_locked === true || Number(asDate(chapter.early_access_until)) > Date.now();
}
function asListing(body, page) {
  const data = asJson(body);
  // Go's omitempty response represents zero results as data:null without total/has_more.
  if (data.data === null && data.meta?.per_page > 0 && (data.meta.total == null || data.meta.total === 0) && !data.meta.has_more) {
    data.data = []; data.meta.total = 0;
  }
  asRequire(Array.isArray(data.data) && Number.isInteger(data.meta?.total) && data.meta.total >= 0 &&
    (data.meta.has_more == null || typeof data.meta.has_more === 'boolean'), 'listing', '列表或分页数据缺失');
  // The API omits has_more on the final page. total remains present, including zero results.
  const next = data.meta.has_more ?? ((page - 1) * 20 + data.data.length < data.meta.total);
  asRequire(data.data.length || !next, 'pagination', '源站返回了不完整的列表');
  const seen = new Set(), list = [];
  for (const book of data.data) {
    const link = asStableBook(book.slug);
    asRequire(typeof book.title === 'string' && book.title.trim(), 'listing', '作品标题缺失');
    if (seen.has(link)) continue;
    seen.add(link); list.push({name: book.title.trim(), link, imageUrl: book.cover ? asImage(book.cover) : ''});
  }
  return {list, hasNextPage: next};
}
function asDetail(body, loc) {
  const info = asProps(body, ['title', 'description', 'coverUrl']);
  const catalog = asProps(body, ['chapters', 'seriesSlug']);
  const link = asStableBook(catalog.seriesSlug);
  asRequire(asSameBook(loc.slug, catalog.seriesSlug), 'identity', '源站返回了另一部作品');
  if (catalog.chapters === null && catalog.totalChapters === 0) catalog.chapters = [];
  asRequire(typeof info.title === 'string' && info.title.trim() && Array.isArray(catalog.chapters), 'catalog', '作品或完整目录缺失');
  asRequire(Number.isInteger(catalog.totalChapters) && catalog.totalChapters >= 0, 'catalog', '目录总数缺失');
  const chapters = [], seen = new Set();
  for (const chapter of catalog.chapters) {
    asRequire((chapter.series_slug == null || asSameBook(chapter.series_slug, catalog.seriesSlug)) &&
      (chapter.series_id == null || info.seriesId == null || chapter.series_id === info.seriesId), 'chapter-owner', '章节归属与作品不一致');
    asRequire(typeof chapter.number === 'number' && Number.isFinite(chapter.number) && chapter.number >= 0, 'catalog', '章节编号缺失');
    const url = link + '/chapter/' + chapter.number;
    if (seen.has(url)) continue;
    seen.add(url); chapters.push({name: (asLocked(chapter) ? '🔒 ' : '') + 'Chapter ' + chapter.number +
      (chapter.title ? ' - ' + chapter.title : ''), url, dateUpload: asDate(chapter.published_at) || asDate(chapter.created_at)});
  }
  asRequire(chapters.length === catalog.totalChapters, 'catalog', '目录尚未完整加载，请稍后重试');
  const description = new Document('<div id="as-description">' + (info.description || '') + '</div>').selectFirst('#as-description').text.trim();
  return {name: info.title.trim(), link, imageUrl: info.coverUrl ? asImage(info.coverUrl) : '',
    description: description + (info.alternativeTitles ? '\n\nAlternative titles: ' + info.alternativeTitles : ''),
    author: info.author || '', artist: info.artist || '',
    genre: [...new Set([info.type, ...(info.genres || []).map(g => g.name)].filter(Boolean))],
    status: ({ongoing:0, completed:1, hiatus:2, dropped:3, axed:3})[info.status] ?? 5, chapters};
}
function asPages(body, loc) {
  const data = asProps(body, ['pages', 'seriesSlug', 'chapterNumber']);
  asRequire(asSameBook(data.seriesSlug, loc.slug) && Number(data.chapterNumber) === Number(loc.number), 'chapter-owner', '源站返回了另一部作品或章节');
  if (data.isLocked === true || (data.isPremium === true && !data.pages?.length))
    throw asError('access', '此章节需要付费或等待提前阅读期结束，请在源站查看权限');
  asRequire(Array.isArray(data.pages) && data.pages.length > 0, 'pages', '章节图片未完整加载，请稍后重试');
  return data.pages.map(page => {
    // Current public reader returns plain images. Never display shuffled tiles as readable pages.
    asRequire(page.tiles == null || (Array.isArray(page.tiles) && page.tiles.length === 0), 'image-protocol', '此章节使用图块还原协议，当前 App 尚未支持');
    return {url: asImage(page.url), headers: {Referer: AS_ORIGIN + '/'}};
  });
}

/*
Upstream copyright 2015 Javier Tomás and contributors.
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

return SourceExtension;
})();

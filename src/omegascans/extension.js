// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Keiyoushi OmegaScans / HeanCms (Apache-2.0); original license below.
const OS_ORIGIN = 'https://omegascans.org';
const OS_API = 'https://api.omegascans.org';
const OS_STATUS = [['全部','All'], ['连载','Ongoing'], ['休刊','Hiatus'], ['弃坑','Dropped'], ['完结','Completed']];
const OS_SORT = [['标题','title'], ['浏览量','total_views'], ['最新更新','latest'], ['新作','created_at']];
// MProvider filter definitions are synchronous; the IDs come from the site's /tags.
const OS_TAGS = [['Drama','2'], ['Harem','8'], ['Romance','1'], ['Fantasy','3'], ['MILF','16']];
const OS_SHOW_PAID = 'pref_show_paid_chap';

function osRequire(ok, code, message) {
  if (!ok) throw Error('[Omega:' + code + '] ' + message);
}
function osSegment(slug) {
  osRequire(typeof slug === 'string' && slug.trim() && slug !== '.' && slug !== '..' && !/[/\\\u0000-\u001f]/.test(slug),
    'url', '作品或章节路径无效');
  return encodeURIComponent(slug);
}
function osId(id) {
  osRequire(Number.isSafeInteger(id) && id > 0, 'identity', '缺少源站数字 ID');
  return '#' + id;
}
function osLocation(url, chapter = false) {
  const match = /^(?:https:\/\/omegascans\.org)?\/series\/([^/?#]+)(?:\/([^/?#]+))?\/?(\?[^#]*)?(?:#([1-9]\d*))?$/.exec(url);
  osRequire(match && Boolean(match[2]) === chapter, 'url', '不是 Omega Scans 的作品或章节地址');
  let series, part;
  try { series = decodeURIComponent(match[1]); part = chapter ? decodeURIComponent(match[2]) : ''; }
  catch { throw Error('[Omega:url] 地址编码无效'); }
  const path = osSegment(series) + (chapter ? '/' + osSegment(part) : '');
  return {series, part, path:path + (match[3] || ''), query:match[3] || '', id:match[4]};
}
function osImage(value) {
  osRequire(typeof value === 'string' && value.trim(), 'image', '图片地址缺失');
  let url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) url = 'https:' + url;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = OS_API + '/' + url.replace(/^\//, '');
  osRequire(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(url) && !/[\u0000-\u001f]/.test(url), 'image', '图片地址无效');
  return url;
}
function osBook(b, query = '') {
  osRequire(typeof b?.title === 'string' && b.title.trim(), 'listing', '缺少作品标题');
  return {name:b.title.trim(), link:OS_ORIGIN + '/series/' + osSegment(b.series_slug) + query + osId(b.id),
    imageUrl:b.thumbnail ? osImage(b.thumbnail) : ''};
}
function osPage(result, page) {
  const meta = result?.meta, rows = result?.data;
  osRequire(Array.isArray(rows) && meta?.current_page === page && Number.isSafeInteger(meta.last_page) && meta.last_page >= 1 &&
    Number.isSafeInteger(meta.total) && meta.total >= rows.length &&
    (rows.length ? page <= meta.last_page : (meta.total === 0 && meta.last_page === 1 || page > meta.last_page)),
    'pagination', '列表数据、页码或总数不一致');
  return meta;
}
function osDescription(b) {
  const doc = new Document('<div id="omega-description">' + (b.description || '') + '</div>').selectFirst('#omega-description');
  const text = doc.select('p').map(p => p.text.trim()).filter(Boolean).join('\n\n') || doc.text.trim();
  const aliases = (b.alternative_names || '').split('|').map(n => n.trim()).filter(n => n && n !== b.title);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter(d => b.release_schedule?.[d.toLowerCase()]);
  const info = [
    typeof b.rating === 'number' ? 'Rating: ' + b.rating.toFixed(2) + (b.ratings_count == null ? '' : ' (' + b.ratings_count + ' ratings)') : '',
    b.status === 'Ongoing' && days.length ? 'Updates: ' + days.join(', ') : '',
    b.release_year ? 'Released: ' + b.release_year : '',
  ].filter(Boolean).join('\n');
  return [text === '-' ? '' : text, info, aliases.length ? 'Alternative names:\n' + aliases.join('\n') : ''].filter(Boolean).join('\n\n');
}

class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer:OS_ORIGIN + '/'}; }
  getSourcePreferences() {
    return [{key:OS_SHOW_PAID, switchPreferenceCompat:{title:'显示付费章节', summary:'仅显示目录与锁定标记，不解锁章节。', value:false}}];
  }
  getFilterList() {
    const options = pairs => pairs.map(([name,value]) => ({name,value,type_name:'SelectOption'}));
    return [
      {type:'status', name:'状态', type_name:'SelectFilter', state:0, values:options(OS_STATUS)},
      {type:'sort', name:'排序', type_name:'SortFilter', state:{index:1, ascending:false, type_name:'SortState'}, values:options(OS_SORT)},
      {type:'genres', name:'题材', type_name:'GroupFilter', state:OS_TAGS.map(([name,value]) => ({name,value,state:false,type_name:'CheckBox'}))},
    ];
  }
  async read(path) {
    const {statusCode, headers, body} = await this.client.get(OS_API + path, {
      ...this.getHeaders(), Origin:OS_ORIGIN, Accept:'application/json, text/plain, */*',
    });
    if (Object.entries(headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
        /^\s*</.test(body) && /<title>\s*Just a moment|id=["']challenge-form["']/i.test(body))
      throw Error('[Omega:verification] 请在来源网页完成验证后重试');
    osRequire(statusCode !== 429, 'rate-limit', '源站限流，请稍后重试');
    osRequire(statusCode !== 401 && statusCode !== 403, 'access', '源站拒绝访问，请在网站核对权限');
    osRequire(statusCode === 200, 'http', '请求失败（HTTP ' + statusCode + '）');
    try { return JSON.parse(body); } catch { throw Error('[Omega:response] 接口未返回有效 JSON'); }
  }
  async query(page, query = '', orderBy = 'total_views', order = 'desc', status = 'All', tags = []) {
    osRequire(Number.isSafeInteger(page) && page >= 1, 'page', '页码应从 1 开始');
    const params = {query_string:query, status, order, orderBy, series_type:'Comic', page, perPage:12, tags_ids:JSON.stringify(tags), adult:true};
    const result = await this.read('/query?' + Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&'));
    osPage(result, page);
    return result;
  }
  async listing(page, ...args) {
    const {data, meta} = await this.query(page, ...args);
    return {list:data.map(b => osBook(b)), hasNextPage:page < meta.last_page};
  }
  getPopular(page) { return this.listing(page); }
  getLatestUpdates(page) { return this.listing(page, '', 'latest'); }
  search(query, page, filters = []) {
    const state = type => filters.find(f => f.type === type)?.state;
    const sort = state('sort') ?? {index:1, ascending:false};
    const status = OS_STATUS[state('status') ?? 0], orderBy = OS_SORT[sort.index];
    osRequire(status && orderBy, 'filter', '筛选选项已变化，请重置筛选');
    const tags = (state('genres') || []).filter(tag => tag.state).map(tag => Number(tag.value));
    return this.listing(page, query.trim(), orderBy[1], sort.ascending ? 'asc' : 'desc', status[1], tags);
  }
  async getDetail(url) {
    const loc = osLocation(url), b = await this.read('/series/' + loc.path);
    osRequire(b?.series_slug === loc.series && (!loc.id || String(b.id) === loc.id), 'identity', '源站返回了另一部作品');
    const book = osBook(b, loc.query), base = OS_ORIGIN + '/series/' + osSegment(loc.series) + '/';
    // The detail endpoint omits the format badge; titles alone are not unique.
    const badge = b.badge ?? (await this.query(1, book.name)).data.find(row => row.id === b.id)?.badge;
    const format = /^douj/i.test(badge) ? 'Doujinshi' : /^manga$/i.test(badge) ? 'Manga' : 'Manhwa';
    const showPaid = (await new SharedPreferences().get(OS_SHOW_PAID)) === true, now = Date.now();
    const chapters = [], seen = new Set();
    let first;
    for (let page = 1; ; page++) {
      const result = await this.read('/chapter/query?page=' + page + '&perPage=1000&series_id=' + b.id);
      const meta = osPage(result, page);
      first ??= meta;
      osRequire(meta.total === first.total && meta.last_page === first.last_page &&
        (b.meta?.chapters_count == null || String(meta.total) === String(b.meta.chapters_count)),
        'catalog', '源站目录总数发生变化，请重试');
      const before = seen.size;
      for (const row of result.data) {
        osRequire(row?.series?.id === b.id && row.series.series_slug === loc.series &&
          (row.series_id == null || row.series_id === b.id), 'owner', '目录中出现其他作品的章节');
        const link = base + osSegment(row.chapter_slug) + osId(row.id);
        if (seen.has(link)) continue;
        seen.add(link);
        const ms = typeof row.created_at === 'string' ? Date.parse(row.created_at) : NaN;
        osRequire(typeof row.chapter_name === 'string' && row.chapter_name.trim() && 'price' in row, 'catalog', '章节名称或价格状态缺失');
        if (ms > now || (row.price !== 0 && !showPaid)) continue;
        const title = row.chapter_title?.trim();
        chapters.push({name:row.chapter_name.trim() + (title ? ' - ' + title : '') + (row.price === 0 ? '' : ' 🔒'),
          url:link, dateUpload:ms > 0 ? String(ms) : ''});
      }
      if (page === first.last_page) break;
      osRequire(seen.size > before && seen.size < first.total, 'catalog', '目录分页重复或提前结束');
    }
    osRequire(seen.size === first.total, 'catalog', '章节目录不完整，请重试');
    return {...book, chapters, description:osDescription(b), author:b.author === '-' ? '' : b.author || '', artist:b.studio === '-' ? '' : b.studio || '',
      genre:[...new Set([...(b.tags || []).map(t => t.name), format])],
      status:({Ongoing:0, Completed:1, Finished:1, Hiatus:2, Dropped:3})[b.status] ?? 5};
  }
  async getPageList(url) {
    const loc = osLocation(url, true), result = await this.read('/chapter/' + loc.path);
    osRequire(result?.paywall !== true, 'paid', '此章节需要购买或等待免费开放，请在源站查看');
    const ch = result?.chapter;
    osRequire(ch?.series?.series_slug === loc.series && ch.chapter_slug === loc.part &&
      (!loc.id || String(ch.id) === loc.id) && (ch.series_id == null || ch.series_id === ch.series.id),
      'owner', '正文与请求的作品或章节不一致');
    const images = ch.chapter_data?.images;
    osRequire(Array.isArray(images) && images.length, 'pages', '源站没有返回正文图片，请重试');
    return images.map(img => ({url:osImage(img), headers:this.getHeaders()}));
  }
}

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

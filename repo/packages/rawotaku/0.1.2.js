// SPDX-License-Identifier: GPL-3.0-only
// NodeLane rawotaku; corresponding source: sources/rawotaku/0.1.2/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Keiyoushi RawOtakuFilters; attribution and original terms in parser.js.
const RO_FILTERS = [
    ['type', '类型', [['全部','all'],['Raw Manga','Raw Manga'],['BLコミック','BLコミック'],['TLコミック','TLコミック'],
        ['オトナコミック','オトナコミック'],['女性マンガ','女性マンガ'],['少女マンガ','少女マンガ'],['少年マンガ','少年マンガ'],['青年マンガ','青年マンガ']]],
    ['status', '状态', [['全部','all'],['连载','Publishing'],['完结','Finished']]],
    ['language', '语言', [['全部','all'],['日语','ja'],['英语','en']]],
    ['sort', '排序', [['默认','default'],['最近更新','latest-updated'],['最多浏览','most-viewed'],['标题 A–Z','title-az'],['标题 Z–A','title-za']]],
];

// SPDX-License-Identifier: GPL-3.0-only
// Keiyoushi MangaReader/RawOtaku port; original Apache-2.0 terms appended below.
const RO_ORIGIN = 'https://rawotaku.com';
function roError(code, message) { return Error('[RO:' + code + '] ' + message); }
function roRequire(value, code, message) { if (!value) throw roError(code, message); }
function roText(element) { return (element?.text || '').replace(/\s+/g, ' ').trim(); }
function roAddress(value) {
    roRequire(typeof value === 'string' && value.trim() && !/[\\\u0000-\u001f]/.test(value), 'url', '地址格式无效');
    let url = value.trim();
    if (url.startsWith('/') && !url.startsWith('//')) url = RO_ORIGIN + url;
    const match = /^https:\/\/rawotaku\.com(\/[^?#]*)?(?:\?([^#]*))?$/.exec(url);
    roRequire(match, 'url', '地址不属于 Raw Otaku');
    let parts;
    try { const path = (match[1] || '/').replace(/^\//, '').replace(/\/$/, ''); parts = path ? path.split('/').map(decodeURIComponent) : []; }
    catch { throw roError('url', '地址编码无效'); }
    roRequire(parts.every(p => p && p !== '.' && p !== '..' && !/[/\\?#\u0000-\u001f]/.test(p)), 'url', '地址路径无效');
    const query = Object.create(null);
    for (const pair of (match[2] || '').split('&').filter(Boolean)) {
        let key, val;
        try { const at = pair.indexOf('='); key = decodeURIComponent(at < 0 ? pair : pair.slice(0, at));
            val = decodeURIComponent((at < 0 ? '' : pair.slice(at + 1)).replace(/\+/g, ' ')); }
        catch { throw roError('url', '查询参数编码无效'); }
        roRequire(key && !Object.prototype.hasOwnProperty.call(query, key), 'url', '查询参数重复');
        query[key] = val;
    }
    const path = '/' + parts.map(encodeURIComponent).join('/') + (parts.length ? '/' : '');
    return {url: RO_ORIGIN + path, path, parts, query};
}
function roLocation(value, chapter = false) {
    const loc = roAddress(value), p = loc.parts;
    roRequire(!Object.keys(loc.query).length && p[0] === 'read' && p.length === (chapter ? 4 : 2) &&
        (chapter ? ['ja','en'].includes(p[2]) && p[3].endsWith('-raw') : p[1].endsWith('-raw')),
        'url', '作品或章节路径无效，请从来源目录重新打开');
    const owner = chapter ? p[1] : p[1].slice(0, -4);
    roRequire(owner, 'url', '作品标识缺失');
    return {...loc, owner};
}
function roDocument(html, loc) {
    roRequire(/<\/html\s*>/i.test(html), 'structure', '页面响应不完整');
    const doc = new Document(html), canonical = doc.select('link[rel="canonical"]');
    roRequire(canonical.length === 1, 'identity', '页面缺少唯一身份');
    const actual = roAddress(canonical[0].attr('href'));
    roRequire(actual.url === loc.url && Object.keys(actual.query).length === Object.keys(loc.query).length &&
        Object.keys(loc.query).every(k => actual.query[k] === loc.query[k]), 'identity', '返回页面与请求身份不一致');
    return doc;
}
function roImage(element) {
    let src = (['data-lazy-src','data-src','data-url','src'].map(k => element.attr(k)).find(Boolean) || '').trim();
    if (!src || src.startsWith('data:image/')) return '';
    src = src.replace(/ /g, '%20');
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = RO_ORIGIN + src;
    roRequire(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(src), 'image-url', '图片地址格式无效');
    return src;
}
function roPagination(doc, path, params, page, count) {
    const pagers = doc.select('ul.pagination');
    if (!pagers.length) {
        roRequire(page === 1 || count === 0, 'pagination', '非首屏缺少分页标识');
        return false;
    }
    let next;
    for (const pager of pagers) {
        const active = pager.select('li.active');
        roRequire(active.length === 1 && roText(active[0]) === String(page), 'pagination', '返回页码与请求不一致');
        const pages = pager.select('a[href]').map(a => {
            let href = a.attr('href');
            if (href.startsWith('?')) href = RO_ORIGIN + path + href;
            const loc = roAddress(href), n = Number(loc.query.p);
            roRequire(loc.path === path && /^[1-9]\d{0,4}$/.test(loc.query.p || '') && n <= 10000 &&
                Object.keys(loc.query).every(k => k === 'p' || Object.prototype.hasOwnProperty.call(params, k) && loc.query[k] === params[k]),
                'pagination', '分页地址或筛选条件变化');
            return n;
        });
        const hasNext = pages.includes(page + 1);
        roRequire(!pages.some(n => n > page) || hasNext, 'pagination', '下一页不连续');
        roRequire(next === undefined || next === hasNext, 'pagination', '分页区域相互矛盾');
        next = hasNext;
    }
    return next;
}
function roListing(html, params, page) {
    const search = Object.prototype.hasOwnProperty.call(params, 'q'), path = search ? '/' : '/filter/';
    const doc = roDocument(html, {url: RO_ORIGIN + path, query: search ? {q: params.q} : {}});
    if (!search) {
        for (const [key] of RO_FILTERS) {
            const select = doc.select('select[name="' + key + '"]');
            roRequire(select.length === 1, 'filter', '筛选表单缺失');
            const selected = select[0].select('option[selected]');
            roRequire(selected.length <= 1 && (selected[0] || select[0].selectFirst('option')).attr('value') === params[key],
                'filter', '网站未应用请求的筛选条件');
        }
    }
    const roots = doc.select('.manga_list-sbs');
    if (!roots.length && search) {
        roRequire(doc.select('#main-content .block_area_category > .notice').some(e => roText(e) === 'データなし！') &&
            !doc.select('.manga-poster, ul.pagination').length, 'listing', '空搜索缺少源站确认标记');
        return {list:[], hasNextPage:false};
    }
    roRequire(roots.length === 1, 'listing', '作品列表区域缺失');
    const root = roots[0], cards = root.select('.flw-item'), seen = new Set();
    roRequire(cards.length <= 100, 'listing', '列表超出处理范围');
    const list = [];
    for (const card of cards) {
        const loc = roLocation(card.selectFirst('a.manga-poster').attr('href'));
        const image = card.selectFirst('.manga-poster img');
        const name = roText(card.selectFirst('.manga-name')) || image.attr('alt').trim();
        roRequire(name, 'listing', '作品标题缺失');
        const imageUrl = roImage(image);
        if (seen.has(loc.url)) continue;
        seen.add(loc.url);
        list.push({name, link:loc.url, imageUrl});
    }
    const hasNextPage = roPagination(doc, path, params, page, list.length);
    roRequire(list.length || /データなし！/.test(roText(root)) && !hasNextPage, 'listing', '空列表缺少源站确认标记');
    return {list, hasNextPage};
}
function roChapters(lists, owner, suffix) {
    roRequire(lists.length > 0 && lists.length <= 2, 'catalog', '章节目录缺失');
    const records = new Map();
    let count = 0;
    for (const list of lists) {
        const lang = list.attr('id').replace(suffix, '');
        roRequire(['ja','en'].includes(lang) && !list.select('.pagination a, a[rel="next"]').length, 'catalog', '完整章节目录未加载');
        const rows = list.select('li.chapter-item');
        count += rows.length;
        roRequire(count <= 10000, 'catalog', '章节数量超出处理范围');
        for (const row of rows) {
            const link = row.selectFirst('a'), loc = roLocation(link.attr('href'), true), id = row.attr('data-id');
            roRequire(loc.owner === owner && loc.parts[2] === lang, 'chapter-owner', '章节不属于当前作品或语言');
            const name = roText(link.selectFirst('.name'));
            roRequire(name && /^[1-9]\d{0,14}$/.test(id), 'catalog', '章节名称或正文编号缺失');
            const previous = records.get(loc.url);
            roRequire(!previous || previous.id === id, 'catalog', '同一章节对应了不同正文编号');
            if (!previous) records.set(loc.url, {name, url: loc.url, id});
        }
    }
    roRequire(records.size, 'catalog', '目录没有可确认的章节');
    return [...records.values()];
}
function roDetail(html, loc) {
    const doc = roDocument(html, loc), info = doc.selectFirst('#ani_detail');
    const name = roText(info.selectFirst('.manga-name'));
    roRequire(name, 'detail', '作品标题缺失');
    const catalogs = doc.select('.chapters-list-ul');
    roRequire(catalogs.length === 1 && !catalogs[0].select('.pagination a, a[rel="next"]').length, 'catalog', '完整章节区域缺失');
    const chapters = roChapters(catalogs[0].select('ul.lang-chapters'), loc.owner, '-chaps');
    const fields = info.select('.anisc-info .item');
    const field = label => fields.find(e => roText(e.selectFirst('.item-head')) === label);
    const state = roText(field('地位:')?.selectFirst('.name')).toLowerCase();
    const alternative = roText(info.selectFirst('.manga-name-or'));
    return {name, link: loc.url, imageUrl: roImage(info.selectFirst('.anisc-poster img')),
        description: [roText(info.selectFirst('.description')), alternative && alternative !== name ? '別名：' + alternative : ''].filter(Boolean).join('\n\n'),
        author: (field('著者:')?.select('a') || []).map(roText).join(', '), genre: info.select('.genres > a').map(roText),
        status: ({ongoing:0,publishing:0,releasing:0,completed:1,finished:1,'on-hold':2,on_hiatus:2,canceled:3,discontinued:3})[state] ?? 5,
        chapters: chapters.map(({name,url}) => ({name,url,dateUpload:''}))};
}
function roReaderId(html, loc) {
    const doc = roDocument(html, loc), owners = doc.select('a.hr-manga');
    roRequire(owners.length === 1 && roLocation(owners[0].attr('href')).owner === loc.owner, 'chapter-owner', '阅读页作品归属不一致');
    // The wrapper's data-reading-id is a stale template value on this site.
    // Resolve the requested URL in its own language menu instead; do not cache IDs.
    const entries = roChapters(doc.select('ul#' + loc.parts[2] + '-chapters'), loc.owner, '-chapters');
    const current = entries.find(c => c.url === loc.url);
    roRequire(current, 'chapter-owner', '阅读目录中没有当前章节');
    return current.id;
}
function roPages(body) {
    let data;
    try { data = JSON.parse(body); } catch { throw roError('pages', '正文响应不是有效 JSON'); }
    roRequire(data?.status === 1 && typeof data.html === 'string', 'pages', '源站未返回有效正文');
    const doc = new Document(data.html), roots = doc.select('.container-reader-chapter#vertical-content');
    roRequire(roots.length === 1 && doc.select('.mr-tools.mrt-bottom').length === 1, 'pages', '完整正文区域缺失');
    const images = roots[0].select('div.iv-card > img');
    roRequire(images.length > 0 && images.length <= 2000, 'pages', '正文为空或页数超出处理范围');
    return images.map((image, index) => {
        roRequire(image.attr('alt') === String(index), 'page-order', '正文页码不连续');
        const url = roImage(image);
        roRequire(url, 'pages', '正文图片地址缺失');
        return {url, headers: {Referer: url}};
    });
}

/*
Ported from RawOtaku.kt, RawOtakuFilters.kt and MangaReader.kt in Keiyoushi/extensions-source.
Commit: b647c92fd14801fda23e866d5a7da7d5fdd7ec92
Copyright 2015 Javier Tomás and contributors (upstream project).
Original portions: Apache-2.0. NodeLane adaptations: GPL-3.0-only.
Changes: MProvider/DOM bridge, verified filter options, bounded requests,
canonical URL identity, full catalog validation, current-menu chapter IDs,
page order and image URL parsing, and categorized errors. No JVM dependency.

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
    getHeaders() { return {Referer: RO_ORIGIN + '/'}; }
    getSourcePreferences() { return []; }
    getFilterList() {
        return [{name:'关键词搜索时，网站不应用以下筛选', type_name:'HeaderFilter'},
            ...RO_FILTERS.map(([type,name,values]) => ({type,name,type_name:'SelectFilter',state:0,
                values:values.map(([name,value]) => ({name,value,type_name:'SelectOption'}))}))];
    }
    async read(url, headers = this.getHeaders()) {
        const response = await this.client.get(url, headers), body = response.body;
        if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body || ''))
            throw roError('verification', 'Cloudflare 验证或封禁，请在来源网页处理后重试');
        if (response.statusCode === 429) throw roError('rate-limit', '请求过于频繁，请稍后重试');
        if (response.statusCode === 401 || response.statusCode === 403) throw roError('access', '源站拒绝访问，请在来源网页核对');
        if (response.statusCode !== 200) throw roError('http', '请求失败（HTTP ' + response.statusCode + '）');
        roRequire(typeof body === 'string' && body.length <= 4 * 1024 * 1024, 'response', '响应格式或大小无效');
        return body;
    }
    async listing(params, page) {
        roRequire(Number.isInteger(page) && page >= 1 && page <= 10000, 'page', '页码无效');
        const query = Object.entries({...params, p:String(page)}).map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
        const path = Object.prototype.hasOwnProperty.call(params, 'q') ? '/' : '/filter/';
        return roListing(await this.read(RO_ORIGIN + path + '?' + query), params, page);
    }
    getPopular(page) { return this.listing({type:'all',status:'all',language:'all',sort:'most-viewed'}, page); }
    getLatestUpdates(page) { return this.listing({type:'all',status:'all',language:'all',sort:'latest-updated'}, page); }
    search(query, page, filters = []) {
        roRequire(typeof query === 'string' && query.length <= 200 && Array.isArray(filters), 'search', '搜索条件无效');
        const params = {type:'all',status:'all',language:'all',sort:'default'}, seen = new Set();
        for (const filter of filters) {
            if (filter?.type_name === 'HeaderFilter') continue;
            const def = RO_FILTERS.find(([type]) => type === filter?.type);
            roRequire(def && !seen.has(filter.type) && filter.type_name === 'SelectFilter' && Number.isInteger(filter.state) &&
                filter.state >= 0 && filter.state < def[2].length, 'filter', '筛选选项无效，请重置筛选');
            seen.add(filter.type); params[filter.type] = def[2][filter.state][1];
        }
        return this.listing(query.trim() ? {q:query.trim()} : params, page);
    }
    async getDetail(url) {
        const loc = roLocation(url);
        return roDetail(await this.read(loc.url), loc);
    }
    async getPageList(url) {
        const loc = roLocation(url, true), id = roReaderId(await this.read(loc.url), loc);
        const headers = {...this.getHeaders(), Accept:'application/json, text/javascript, */*; q=0.01',
            Referer:encodeURIComponent(loc.url), 'X-Requested-With':'XMLHttpRequest'};
        return roPages(await this.read(RO_ORIGIN + '/json/chapter?mode=vertical&id=' + id, headers));
    }
}

return SourceExtension;
})();

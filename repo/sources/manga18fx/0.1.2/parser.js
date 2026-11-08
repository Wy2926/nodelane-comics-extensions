// SPDX-License-Identifier: GPL-3.0-only
// YiiMadara/Manga18fx port; original Apache-2.0 terms appended below.
const M18_ORIGIN = 'https://manga18fx.com';
function m18Error(code, message) { return Error('[M18:' + code + '] ' + message); }
function m18Require(value, code, message) { if (!value) throw m18Error(code, message); }
function m18Text(element) { return (element?.text || '').replace(/\s+/g, ' ').trim(); }
function m18Address(value) {
    m18Require(typeof value === 'string' && value.trim() && !/[\\\u0000-\u001f]/.test(value), 'url', '地址格式无效');
    let url = value.trim();
    if (url.startsWith('/') && !url.startsWith('//')) url = M18_ORIGIN + url;
    const match = /^https:\/\/manga18fx\.com(\/[^?#]*)?(?:\?([^#]*))?$/.exec(url);
    m18Require(match, 'url', '地址不属于 Manga18fx');
    let parts;
    try { const path = (match[1] || '/').replace(/^\//, '').replace(/\/$/, ''); parts = path ? path.split('/').map(decodeURIComponent) : []; }
    catch { throw m18Error('url', '地址编码无效'); }
    m18Require(parts.every(p => p && p !== '.' && p !== '..' && !/[/\\?#\u0000-\u001f]/.test(p)), 'url', '地址路径无效');
    const query = Object.create(null);
    for (const pair of (match[2] || '').split('&').filter(Boolean)) {
        let key, val;
        try { const at = pair.indexOf('='); key = decodeURIComponent(at < 0 ? pair : pair.slice(0, at));
            val = decodeURIComponent((at < 0 ? '' : pair.slice(at + 1)).replace(/\+/g, ' ')); }
        catch { throw m18Error('url', '查询参数编码无效'); }
        m18Require(key && !Object.prototype.hasOwnProperty.call(query, key), 'url', '查询参数重复');
        query[key] = val;
    }
    return {url: M18_ORIGIN + '/' + parts.map(encodeURIComponent).join('/'), parts, query};
}
function m18Same(a, b) {
    return a.url === b.url && Object.keys(a.query).length === Object.keys(b.query).length && Object.keys(a.query).every(k => a.query[k] === b.query[k]);
}
function m18Location(value, chapter = false) {
    const loc = m18Address(value);
    m18Require(!Object.keys(loc.query).length && loc.parts[0] === 'manga' && loc.parts.length === (chapter ? 3 : 2),
        'url', '作品或章节路径无效，请从来源目录重新打开');
    return {...loc, owner: loc.parts[1]};
}
function m18Document(html, identity) {
    m18Require(/<\/html\s*>/i.test(html), 'structure', '页面响应不完整');
    const doc = new Document(html);
    if (identity) {
        const canonical = doc.select('link[rel="canonical"]');
        m18Require(canonical.length === 1 && m18Same(m18Address(canonical[0].attr('href')), m18Address(identity)), 'identity', '返回页面与请求身份不一致');
    }
    return doc;
}
function m18Image(element) {
    let src = (element.attr('data-src') || element.attr('src')).trim();
    if (!src || src.startsWith('data:image/')) return '';
    src = src.replace(/ /g, '%20');
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = M18_ORIGIN + src;
    m18Require(/^https?:\/\/[^/?#@\s\\]+(?:[/?#][^\s\\]*)?$/i.test(src), 'image-url', '图片地址格式无效');
    return src;
}
function m18ListUrl(spec, page) {
    m18Require(Number.isInteger(page) && page >= 1 && page <= 10000, 'page', '页码无效');
    const query = spec.kind === 'search' ? {q:spec.query, page:String(page)} : spec.kind === 'popular' ? {page:String(page)} : spec.sort ? {orderby:spec.sort} : {};
    const path = spec.kind === 'search' ? 'search' : spec.kind === 'popular' ? 'hot-manga' : spec.path + '/' + page;
    const params = Object.entries(query).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
    return M18_ORIGIN + '/' + path + (params ? '?' + params : '');
}
function m18Pagination(root, spec, page, count) {
    const pagers = root.select('#blog-pager');
    m18Require(pagers.length === 1, 'pagination', '分页区域缺失');
    const pager = pagers[0], links = pager.select('a[href]');
    if (!links.length) {
        m18Require(!pager.select('li').length && (page === 1 || count === 0), 'pagination', '非首屏缺少页码确认');
        return false;
    }
    const active = pager.select('li.active');
    m18Require(active.length === 1 && m18Text(active[0]) === String(page), 'pagination', '返回页码与请求不一致');
    const numbers = links.map(link => {
        const raw = link.attr('data-page');
        m18Require(/^\d{1,5}$/.test(raw), 'pagination', '分页编号缺失');
        const number = Number(raw) + 1;
        m18Require(number <= 10000 && m18Same(m18Address(link.attr('href')), m18Address(m18ListUrl(spec, number))), 'pagination', '分页地址或筛选条件变化');
        return number;
    });
    const next = pager.select('li.next a');
    m18Require(next.length <= 1, 'pagination', '下一页标记重复');
    const hasNextPage = next.length === 1;
    m18Require(!hasNextPage || Number(next[0].attr('data-page')) === page, 'pagination', '下一页不连续');
    m18Require(hasNextPage || !numbers.some(n => n > page), 'pagination', '下一页标记与页码矛盾');
    return hasNextPage;
}
function m18Listing(html, spec, page) {
    const canonical = spec.kind === 'latest' ? M18_ORIGIN + '/' : M18_ORIGIN + '/' + (spec.kind === 'popular' ? 'hot-manga' : spec.path);
    const doc = m18Document(html, spec.kind === 'search' ? null : canonical);
    const roots = doc.select('.site-body .bixbox').filter(e => e.select('#blog-pager').length);
    m18Require(roots.length === 1 && doc.select('#blog-pager').length === 1, 'listing', '主作品列表区域缺失或重复');
    const root = roots[0];
    if (spec.kind === 'search') {
        m18Require(m18Text(root.selectFirst('h1')) === 'RESULTS FOR "' + spec.query + '"', 'identity', '搜索响应与关键词不一致');
    } else if (spec.kind === 'category') {
        const selected = root.select('a.active[href*="orderby="]');
        m18Require(spec.sort ? selected.length === 1 && m18Same(m18Address(selected[0].attr('href')),
            m18Address(M18_ORIGIN + '/' + spec.path + '?orderby=' + spec.sort)) : selected.length === 0, 'filter', '网站未应用请求的排序');
    }
    const lists = root.select('.listupd');
    m18Require(lists.length === 1, 'listing', '作品列表缺失');
    const cards = lists[0].select('.page-item'), seen = new Set(), list = [];
    m18Require(cards.length <= 100, 'listing', '列表超出处理范围');
    for (const card of cards) {
        const link = card.selectFirst('h3 a'), loc = m18Location(link.attr('href')), name = m18Text(link);
        m18Require(name, 'listing', '作品标题缺失');
        const imageUrl = m18Image(card.selectFirst('img'));
        if (!seen.has(loc.url)) { seen.add(loc.url); list.push({name, link:loc.url, imageUrl}); }
    }
    const hasNextPage = m18Pagination(root, spec, page, list.length);
    m18Require(list.length || spec.kind === 'search' && m18Text(lists[0]) === 'No result for "' + spec.query + '"' && !hasNextPage,
        'listing', '空列表缺少源站确认标记');
    return {list, hasNextPage};
}
function m18Date(text) {
    const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}|\d{2})$/.exec(text);
    if (!match) return '';
    const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].toLowerCase());
    const year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0), day = Number(match[1]);
    if (year < 1970 || month < 0) return '';
    const date = new Date(Date.UTC(year, month, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? String(date.getTime()) : '';
}
function m18Detail(html, loc) {
    const doc = m18Document(html, loc.url), name = m18Text(doc.selectFirst('.post-title h1'));
    m18Require(name, 'detail', '作品标题缺失');
    const fields = doc.select('.post-content_item');
    const field = label => fields.find(e => m18Text(e.selectFirst('.summary-heading')).toLowerCase().startsWith(label))?.selectFirst('.summary-content');
    const value = element => /^(updating|n\/a)$/i.test(m18Text(element)) ? '' : m18Text(element);
    const names = element => (element?.select('a') || []).map(value).filter(Boolean).join(', ') || value(element);
    const panels = doc.select('.panel-manga-chapter'), catalogs = doc.select('ul.row-content-chapter');
    m18Require(panels.length === 1 && catalogs.length === 1 && panels[0].select('ul.row-content-chapter').length === 1 &&
        !panels[0].select('.pagination a, a[rel="next"]').length, 'catalog', '完整章节目录未加载');
    const rows = catalogs[0].select('li'), seen = new Set(), chapters = [];
    m18Require(rows.length && rows.length <= 10000, 'catalog', '目录为空或数量超出处理范围');
    for (const row of rows) {
        const link = row.selectFirst('a'), chapter = m18Location(link.attr('href'), true), title = m18Text(link);
        m18Require(chapter.owner === loc.owner, 'chapter-owner', '章节不属于当前作品');
        m18Require(title, 'catalog', '章节名称缺失');
        if (seen.has(chapter.url)) continue;
        seen.add(chapter.url);
        chapters.push({name:title, url:chapter.url, dateUpload:m18Date(m18Text(row.selectFirst('.chapter-time')))});
    }
    const alternative = value(field('alternative')), state = value(field('status')).toLowerCase();
    return {name, link:loc.url, imageUrl:m18Image(doc.selectFirst('.summary_image img')), author:names(field('author')), artist:names(field('artist')),
        genre:[...new Set([...(field('genre')?.select('a') || []).map(value), value(field('type'))].filter(Boolean))],
        status:({ongoing:0,completed:1})[state] ?? 5,
        description:[m18Text(doc.selectFirst('.dsct, .ss-manga, .post-content_item .entry-content')), alternative && alternative !== name ? 'Alternative names: ' + alternative : ''].filter(Boolean).join('\n\n'), chapters};
}
function m18Pages(html, loc) {
    const doc = m18Document(html, loc.url), crumbs = doc.select('.breadcrumb a[href]');
    m18Require(crumbs.some(e => m18Address(e.attr('href')).url === M18_ORIGIN + '/manga/' + encodeURIComponent(loc.owner)) &&
        crumbs.some(e => m18Same(m18Address(e.attr('href')), loc)), 'chapter-owner', '阅读页缺少当前作品与章节归属');
    // Include the tag: the App DOM also matches the navi-change-chapter-btn class.
    const menus = doc.select('select.navi-change-chapter');
    m18Require(doc.select('.chapchange').length === 2 && menus.length === 2, 'pages', '阅读页首尾导航不完整');
    let previous;
    for (const menu of menus) {
        const selected = menu.select('option[selected]'), options = menu.select('option').map(e => e.attr('data-c'));
        m18Require(options.length && options.length <= 10000 && options.every(s => /^[^/?#\\\s]+$/.test(s)) &&
            selected.length === 1 && selected[0].attr('data-c') === loc.parts[2], 'chapter-owner', '阅读导航与当前章节不一致');
        const signature = JSON.stringify(options);
        m18Require(previous === undefined || previous === signature, 'pages', '首尾章节导航不一致');
        previous = signature;
    }
    const roots = doc.select('.read-content');
    m18Require(roots.length === 1, 'pages', '正文区域缺失或重复');
    const images = roots[0].select('img');
    m18Require(images.length && images.length <= 2000, 'pages', '正文为空或页数超出处理范围');
    return images.map((image,index) => {
        const slots = image.attr('class').split(/\s+/).filter(s => /^p\d+$/.test(s));
        const alt = /\bPage\s+(\d+)$/i.exec(image.attr('alt'));
        m18Require(slots.length === 1 && slots[0] === 'p' + (index + 1) && (!alt || Number(alt[1]) === index + 1), 'page-order', '正文图片页码不连续');
        const url = m18Image(image);
        m18Require(url, 'pages', '正文图片地址缺失');
        return {url, headers:{Referer:M18_ORIGIN + '/'}};
    });
}

/*
Ported from Manga18fx.kt, YiiMadara.kt and yiimadara/Filters.kt in Keiyoushi/extensions-source.
Commit: 48b291828458a32c97c3b167be453258c1bd5a86
Copyright 2015 Javier Tomás and contributors (upstream project).
Original portions: Apache-2.0. NodeLane adaptations: GPL-3.0-only.
Changes: MProvider/DOM bridge, verified filters, bounded requests, canonical and
search identity, complete catalog ownership, date validation, image slot/URL
validation and categorized failures. No JVM or downloaded-script execution.

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

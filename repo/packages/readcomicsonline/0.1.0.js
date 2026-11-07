// SPDX-License-Identifier: GPL-3.0-only
// NodeLane readcomicsonline; corresponding source: sources/readcomicsonline/0.1.0/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Values from the public /advanced-search form; labels are not protocol keys.
const RCO_FILTERS = [
    ['status_id', '连载状态', [['全部', ''], ['连载中', '1'], ['已完结', '2']]],
    ['type_id', '漫画类型', [['全部', ''], ['DC Comics', '1'], ['Marvel Comics', '2'], ['Other Comics', '3']]],
    ['category', '出版社', [['全部', ''], ['215 Ink', '75'], ['451', '58'], ['AAM-Markosia', '70'], ['Ablaze', '94'],
        ['Abstract Studio', '76'], ['Action Lab', '53'], ['Aftershock Comics', '51'], ['Ahoy Comics', '90'], ['Albatross', '77'],
        ['Alien Books', '111'], ['Alterna Comics', '84'], ['American Gothic Press', '73'], ['American Mythology', '54'],
        ['Amryl Entertainment', '89'], ['Antartic Press', '52'], ['Archie', '40'], ['ARH Comix', '78'], ['Aspen', '72'],
        ['Avatar Press', '67'], ['AWA Studios', '101'], ['Bad Idea', '113'], ['Benitez', '86'], ['Black Mask', '59'],
        ['Black Panel Press', '105'], ['Bongo', '63'], ['Boom Studios', '35'], ['Boundless', '66'], ['BroadSword Comics', '69'],
        ['Bubble', '65'], ['Chapterhouse Comics', '60'], ['Coffin Comics', '92'], ['Comics Experience', '83'], ['Darby Pop', '42'],
        ['Dark Horse', '38'], ['DC Comics', '33'], ['Devils Due', '50'], ['DSTLRY', '109'], ['Dynamite', '36'], ['Europe Comics', '95'],
        ['Fantagraphics', '71'], ['First Second', '108'], ['Graphic India', '41'], ['Heavy Metal', '62'], ['Hermes Press', '57'],
        ['Humanoids', '96'], ['Icon Comics', '44'], ['IDW', '39'], ['Ignition Press', '112'], ['Image Comics', '47'], ['Inverse', '103'],
        ['Joe Books', '81'], ['Legendary Comics', '79'], ['Lion Forge', '85'], ['MAD', '82'], ['Mad Cave', '91'], ['Magnetic Press', '93'],
        ['Marvel Comics', '34'], ['Monkeybrain', '80'], ['One Shots & TPBs', '17'], ['Oni Press', '43'], ['Rebellion', '37'], ['Red 5', '61'],
        ['SAF Comics', '99'], ['Scholastic', '100'], ['Scout Comics', '106'], ['Soleil', '98'], ['Source Point Press', '107'],
        ['Space Goat Productions', '68'], ['Storm King', '87'], ['Stranger Comics', '102'], ['Sucker', '88'], ['TKO', '97'],
        ['Top Cow', '56'], ['Top Shelf', '64'], ['Udon', '46'], ['United Plankton', '45'], ['Valiant', '48'], ['Vault', '74'],
        ['Vertigo', '49'], ['Virus', '104'], ['Yen Press', '110'], ['Zenescope', '55']]],
];

// SPDX-License-Identifier: GPL-3.0-only
// Keiyoushi port attribution and original Apache-2.0 terms are appended below.
const RCO_ORIGIN = 'https://readcomicsonline.ru';
function rcoError(code, message) { return new Error('[RCO:' + code + '] ' + message); }
function rcoRequire(value, code, message) { if (!value) throw rcoError(code, message); }
function rcoText(element) { return (element?.text || '').replace(/\s+/g, ' ').trim(); }
function rcoUrl(value, image = false) {
    rcoRequire(typeof value === 'string' && value.trim() && !/[\s\\\u0000-\u001f]/.test(value.trim()), 'url', '地址格式无效');
    let url = value.trim();
    if (url.startsWith('//')) url = 'https:' + url;
    else if (url.startsWith('/')) url = RCO_ORIGIN + url;
    const match = /^https:\/\/([^/?#]+)(\/[^?#]*)?(?:\?([^#]*))?(?:#)?$/.exec(url);
    const hosts = image ? ['readcomicsonline.ru', 'cdn.readcomicsonline.ru'] : ['readcomicsonline.ru'];
    rcoRequire(match && hosts.includes(match[1]), 'url', '地址协议或主机不受支持');
    let parts;
    try { parts = (match[2] || '/').replace(/\/$/, '').split('/').slice(1).map(decodeURIComponent); }
    catch { throw rcoError('url', '地址编码无效'); }
    rcoRequire(parts.every(p => p && !/[\s/\\?#\u0000-\u001f]/.test(p) && p !== '.' && p !== '..'), 'url', '地址路径无效');
    const query = {};
    for (const pair of (match[3] || '').split('&').filter(Boolean)) {
        let key, val;
        try { const at = pair.indexOf('='); key = decodeURIComponent(at < 0 ? pair : pair.slice(0, at));
            val = decodeURIComponent((at < 0 ? '' : pair.slice(at + 1)).replace(/\+/g, ' ')); }
        catch { throw rcoError('url', '查询参数编码无效'); }
        rcoRequire(key && !Object.prototype.hasOwnProperty.call(query, key), 'url', '查询参数重复');
        Object.defineProperty(query, key, {value: val, enumerable: true});
    }
    return {url: 'https://' + match[1] + '/' + parts.map(encodeURIComponent).join('/') + (match[3] ? '?' + match[3] : ''), parts, query};
}
function rcoLocation(value, chapter = false) {
    const loc = rcoUrl(value);
    rcoRequire(loc.parts[0] === 'comic' && loc.parts.length === (chapter ? 3 : 2) && !Object.keys(loc.query).length,
        'url', '作品或章节路径无效，请从目录重新打开');
    return loc;
}
function rcoIdentity(doc, expected) {
    const url = doc.selectFirst('link[rel="canonical"]').attr('href');
    rcoRequire(url && rcoUrl(url).url === expected, 'identity', '返回页面与请求身份不一致');
}
function rcoImage(element, owner, chapter) {
    const src = element.attr('data-src') || element.attr('src');
    if (!src) return '';
    const loc = rcoUrl(src, true), parts = loc.parts;
    rcoRequire(parts[0] === 'uploads' && parts[1] === 'manga' && parts[2] === owner &&
        (chapter === undefined ? parts[3] === 'cover' : parts[3] === 'chapters' && parts[4] === chapter),
        'image-owner', '图片与作品或章节归属不一致');
    return loc.url;
}
function rcoNext(doc, path, params, page) {
    const next = doc.select('nav a[rel="next"]');
    for (const link of next) {
        const loc = rcoUrl(link.attr('href'));
        const expected = {...params, page: String(page + 1)};
        rcoRequire(loc.parts.join('/') === path && Object.keys(expected).every(k => loc.query[k] === expected[k]) &&
            Object.keys(loc.query).every(k => k in expected || !loc.query[k]), 'pagination', '分页地址或筛选条件发生变化');
    }
    const current = rcoText(doc.selectFirst('nav [aria-current="page"]'));
    rcoRequire(!current || Number(current) === page, 'pagination', '源站返回了错误页码');
    return next.length > 0;
}
function rcoListing(html, path, params, page) {
    const doc = new Document(html), main = doc.selectFirst('main'), search = path === 'advanced-search';
    rcoIdentity(doc, RCO_ORIGIN + '/' + path);
    const cards = search ? main.select('a.group') : main.select('.comic-list-layout .grid > .group');
    const seen = new Set(), list = cards.map(card => {
        const a = search ? card : card.selectFirst('a.block.text-sm.font-semibold');
        const loc = rcoLocation(a.attr('href')), name = rcoText(search ? a.selectFirst('p') : a);
        rcoRequire(name && !seen.has(loc.url), 'listing', '列表缺少标题或含有重复作品');
        seen.add(loc.url);
        return {name, link: loc.url, imageUrl: rcoImage(card.selectFirst('img'), loc.parts[1])};
    });
    const hasNextPage = rcoNext(main, path, params, page);
    const total = search ? rcoText(main.selectFirst('h2')).match(/^Search results\s*\(([\d,]+)\)$/i) : null;
    if (search) {
        rcoRequire(total, 'listing', '搜索结果标记缺失');
        const count = Number(total[1].replace(/,/g, ''));
        rcoRequire(list.length === Math.min(60, Math.max(0, count - (page - 1) * 60)) && hasNextPage === (page * 60 < count),
            'pagination', '搜索结果数量或分页不完整');
    }
    rcoRequire(list.length || search && /No comics match those filters\./.test(rcoText(main)) && !hasNextPage,
        'listing', '列表内容缺失，不能视为空结果');
    return {list, hasNextPage};
}
function rcoDate(value) {
    const match = /^(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{4})$/.exec(value.trim());
    if (!match) return '';
    const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].toLowerCase());
    const day = Number(match[1]), year = Number(match[3]), date = new Date(year, month, day);
    return month >= 0 && year >= 1970 && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? String(date.getTime()) : '';
}
function rcoDetail(html, loc) {
    const doc = new Document(html), main = doc.selectFirst('main');
    rcoIdentity(doc, loc.url);
    const name = rcoText(main.selectFirst('h1.text-2xl'));
    rcoRequire(name, 'detail', '作品标题缺失');
    const section = main.select('section').find(e => rcoText(e.selectFirst('h2')) === 'Chapters');
    rcoRequire(section && !section.select('a[rel="next"]').length, 'catalog', '完整章节目录未加载');
    const rows = section.select('.overflow-hidden.border-ink-600 > a'), seen = new Set(), chapters = [];
    rcoRequire(rows.length > 0 && rows.length <= 10000, 'catalog', '章节目录为空或超出处理范围');
    for (const row of rows) {
        const chapter = rcoLocation(row.attr('href'), true), title = rcoText(row.selectFirst('.text-brand-400'));
        rcoRequire(chapter.parts[1] === loc.parts[1], 'chapter-owner', '章节不属于当前作品');
        rcoRequire(title, 'catalog', '章节名称缺失');
        if (seen.has(chapter.url)) continue;
        seen.add(chapter.url);
        chapters.push({name: title, url: chapter.url, dateUpload: rcoDate(rcoText(row.selectFirst('.text-slate-500')))});
    }
    const synopsis = main.select('div.overflow-hidden.border-ink-600').find(e => rcoText(e.selectFirst('h3')) === 'Synopsis');
    const fields = main.select('dl > div');
    const field = label => fields.find(e => rcoText(e.selectFirst('span')).toLowerCase().replace(/:$/, '') === label);
    const names = label => (field(label)?.select('a') || []).map(rcoText);
    const state = rcoText(main.selectFirst('div.flex.flex-wrap.gap-2 span.rounded-full')).toLowerCase();
    return {name, link: loc.url, imageUrl: rcoImage(main.selectFirst('img.w-full.rounded-xl'), loc.parts[1]),
        description: (synopsis?.select('p') || []).map(rcoText).join('\n\n'), author: names('author').join(', '), artist: names('artist').join(', '),
        genre: names('genres'), status: ({ongoing: 0, complete: 1, completed: 1, hiatus: 2, dropped: 3})[state] ?? 5, chapters};
}
function rcoPages(html, loc) {
    const doc = new Document(html), main = doc.selectFirst('main');
    rcoIdentity(doc, loc.url);
    const owner = RCO_ORIGIN + '/comic/' + encodeURIComponent(loc.parts[1]);
    rcoRequire(main.select('nav[aria-label="Breadcrumb"] a').some(e => rcoUrl(e.attr('href')).url === owner),
        'chapter-owner', '阅读器缺少当前作品归属');
    const selected = main.select('select').filter(e => e.attr('id') !== 'page-list').flatMap(e => e.select('option[selected]'));
    rcoRequire(selected.length && selected.every(e => rcoLocation(e.attr('value'), true).url === loc.url),
        'chapter-owner', '阅读器选择的章节与请求不一致');
    const images = main.select('#reader-all img'), slots = main.select('#page-list option');
    rcoRequire(images.length > 0 && images.length <= 2000 && slots.length === images.length, 'pages', '完整图片清单缺失或页数不匹配');
    slots.forEach((slot, i) => rcoRequire(rcoUrl(slot.attr('value')).url === loc.url + '/' + (i + 1), 'page-order', '图片导航顺序或章节归属无效'));
    return images.map(image => {
        const url = rcoImage(image, loc.parts[1], loc.parts[2]);
        rcoRequire(url, 'pages', '图片地址缺失');
        return {url, headers: {Referer: RCO_ORIGIN + '/'}};
    });
}

/*
Ported from ReadComicsOnline.kt in Keiyoushi/extensions-source
Commit: b647c92fd14801fda23e866d5a7da7d5fdd7ec92
Copyright 2015 Javier Tomás and contributors (upstream project).
Original portions: Apache-2.0. NodeLane adaptations: GPL-3.0-only.
Changes: MProvider/DOM bridge, filters, bounded requests, identity, dates,
complete-page validation and categorized errors. No JVM dependency.
The original Apache-2.0 license follows and travels with every bundle:

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
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: RCO_ORIGIN + '/'}; }
    getSourcePreferences() { return []; }
    getFilterList() {
        return RCO_FILTERS.map(([type, name, values]) => ({type, name, type_name: 'SelectFilter', state: 0,
            values: values.map(([name, value]) => ({name, value, type_name: 'SelectOption'}))}));
    }
    async read(url) {
        const response = await this.client.get(url, this.getHeaders());
        const body = response.body || '';
        if (Object.entries(response.headers || {}).some(([key, value]) => key.toLowerCase() === 'cf-mitigated' && value === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body))
            throw rcoError('verification', 'Cloudflare 验证或封禁，请在来源网页处理后重试');
        if (response.statusCode === 429) throw rcoError('rate-limit', '请求过于频繁，请稍后重试');
        if (response.statusCode === 401 || response.statusCode === 403) throw rcoError('access', '源站拒绝访问，请在来源网页核对访问状态');
        if (response.statusCode !== 200) throw rcoError('http', '请求失败（HTTP ' + response.statusCode + '）');
        rcoRequire(typeof body === 'string' && body.length <= 4 * 1024 * 1024, 'response', '响应格式或大小无效');
        return body;
    }
    async listing(path, params, page) {
        rcoRequire(Number.isInteger(page) && page >= 1 && page <= 10000, 'page', '页码无效');
        const query = Object.entries({...params, page: String(page)}).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
        return rcoListing(await this.read(RCO_ORIGIN + '/' + path + '?' + query), path, params, page);
    }
    getPopular(page) { return this.listing('comic-list', {sort: 'views'}, page); }
    getLatestUpdates(page) { return this.listing('comic-list', {sort: 'latest'}, page); }
    search(query, page, filters = []) {
        rcoRequire(typeof query === 'string' && query.length <= 200 && Array.isArray(filters), 'search', '搜索条件无效');
        const params = query.trim() ? {name: query.trim()} : {}, seen = new Set();
        for (const filter of filters) {
            const definition = RCO_FILTERS.find(([type]) => type === filter.type);
            rcoRequire(definition && !seen.has(filter.type) && filter.type_name === 'SelectFilter' && Number.isInteger(filter.state) &&
                filter.state >= 0 && filter.state < definition[2].length, 'filter', '筛选选项无效，请重置筛选');
            seen.add(filter.type);
            const value = definition[2][filter.state][1];
            if (value) params[filter.type] = value;
        }
        return Object.keys(params).length ? this.listing('advanced-search', params, page) : this.getPopular(page);
    }
    async getDetail(url) {
        const loc = rcoLocation(url);
        return rcoDetail(await this.read(loc.url), loc);
    }
    async getPageList(url) {
        const loc = rcoLocation(url, true);
        return rcoPages(await this.read(loc.url), loc);
    }
}

return SourceExtension;
})();

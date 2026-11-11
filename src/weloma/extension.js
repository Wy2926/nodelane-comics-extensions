// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Keiyoushi WeLoveManga/FMReader; original Apache-2.0 terms below.
const WM_ORIGIN = 'https://weloma.net';
const WM_OWNER = '#nodelane-weloma=';
function wmRequire(value, code, message) {
    if (!value) throw Error('[Weloma:' + code + '] ' + message);
}
function wmBase64(value) {
    const input = value.replace(/\s/g, '');
    wmRequire(input && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/.test(input), 'encoding', 'Base64 数据无效');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0, buffer = 0, encoded = '';
    for (const char of input.replace(/=+$/, '')) {
        buffer = (buffer << 6) | alphabet.indexOf(char); bits += 6;
        if (bits >= 8) { bits -= 8; encoded += '%' + ((buffer >>> bits) & 255).toString(16).padStart(2, '0'); }
    }
    wmRequire(!bits || (buffer & ((1 << bits) - 1)) === 0, 'encoding', 'Base64 数据不完整');
    try { return decodeURIComponent(encoded); }
    catch { throw Error('[Weloma:encoding] UTF-8 数据无效'); }
}
function wmText(element) {
    const encoded = element?.attr('data-enc');
    return (encoded ? wmBase64(encoded) : element?.text || '').replace(/\s+/g, ' ').trim();
}
function wmLocation(value, kind) {
    wmRequire(typeof value === 'string', 'url', '作品或章节地址无效');
    const parts = value.split(WM_OWNER);
    const url = parts[0].startsWith('/') ? WM_ORIGIN + parts[0] : parts[0];
    wmRequire(new RegExp('^https://weloma\\.net/' + kind + '/[A-Za-z0-9]+(?:\\?[^#\\s\\\\]*)?$').test(url) &&
        parts.length <= 2 && (parts.length === 1 || kind === 'c'), 'url', '作品或章节地址不属于 Weloma');
    let owner;
    if (parts.length === 2) {
        try { owner = wmLocation(decodeURIComponent(parts[1]), 'm').url; }
        catch { throw Error('[Weloma:url] 章节作品标记无效'); }
    }
    return {url, owner};
}
function wmImage(value, base) {
    let url = (value || '').trim().replace(/ /g, '%20');
    wmRequire(url && !/[\u0000-\u001f\\]/.test(url), 'image', '图片地址缺失或无效');
    if (url.startsWith('//')) url = 'https:' + url;
    else if (url.startsWith('/')) url = WM_ORIGIN + url;
    else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = base.slice(0, base.lastIndexOf('/') + 1) + url;
    wmRequire(/^https?:\/\/[^/?#@\s]+(?:[/?#][^\s]*)?$/i.test(url), 'image', '图片地址格式无效');
    return url;
}
function wmDate(value) {
    const relative = /^(\d+)\s+(seconds?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago$/i.exec(value.trim());
    if (relative) {
        const date = new Date(Date.now()), n = Number(relative[1]), unit = relative[2].toLowerCase().replace(/s$/, '');
        if (unit === 'month' || unit === 'year') {
            const day = date.getUTCDate(); date.setUTCDate(1);
            date.setUTCMonth(date.getUTCMonth() - n * (unit === 'year' ? 12 : 1));
            date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
        } else date.setTime(date.getTime() - n * ({second:1000, minute:60000, min:60000, hour:3600000, day:86400000, week:604800000}[unit]));
        return Number.isFinite(date.getTime()) && date.getTime() > 0 ? String(date.getTime()) : '';
    }
    const absolute = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    if (!absolute) return '';
    const [,d,m,y] = absolute.map(Number), time = Date.UTC(y,m-1,d), date = new Date(time);
    return time > 0 && date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d ? String(time) : '';
}
function wmReader(doc, loc) {
    const links = doc.select('.breadcrumb a[href]');
    wmRequire(links.some(a => a.attr('href') === loc.url || WM_ORIGIN + a.attr('href') === loc.url), 'identity', '阅读页与请求章节不一致');
    const owners = links.filter(a => /^(?:https:\/\/weloma\.net)?\/m\//.test(a.attr('href')));
    wmRequire(owners.length === 1, 'identity', '阅读页缺少作品身份');
    const owner = wmLocation(owners[0].attr('href'), 'm').url;
    wmRequire(!loc.owner || loc.owner === owner, 'owner', '阅读页属于其他作品');
    const menus = doc.select('ul.chapter_select select');
    wmRequire(menus.length, 'catalog', '阅读页缺少章节菜单');
    const catalogs = menus.map(menu => {
        const selected = menu.select('option[selected]');
        wmRequire(selected.length === 1 && wmLocation(selected[0].attr('value'), 'c').url === loc.url, 'identity', '章节菜单与请求不一致');
        const chapters = [], seen = new Set();
        for (const option of menu.select('option')) {
            const url = wmLocation(option.attr('value'), 'c').url, name = wmText(option);
            wmRequire(name, 'catalog', '章节名称缺失');
            if (!seen.has(url)) { seen.add(url); chapters.push({name, url}); }
        }
        return chapters;
    });
    wmRequire(catalogs.every(c => c.map(x => x.url).join('\n') === catalogs[0].map(x => x.url).join('\n')), 'catalog', '章节菜单相互矛盾');
    return {owner, chapters:catalogs[0]};
}
class SourceExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout:25, connectTimeout:10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer:WM_ORIGIN + '/'}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }
    async read(url) {
        const response = await this.client.get(url, this.getHeaders()), body = response.body;
        if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase() === 'cf-mitigated' && v === 'challenge') ||
            /<title>\s*Just a moment|id=["']challenge-form["']|Sorry, you have been blocked/i.test(body || ''))
            throw Error('[Weloma:verification] 请在来源网页完成验证后重试');
        wmRequire(response.statusCode !== 429, 'rate-limit', '请求过于频繁，请稍后重试');
        wmRequire(response.statusCode !== 401 && response.statusCode !== 403, 'access', '源站拒绝访问，请在来源网页核对');
        wmRequire(response.statusCode === 200, 'http', '请求失败（HTTP ' + response.statusCode + '）');
        wmRequire(typeof body === 'string' && /<\/html\s*>/i.test(body), 'structure', '页面响应不完整');
        return new Document(body);
    }
    async listing(params, page) {
        wmRequire(Number.isSafeInteger(page) && page > 0, 'page', '页码无效');
        const query = Object.entries({...params, page, listType:'pagination'}).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
        const doc = await this.read(WM_ORIGIN + '/manga-list.html?' + query);
        const roots = doc.select('.card-body #history'), pagers = doc.select('.pagination-wrap .pagination');
        wmRequire(roots.length === 1 && pagers.length === 1, 'listing', '列表或分页区域缺失');
        const list = [], seen = new Set();
        for (const card of roots[0].select('.thumb-item-flow')) {
            const a = card.selectFirst('.series-title a'), link = wmLocation(a?.attr('href'), 'm').url, name = wmText(a);
            wmRequire(name, 'listing', '作品标题缺失');
            const style = card.selectFirst('.content.img-in-ratio')?.attr('style') || '';
            const cover = /url\(\s*['"]?([^'"()]*?)['"]?\s*\)/.exec(style);
            if (!seen.has(link)) { seen.add(link); list.push({name,link,imageUrl:cover ? wmImage(cover[1], WM_ORIGIN + '/') : ''}); }
        }
        const active = pagers[0].select('a.active');
        if (!list.length) {
            wmRequire(!pagers[0].select('a').length && !wmText(roots[0]), 'listing', '空列表状态不明确');
            return {list,hasNextPage:false};
        }
        wmRequire(active.length === 1 && wmText(active[0]) === String(page), 'pagination', '返回页码与请求不一致');
        const next = pagers[0].select('a[href]:not(.disabled)').some(a => wmText(a) === '»' || wmText(a) === String(page + 1));
        wmRequire(next || !pagers[0].select('a[href]').some(a => Number(wmText(a)) > page), 'pagination', '下一页入口缺失');
        return {list,hasNextPage:next};
    }
    getPopular(page) { return this.listing({sort:'views',sort_type:'DESC'}, page); }
    getLatestUpdates(page) { return this.listing({sort:'last_update',sort_type:'DESC'}, page); }
    search(query, page) {
        wmRequire(typeof query === 'string', 'search', '搜索关键词无效');
        return this.listing({name:query.trim()}, page);
    }
    async getDetail(value) {
        const loc = wmLocation(value, 'm'), doc = await this.read(loc.url);
        const name = wmText(doc.selectFirst('.manga-info h1, .manga-info h3'));
        const roots = doc.select('.list-chapters');
        wmRequire(name && roots.length === 1 && !roots[0].select('.pagination, [rel="next"]').length, 'catalog', '作品或完整目录缺失');
        const chapters = new Map();
        for (const a of roots[0].select('a[href]')) {
            const url = wmLocation(a.attr('href'), 'c').url, name = a.attr('title') || wmText(a.selectFirst('.chapter-name'));
            wmRequire(name, 'catalog', '章节名称缺失');
            chapters.set(url, {name,url,dateUpload:wmDate(wmText(a.selectFirst('.chapter-time')))});
        }
        wmRequire(chapters.size, 'catalog', '源站未提供可读章节目录');
        const first = chapters.values().next().value;
        const reader = wmReader(await this.read(first.url), {url:first.url,owner:loc.url});
        wmRequire([...chapters.keys()].every(url => reader.chapters.some(c => c.url === url)), 'catalog', '目录与阅读菜单不一致，请重试');
        const status = wmText(doc.selectFirst('.manga-info a.btn-success')).toLowerCase();
        const cover = doc.selectFirst('img.thumbnail');
        const other = doc.select('.manga-info li').map(wmText).find(t => /^Other names\s*:/i.test(t));
        return {name,link:loc.url,imageUrl:cover?.attr('src') ? wmImage(cover.attr('src'),loc.url) : '',
            author:doc.select('.manga-info a.btn-info').map(wmText).filter(t => !/^updating$/i.test(t)).join(', '),
            genre:doc.select('.manga-info a.btn-danger').map(wmText),
            status:/^complet(?:ed|e)$/.test(status) ? 1 : /^(?:on ?going|updating|incomplete)$/.test(status) ? 0 : 5,
            description:[wmText(doc.selectFirst('.summary-content')),other].filter(Boolean).join('\n\n'),
            chapters:reader.chapters.map(c => ({...(chapters.get(c.url) || {...c,dateUpload:''}),url:c.url + WM_OWNER + encodeURIComponent(loc.url)}))};
    }
    async getPageList(value) {
        const loc = wmLocation(value, 'c'), doc = await this.read(loc.url);
        wmReader(doc, loc);
        const roots = doc.select('#chapter-images');
        wmRequire(roots.length === 1, 'pages', '正文区域缺失');
        const images = roots[0].select('img.chapter-img');
        wmRequire(images.length, 'pages', '源站未提供正文图片');
        return images.map(img => {
            const attr = ['data-img','data-original','data-src','data-srcset','data-aload','src'].map(k => img.attr(k)).find(Boolean);
            wmRequire(attr, 'pages', '正文图片地址缺失');
            const value = /^https?:\/\//i.test(attr) || attr.includes('.') ? attr : wmBase64(attr);
            return {url:wmImage(value,loc.url),headers:{Referer:loc.url}};
        });
    }
}

/*
Original work: Copyright 2015 Javier Tomás and Keiyoushi/Tachiyomi contributors.
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

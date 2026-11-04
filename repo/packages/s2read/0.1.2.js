// SPDX-License-Identifier: GPL-3.0-only
// NodeLane s2read; corresponding source: sources/s2read/0.1.2/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Independent MProvider adapter for the verified S2READ Madara layout.
const S2_ORIGIN = 'https://s2read.com';
function s2Failure(code, reason) {
    return new Error('S2READ ' + reason + ' [S2:' + code + ']，请更新来源。');
}
function s2Location(value, chapter) {
    const match = /^(?:https:\/\/s2read\.com)?\/manga\/([a-z0-9][a-z0-9-]*)\/(?:([a-z0-9][a-z0-9._-]*)\/)?(?:\?style=list)?$/.exec(value);
    if (!match || Boolean(match[2]) !== chapter)
        throw s2Failure(chapter ? 'chapter-url' : 'work-url', chapter ? '章节地址格式不受支持' : '作品地址格式不受支持');
    return {slug: match[1], chapter: match[2], url: S2_ORIGIN + '/manga/' + match[1] + '/' + (match[2] ? match[2] + '/' : '')};
}
function s2Image(value) {
    value = String(value || '').trim();
    if (!/^https:\/\/(?:(?:cdn-?[1-9][0-9]*|vps[1-9][0-9]*)\.)?s2read\.com\/[\S]+$/.test(value)) throw s2Failure('image-url', '图片地址不在已适配的站点范围');
    return value;
}
function s2Cover(node) {
    // Some valid search cards have an empty thumbnail container.
    // Covers are optional; chapter images still require a valid site URL.
    const value = node.attr('data-src') || node.attr('src');
    return value ? s2Image(value) : '';
}
function s2Text(node) { return node.text.replace(/\s+/g, ' ').trim(); }
class SourceExtension extends MProvider {
    constructor() { super(); this.client = new Client({timeout: 25, connectTimeout: 10}); }
    get supportsLatest() { return true; }
    getHeaders() { return {Referer: S2_ORIGIN + '/'}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }
    async read(url, body) {
        const response = body === undefined ? await this.client.get(url, this.getHeaders())
            : await this.client.post(url, this.getHeaders(), body);
        if (Object.entries(response.headers || {}).some(([k,v]) => k.toLowerCase()==='cf-mitigated' && v==='challenge'))
            throw new Error('S2READ 需要 Cloudflare 验证，请在来源网页完成后重试。');
        if (response.statusCode === 429) throw new Error('S2READ 请求过于频繁，请稍后重试。');
        if (response.statusCode !== 200) throw new Error('S2READ 请求失败（HTTP ' + response.statusCode + '）。');
        if (typeof response.body !== 'string' || response.body.length > 2*1024*1024) throw s2Failure('response', '响应格式或大小不在处理范围');
        return response.body;
    }
    async listing(query, page, order) {
        if (!Number.isInteger(page) || page<1 || page>1000) throw new Error('页码无效');
        const search = query !== null;
        const body = {action:'madara_load_more',page:String(page-1),
            template:'madara-core/content/content-' + (search ? 'search' : 'archive'),
            'vars[paged]':'1','vars[template]':search?'search':'archive',
            'vars[posts_per_page]':'12','vars[post_type]':'wp-manga','vars[post_status]':'publish'};
        if (search) body['vars[s]'] = query.trim();
        else { body['vars[orderby]']='meta_value_num'; body['vars[meta_key]']=order==='views'?'_wp_manga_views':'_latest_update';
            body['vars[manga_archives_item_layout]']='big_thumbnail'; }
        const html = await this.read(S2_ORIGIN+'/wp-admin/admin-ajax.php',body);
        if (!html.trim()) return {list:[],hasNextPage:false};
        // Reject an HTML login/challenge document before interpreting fragments.
        if (/<(?:html|script|form)\b/i.test(html)) throw s2Failure('listing-document', '列表返回了完整网页或验证内容');
        const doc = new Document(html), end = doc.select('.no-posts');
        const cards = doc.select(search ? '.c-tabs-item__content' : '.page-item-detail');
        if (end.length>1 || end.some(e=>s2Text(e)) || cards.length>12 ||
            (!cards.length && !end.length) || (cards.length<12 && !end.length)) throw s2Failure('listing-page', '列表分页结构未识别');
        const seen = new Set();
        const list = cards.map(card=>{
            const link = card.selectFirst('.post-title a'), loc=s2Location(link.attr('href'),false);
            const name=s2Text(link);
            if (!name || seen.has(loc.slug)) throw s2Failure('listing-item', '列表作品缺少名称或重复'); seen.add(loc.slug);
            return {name,link:loc.url,imageUrl:s2Cover(card.selectFirst(search?'.tab-thumb img':'.item-thumb img'))};
        });
        return {list,hasNextPage:!end.length};
    }
    getPopular(page) { return this.listing(null,page,'views'); }
    getLatestUpdates(page) { return this.listing(null,page,'latest'); }
    search(query,page) { return query.trim() ? this.listing(query,page) : this.getPopular(page); }
    async getDetail(url) {
        const loc=s2Location(url,false), doc=new Document(await this.read(loc.url));
        if (s2Location(doc.selectFirst('link[rel="canonical"]').attr('href'),false).url!==loc.url) throw s2Failure('work-identity', '返回的作品与请求不符');
        const name=s2Text(doc.selectFirst('.post-title h1')), rows=doc.select('.listing-chapters_wrap .wp-manga-chapter');
        if (!name || !rows.length || rows.length>10000) throw s2Failure('chapter-list', '作品名称或章节目录不完整');
        if (doc.select('#manga-chapters-holder').length) throw s2Failure('chapter-list-ajax', '章节目录尚未展开');
        const seen=new Set(), chapters=[];
        for (const row of rows) {
            const link=row.selectFirst('a'), chapter=s2Location(link.attr('href'),true), title=s2Text(link);
            if (chapter.slug!==loc.slug) throw s2Failure('chapter-owner', '目录混入其他作品的章节');
            if (!title) throw s2Failure('chapter-title', '章节缺少名称');
            // Madara can render repeated records for one URL. Keep each page
            // identity once, without merging distinct URLs by chapter number.
            if (seen.has(chapter.url)) continue;
            seen.add(chapter.url);
            chapters.push({name:title,url:chapter.url});
        }
        const fields={};
        for(const item of doc.select('.post-content_item')) fields[s2Text(item.selectFirst('h5')).toLowerCase()]=s2Text(item.selectFirst('.summary-content'));
        const status=(fields.status||'').toLowerCase();
        return {name,link:loc.url,imageUrl:s2Cover(doc.selectFirst('.summary_image img')),
            description:s2Text(doc.selectFirst('.description-summary .summary__content')),
            author:fields['author(s)']||'',genre:doc.select('.genres-content a').map(s2Text),
            status:status==='ongoing'?0:status==='completed'?1:5,chapters};
    }
    async getPageList(url) {
        const loc=s2Location(url,true), doc=new Document(await this.read(loc.url+'?style=list'));
        if(s2Location(doc.selectFirst('link[rel="canonical"]').attr('href'),true).url!==loc.url) throw s2Failure('chapter-identity', '返回的章节与请求不符');
        const selected=doc.select('.single-chapter-select option[selected]');
        if(!selected.length || selected.some(e=>e.attr('value')!==loc.chapter || s2Location(e.attr('data-redirect'),true).url!==loc.url)) throw s2Failure('chapter-navigation', '章节导航与正文不符');
        if(doc.selectFirst('#wp-manga-current-chap').attr('value')!==loc.chapter) throw s2Failure('chapter-current', '当前章节标识不符');
        const slots=doc.select('.reading-content .page-break'), pages=doc.select('.reading-content .page-break img');
        if(!slots.length && !pages.length && doc.select('.reading-content').length === 1)
            throw new Error('S2READ 本次返回的章节正文没有图片 [S2:chapter-empty]，请在网页核对或稍后重试。');
        if(!pages.length || pages.length>1500 || slots.length!==pages.length) throw s2Failure('page-list', '正文图片清单不完整');
        return pages.map((image,index)=>{
            if(image.attr('id')!=='image-'+index)throw s2Failure('page-order', '正文图片序号不连续');
            return {url:s2Image(image.attr('data-src')||image.attr('src')),headers:this.getHeaders()};
        });
    }
}

return SourceExtension;
})();

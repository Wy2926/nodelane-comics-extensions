// SPDX-License-Identifier: GPL-3.0-only
// Independent MProvider adapter for the verified S2READ Madara layout.
const S2_ORIGIN = 'https://s2read.com';
function s2Failure() { return new Error('S2READ 页面结构或归属已变化，请更新来源。'); }
function s2Location(value, chapter) {
    const match = /^(?:https:\/\/s2read\.com)?\/manga\/([a-z0-9][a-z0-9-]*)\/(?:([a-z0-9][a-z0-9-]*)\/)?(?:\?style=list)?$/.exec(value);
    if (!match || Boolean(match[2]) !== chapter) throw s2Failure();
    return {slug: match[1], chapter: match[2], url: S2_ORIGIN + '/manga/' + match[1] + '/' + (match[2] ? match[2] + '/' : '')};
}
function s2Image(value) {
    value = String(value || '').trim();
    if (!/^https:\/\/(?:s2read\.com|cdn-[1-9][0-9]*\.s2read\.com)\/[\S]+$/.test(value)) throw s2Failure();
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
        if (typeof response.body !== 'string' || response.body.length > 2*1024*1024) throw s2Failure();
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
        if (/<(?:html|script|form)\b/i.test(html)) throw s2Failure();
        const doc = new Document(html), end = doc.select('.no-posts');
        const cards = doc.select(search ? '.c-tabs-item__content' : '.page-item-detail');
        if (end.length>1 || end.some(e=>s2Text(e)) || cards.length>12 ||
            (!cards.length && !end.length) || (cards.length<12 && !end.length)) throw s2Failure();
        const seen = new Set();
        const list = cards.map(card=>{
            const link = card.selectFirst('.post-title a'), loc=s2Location(link.attr('href'),false);
            const name=s2Text(link);
            if (!name || seen.has(loc.slug)) throw s2Failure(); seen.add(loc.slug);
            return {name,link:loc.url,imageUrl:s2Cover(card.selectFirst(search?'.tab-thumb img':'.item-thumb img'))};
        });
        return {list,hasNextPage:!end.length};
    }
    getPopular(page) { return this.listing(null,page,'views'); }
    getLatestUpdates(page) { return this.listing(null,page,'latest'); }
    search(query,page) { return query.trim() ? this.listing(query,page) : this.getPopular(page); }
    async getDetail(url) {
        const loc=s2Location(url,false), doc=new Document(await this.read(loc.url));
        if (s2Location(doc.selectFirst('link[rel="canonical"]').attr('href'),false).url!==loc.url) throw s2Failure();
        const name=s2Text(doc.selectFirst('.post-title h1')), rows=doc.select('.listing-chapters_wrap .wp-manga-chapter');
        if (!name || !rows.length || rows.length>10000) throw s2Failure();
        if (doc.select('#manga-chapters-holder').length) throw s2Failure(); // Unloaded AJAX catalog is not a complete snapshot.
        const seen=new Set();
        const chapters=rows.map(row=>{
            const link=row.selectFirst('a'), chapter=s2Location(link.attr('href'),true), title=s2Text(link);
            if (chapter.slug!==loc.slug || seen.has(chapter.url) || !title) throw s2Failure();
            seen.add(chapter.url);
            return {name:title,url:chapter.url};
        });
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
        if(s2Location(doc.selectFirst('link[rel="canonical"]').attr('href'),true).url!==loc.url) throw s2Failure();
        const selected=doc.select('.single-chapter-select option[selected]');
        if(!selected.length || selected.some(e=>e.attr('value')!==loc.chapter || s2Location(e.attr('data-redirect'),true).url!==loc.url)) throw s2Failure();
        if(doc.selectFirst('#wp-manga-current-chap').attr('value')!==loc.chapter) throw s2Failure();
        const slots=doc.select('.reading-content .page-break'), pages=doc.select('.reading-content .page-break img');
        if(!pages.length || pages.length>1500 || slots.length!==pages.length) throw s2Failure();
        return pages.map((image,index)=>{
            if(image.attr('id')!=='image-'+index)throw s2Failure();
            return {url:s2Image(image.attr('data-src')||image.attr('src')),headers:this.getHeaders()};
        });
    }
}

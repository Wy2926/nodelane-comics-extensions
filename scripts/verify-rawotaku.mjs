// Bounded anonymous verification; never log source responses or image URLs.
import {loadPlugin,Client} from './runtime.mjs';
class BrowserClient extends Client {
    get(url,headers) { return super.get(url,{'User-Agent':'Mozilla/5.0',...headers}); }
}
const plugin=await loadPlugin('rawotaku',BrowserClient), pool=new Map();
for(const [label,work] of [
    ['popular',()=>plugin.getPopular(1)],['popular-2',()=>plugin.getPopular(2)],['latest',()=>plugin.getLatestUpdates(1)],
    ['search',()=>plugin.search('one',1)],['search-ja',()=>plugin.search('異世界',1)],['search-ja-2',()=>plugin.search('異世界',2)],
    ['empty',()=>plugin.search('NodeLaneNoMatch9q7x',1)],
    ['filter',()=>{const f=plugin.getFilterList();f[1].state=1;return plugin.search('',1,f);}],
]) {
    const result=await work();console.log(label,{count:result.list.length,next:result.hasNextPage});
    if(label==='empty'&&result.list.length)throw Error('无结果样本已变化，请核对');
    if(label==='latest'||label==='search')for(const item of result.list.slice(0,3))pool.set(item.link,item);
}
let checked=0;
for(const item of pool.values()) {
    const detail=await plugin.getDetail(item.link), pages=await plugin.getPageList(detail.chapters[0].url);
    console.log('catalog-reader',{sample:++checked,chapters:detail.chapters.length,pages:pages.length,dated:detail.chapters.filter(c=>c.dateUpload).length});
}
const detail=await plugin.getDetail('https://rawotaku.com/read/'+encodeURIComponent('ワンピース')+'-raw/');
const pages=await plugin.getPageList(detail.chapters.at(-1).url);
console.log('long-catalog',{chapters:detail.chapters.length,firstChapterPages:pages.length});
for(const index of [...new Set([0,pages.length-1])]) {
    const response=await new BrowserClient().get(pages[index].url,pages[index].headers);
    if(response.statusCode!==200||!response.headers['content-type']?.startsWith('image/'))throw Error('图片检查失败（页 '+(index+1)+'）');
    console.log('image',{page:index+1,status:response.statusCode,bytes:response.bodyBytes.length});
}

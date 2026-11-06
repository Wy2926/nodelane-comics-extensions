// Anonymous, bounded checks. Device cookies/UA remain managed by the App.
import {loadPlugin, Client} from './runtime.mjs';
class BrowserClient extends Client {
    request(method,url,headers,body) { return super.request(method,url,{'User-Agent':'Mozilla/5.0',...headers},body); }
}
const plugin=await loadPlugin('ridibooks',BrowserClient);
const comic=plugin.getFilterList();comic[0].state=1;
for(const [name,call] of [
    ['popular',()=>plugin.getPopular(1)],['popular-2',()=>plugin.getPopular(2)],
    ['latest',()=>plugin.getLatestUpdates(1)],['webtoon-search',()=>plugin.search('고양이',1)],
    ['comic-search',()=>plugin.search('고양이',1,comic)],['comic-search-2',()=>plugin.search('고양이',2,comic)],
    ['empty',()=>plugin.search('NodeLaneNoMatch9q7x',1)],
]) {
    const result=await call();console.log(name,{count:result.list.length,next:result.hasNextPage});
    if(name==='empty'&&result.list.length)throw Error('无结果检查不符合预期');
}
for(const id of ['4921002551','505015425']) {
    const detail=await plugin.getDetail('https://ridibooks.com/books/'+id);
    console.log('catalog',{id,chapters:detail.chapters.length,dated:detail.chapters.filter(c=>c.dateUpload).length});
    const pages=await plugin.getPageList(detail.chapters[0].url);
    console.log('reader',{id,pages:pages.length});
    for(const index of [...new Set([0,pages.length-1])]) {
        const response=await new BrowserClient().get(pages[index].url,pages[index].headers);
        if(response.statusCode!==200||!response.headers['content-type']?.startsWith('image/'))throw Error('正文图片检查失败（页 '+(index+1)+'）');
        console.log('image',{page:index+1,status:response.statusCode,bytes:response.bodyBytes.length});
    }
}
try {
    await plugin.getPageList('https://ridibooks.com/books/4921002554/view#nodelane-ridibooks=4921002551');
    throw Error('预期需要阅读权限的章节状态已变化，请核对样本');
} catch(error) {
    if(!error.message.includes('[RIDI:access]'))throw error;
    console.log('restricted-chapter',{accessRequired:true});
}

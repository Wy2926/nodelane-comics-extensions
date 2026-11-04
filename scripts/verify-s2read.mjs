import {loadPlugin} from './runtime.mjs';
const plugin=await loadPlugin('s2read');
for(const [name,call] of [['热门',()=>plugin.getPopular(1)],['热门下一页',()=>plugin.getPopular(2)],['最新',()=>plugin.getLatestUpdates(1)],['搜索',()=>plugin.search('soul land',1)],['搜索下一页',()=>plugin.search('soul land',2)],['空搜索',()=>plugin.search('nodelanevalidationzzqv',1)],['完整目录',()=>plugin.getDetail('https://s2read.com/manga/soul-land-iv-8211-the-ultimate-combat/')],['图片清单',()=>plugin.getPageList('https://s2read.com/manga/soul-land-iv-8211-the-ultimate-combat/chapter-2/')]]) {
 try {const r=await call();console.log(name,JSON.stringify({count:r.list?.length??r.chapters?.length??r.length,next:r.hasNextPage}));}
 catch(e){console.error(name,e.message);process.exitCode=1;break;}
}

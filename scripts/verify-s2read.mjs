import {loadPlugin} from './runtime.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--catalogs')) {
 console.error('用法：node scripts/verify-s2read.mjs [--catalogs]');
 process.exit(2);
}
const plugin=await loadPlugin('s2read');
const catalogs=new Map();
for(const [name,call] of [['热门',()=>plugin.getPopular(1)],['热门下一页',()=>plugin.getPopular(2)],['最新',()=>plugin.getLatestUpdates(1)],['搜索',()=>plugin.search('soul land',1)],['搜索下一页',()=>plugin.search('soul land',2)],['空搜索',()=>plugin.search('nodelanevalidationzzqv',1)],['完整目录',()=>plugin.getDetail('https://s2read.com/manga/soul-land-iv-8211-the-ultimate-combat/')],['图片清单',()=>plugin.getPageList('https://s2read.com/manga/soul-land-iv-8211-the-ultimate-combat/chapter-2/')]]) {
 try {
  const r=await call();
  console.log(name,JSON.stringify({count:r.list?.length??r.chapters?.length??r.length,next:r.hasNextPage,
   dated:r.chapters?.filter(c=>c.dateUpload).length}));
  if(r.chapters?.length&&!r.chapters.some(c=>c.dateUpload)) throw Error('完整目录没有取得任何章节日期');
  if(name==='热门'||name==='最新') for(const item of r.list) catalogs.set(item.link,item.name);
 }
 catch(e){console.error(name,e.message);process.exitCode=1;break;}
}
if(args.includes('--catalogs')&&!process.exitCode) {
 // Broader, sequential checks are opt-in: at most the first 12 popular and
 // 12 latest titles, without downloading images or retaining site responses.
 let passed=0;
 for(const [link,name] of [...catalogs].slice(0,24)) {
  try {
   const detail=await plugin.getDetail(link);
   passed++;
   console.log('目录',JSON.stringify({name,chapters:detail.chapters.length,dated:detail.chapters.filter(c=>c.dateUpload).length}));
  } catch(e) {
   console.error('目录失败',JSON.stringify({name,error:e.message}));
   process.exitCode=1;
  }
 }
 console.log('目录汇总',JSON.stringify({checked:Math.min(catalogs.size,24),passed}));
}

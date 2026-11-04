// Saves at most three image samples locally, with only decoding headers in the manifest.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadPlugin,Client} from './runtime.mjs';
import {root,digest} from './catalog.mjs';
const plugin=await loadPlugin('comix'), client=new Client();
const work=await plugin.getDetail('https://comix.to/title/nr83-the-sword-bearing-flower');
const pages=await plugin.getPageList(work.chapters[0].url);
const selected=pages.filter(p=>p.imageProcessing).slice(0,3);
if(!selected.length)throw Error('本章未提供打乱图片，不能据此验收图片还原');
const out=path.join(root,'artifacts/comix-images');await mkdir(out,{recursive:true});
const records=[];
for (const [i,page] of selected.entries()) {
  const response=await client.get(page.url,page.headers);
  if(response.statusCode!==200)throw Error('样本图片读取失败：HTTP '+response.statusCode);
  const file=`page-${i}.bin`;await writeFile(path.join(out,file),response.bodyBytes);
  const headers=Object.fromEntries(Object.entries(response.headers).filter(([k])=>k.startsWith('x-scramble-')));
  records.push({file,sha256:digest(response.bodyBytes),headers,imageProcessing:page.imageProcessing});
  console.log(`样本 ${i+1}：${response.bodyBytes.length} 字节，算法 ${headers['x-scramble-algo']}，网格 ${headers['x-scramble-grid']}`);
}
await writeFile(path.join(out,'images.json'),JSON.stringify(records,null,2)+'\n');
console.log('样本保存到忽略目录 artifacts/comix-images；未保存 Cookie 或签名地址。');

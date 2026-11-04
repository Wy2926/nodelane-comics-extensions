// Developer-only Node harness. Production plugins use App's Client and Document.
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {root, json} from './catalog.mjs';
const run = promisify(execFile);
export class Element {
  constructor(node) { this.node = node; }
  attr(key) { return this.node?.getAttribute(key) ?? ''; }
  get text() { return this.node?.textContent ?? ''; }
  get innerHtml() { return this.node?.innerHTML ?? ''; }
  get outerHtml() { return this.node?.outerHTML ?? ''; }
  select(query) { return [...(this.node?.querySelectorAll(query) ?? [])].map(e=>new Element(e)); }
  selectFirst(query) { return new Element(this.node?.querySelector(query)); }
}
export class Document extends Element {
  constructor(html) { super(parseHTML(html).document); }
}
export class Client {
  get(url,headers = {}) { return this.request('GET',url,headers); }
  post(url,headers = {},body = {}) { return this.request('POST',url,headers,body); }
  async request(method,url,headers,body) {
    const args=['-sS','--max-time','30','--max-filesize','12582912','-D','-','-w','\n%{http_code}','-X',method];
    for(const [key,value] of Object.entries(headers)) args.push('-H', key+': '+value);
    if(body !== undefined) for(const [key,value] of Object.entries(body)) args.push('--data-urlencode',key+'='+value);
    args.push(url);
    let data;
    try { ({stdout:data}=await run('curl',args,{encoding:'buffer',maxBuffer:13*1024*1024})); }
    catch { throw Error('网络请求失败（地址、响应与凭据未输出）'); }
    let responseHeaders={};
    while(data.subarray(0,5).toString()==='HTTP/') {
      const end=data.indexOf('\r\n\r\n'); if(end<0) throw Error('响应头无效');
      responseHeaders=Object.fromEntries(data.subarray(0,end).toString().split('\r\n').slice(1).filter(x=>x.includes(':')).map(x=>{
        const at=x.indexOf(':');return [x.slice(0,at).toLowerCase(),x.slice(at+1).trim()];
      }));
      data=data.subarray(end+4);
    }
    const end=data.lastIndexOf('\n'), bytes=data.subarray(0,end);
    return {statusCode:Number(data.subarray(end+1)),headers:responseHeaders,body:bytes.toString('utf8'),bodyBytes:bytes};
  }
}
export async function loadPlugin(slug, ClientImpl=Client, globals={}) {
  const entry=(await json(path.join(root,'.build/index.json'))).find(e=>e.nodelane.slug===slug);
  if(!entry)throw Error('来源尚未构建');
  const context=vm.createContext({MProvider:class { get source(){return entry;} },Client:ClientImpl,Document,
    NodeLane:{capabilities:['image.tile-shuffle.v1']},...globals});
  vm.runInContext(await readFile(path.join(root,'.build',entry.sourceCodeUrl),'utf8')+'\nglobalThis.plugin = new DefaultExtension();',context);
  return context.plugin;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {mockPlugin} from './helpers/runtime.mjs';

const origin='https://cn.baozimh.com',url=origin+'/comic/fixture';
const detail=await readFile(new URL('./fixtures/baozimh-short-detail.html',import.meta.url),'utf8');
const challenge={statusCode:403,body:JSON.stringify({error:'challenge_required',challenge_url:'/__gatekeeper_challenge/start?return=%2Fcomic%2Ffixture'})};
const success=JSON.stringify({ok:true,response:{statusCode:200,body:detail}});

async function browser(options={}) {
  const sessions=[],requests=[];
  const {plugin}=await mockPlugin('baozimh',()=>challenge,{
    evaluateJavascriptViaWebview:async(pageUrl,headers,scripts,timeout)=>{
      const session={pageUrl,headers,timeout,replies:[],polls:0};sessions.push(session);
      let finish;const completed=new Promise(resolve=>finish=resolve),timers=new Set();
      function open(challenged) {
        const {document}=parseHTML('<html><head>'+(challenged?'<script src="/__gatekeeper_challenge/assets/fixture/challenge.js"></script>':'')+'</head><body data-state="checking"></body></html>');
        let clock=0;const events=new EventTarget();
        const context=vm.createContext({document,location:new URL(pageUrl),URL,AbortController,
          Date:class extends Date {static now(){return clock;}},
          addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
          setTimeout:(fn,delay)=>{
            const id=setTimeout(()=>{
              timers.delete(id);
              if(delay===250){
                session.polls++;assert.equal(requests.length,0,'no fetch before verification');
                if(options.navigate){events.dispatchEvent(new Event('pagehide'));open(false);return;}
                if(options.waitTimeout)clock+=150000;
                else document.body.setAttribute('data-state',options.fail?'failed':'passed');
              }
              fn();
            },delay===250?1:delay);timers.add(id);return id;
          },
          clearTimeout:id=>{clearTimeout(id);timers.delete(id);},
          fetch:async(target,init)=>{
            requests.push({url:target,init});assert.equal(init.credentials,'same-origin');
            assert.equal(Object.keys(init.headers).some(k=>k.toLowerCase()==='cookie'),false);
            return {url:target,status:200,headers:new Headers(),text:async()=>detail};
          },
        });
        context.window=context;
        const bridge={callHandler:async(name,value)=>{assert.equal(name,'setResponse');session.replies.push(value);finish(value);}};
        if(!options.delayedBridge)context.flutter_inappwebview=bridge;
        for(const script of scripts){vm.runInContext(script,context);vm.runInContext(script,context);}
        if(options.delayedBridge){context.flutter_inappwebview=bridge;events.dispatchEvent(new Event('flutterInAppWebViewPlatformReady'));}
      }
      open(!options.ready);
      try {const result=await completed;assert.equal(timers.size,0,'all document timers released');return result;}
      finally {for(const timer of timers)clearTimeout(timer);}
    },
  });
  return {plugin,sessions,requests};
}

test('Baozi waits for Gatekeeper, preserves the original request and only replies once across bridge/load events',async()=>{
  for(const options of [{delayedBridge:true},{navigate:true},{ready:true}]){
    const {plugin,sessions,requests}=await browser(options);
    assert.equal((await plugin.getDetail(url)).chapters.length,3);
    assert.equal(requests.length,1);assert.equal(requests[0].url,url);
    assert.equal(sessions[0].pageUrl,origin+'/__gatekeeper_challenge/start?return=%2Fcomic%2Ffixture');
    assert.equal(sessions[0].timeout,180);assert.equal(sessions[0].replies.length,1);
    assert.equal(sessions[0].polls,options.ready?0:1);
  }
});
test('Baozi failed or expired Gatekeeper does not fetch or return a partial catalog',async()=>{
  for(const options of [{fail:true},{waitTimeout:true}]){
    const {plugin,requests}=await browser(options);
    await assert.rejects(plugin.getDetail(url),/BAOZI:verification.*(失败|超时)/);
    assert.equal(requests.length,0);
  }
});
test('Baozi rechecks the verified response without verification loops and keeps HTTP failures distinct',async()=>{
  for(const [raw,code] of [['','verification'],['not JSON','verification'],[JSON.stringify({ok:true,response:challenge}),'verification'],[JSON.stringify({ok:true,response:{statusCode:429,body:'limited'}}),'rate-limit']]){
    let calls=0;
    const {plugin,requests}=await mockPlugin('baozimh',()=>challenge,{evaluateJavascriptViaWebview:async()=>{calls++;return raw;}});
    await assert.rejects(plugin.getDetail(url),new RegExp('BAOZI:'+code));
    assert.equal(calls,1);assert.equal(requests.length,1);
  }
});
test('Baozi serializes verification requests and permits a fresh attempt after failure',async()=>{
  let active=0,calls=0,release;
  const held=new Promise(resolve=>release=resolve);
  const {plugin}=await mockPlugin('baozimh',()=>challenge,{evaluateJavascriptViaWebview:async()=>{
    assert.equal(++active,1);calls++;
    try {if(calls===1){await held;return '';}return success;}finally{active--;}
  }});
  const first=assert.rejects(plugin.getDetail(url),/BAOZI:verification/),second=plugin.getDetail(url);
  release();await first;assert.equal((await second).chapters.length,3);
  assert.equal((await plugin.getDetail(url)).chapters.length,3);assert.equal(calls,3);
});

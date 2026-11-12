// SPDX-License-Identifier: GPL-3.0-only
// Gatekeeper flow checked against Keiyoushi; the source page runs its own PoW worker.
function bzGatekeeperRequired(response) {
  const headers=Object.fromEntries(Object.entries(response.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  return headers['x-gatekeeper-challenge']==='required' || /"error"\s*:\s*"challenge_required"|__gatekeeper_challenge\/start/.test(response.body||'');
}

// Serialized into the temporary WebView. Cookies stay in its browser session.
function bzRunVerifiedPage(url) {
  if (window.__nodeLaneBaoziRequest) return;
  window.__nodeLaneBaoziRequest=true;
  let unloaded=false,waitTimer,requestTimer,controller;
  const cleanup=()=>{clearTimeout(waitTimer);clearTimeout(requestTimer);};
  const onHide=()=>{unloaded=true;cleanup();if(controller)controller.abort();};
  window.addEventListener('pagehide',onHide,{once:true});
  const run=async()=>{
    let result;
    try {
      if (location.origin!==new URL(url).origin) throw Error('验证页面已跳转，请在来源网页核对后重试');
      // The website redirects after passing; onLoadStop reinjects this program in
      // the new document. Its manual mode instead leaves data-state="passed" here.
      const deadline=Date.now()+150000;
      await new Promise((resolve,reject)=>{
        const check=()=>{
          const challenge=window.gatekeeperChallenge || document.querySelector('script[src*="/__gatekeeper_challenge/"]');
          const state=document.body?.getAttribute('data-state');
          if (!challenge || state==='passed') return resolve();
          if (state==='failed') return reject(Error('Gatekeeper 自动验证失败，请在来源网页完成后重试'));
          if (Date.now()>=deadline) return reject(Error('Gatekeeper 自动验证超时，请重试'));
          waitTimer=setTimeout(check,250);
        };
        check();
      });
      if(unloaded)return;
      controller=new AbortController();
      requestTimer=setTimeout(()=>controller.abort(),25000);
      const response=await fetch(url,{headers:{Accept:'text/html'},credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if (new URL(response.url).origin!==location.origin) throw Error('验证后的请求已跳转，请在来源网页核对');
      result={ok:true,response:{statusCode:response.status,headers:Object.fromEntries(response.headers.entries()),body:await response.text()}};
    } catch(error) {
      result={ok:false,error:error.name==='AbortError'?'验证后的请求超时，请重试':error.message||'网页请求失败，请重试'};
    } finally {
      cleanup();
    }
    // A navigation abandons this document; only the new page may answer the host.
    if (unloaded)return;
    window.removeEventListener('pagehide',onHide);
    await window.flutter_inappwebview.callHandler('setResponse',JSON.stringify(result));
  };
  if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler==='function') void run();
  else window.addEventListener('flutterInAppWebViewPlatformReady',()=>{void run();},{once:true});
}

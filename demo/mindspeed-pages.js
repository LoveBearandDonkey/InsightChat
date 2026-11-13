/* Transport to the packaged workbench. This file contains no validation rules. */
(() => {
  const channel='mindspeed-config-demo/v1';
  const bundled=new URL('vendor/mindspeed/index.html',document.currentScript.src).href;
  const embedStyles=new URL('mindspeed-embed.css',document.currentScript.src).href;
  const sessions=new Map();

  document.addEventListener('msi:mindspeed-frame',event=>{
    const {id,frame}=event.detail;
    frame.addEventListener('load',()=>{
      // Same-origin fallback pages keep their packaged files and hashes intact.
      // Cross-origin MCP pages receive this stylesheet from the bridge instead.
      try{
        const doc=frame.contentDocument;
        if(!doc||doc.querySelector('[data-mindspeed-embed]'))return;
        const link=doc.createElement('link');link.rel='stylesheet';link.href=embedStyles;
        link.dataset.mindspeedEmbed='';doc.head.append(link);
      }catch(_){}
    });
    const session=sessions.get(id);
    if(!session)return;
    const origin=new URL(session.url).origin;
    const requestId=crypto.randomUUID();
    let sent=false;
    const stop=()=>{clearInterval(poll);clearTimeout(timeout);window.removeEventListener('message',receive);session.signal?.removeEventListener('abort',cancel);};
    const fail=error=>{stop();session.reject?.(error);};
    const cancel=()=>fail(new DOMException('本次检查已停止','AbortError'));
    const receive=event=>{
      if(event.source!==frame.contentWindow || event.origin!==origin || event.data?.channel!==channel || event.data.requestId!==requestId)return;
      if(event.data.type==='ready' && !sent){sent=true;frame.contentWindow.postMessage({channel,type:'check',requestId,payload:session.payload},origin);}
      if(event.data.type==='result'){stop();session.resolve?.({...event.data.result,id,url:session.url});}
      if(event.data.type==='error')fail(new Error(event.data.message||'页面本地校验失败'));
    };
    const hello=()=>frame.contentWindow?.postMessage({channel,type:'hello',requestId},origin);
    window.addEventListener('message',receive);
    const poll=setInterval(hello,250);
    const timeout=setTimeout(()=>fail(new Error('工作台未响应，请确认已发布带页面通信入口的静态版本')),8000);
    session.signal?.addEventListener('abort',cancel,{once:true});
    if(session.signal?.aborted)cancel();else hello();
  });

  window.MS_MINDSPEED_PAGES=Object.freeze({async check(payload,signal){
    const candidates=[window.MINDSPEED_DEMO_WORKBENCH_URL||bundled,bundled];
    let lastError;
    for(const target of [...new Set(candidates)]){
      if(signal.aborted)throw new DOMException('本次检查已停止','AbortError');
      const id=crypto.randomUUID(),url=new URL(target,location.href);
      url.searchParams.set('embed','1');url.searchParams.set('preview','1');
      try{
        return await new Promise((resolve,reject)=>{
          sessions.set(id,{payload,url:url.href,signal,resolve:result=>{
            // Retain source contents for tab switches and reopening this result.
            Object.assign(sessions.get(id),{signal:null,resolve:null,reject:null});resolve(result);
          },reject});
          window.MS_DEMO.openMindspeed(id,url.href);
        });
      }catch(error){sessions.delete(id);if(signal.aborted)throw error;lastError=error;}
    }
    throw lastError;
  }});
})();

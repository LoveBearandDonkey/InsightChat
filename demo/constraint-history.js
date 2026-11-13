/* Host adapter only: no training rules or card markup are copied here. */
(() => {
  const prepared=new WeakSet();
  function prepareFrame(frame){
    const doc=frame.contentDocument;
    const reply=doc?.getElementById('agent-reply');
    if(!reply||prepared.has(doc))return;
    prepared.add(doc);
    // Keep the upstream interactive view; the host owns the surrounding chat.
    const style=doc.createElement('style');
    style.textContent='html[data-embed=inline] .agent-response,html[data-embed=inline] .panel-top>.meta{display:none}';
    doc.head.append(style);
    const answer=frame.closest('.interactive-response')?.querySelector('[data-constraint-answer]');
    const syncAnswer=()=>{if(answer){answer.textContent=reply.textContent.replace('下方每套方案','卡片中的每套方案');answer.hidden=!reply.textContent.trim();}};
    new MutationObserver(syncAnswer).observe(reply,{childList:true,subtree:true,characterData:true});
    syncAnswer();
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(!data || data.channel!=='mindspeed-constraint-lens/v1')return;
    const frame=[...document.querySelectorAll('iframe[data-constraint-case]')].find(frame=>frame.contentWindow===event.source);
    if(!frame || event.origin!==new URL(frame.src).origin || data.case!==frame.dataset.constraintCase)return;
    if(data.type==='ready')prepareFrame(frame);
    if(data.type==='theme' && ['light','dark'].includes(data.theme))frame.closest('.constraint-inline-card').dataset.theme=data.theme;
    if(data.type==='resize' && Number.isFinite(data.height) && data.height>0 && data.height<20000)frame.style.height=Math.ceil(data.height)+'px';
    if(data.type==='draft' && typeof data.text==='string'){
      const input=document.getElementById('chatInput');input.value=data.text;input.dispatchEvent(new Event('input'));input.focus();
    }
  });
})();

(() => {
  'use strict';
  if(typeof document==='undefined'||!document)return;
  let state=null;
  const send=data=>{if(window.parent!==window)window.parent.postMessage({...data,type:data.type||'ms-demo-action'},'*');};
  function render(){
    const host=document.getElementById('s1TaskContent');host.classList.remove('s1-standalone');
    if(['calc','infinite','chase'].includes(state.themeId))document.documentElement.dataset.agentTheme=state.themeId;else delete document.documentElement.dataset.agentTheme;
    host.innerHTML=S1.render(state);
    if(state.detached){host.insertAdjacentHTML('afterbegin','<p class="s1-view">历史快照：原任务已重置，请回原 IDE 重新接续。</p>');host.querySelectorAll('button').forEach(b=>b.disabled=true);}
  }
  document.addEventListener('click',e=>{
    if(state?.detached)return;
    const c=e.target.closest('[data-s1-candidate]');if(c)return send({action:'candidate',candidate:c.dataset.s1Candidate});
    const source=e.target.closest('[data-s1-source]');if(source)return send({action:'source',path:source.dataset.s1Source,line:Number(source.dataset.line)||0});
    const a=e.target.closest('[data-s1-action]');if(a)send({action:a.dataset.s1Action});
  });
  window.addEventListener('message',e=>{if(e.source!==window.parent||e.data?.type!=='ms-demo-state'||!e.data.s1ScaleDown)return;state=e.data;render();});
  if(window.parent!==window)send({type:'ms-demo-ready'});
})();

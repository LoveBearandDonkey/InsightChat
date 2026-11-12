/* Live configuration check for the VS Code chat; the remaining stories stay scripted. */
(() => {
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prompt = '帮我检查当前打开的训练配置，结合同目录的训练脚本和 JSON 模型配置一起分析，看看有没有配置冲突或缺失项。请给出简短结论和配置工作台链接。';
  let checking=false,controller;
  async function readJson(response) {
    const text=await response.text();
    let data;
    try{data=JSON.parse(text);}catch{throw new Error(`校验地址没有返回 JSON（HTTP ${response.status}）。Live Server 只能提供静态页面，请确认 Node 后端已启动：http://127.0.0.1:2027/demo/`);}
    if(!response.ok)throw new Error(data.message||`校验接口错误（HTTP ${response.status}）`);
    return data;
  }
  async function backend(signal) {
    const origins=[location.origin];
    // Local convenience only: public Pages never sends configuration to loopback.
    if(['127.0.0.1','localhost','[::1]'].includes(location.hostname))origins.push('http://127.0.0.1:2027');
    for(const origin of [...new Set(origins)]){
      try{
        const response=await fetch(origin+'/demo/mindspeed/api/session',{signal:AbortSignal.any([signal,AbortSignal.timeout(1500)])});
        const session=await readJson(response);
        if(session.service==='insightchat-mindspeed-bridge')return origin;
      }catch(error){if(signal.aborted)throw error;}
    }
    throw new Error('未连接到 MindSpeed MCP 后端。请在 InsightChat 目录运行 node demo/server.cjs，并确认 http://127.0.0.1:2027/demo/ 可以访问');
  }
  $('chatMessages').addEventListener('click',event=>{
    if(event.target.closest('[data-action="start"],.suggestion-start')){
      event.preventDefault();event.stopImmediatePropagation();
      $('chatInput').value=prompt;$('chatInput').dispatchEvent(new Event('input'));$('chatInput').focus();
    }
    const link=event.target.closest('[data-mindspeed-result]');
    if(link){event.preventDefault();window.MS_DEMO.openMindspeed(link.dataset.mindspeedResult);}
  },true);
  $('chatStop').addEventListener('click',event=>{if(checking){event.stopImmediatePropagation();controller?.abort();}},true);
  $('chatForm').addEventListener('submit',async event=>{
    const question=$('chatInput').value.trim();
    if(!/MindSpeed|当前.*配置|配置.*校验|校验.*配置|检查.*配置/i.test(question))return;
    event.preventDefault();event.stopImmediatePropagation();if(checking)return;
    const snapshot=window.MS_DEMO.getSnapshot();
    const active=snapshot.active;
    if(!active || active.startsWith('@') || !/\.(sh|ssh|json|ya?ml)$/i.test(active)){
      window.MS_DEMO.appendMessage('<p>请先在 VS Code 中打开要校验的配置文件，再发送问题。</p>');return;
    }
    const folder=active.slice(0,active.lastIndexOf('/')+1);
    const files=Object.entries(snapshot.files).filter(([name])=>name.slice(0,name.lastIndexOf('/')+1)===folder && /\.(sh|ssh|json|ya?ml)$/i.test(name)).map(([path,content])=>({path,content}));
    window.MS_DEMO.appendMessage('<p>'+escape(question)+'</p>','user');
    $('chatInput').value='';$('chatInput').dispatchEvent(new Event('input'));
    checking=true;controller=new AbortController();$('chatSend').hidden=true;$('chatStop').hidden=false;
    window.MS_DEMO.logMindspeed('读取 '+active+'，联合 '+files.length+' 份配置，正在连接 MindSpeed MCP。');
    try{
      let result;
      try{
        const origin=await backend(controller.signal);
        const response=await fetch(origin+'/demo/mindspeed/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({active,files}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
        result=await readJson(response);
        result.url=new URL(result.url,origin).href;
      }catch(error){
        if(controller.signal.aborted)throw error;
        window.MS_DEMO.logMindspeed('MindSpeed MCP 连接或调用失败：'+error.message+'；改用工作台页面本地校验。');
        result=await window.MS_MINDSPEED_PAGES.check({active,files},controller.signal);
      }
      const local=result.mode==='browser-local-config-core';
      const data=result.parse.data;
      window.MS_DEMO.logMindspeed((local?'页面本地 config-core 已执行（未调用 MCP）：':'MindSpeed MCP 已实际调用：')+result.calls.join(' → ')+'；来源 '+result.files.join('、')+'。');
      const errors=result.validation?.errors||[];
      const conflicts=data.source_conflicts||[];
      const missing=data.missing_required_fields||[];
      const conclusion=missing.length?`完整校验还缺 ${missing.length} 项配置，当前不能判定通过。`:errors.length?`发现 ${errors.length} 条静态规则问题${errors[0]?.message?'：'+errors[0].message:''}。`:conflicts.length?`存在 ${conflicts.length} 项来源差异，需核对后确认。`:result.validation?'已完成并行静态校验，未发现阻断问题；实际训练仍需在目标环境验证。':'已解析配置，尚未完成并行静态校验。';
      const execution=local?'MindSpeed MCP 未能完成调用，已改用工作台页面本地校验':'已调用 MindSpeed MCP 的 '+result.calls.map(escape).join('、');
      window.MS_DEMO.appendMessage(`<p>${execution}，联合读取 <strong>${escape(active)}</strong> 所在目录的 ${result.files.length} 份配置。${escape(conclusion)}</p><p><a href="${escape(result.url)}" data-mindspeed-result="${escape(result.id)}">打开 MindSpeed 配置工作台 ↗</a></p>`);
      if(!local)window.MS_DEMO.openMindspeed(result.id,result.url);
    }catch(error){window.MS_DEMO.appendMessage('<p>'+escape(controller.signal.aborted?'本次检查已停止。':'MindSpeed 配置校验未完成：'+error.message+'；未生成通过结论。')+'</p>');}
    finally{checking=false;controller=null;$('chatSend').hidden=false;$('chatStop').hidden=true;$('chatInput').dispatchEvent(new Event('input'));}
  },true);
})();

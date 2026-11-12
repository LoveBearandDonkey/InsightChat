/* Local presentation shell. MindSpeed checks use the demo's real MCP bridge; no training runs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = 'mindstudio-2027-demo-workspace-s1-scale-down-v2';
  const fresh = () => ({project: DEMO.project, files: {...DEMO.files}, webviewUrl:''});
  let workspace = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && validFiles(saved.files) && typeof saved.project === 'string' && validUrl(saved.webviewUrl || '')) {
      const legacyFolders=new Set(Object.keys(DEMO.trainingFiles || {}).map(path=>path.split('/')[1]));
      const files={...DEMO.trainingFiles};
      for(const [path,value] of Object.entries(saved.files)) {
        const target=legacyFolders.has(path.split('/')[0])?'ConfigTest/'+path:path;
        if(target===path||!Object.hasOwn(saved.files,target)) files[target]=value;
      }
      workspace=saved;
      if(validFiles(files)) workspace={...saved,files};
    }
  } catch (_) {}
  const initialFile=Object.keys(DEMO.trainingFiles || {})[0] || 'configs/model.yaml';
  let story = DEMO.stories[0], stage = 0, active = initialFile, tabs = [active];
  let collapsed = new Set(Object.keys(DEMO.trainingFiles || {}).map(path=>path.split('/').slice(0,-1).join('/')).filter(folder=>!active.startsWith(folder+'/'))), dirty = new Set(), messages = [], focusLine = 0, timer = null, busy = false, panel = 'terminal', context = active;
  let applied = false, exported = false, candidate = 'A', validationPlan = null;
  const frame = document.querySelector('.ide');
  const mindspeedViews = new Map();
  const terminalLines = ['<span class="dim">S1 · 64 → 32 卡 · 本轮不占卡 · 无 MCP / 训练作业</span>'];
  const navigation={back:[],forward:[]};
  const icon = name => `<span class="codicon codicon-${name}" aria-hidden="true"></span>`;
  function validFiles(files) { return files && !Array.isArray(files) && typeof files === 'object' && Object.keys(files).length > 0 && Object.keys(files).length < 150 && Object.entries(files).every(([p,v]) => p.length < 180 && !p.startsWith('/') && !p.includes('..') && !p.includes('\\') && p.split('/').every(part=>part&&!['__proto__','constructor','prototype'].includes(part)) && typeof v === 'string' && v.length < 200000); }
  function validUrl(value) { if (!value) return true; try { return ['http:','https:'].includes(new URL(value).protocol); } catch (_) { return false; } }
  function notify(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => $('toast').classList.remove('visible'), 3300); }
  function persist() { try { localStorage.setItem(key,JSON.stringify(workspace)); dirty.clear(); renderTabs(); notify('工程内容已保存到本机浏览器'); } catch (_) { notify('浏览器存储不可用，请导出文件保存'); } }
  function fileIcon(path) {
    const theme=window.SETI_THEME;if(!theme)return icon('file');
    const name=path.split('/').pop().toLowerCase(),ext=name.split('.').pop();
    const language=({py:'python',yaml:'yaml',yml:'yaml',sh:'shellscript',md:'markdown',json:'json',log:'log'})[ext];
    const definition=theme.iconDefinitions[theme.fileNames[name]||theme.fileExtensions[ext]||theme.languageIds[language]||theme.file];
    const code=parseInt((definition.fontCharacter||'\\E023').replace('\\',''),16);
    return `<span class="seti-icon" aria-hidden="true" style="color:${definition.fontColor}">${String.fromCodePoint(code)}</span>`;
  }
  function renderTree() {
    const root = {};
    Object.keys(workspace.files).forEach(path => { const parts=path.split('/'); let node=root; parts.forEach((part,i)=>{ if(i===parts.length-1) node[part]={file:path}; else node=node[part] ||= {children:{}} , node=node.children; }); });
    function branch(node,depth=0,prefix='') {
      return Object.entries(node).sort(([a,av],[b,bv]) => Number(!!bv.children)-Number(!!av.children)||a.localeCompare(b)).map(([name,entry])=>{
        const path=prefix+name;
        const guides=`<span class="monaco-tl-indent" aria-hidden="true">${'<span class="indent-guide"></span>'.repeat(depth)}</span>`;
        if(entry.children) return `<button class="tree-row monaco-tl-row folder" role="treeitem" aria-level="${depth+1}" data-folder="${esc(path)}" aria-expanded="${!collapsed.has(path)}" style="padding-left:${8+depth*8}px">${guides}<span class="monaco-tl-twistie codicon codicon-chevron-down ${collapsed.has(path)?'collapsed':''}" aria-hidden="true"></span><span class="monaco-tl-contents"><span class="file-name">${esc(name)}</span></span></button>${collapsed.has(path)?'':branch(entry.children,depth+1,path+'/')}`;
        return `<button class="tree-row monaco-tl-row ${active===path?'active':''}" role="treeitem" aria-level="${depth+1}" aria-selected="${active===path}" data-file="${esc(path)}" style="padding-left:${8+depth*8}px" title="${esc(path)}">${guides}<span class="tree-empty-twistie"></span><span class="monaco-tl-contents">${fileIcon(path)}<span class="file-name">${esc(name)}</span>${path==='configs/model.yaml'||dirty.has(path)?'<span class="tree-decoration">M</span>':''}</span></button>`;
      }).join('');
    }
    $('fileTree').innerHTML=branch(root); $('projectLabel').textContent=workspace.project.toUpperCase();$('commandProject').textContent=workspace.project+' [SSH: npu-dev-01]';
  }
  function label(path) { return path.startsWith('@mindspeed/')?'MindSpeed · 配置校验':path==='@task'?'MindStudio · 配置任务':path==='@s1'?'64 → 32 卡 · 配置证据':path==='@diff'?'model.yaml (缩卡候选)':path==='@settings'?'设置':path==='@story'?story.id+' · '+story.short:path.split('/').pop(); }
  function renderTabs() {
    $('editorTabs').innerHTML=tabs.map(path=>`<div role="tab" tabindex="${path===active?0:-1}" aria-selected="${path===active}" class="editor-tab" data-tab="${esc(path)}">${path.startsWith('@')?icon(path==='@task'?'browser':path==='@settings'?'settings-gear':'diff'):fileIcon(path)}<span>${esc(label(path))}</span>${dirty.has(path)?'<span class="tab-dirty">●</span>':''}<button class="tab-close" data-close="${esc(path)}" aria-label="关闭 ${esc(label(path))}" title="关闭 (${navigator.platform.includes('Mac')?'⌘':'Ctrl'}+W)">${icon('close')}</button></div>`).join('');
  }
  function openFile(path,line=0,record=true) {
    if (!path.startsWith('@') && !Object.hasOwn(workspace.files,path)) return notify('工程中没有该文件：'+path);
    if(record&&active!==path){navigation.back.push(active);navigation.forward=[];}
    active=path;focusLine=line;if(!tabs.includes(path)) tabs.push(path);
    if(!path.startsWith('@')) context=path;
    renderTabs();renderTree();renderEditor();renderContext();
  }
  function highlight(text) {
    if (/^\s*#|^\s*\/\//.test(text)) return `<span class="tok-comment">${esc(text)}</span>`;
    return esc(text).replace(/^([\s\w.-]+)(:)/,'<span class="tok-key">$1</span>$2').replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g,'<span class="tok-string">$1</span>').replace(/\b(true|false|\d+(?:\.\d+)?)\b/g,'<span class="tok-value">$1</span>');
  }
  function edited(path,value){workspace.files[path]=value;dirty.add(path);focusLine=0;renderTabs();if((stage>0||busy)&&fixturePaths.includes(path)){clearTimeout(timer);busy=false;stage=0;applied=false;exported=false;validationPlan=null;messages=[];say('<p>配置来源已变更，之前的检查结果已失效。固定故事不会继续生成自定义配置结论；可在演示设置中恢复初始工程。</p>');updateGuide();}}
  function renderEditor() {
    $('editorContent').scrollTop=0;
    window.MS_EDITOR?.dispose();$('editorContent').classList.remove('has-monaco');
    $('breadcrumbs').innerHTML=active.startsWith('@')?'':active.split('/').map((part,i,parts)=>(i?icon('chevron-right'):'')+(i===parts.length-1?fileIcon(active):'')+`<button data-breadcrumb="${esc(parts.slice(0,i+1).join('/'))}">${esc(part)}</button>`).join('');
    document.title=(active?label(active)+' - ':'')+workspace.project+' [SSH: npu-dev-01] - Visual Studio Code';
    $('languageStatus').textContent=active.startsWith('@')?'MindStudio':({yaml:'YAML',sh:'Shell Script',py:'Python',json:'JSON',md:'Markdown',log:'Log'})[active.split('.').pop()]||'Plain Text';
    const content=$('editorContent');
    if(active.startsWith('@mindspeed/')) {
      const id=active.slice('@mindspeed/'.length);
      const url=mindspeedViews.get(id)||'/demo/mindspeed/workbench.html#handoff='+encodeURIComponent(id);
      content.innerHTML=`<iframe class="mindspeed-webview" title="MindSpeed 配置工作台" src="${esc(url)}" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"></iframe>`;
      document.dispatchEvent(new CustomEvent('msi:mindspeed-frame',{detail:{id,frame:content.querySelector('iframe')}}));
      return;
    }
    if(active==='@task') return renderWebview();
    if(active==='@s1') {content.innerHTML=S1.render(storyState());return;}
    if(active==='@diff') return renderDiff();
    if(active==='@story') return renderStoryPreview();
    if(active==='@settings') return renderNativeSettings();
    const text=workspace.files[active];
    if(text===undefined){content.innerHTML='<div class="empty-editor">'+icon('code')+'<span>显示所有命令　Ctrl+Shift+P</span><span>转到文件　Ctrl+P</span><span>切换终端　Ctrl+J</span></div>';return;}
    if(window.MS_EDITOR?.ready){content.classList.add('has-monaco');content.innerHTML='<div id="monacoEditor" class="monaco-host"></div>';window.MS_EDITOR.mount($('monacoEditor'),active,text,value=>edited(active,value),focusLine);return;}
    content.innerHTML='<div class="code-view"><div id="lineNumbers" class="line-numbers"></div><div class="code-surface"><pre id="codeHighlight" class="code-highlight" aria-hidden="true"></pre><textarea id="codeInput" class="code-input" aria-label="编辑 '+esc(active)+'" wrap="off" spellcheck="false"></textarea></div><div id="minimap" class="minimap" aria-hidden="true"></div></div>';
    $('codeInput').value=text;
    function updateCode(){ const lines=$('codeInput').value.split('\n'); $('lineNumbers').textContent=lines.map((_,i)=>i+1).join('\n'); $('codeHighlight').innerHTML=lines.map((line,i)=>`<span class="code-line ${i+1===focusLine?'focus-line':''}">${highlight(line)||' '}</span>`).join(''); $('minimap').innerHTML=lines.slice(0,65).map(line=>`<i style="width:${Math.max(5,Math.min(100,line.length*2))}%"></i>`).join(''); }
    updateCode();
    const input=$('codeInput');
    input.addEventListener('input',()=>{edited(active,input.value);updateCode();});
    input.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();const start=input.selectionStart;input.setRangeText('  ',start,input.selectionEnd,'end');input.dispatchEvent(new Event('input'));}});
    function cursor(){const before=input.value.slice(0,input.selectionStart).split('\n');$('cursorStatus').textContent=`行 ${before.length}，列 ${before.at(-1).length+1}`;}
    input.addEventListener('click',cursor);input.addEventListener('keyup',cursor);
    if(focusLine) requestAnimationFrame(()=>{const line=content.querySelector('.focus-line');if(line)content.scrollTop=Math.max(0,line.offsetTop-120);});
  }
  function renderContext(){ $('contextChip').hidden=!context; if(context) $('contextChip').innerHTML=fileIcon(context)+'<span class="context-name">'+esc(context.split('/').pop())+'</span><button id="contextRemove" class="icon-btn" title="移除文件上下文" aria-label="移除文件上下文">'+icon('close')+'</button>'; }
  function renderWebview(){
    const url=workspace.webviewUrl||'task.html';
    $('editorContent').innerHTML=`<div class="webview-wrap"><div class="webview-toolbar">${icon('globe')}<span class="webview-address" title="${esc(url)}">${workspace.webviewUrl?esc(url):'msagent.local / projects / xinghe / tasks / '+(stage?'cfg-demo-027':'—')}</span><button id="reloadWebview" class="icon-btn" title="重新加载">${icon('refresh')}</button><a href="${esc(url)}" target="_blank" rel="noopener">在浏览器打开 ↗</a></div><iframe id="taskFrame" title="MindStudio 配置任务 Webview" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" src="${esc(url)}"></iframe></div>`;
    $('taskFrame').addEventListener('load',syncTask);$('reloadWebview').onclick=renderWebview;
  }
  function storyState(){return {s1ScaleDown:true,stage:story.id==='S1'?stage:0,story:story.id,applied,candidate,exported,validationPlan,project:workspace.project,taskId:story.id==='S1'&&stage>0?'cfg-demo-027':null,owner:'IDE Agent'};}
  function syncTask(){ if(!workspace.webviewUrl) $('taskFrame')?.contentWindow.postMessage({type:'ms-demo-state',...storyState()},'*'); }
  function renderDiff(){
    const original=DEMO.files['configs/model.yaml'], revised=S1.config(S1.pick({candidate}));
    const column=(text,other,kind)=>text.split('\n').map((line,i)=>`<span class="${line!==other.split('\n')[i]?kind:''}">${esc(line)||' '}</span>`).join('');
    $('editorContent').innerHTML=`<div class="diff-page s1-diff-page"><div class="diff-toolbar"><div class="s1-diff-candidates"><span>方案 ${candidate} · model.yaml</span><button data-s1-candidate="A" class="${candidate==='A'?'selected':''}" ${applied?'disabled':''}>方案 A</button><button data-s1-candidate="B" class="${candidate==='B'?'selected':''}" ${applied?'disabled':''}>方案 B</button></div><button id="rejectDiff" class="secondary-btn">返回比较</button><button id="applyDiff" class="primary-btn" ${applied?'disabled':''}>${applied?'已保留':'保留方案 '+candidate}</button></div><div class="s1-diff-locks">GBS=128 · 16K · 模型 / Top-K / 数值策略不变 · 不重置 checkpoint 与数据进度</div>${window.MS_EDITOR?.ready?'<div id="monacoDiff" class="monaco-diff-host"></div>':`<div class="diff-grid"><div><h3>32 卡新草稿</h3><pre>${column(original,revised,'removed')}</pre></div><div><h3>候选 ${candidate}</h3><pre>${column(revised,original,'added')}</pre></div></div>`}</div>`;
    if(window.MS_EDITOR?.ready)window.MS_EDITOR.mountDiff($('monacoDiff'),original,revised,'yaml');
    $('rejectDiff').onclick=()=>goStage(5);$('applyDiff').onclick=applyChange;
  }
  function renderStoryPreview(){ $('editorContent').innerHTML=`<article class="story-preview"><small>${esc(story.id)} / SCENARIO PREVIEW</small><h1>${esc(story.title)}</h1><p>${esc(story.role)}</p><p>${esc(story.description)}</p><div class="route">${esc(story.handoff)}</div><p class="scope">此故事已预留入口，尚未制作完整操作脚本。当前仅展示目标流程，不产生检查结果或通过状态。</p><button class="primary-btn" id="backToS1">返回 S1 完整演示</button></article>`; $('backToS1').onclick=()=>selectStory('S1'); }
  function welcome(){return `<div class="welcome"><div class="welcome-mark">${icon('copilot-large')}</div><h2>${'使用 Agent 构建'}</h2><p>从代码到运行，描述你要完成的任务。Agent 可以使用工作区中的文件和工具。</p><div class="chat-suggestions"><button class="suggestion" data-action="start">${icon('checklist')}<span>检查当前训练配置</span>${icon('arrow-right')}</button><button class="suggestion" data-action="explain">${icon('code')}<span>解释当前文件</span>${icon('arrow-right')}</button><button class="suggestion" data-action="files">${icon('search')}<span>查找工作区中的文件</span>${icon('arrow-right')}</button></div><p class="shortcut-note">添加文件上下文 <kbd>Ctrl</kbd> + <kbd>#</kbd></p></div>`;}
  function renderChat(){
    $('chatMessages').innerHTML=messages.length?messages.map((m,i)=>`<article class="interactive-item-container ${m.role==='user'?'interactive-request':'interactive-response'}"><div class="header"><div class="user"><span class="avatar">${icon(m.role==='user'?'account':'copilot')}</span><span class="username">${m.role==='user'?'你':'GitHub Copilot'}</span></div><div class="message-toolbar"><button class="icon-btn" data-copy="${i}" title="复制消息" aria-label="复制消息">${icon('copy')}</button></div></div><div class="value">${m.role==='user'&&m.context?`<div class="request-attachments"><button data-source="${esc(m.context)}">${fileIcon(m.context)}${esc(m.context.split('/').pop())}</button></div>`:''}${m.html}</div>${m.role!=='user'?`<div class="chat-footer-toolbar"><button class="icon-btn" data-copy="${i}" title="复制" aria-label="复制回答">${icon('copy')}</button><button class="icon-btn" data-feedback="up" title="有帮助" aria-label="回答有帮助">${icon('thumbsup')}</button><button class="icon-btn" data-feedback="down" title="没有帮助" aria-label="回答没有帮助">${icon('thumbsdown')}</button><button class="icon-btn" data-retry="${i}" title="重试" aria-label="重试回答">${icon('refresh')}</button><span>Auto</span></div>`:''}</article>`).join(''):welcome();
    $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
  }
  function say(html,role='assistant'){messages.push({role,html,context:role==='user'?context:null});renderChat();}
  function log(text,style=''){terminalLines.push(`<span class="${style}">${esc(text)}</span>`);renderPanel();}
  function renderPanel(){
    $('panelNav').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.panel===panel));
    if(panel==='problems') $('terminalOutput').innerHTML=story.id==='S1'&&stage>0&&stage<3?'<button class="problem-row" data-file="configs/model.yaml" data-line="'+S1.line('expert_model_parallel_size')+'">'+icon('warning')+' model.yaml　DP=4 不能组成 EP=8（page-rule，演示）</button>':'当前没有已报告的静态阻断；运行仍未验证。';
    else if(panel==='output') $('terminalOutput').innerHTML=terminalLines.slice(1).join('<br>');
    else if(panel==='debug') $('terminalOutput').textContent='';
    else if(panel==='ports') $('terminalOutput').innerHTML='<span class="dim">没有转发的端口。转发端口以从本地访问远程服务。</span>';
    else $('terminalOutput').innerHTML=terminalLines.join('<br>');
    $('terminalForm').hidden=panel!=='terminal';$('terminalOutput').scrollTop=$('terminalOutput').scrollHeight;
  }
  const fixturePaths=['configs/baseline-64.yaml','configs/model.yaml','configs/runtime.yaml','scripts/train_npu.sh','data/dataset_manifest.json'];
  function updateGuide(){
    const isS1=story.id==='S1', step=S1.beats[Math.min(stage,9)];
    $('stepIndex').textContent=isS1?String(stage+1).padStart(2,'0')+' / 10':story.id+' / 预览';
    $('stepTitle').textContent=isS1?step[0]:story.short+' · 故事入口';
    $('stepDescription').textContent=isS1?step[1]:'此场景主入口：'+story.handoff.split(' → ')[0];
    $('nextStep').innerHTML=esc(isS1?(stage===6?'审阅方案 '+candidate+' Diff':stage===7?'保留方案 '+candidate:step[2]):'查看场景说明')+icon('arrow-right');
    $('nextStep').disabled=busy;$('prevStep').disabled=!isS1||stage===0||busy;
    $('s1Progress').style.width=(isS1?(stage+1)/10*100:0)+'%';
    $('problemCount').textContent=isS1&&stage>0&&stage<3?'1':'0';$('statusWarnings').textContent=isS1&&stage>0&&stage<3?'1':'0';$('changesBadge').hidden=!applied;
    $('chatSend').hidden=busy;$('chatStop').hidden=!busy;$('chatSend').disabled=busy||!$('chatInput').value.trim();$('chatPanel').classList.toggle('is-working',busy);
    syncTask();document.dispatchEvent(new CustomEvent('msdemo:state-changed'));
  }
  function fixtureValid(){return fixturePaths.every(path=>workspace.files[path]===(path==='configs/model.yaml'&&applied?S1.config(S1.pick({candidate})):DEMO.files[path]));}
  function renderTranscript(){
    if(!stage){messages=[];renderChat();return;}
    messages=[{role:'user',html:'<p>'+esc(story.prompt)+'</p>',context:'configs/model.yaml'}];
    for(let i=1;i<=stage;i++){
      if(i===3)messages.push({role:'user',html:'<p>EP 改成 4，是不是就可以了？</p>'});
      if(i===6)messages.push({role:'user',html:'<p>这两个方案哪个更值得上机？</p>'});
      messages.push({role:'assistant',html:'<div class="s1-beat-message"><small>'+String(i).padStart(2,'0')+' / '+esc(S1.beats[i][0])+'</small>'+S1.dialogue[i]+(i===stage?'<button class="s1-chat-action" data-action="evidence">展开当前证据 ↗</button>':'')+'</div>'});
    }
    renderChat();
  }
  function goStage(value){
    if(story.id!=='S1'||busy)return;
    if(!fixtureValid())return notify('来源已偏离固定样例；请在演示设置恢复初始工程后重演。');
    value=Math.max(0,Math.min(9,value));
    if(value>=8&&!applied)return;
    if(applied&&value<8){workspace.files['configs/model.yaml']=DEMO.files['configs/model.yaml'];applied=false;dirty.delete('configs/model.yaml');}
    stage=value;exported=stage===9&&exported;
    frame.classList.remove('chat-hidden');
    renderTranscript();openFile(stage===0?'configs/model.yaml':stage===7?'@diff':'@s1');updateGuide();renderPanel();
  }
  function startCheck(prompt){
    if(story.id!=='S1')return showStoryInfo();if(busy)return;
    if(stage>0)return openFile('@s1');
    if(!fixtureValid()){say('<p>当前文件已偏离故事 1 的固定样例。可编辑和展示自定义文件；不会为其套用预置检查结论。请在演示设置中恢复初始工程，再开始故事。</p>');return;}
    say('<p>'+esc(prompt||story.prompt)+'</p>','user');busy=true;updateGuide();
    say('<p>读取基线、新草稿与声明资源，核对模型结构和锁定目标。</p><div class="s1-inline-note">本地故事回放 · 不是实时 MCP 调用</div>');
    timer=setTimeout(()=>{busy=false;goStage(1);log('[DEMO] cfg-demo-027 / 64 → 32 ranks / 42 mapped fields / no NPU','dim');},500);
  }
  function reviewDiff(){
    if(story.id!=='S1')return showStoryInfo();
    if(stage<6)return notify('先沿故事完成分组、容量和仿真依据检查，再审阅候选。');
    if(applied){openFile('@diff');return;}
    goStage(7);
  }
  function applyChange(){
    if(story.id!=='S1'||stage<7||busy)return false;
    if(applied)return true;
    if(!fixtureValid()){notify('来源已变更，不能应用固定演示补丁');return false;}
    workspace.files['configs/model.yaml']=S1.config(S1.pick({candidate}));dirty.add('configs/model.yaml');applied=true;stage=8;
    renderTranscript();openFile('@s1');updateGuide();renderTree();renderPanel();
    log('[DEMO] candidate '+candidate+' retained / static passed / theoretical only / runtime unverified','good');return true;
  }
  function chooseCandidate(value){
    if(story.id!=='S1'||!['A','B'].includes(value)||stage<5||busy)return;
    if(applied)return notify('已保留方案；可先点“上一步”返回 Diff 后重新选择。');
    candidate=value;exported=false;validationPlan=null;renderEditor();updateGuide();
  }
  function shortTest(){
    if(!applied)return notify('先保留候选，再按需记录真机验证计划。');
    $('budgetDialog').showModal();
  }
  function runShortTest(){
    const host=$('testHost').value.trim(), deadline=$('testDeadline').value;
    if(!host||!deadline)return notify('请填写目标主机与截止时间。');
    const budget={host,deadline,queue:$('testQueue').value,devices:Number($('testDevices').value),minutes:Number($('testMinutes').value),status:'planned-not-submitted',scope:['真实峰值与通信初始化','特性执行','checkpoint 与数据进度恢复']};
    if(budget.devices!==32||![3,5,10].includes(budget.minutes))return;
    validationPlan=budget;exported=false;if(stage===9)stage=8;
    $('budgetDialog').close();openFile('@s1');updateGuide();notify('已记录计划；未提交真实作业，重新导出可带上此计划。');
  }
  function exportPackage(){
    if(story.id!=='S1'||!applied||stage<8)return notify('请先审阅并保留候选；导出不需要真机短测。');
    if(!fixtureValid())return notify('来源已变更，不能导出旧结论。');
    const selected=S1.pick({candidate});
    const report={demo:true,notice:'本地故事回放；未调用 MCP / Tinker / NPU；理论值未校准',task:'cfg-demo-027',project:workspace.project,scenario:'S1-scale-down-64-to-32',candidate,source:S1_EVIDENCE.source,sourceVersion:S1.get(selected).sourceVersions,locked:{totalRanks:32,globalBatch:128,sequenceLength:16384,model:'S1-synthetic-MoE',topK:2,computeDtype:'bf16',parameterDtype:'fp32'},originalChanges:[{field:'total_ranks',before:64,after:32},{field:'dp',before:8,after:4},{field:'micro_batch_size',before:1,after:2},{field:'shard_mode',before:'zero1',after:'none'}],reading:{mappedFields:S1_EVIDENCE.mappedFields,paths:fixturePaths,kind:'fixed normalized demo inputs'},evidence:S1_EVIDENCE,selectedConfig:S1.get(selected).input,diff:{path:'configs/model.yaml',before:DEMO.files['configs/model.yaml'],after:workspace.files['configs/model.yaml']},validation:{static:'passed in recorded local fixture',capacity:'theoretical-uncalibrated',simulation:'not-executed; matching measurement package missing; compatibility unverified',runtime:'not-executed',devicesUsed:0},validationPlan,uncovered:['实际设备拓扑与通信初始化','特性执行及真实峰值','checkpoint 元数据、分片加载与转换支持','已消耗样本 / token / 学习率 / 采样恢复','Tinker 匹配测量包、兼容性与性能比较','长序列完整负载、长程收敛及业务性能'],runReferences:[],files:{...workspace.files}};
    download('cfg-demo-027-scale-down-'+candidate+'.json',JSON.stringify(report,null,2),'application/json');
    exported=true;stage=9;renderTranscript();openFile('@s1');updateGuide();notify('已导出方案 '+candidate+'：配置、依据与待验项；本轮 0 NPU。');
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function showStoryInfo(){openFile('@story');}
  function next(){
    if(story.id!=='S1')return showStoryInfo();
    document.dispatchEvent(new CustomEvent('msi:window-open'));if(busy)return;
    if(stage===0)return startCheck();if(stage<7)return goStage(stage+1);if(stage===7)return applyChange();if(stage===8)return exportPackage();resetState();
  }
  function resetState(){
    clearTimeout(timer);busy=false;
    if(applied&&workspace.files['configs/model.yaml']===S1.config(S1.pick({candidate}))){workspace.files['configs/model.yaml']=DEMO.files['configs/model.yaml'];dirty.delete('configs/model.yaml');}
    stage=0;applied=false;exported=false;candidate='A';validationPlan=null;messages=[];terminalLines.length=0;terminalLines.push('<span class="dim">S1 · 本轮不占卡 · 无 MCP / 训练作业</span>');
    tabs=tabs.filter(p=>!p.startsWith('@')&&Object.hasOwn(workspace.files,p));active=Object.hasOwn(workspace.files,story.file)?story.file:Object.keys(workspace.files)[0];if(!tabs.includes(active))tabs.unshift(active);context=active;renderAll();renderPanel();
  }
  function selectStory(id){story=DEMO.stories.find(s=>s.id===id)||DEMO.stories[0];resetState();}
  function renderAll(){ $('storyNav').innerHTML=DEMO.stories.map(s=>`<button class="story-pill ${s.id===story.id?'active':''}" data-story="${s.id}" title="${s.id==='S1'?'完整交互演示':'故事入口 · 待扩展'}"><span>${s.id}</span>${s.short}</button>`).join('');renderTree();renderTabs();renderEditor();renderChat();renderContext();updateGuide(); }
  function openTask(){document.dispatchEvent(new CustomEvent('msi:window-open'));if(story.id!=='S1')return showStoryInfo();openFile('@task');}
  function openSettings(){ $('projectName').value=workspace.project;$('webviewUrl').value=workspace.webviewUrl||'';$('fileConfig').value=JSON.stringify(workspace.files,null,2);$('settingsError').textContent='';$('settingsDialog').showModal(); }
  function renderNativeSettings(){ $('editorContent').innerHTML='<div class="settings-view"><h2>设置</h2><input id="settingsSearch" placeholder="搜索设置" aria-label="搜索设置"><div class="settings-group"><label for="editorFontSize">Editor: Font Size</label><p>控制以像素为单位的字体大小。</p><input id="editorFontSize" type="number" min="10" max="24" value="'+(window.MS_EDITOR?.preferences?.fontSize||14)+'"><label><input id="editorMinimap" type="checkbox" '+(window.MS_EDITOR?.preferences?.minimap?.enabled===false?'':'checked')+'> Editor › Minimap: Enabled</label><p>控制是否显示缩略图。</p></div><div class="settings-group"><label>Workbench › Color Theme</label><p>Dark Modern</p></div></div>';$('editorFontSize').onchange=()=>{const size=Math.min(24,Math.max(10,Number($('editorFontSize').value)||14));window.MS_EDITOR?.options({fontSize:size});};$('editorMinimap').onchange=()=>window.MS_EDITOR?.options({minimap:{enabled:$('editorMinimap').checked}});$('settingsSearch').oninput=()=>{const q=$('settingsSearch').value.toLowerCase();document.querySelectorAll('.settings-group').forEach(g=>g.hidden=!g.textContent.toLowerCase().includes(q));}; }
  function commandList(){const query=$('commandInput').value.toLowerCase().replace(/^>/,'').trim();const commands=[...Object.keys(workspace.files).map(p=>({name:p,kind:'文件',run:()=>openFile(p)})),{name:'查看: 切换终端',kind:'命令',run:()=>frame.classList.toggle('terminal-hidden')},{name:'查看: 切换主侧栏',kind:'命令',run:()=>frame.classList.toggle('sidebar-hidden')},{name:'聊天: 新建聊天',kind:'命令',run:()=>{messages=[];renderChat();}},{name:'首选项: 打开设置 (UI)',kind:'命令',run:()=>openFile('@settings')},{name:'文件: 保存',kind:'命令',run:persist}].filter(c=>c.name.toLowerCase().includes(query));commandList.items=commands;commandList.index=0;renderCommands();}
  function renderCommands(){$('commandResults').innerHTML=commandList.items.map((c,i)=>`<button class="command-item ${i===commandList.index?'selected':''}" data-command-index="${i}">${c.kind==='文件'?fileIcon(c.name):icon('terminal')}<span>${esc(c.name)}</span><small>${c.kind}</small></button>`).join('')||'<p style="padding:10px">没有匹配项</p>';}
  function openCommands(query=''){$('commandInput').value=typeof query==='string'?query:'';$('commandDialog').showModal();commandList();$('commandInput').focus();}
  function runCommand(index){const item=commandList.items[index];if(item){$('commandDialog').close();item.run();}}
  function showMenu(anchor,items){const menu=$('nativeMenu');menu.innerHTML=items.map((item,i)=>item===null?'<hr>':`<button role="menuitem" data-menu-index="${i}"><span>${item.label}</span><span class="shortcut">${item.key||''}</span></button>`).join('');menu.hidden=false;const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(4,Math.min(innerWidth-menu.offsetWidth-5,rect.left))+'px';menu.style.top=Math.min(innerHeight-menu.offsetHeight-5,rect.bottom+3)+'px';menu.onclick=e=>{const b=e.target.closest('[data-menu-index]');if(!b)return;menu.hidden=true;items[Number(b.dataset.menuIndex)]?.run?.();};menu.querySelector('button')?.focus();}
  function newFile(){frame.classList.remove('sidebar-hidden');$('fileTree').hidden=false;renderTree();const form=document.createElement('form');form.className='tree-new-file';form.innerHTML='<span class="codicon codicon-file"></span><input aria-label="新文件路径" placeholder="输入文件名或相对路径">';$('fileTree').prepend(form);const input=form.querySelector('input');input.focus();form.onsubmit=e=>{e.preventDefault();const path=input.value.trim();if(!validFiles({[path]:''})||Object.hasOwn(workspace.files,path))return notify('请输入有效且尚未存在的相对文件路径');workspace.files[path]='';dirty.add(path);path.split('/').slice(0,-1).reduce((prefix,n)=>{const p=prefix?prefix+'/'+n:n;collapsed.delete(p);return p;},'');openFile(path);window.MS_EDITOR?.focus();$('codeInput')?.focus();};input.onkeydown=e=>{if(e.key==='Escape'){form.remove();$('fileTree').querySelector('button')?.focus();}};}
  function historyMove(direction){const from=navigation[direction],to=navigation[direction==='back'?'forward':'back'];const path=from.pop();if(!path)return;to.push(active);openFile(path,0,false);}
  function explainFile(){if(!context)return openCommands();say('<p>解释当前文件。</p>','user');const path=context;say('<p><button class="source-link" data-source="'+esc(path)+'">'+esc(path)+'</button> '+(path.endsWith('model.yaml')?'定义了 MoE 模型结构、训练 batch、并行拓扑与重计算策略。当前重计算粒度为 <code>selective</code>。启动时还需结合 shell 参数和实际运行日志核对最终采用值。':path.endsWith('train_npu.sh')?'是 NPU 训练启动脚本：设置设备可见性，通过 torchrun 启动训练，并传入 batch、序列长度、数值精度与重计算参数。':'是当前训练工程的一部分，可作为后续任务的文件上下文。')+'</p>');}
  function stopResponse(){clearTimeout(timer);busy=false;messages=messages.filter(m=>!m.html.includes('正在调用'));say('<p>响应已停止。</p>');updateGuide();}
  function resizePanel(id,variable,startValue,direction,min,max){
    $(id).addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();const start=event.clientX,sy=event.clientY;const initial=startValue();document.body.classList.add('resizing');function move(e){const delta=direction==='vertical'?sy-e.clientY:(e.clientX-start)*(direction==='left'?-1:1);document.documentElement.style.setProperty(variable,Math.min(max(),Math.max(min,initial+delta))+'px');}function end(){document.body.classList.remove('resizing');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);}window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);});
    $(id).addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();document.documentElement.style.setProperty(variable,Math.min(max(),Math.max(min,startValue()+(['ArrowRight','ArrowUp'].includes(e.key)?20:-20)))+'px');});
  }
  $('fileTree').onclick=e=>{const file=e.target.closest('[data-file]');if(file){const path=file.dataset.file;openFile(path);Array.from($('fileTree').querySelectorAll('[data-file]')).find(b=>b.dataset.file===path)?.focus();}const folder=e.target.closest('[data-folder]');if(folder){const path=folder.dataset.folder;collapsed.has(path)?collapsed.delete(path):collapsed.add(path);renderTree();Array.from($('fileTree').querySelectorAll('[data-folder]')).find(b=>b.dataset.folder===path)?.focus();}};
  $('fileTree').onkeydown=e=>{const row=e.target.closest('.tree-row');if(!row)return;const rows=Array.from($('fileTree').querySelectorAll('.tree-row'));let index=rows.indexOf(row);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowDown'?1:-1)));rows[index]?.focus();}else if(e.key==='ArrowRight'){e.preventDefault();if(row.dataset.folder&&collapsed.has(row.dataset.folder))row.click();else rows[index+1]?.focus();}else if(e.key==='ArrowLeft'){e.preventDefault();if(row.dataset.folder&&!collapsed.has(row.dataset.folder))row.click();else{const path=row.dataset.folder||row.dataset.file;const parent=path.split('/').slice(0,-1).join('/');rows.find(r=>r.dataset.folder===parent)?.focus();}}};
  $('editorTabs').onclick=e=>{const close=e.target.closest('[data-close]');if(close){tabs=tabs.filter(p=>p!==close.dataset.close);if(active===close.dataset.close)active=tabs.at(-1)||'';renderTabs();renderTree();renderEditor();return;}const tab=e.target.closest('[data-tab]');if(tab)openFile(tab.dataset.tab);};
  $('editorTabs').onkeydown=e=>{const tab=e.target.closest('[data-tab]');if(!tab)return;if(['Enter',' '].includes(e.key)){e.preventDefault();openFile(tab.dataset.tab);}if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();const index=(tabs.indexOf(tab.dataset.tab)+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;openFile(tabs[index]);$('editorTabs').querySelector('[aria-selected=true]').focus();}};
  $('storyNav').onclick=e=>{const b=e.target.closest('[data-story]');if(b)selectStory(b.dataset.story);};
  $('chatMessages').onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action)({start:()=>startCheck(),task:openTask,evidence:()=>openFile('@s1'),test:shortTest,export:exportPackage,explain:explainFile,files:()=>openCommands()})[action]?.();const source=e.target.closest('[data-source]');if(source)openFile(source.dataset.source,Number(source.dataset.line)||0);const copy=e.target.closest('[data-copy]');if(copy){const article=copy.closest('article');const text=article.querySelector('.value').textContent;if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>{copy.innerHTML=icon('check');}).catch(()=>notify('浏览器未允许复制'));}const feedback=e.target.closest('[data-feedback]');if(feedback){feedback.innerHTML=icon(feedback.dataset.feedback==='up'?'thumbsup-filled':'thumbsdown-filled');feedback.setAttribute('aria-pressed','true');}const retry=e.target.closest('[data-retry]');if(retry){const m=messages[Number(retry.dataset.retry)];if(m&&!busy){messages.splice(Number(retry.dataset.retry),1);messages.push(m);renderChat();}}};
  $('chatForm').onsubmit=e=>{e.preventDefault();const value=$('chatInput').value.trim();if(!value||busy)return;$('chatInput').value='';updateGuide();if(story.id!=='S1'){say('<p>'+esc(value)+'</p>','user');notify(story.id+' 暂为场景入口，完整操作脚本待扩展。');}else if(stage===0)startCheck(value);else if(/下一步|继续/.test(value))next();else if(/EP|分组|容量|显存|方案|仿真/i.test(value))next();else{say('<p>'+esc(value)+'</p>','user');if(/来源|任务|记录/.test(value))openTask();else if(/修改|diff|修复/i.test(value))reviewDiff();else if(/短测|验证/.test(value))shortTest();else if(/保存|导出/.test(value))exportPackage();else if(/解释/.test(value))explainFile();else say('<p>当前为固定故事回放。可点击下方“下一步”继续讲述，或打开当前证据。</p>');}};
  $('chatInput').oninput=()=>{$('chatSend').disabled=!$('chatInput').value.trim();$('chatInput').style.height='auto';$('chatInput').style.height=Math.min(160,Math.max(62,$('chatInput').scrollHeight))+'px';};
  $('chatInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chatForm').requestSubmit();}};
  $('contextChip').onclick=e=>{if(e.target.closest('button')){context='';renderContext();}};
  $('hostMode').onchange=()=>{if($('hostMode').value==='msagent')document.dispatchEvent(new CustomEvent('msagent:open'));else document.dispatchEvent(new CustomEvent('msi:window-open'));};
  $('nextStep').onclick=next;$('prevStep').onclick=()=>goStage(stage-1);$('runShortTest').onclick=runShortTest;$('resetDemo').onclick=()=>{resetState();notify('当前故事已重置');};$('newChat').onclick=()=>{clearTimeout(timer);busy=false;messages=[];renderChat();updateGuide();};$('chatStop').onclick=stopResponse;
  function s1Action(action){({next,export:exportPackage,plan:shortTest,diff:reviewDiff,evidence:()=>openFile('@s1')})[action]?.();}
  $('editorContent').addEventListener('click',e=>{const c=e.target.closest('[data-s1-candidate]');if(c)chooseCandidate(c.dataset.s1Candidate);const source=e.target.closest('[data-s1-source]');if(source)openFile(source.dataset.s1Source,Number(source.dataset.line)||0);const action=e.target.closest('[data-s1-action]');if(action)s1Action(action.dataset.s1Action);});
  $('sidebarToggle').onclick=()=>frame.classList.toggle('sidebar-hidden');$('chatToggle').onclick=()=>frame.classList.toggle('chat-hidden');$('panelToggle').onclick=()=>frame.classList.toggle('terminal-hidden');$('terminalClose').onclick=()=>frame.classList.add('terminal-hidden');
  $('treeCollapse').onclick=()=>{if(collapsed.size)collapsed.clear();else Object.keys(workspace.files).forEach(p=>p.split('/').slice(0,-1).reduce((prefix,n)=>{const path=prefix?prefix+'/'+n:n;collapsed.add(path);return path;},''));renderTree();};
  $('projectHeading').onclick=()=>{const hidden=$('fileTree').hidden;$('fileTree').hidden=!hidden;$('projectHeading').setAttribute('aria-expanded',String(hidden));$('projectHeading').querySelector('.codicon').className='codicon codicon-chevron-'+(hidden?'down':'right');};
  document.querySelector('.activitybar').onclick=e=>{const a=e.target.closest('[data-activity]');if(!a)return;document.querySelectorAll('.activity').forEach(b=>b.classList.toggle('active',b===a));({explorer:()=>frame.classList.toggle('sidebar-hidden'),search:()=>openCommands(),diff:()=>stage>=1?reviewDiff():openFile('scripts/train_npu.sh'),run:()=>{frame.classList.remove('terminal-hidden');openFile('scripts/train_npu.sh');},settings:()=>showMenu(a,[{label:'命令面板…',key:'Ctrl+Shift+P',run:()=>openCommands('>')},null,{label:'设置',key:'Ctrl+,',run:()=>openFile('@settings')},{label:'键盘快捷方式',key:'Ctrl+K Ctrl+S',run:()=>openCommands('>查看')},null,{label:'关于',run:()=>$('aboutDialog').showModal()}]),extensions:()=>showMenu(a,[{label:'GitHub Copilot Chat',run:()=>{frame.classList.remove('chat-hidden');}},{label:'Python',run:()=>openFile('src/train.py')},{label:'Remote - SSH',run:()=>frame.classList.remove('terminal-hidden')}])})[a.dataset.activity]?.();};
  $('panelNav').onclick=e=>{const p=e.target.closest('[data-panel]');if(p){panel=p.dataset.panel;renderPanel();}};
  $('terminalOutput').onclick=e=>{const f=e.target.closest('[data-file]');if(f)openFile(f.dataset.file,Number(f.dataset.line));};
  $('problemsStatus').onclick=()=>{panel='problems';frame.classList.remove('terminal-hidden');renderPanel();};
  $('terminalForm').onsubmit=e=>{e.preventDefault();const cmd=$('terminalInput').value.trim();$('terminalInput').value='';log('linlan@npu-dev-01:~/'+workspace.project+'$ '+cmd);if(cmd==='help')log('bash: ls, pwd, cat <file>, clear, git status','dim');else if(cmd==='ls')log([...new Set(Object.keys(workspace.files).map(p=>p.split('/')[0]))].join('  '));else if(cmd==='pwd')log('/home/linlan/'+workspace.project);else if(cmd.startsWith('cat ')){const path=cmd.slice(4).trim();log(Object.hasOwn(workspace.files,path)?workspace.files[path]:'cat: '+path+': No such file or directory');}else if(cmd==='git status'||cmd==='git status --short')log(' M scripts/train_npu.sh');else if(cmd==='clear'){terminalLines.length=0;renderPanel();}else if(cmd)log('bash: '+cmd.split(' ')[0]+': command not found','warn');};
  $('settingsOpen').onclick=openSettings;$('saveSettings').onclick=()=>{try{const files=JSON.parse($('fileConfig').value);if(!validFiles(files))throw new Error('请提供非空的“相对文件路径 → 文本内容”JSON 对象。');const url=$('webviewUrl').value.trim();if(!validUrl(url))throw new Error('Webview 地址仅支持完整的 http / https URL。');const project=$('projectName').value.trim();if(!project||project.length>80)throw new Error('工程名请使用 1–80 个字符。');clearTimeout(timer);busy=false;workspace={files,project,webviewUrl:url};stage=0;applied=false;exported=false;candidate='A';validationPlan=null;messages=[];tabs=Object.keys(files).slice(0,2);active=tabs[0];context=active;collapsed.clear();dirty.clear();persist();$('settingsDialog').close();renderAll();}catch(err){$('settingsError').textContent=err.message;}};
  $('restoreWorkspace').onclick=()=>{workspace=fresh();story=DEMO.stories[0];tabs=['configs/model.yaml','scripts/train_npu.sh'];resetState();persist();$('settingsDialog').close();};
  $('commandOpen').onclick=openCommands;$('taskbarSearch').onclick=openCommands;$('commandInput').oninput=commandList;
  $('commandResults').onclick=e=>{const b=e.target.closest('[data-command-index]');if(b)runCommand(Number(b.dataset.commandIndex));};
  $('commandInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();runCommand(commandList.index);}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();commandList.index=Math.max(0,Math.min(commandList.items.length-1,commandList.index+(e.key==='ArrowDown'?1:-1)));renderCommands();}};
  document.querySelector('.menubar').onclick=e=>{const button=e.target.closest('[data-command]');if(!button)return;const menus={files:[{label:'新建文本文件',key:'Ctrl+N',run:newFile},{label:'转到文件…',key:'Ctrl+P',run:()=>openCommands()},null,{label:'保存',key:'Ctrl+S',run:persist},{label:'关闭编辑器',key:'Ctrl+W',run:()=>document.querySelector('.editor-tab[aria-selected=true] .tab-close')?.click()}],edit:[{label:'撤销',key:'Ctrl+Z',run:()=>window.MS_EDITOR?.instance?.trigger('menu','undo')},{label:'重做',key:'Ctrl+Y',run:()=>window.MS_EDITOR?.instance?.trigger('menu','redo')},null,{label:'查找',key:'Ctrl+F',run:()=>window.MS_EDITOR?.action('actions.find')}],selection:[{label:'全选',key:'Ctrl+A',run:()=>{window.MS_EDITOR?.action('editor.action.selectAll');$('codeInput')?.select();}},{label:'展开选择',key:'Shift+Alt+→',run:()=>window.MS_EDITOR?.action('editor.action.smartSelect.expand')}],view:[{label:'命令面板…',key:'Ctrl+Shift+P',run:()=>openCommands('>')},null,{label:'主侧栏',key:'Ctrl+B',run:()=>frame.classList.toggle('sidebar-hidden')},{label:'辅助侧栏',run:()=>frame.classList.toggle('chat-hidden')},{label:'终端',key:'Ctrl+J',run:()=>frame.classList.toggle('terminal-hidden')}],go:[{label:'转到文件…',key:'Ctrl+P',run:()=>openCommands()},{label:'后退',key:'Alt+←',run:()=>historyMove('back')},{label:'前进',key:'Alt+→',run:()=>historyMove('forward')}],run:[{label:'运行和调试',key:'Ctrl+Shift+D',run:()=>{frame.classList.remove('terminal-hidden');openFile('scripts/train_npu.sh');}}],terminal:[{label:'新建终端',key:'Ctrl+Shift+`',run:()=>{frame.classList.remove('terminal-hidden');panel='terminal';renderPanel();$('terminalInput').focus();}},{label:'清除终端',run:()=>{terminalLines.length=0;renderPanel();}},{label:'切换终端',key:'Ctrl+J',run:()=>frame.classList.toggle('terminal-hidden')}],help:[{label:'显示所有命令',key:'Ctrl+Shift+P',run:()=>openCommands('>')},null,{label:'关于',run:()=>$('aboutDialog').showModal()}]};showMenu(button,menus[button.dataset.command]);};
  $('openTask').onclick=openTask;$('showDesktop').onclick=()=>$('msiWindowMinimize').click();$('remoteStatus').onclick=()=>notify('SSH 主机为演示标签，当前没有建立远程连接');
  document.addEventListener('keydown',e=>{if($('msiDesktop').dataset.activeWindow==='agent')return;if(e.ctrlKey&&e.key.toLowerCase()==='p'){e.preventDefault();openCommands(e.shiftKey?'>':'');}else if(e.ctrlKey&&e.key.toLowerCase()==='b'){e.preventDefault();frame.classList.toggle('sidebar-hidden');}else if(e.ctrlKey&&e.key.toLowerCase()==='j'){e.preventDefault();frame.classList.toggle('terminal-hidden');}else if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();persist();}else if(e.key==='Escape')$('nativeMenu').hidden=true;});
  $('presenterToggle').onclick=()=>{document.body.classList.toggle('presenter-collapsed');const collapsed=document.body.classList.contains('presenter-collapsed');$('presenterToggle').title=collapsed?'展开演示控制台':'收起演示控制台';$('presenterToggle').setAttribute('aria-label',$('presenterToggle').title);$('presenterToggle').setAttribute('aria-expanded',String(!collapsed));window.dispatchEvent(new Event('resize'));};
  $('helpOpen').onclick=()=>$('helpDialog').showModal();$('navigateBack').onclick=()=>historyMove('back');$('navigateForward').onclick=()=>historyMove('forward');
  $('newFileButton').onclick=newFile;$('treeRefresh').onclick=renderTree;$('explorerMore').onclick=e=>showMenu(e.currentTarget,[{label:'新建文件',run:newFile},{label:'刷新',run:renderTree},{label:'折叠文件夹',run:()=>$('treeCollapse').click()}]);
  $('outlineToggle').onclick=e=>{e.currentTarget.querySelector('.codicon').classList.toggle('codicon-chevron-down');};$('timelineToggle').onclick=e=>{e.currentTarget.querySelector('.codicon').classList.toggle('codicon-chevron-down');};
  $('terminalNew').onclick=()=>{panel='terminal';renderPanel();$('terminalInput').focus();};$('terminalClear').onclick=()=>{terminalLines.length=0;renderPanel();};$('terminalExpand').onclick=()=>frame.classList.toggle('terminal-maximized');
  $('attachContext').onclick=e=>showMenu(e.currentTarget,Object.keys(workspace.files).map(path=>({label:path,run:()=>{context=path;renderContext();}})));
  $('agentMode').onclick=e=>showMenu(e.currentTarget,['Agent','Ask','Edit'].map(mode=>({label:mode,run:()=>{$('agentMode').innerHTML=esc(mode)+icon('chevron-down');}})));
  $('modelMode').onclick=e=>showMenu(e.currentTarget,[{label:'Auto',run:()=>{$('modelMode').innerHTML='Auto'+icon('chevron-down');}}]);
  $('chatTools').onclick=e=>showMenu(e.currentTarget,[{label:'✓  mindstudio-config',run:()=>{}},{label:'✓  工作区文件',run:()=>{}},{label:'配置工具…',run:()=>openFile('.mcp.json')}]);
  $('chatMaximize').onclick=()=>{
    const maximized=frame.classList.toggle('chat-maximized');
    const button=$('chatMaximize');
    button.title=maximized?'还原聊天大小':'最大化聊天';
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-pressed',String(maximized));
    button.querySelector('.codicon').className='codicon codicon-screen-'+(maximized?'normal':'full');
    window.dispatchEvent(new Event('resize'));
  };
  $('chatHistory').onclick=e=>showMenu(e.currentTarget,[{label:messages.length?'检查长序列训练配置':'没有聊天历史记录',run:()=>{frame.classList.remove('chat-hidden');}}]);
  $('chatMore').onclick=e=>showMenu(e.currentTarget,[{label:'新建聊天',run:()=>$('newChat').click()},{label:'将当前文件添加到聊天',run:()=>{context=active.startsWith('@')?'':active;renderContext();}},{label:'隐藏聊天',run:()=>frame.classList.add('chat-hidden')}]);
  $('chatViewMenu').onclick=e=>showMenu(e.currentTarget,[{label:'聊天',run:()=>{}},{label:'聊天历史记录',run:()=>$('chatHistory').click()}]);
  $('editorMore').onclick=e=>showMenu(e.currentTarget,[{label:'关闭',run:()=>document.querySelector('.editor-tab[aria-selected=true] .tab-close')?.click()},{label:'关闭其他',run:()=>{tabs=[active];renderTabs();}},{label:'关闭全部',run:()=>{tabs=[];active='';renderTabs();renderEditor();renderTree();}}]);
  $('splitEditor').onclick=e=>showMenu(e.currentTarget,[{label:'并排比较当前文件',run:()=>stage>=1?reviewDiff():openFile('scripts/train_npu.sh')}]);
  $('accountButton').onclick=e=>showMenu(e.currentTarget,[{label:'GitHub Copilot',run:()=>frame.classList.remove('chat-hidden')},{label:'管理账户',run:()=>openFile('@settings')}]);
  $('remoteExplorer').onclick=e=>showMenu(e.currentTarget,[{label:'SSH: npu-dev-01',run:()=>frame.classList.remove('terminal-hidden')}]);$('copilotStatus').onclick=()=>frame.classList.toggle('chat-hidden');$('notifications').onclick=e=>showMenu(e.currentTarget,[{label:'没有新通知',run:()=>{}}]);$('branchStatus').onclick=e=>showMenu(e.currentTarget,[{label:'✓ main',run:()=>{}}]);$('syncStatus').onclick=()=>{const el=$('syncStatus').querySelector('.codicon');el.classList.add('codicon-modifier-spin');setTimeout(()=>el.classList.remove('codicon-modifier-spin'),650);};
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#nativeMenu'))$('nativeMenu').hidden=true;});
  $('nativeMenu').onkeydown=e=>{const buttons=Array.from($('nativeMenu').querySelectorAll('button'));const index=buttons.indexOf(document.activeElement);if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}};
  window.addEventListener('ms:editor-ready',()=>{if(!active.startsWith('@')||active==='@diff')renderEditor();});
  window.addEventListener('message',e=>{if(e.source!==$('taskFrame')?.contentWindow||workspace.webviewUrl)return;const msg=e.data;if(!msg||typeof msg!=='object')return;if(msg.type==='ms-demo-ready')syncTask();if(msg.type==='ms-demo-action'){if(msg.action==='candidate')return chooseCandidate(msg.candidate);if(msg.action==='source'&&fixturePaths.includes(msg.path))return openFile(msg.path,Number(msg.line)||0);({diff:reviewDiff,test:shortTest,plan:shortTest,export:exportPackage,start:()=>startCheck(),next,evidence:()=>openFile('@s1')})[msg.action]?.();}});
  resizePanel('explorerResize','--explorer-width',()=>$('explorer').offsetWidth,'right',145,()=>Math.max(145,frame.clientWidth*.3));resizePanel('chatResize','--chat-width',()=>$('chatPanel').offsetWidth,'left',250,()=>Math.max(250,frame.clientWidth*.48));resizePanel('terminalResize','--terminal-height',()=>$('terminal').offsetHeight,'vertical',80,()=>Math.max(80,frame.clientHeight*.55));
  if(!Object.hasOwn(workspace.files,active)){active=Object.keys(workspace.files)[0];tabs=Object.keys(workspace.files).slice(0,2);context=active;}
  window.MS_DEMO=Object.freeze({getSnapshot:()=>({...storyState(),active,files:{...workspace.files},webviewUrl:workspace.webviewUrl||''}),appendMessage:say,logMindspeed:log,openMindspeed:(id,url)=>{if(url)mindspeedViews.set(id,url);openFile('@mindspeed/'+id);},revealSource:(path,line=0)=>{document.dispatchEvent(new CustomEvent('msi:window-open'));openFile(path,line);},reviewDiff:()=>{document.dispatchEvent(new CustomEvent('msi:window-open'));reviewDiff();},start:()=>{selectStory('S1');startCheck();},next,exportPackage,chooseCandidate,openEvidence:()=>openFile('@s1')});
  renderAll();renderPanel();
})();

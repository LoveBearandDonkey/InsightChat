/* InsightChat app/pages/chat.html conversation markup, mapped to msAgent IDs.
   Source wzh-chat-* classes match vendor/insight-chat.css. Task state stays in
   agent-client.js; no InsightChat project/model/backend logic is imported. */
(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const img=(name,cls='')=>`<img src="assets/insight-chat/${name}"${cls?` class="${cls}"`:''} alt="">`;
  const contextIcon=(name,cls='')=>`<img src="../src/pic/icon/${name}"${cls?` class="${cls}"`:''} alt="">`;
  const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>';
  const template=`
    <main class="agent-conversation wzh-chat-panel is-open" aria-label="msAgent 对话">
      <header class="wzh-chat-head">
        <div class="wzh-chat-head-brand agent-chat-heading">
          <button id="agentSidebarToggle" class="wzh-chat-head-btn" type="button" title="收起主题列表" aria-label="收起主题列表" aria-expanded="true" aria-controls="agentTopics"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M15 4v16"></path><path class="msi-sidebar-direction" d="M10.75 8.75 7.25 12 10.75 15.25"></path></svg></button>
          <div class="agent-topic-title-editor"><button id="agentTopicTitleButton" class="wzh-chat-session-btn" type="button" title="重命名会话主题"><span id="agentTopicTitle" class="wzh-chat-session-text">训练配置生效检查</span>${img('edit.svg','wzh-chat-session-pen')}</button><input id="agentTopicTitleInput" class="wzh-chat-session-input" type="text" maxlength="40" aria-label="会话主题" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" hidden></div>
          <small id="agentTaskLabel"></small>
        </div>
        <div class="wzh-chat-head-actions">
          <button id="agentConversationNew" class="wzh-chat-head-btn" type="button" title="新建对话" aria-label="新建对话">${img('newchat.svg')}</button>
          <button id="agentTopicMenu" class="wzh-chat-head-btn" type="button" title="主题与任务信息" aria-label="主题与任务信息">${img('history.svg')}</button>
        </div>
      </header>
      <div class="wzh-chat-body">
        <div id="agentMessages" class="wzh-chat-messages" role="log" aria-live="polite" aria-label="对话记录"></div>
        <div class="wzh-chat-jump-wrap">
          <button id="agentChatJump" class="wzh-chat-jump-btn" type="button" title="回到底部" aria-label="回到底部">
            <svg class="wzh-chat-jump-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"></path></svg>
            <span class="wzh-chat-jump-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </div>
        <form id="agentChatForm" class="wzh-chat-input-bar">
          <svg class="wzh-chat-input-glow" aria-hidden="true" focusable="false">
            <rect class="wzh-chat-input-glow-halo" width="100%" height="100%" rx="23.5" pathLength="100"></rect>
            <rect class="wzh-chat-input-glow-core" width="100%" height="100%" rx="23.5" pathLength="100"></rect>
          </svg>
          <div id="agentContext" class="wzh-chat-context-chips"></div>
          <div class="wzh-chat-input-wrap">
            <textarea id="agentChatInput" class="wzh-chat-input" rows="2" autocomplete="off" aria-label="向 msAgent 发送消息" placeholder="描述任务，或引用工作区中的文件…"></textarea>
            <div id="agentChatInputHighlight" class="wzh-chat-input-hl" aria-hidden="true"></div>
          </div>
          <div class="wzh-chat-composer-toolbar">
            <div class="wzh-chat-model-wrap"><span class="wzh-chat-tool" title="当前使用 Agent 模式">${img('Agent.svg')}<span>Agent</span></span></div>
            <div class="wzh-chat-model-wrap"><span class="wzh-chat-tool" title="模型自动选择（演示）">${img('model.svg')}<span>自动选择</span></span></div>
            <div class="wzh-chat-composer-actions">
              <button id="agentChatClean" class="wzh-chat-clean-btn" type="button" title="清空输入" aria-label="清空输入" hidden><span class="wzh-chat-clean-icon" aria-hidden="true"></span></button>
              <span id="agentChatCleanDivider" class="wzh-chat-clean-divider" aria-hidden="true" hidden></span>
              <button class="wzh-chat-mic-btn" type="button" title="语音输入（暂未启用）" aria-label="语音输入（暂未启用）" disabled>${img('voice.svg')}</button>
              <button id="agentStop" class="wzh-chat-send-btn is-stop" type="button" title="停止响应" aria-label="停止 msAgent 响应" hidden>${img('stop.svg')}</button>
              <button id="agentSend" class="wzh-chat-send-btn" type="submit" title="发送消息" aria-label="发送给 msAgent" disabled>${img('sent.svg')}</button>
            </div>
          </div>
        </form>
      </div>
    </main>`;
  function welcome(stories,activeStory){
    const selected=stories.find(s=>s.id===activeStory)||stories[0];
    const cards=[selected,...stories.filter(s=>s.id!==selected.id)].slice(0,3);
    return `<div class="wzh-chat-welcome"><div class="wzh-chat-welcome-hero"><canvas class="wzh-chat-welcome-dots" aria-hidden="true"></canvas>${img('msinsightbotAvatar.png','wzh-chat-welcome-logo')}<div class="wzh-chat-welcome-text">你好，我是 MindStudio Agent</div></div><div class="wzh-chat-guide-list">${cards.map((s,i)=>`<button class="wzh-chat-guide-card" type="button" data-agent-story="${esc(s.id)}" data-agent-action="suggest">${img('guidecard'+(i+1)+'.png','wzh-chat-guide-icon')}<span class="wzh-chat-guide-text"><span class="wzh-chat-guide-title">${esc(s.title)}</span><span class="wzh-chat-guide-sub"><span class="wzh-chat-guide-tag">${img('quote.svg')}${esc(s.role)}</span><span class="wzh-chat-guide-desc">${esc(s.description||s.prompt)}</span></span></span></button>`).join('')}</div></div>`;
  }
  function question(message,index,pinned){const binding=message.binding||{project:window.DEMO?.project||'当前工作区',directory:window.DEMO?.project||'当前工作区',directoryBound:true};return `<article class="wzh-chat-qcard has-context${pinned?' is-pinned':''}" data-question="${index}"><button class="wzh-chat-qcard-toggle" type="button" data-question-toggle aria-label="展开或收起问题" aria-expanded="true">${chevron}</button>${contextChip(binding.project,binding,'agentQuestion'+index,index)}<div class="wzh-chat-qcard-text">${esc(message.text)}</div></article>`;}
  function answer(message,index){return `<article class="wzh-chat-message ai"><div class="wzh-chat-body-content"><div class="wzh-chat-answer">${message.html}</div>${message.working?'':`<div class="wzh-chat-answer-actions"><button class="wzh-chat-answer-action" type="button" data-copy-message="${index}" title="复制回答" aria-label="复制回答">${img('Copy.svg')}</button><button class="wzh-chat-answer-action" type="button" data-feedback="${index}" data-vote="up" title="有帮助" aria-label="回答有帮助" aria-pressed="false">${img('Like.svg')}</button><button class="wzh-chat-answer-action" type="button" data-feedback="${index}" data-vote="down" title="没有帮助" aria-label="回答没有帮助" aria-pressed="false">${img('Dislike.svg')}</button></div>`}</div></article>`;}
  function evidence(kind,title,description){return `<button class="wzh-chat-viz-card" type="button" data-preview="${esc(kind)}"><span class="wzh-chat-viz-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM8 15v-4m4 4V8m4 7v-6"></path></svg></span><span class="wzh-chat-viz-card-copy"><span class="wzh-chat-viz-card-title">${esc(title)}</span><span class="wzh-chat-viz-card-desc">${esc(description)}</span></span><span class="wzh-chat-viz-card-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg></span></button>`;}
  function contextChip(project,state={},prefix='agent',questionIndex=null){
    const bound=state.directoryBound!==false,directory=state.directory||project,name=directory.split(/[\\/]/).filter(Boolean).pop()||directory;
    const question=questionIndex!==null;
    return `<div class="wzh-chat-anchor-chip${question?' wzh-chat-qcard-anchor':''}" id="${prefix}ContextGroup"${question?` data-context-question="${questionIndex}"`:''}><div class="wzh-chat-context-item wzh-chat-code-context agent-context-code${bound?' is-bound':''}" id="${prefix}CodeContext"><button class="wzh-chat-local-code-add" id="${prefix}CodeAdd" type="button" data-context-action="bind-directory" title="绑定当前工程的项目目录"${bound?' hidden':''}><span class="wzh-chat-local-code-add-icon" aria-hidden="true"></span>项目目录</button><div class="wzh-chat-code-chip" id="${prefix}CodeChip"${bound?'':' hidden'}>${contextIcon('localfile.svg','wzh-chat-code-icon')}<span class="wzh-chat-code-path" id="${prefix}CodePath" data-full-path="${esc(directory)}">${esc(name)}</span><button class="wzh-chat-anchor-close" type="button" data-context-action="unbind-directory" title="移除项目目录" aria-label="移除项目目录">${contextIcon('close.svg')}</button></div></div></div>`;
  }
  function context(project,historyContext,state={}){return contextChip(project,state)+`<input type="hidden" id="agentLocalCodePath" value="${state.directoryBound!==false?esc(state.directory||project):''}">`;}
  function syncInput(){const input=document.getElementById('agentChatInput'),highlight=document.getElementById('agentChatInputHighlight');highlight.innerHTML=esc(input.value).replace(/(^|\s)([#@/][^\s]+)/g,'$1<span class="wzh-chat-input-chip">$2</span>')+(input.value.endsWith('\n')?'\n':'');input.style.height='auto';input.style.height=Math.min(126,Math.max(44,input.scrollHeight))+'px';highlight.scrollTop=input.scrollTop;document.getElementById('agentChatClean').hidden=!input.value;document.getElementById('agentChatCleanDivider').hidden=!input.value;}
  window.MS_AGENT_CHAT=Object.freeze({template,welcome,question,answer,evidence,context,contextChip,syncInput});
})();

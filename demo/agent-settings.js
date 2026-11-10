/* Host controller for the copied InsightChat assistant settings component.
   Unsupported integrations remain visible and disabled. Only msAgent MCP
   controls change the existing prototype's state. */
(() => {
  'use strict';
  const source=window.MS_INSIGHT_SETTINGS;
  const mcpPane=`<section class="wzh-settings-section msagent-mcp-section" data-settings-panel="msagent-mcp" aria-label="msAgent MCP" hidden>
    <div class="wzh-skills-toolbar">
    <nav class="wzh-skills-tabs msagent-mcp-tabs" data-msagent-mcp-tabs role="tablist" aria-label="msAgent MCP 配置">
      <button id="agentMcpProviderTab" class="is-active selected" data-mcp-tab="provider" type="button" role="tab" aria-controls="agentMcpBody" aria-selected="true">外部Agent接入</button>
      <button id="agentMcpServicesTab" data-mcp-tab="services" type="button" role="tab" aria-controls="agentMcpBody" aria-selected="false" tabindex="-1">MCP 设置</button>
    </nav>
    </div>
    <div id="agentMcpBody" class="msagent-mcp-body" role="tabpanel" aria-labelledby="agentMcpProviderTab"></div>
  </section>`;
  function mount(dialog,{renderMcp}){
    dialog.innerHTML=source.template.replaceAll('trainChatSettingsClose','agentMcpClose').replaceAll('trainChatSettingsSave','agentMcpDone').replaceAll('trainChatSettingsCancel','agentSettingsCancel');
    const $=id=>dialog.querySelector('#'+id);
    const nav=dialog.querySelector('.wzh-settings-nav'),scroll=dialog.querySelector('.wzh-settings-scroll');
    nav.querySelector('[data-settings-section="general"]').insertAdjacentHTML('afterend','<button type="button" class="wzh-settings-nav-item" data-settings-section="msagent-mcp"><span class="wzh-settings-nav-icon wzh-settings-nav-icon--asset" aria-hidden="true"><img src="assets/insight-chat/mcp.svg" alt=""></span>msAgent MCP</button>');
    scroll.insertAdjacentHTML('afterbegin',mcpPane);
    $('trainChatSettingsHeading').insertAdjacentHTML('afterend','<span id="agentSettingsMcpState" class="msagent-mcp-badge" hidden>已就绪</span>');
    const labels={'msagent-mcp':'msAgent MCP',general:'通用',agent:'Agent',skills:'Skills',mcp:'MCP',knowledge:'知识库'};
    const filters={skills:'all',mcp:'all',knowledge:'all'};
    let section='general';
    // Same theme-table chart colors and --general-icon-bg variable as settings-general.js.
    const iconColors={light:['#5CA2E9','#BF68FA','#87C859','#F69E39','#2CB8C9'],dark:['#55C6F4','#CE80D3','#00AD9F','#F5A15E','#4FBEC2']};
    const owner=dialog.closest('.agent-client');
    function syncIconColors(){const palette=iconColors[owner.dataset.theme==='dark'?'dark':'light'];dialog.querySelectorAll('.wzh-general-icon').forEach((icon,index)=>icon.style.setProperty('--general-icon-bg',palette[index]));}
    syncIconColors();new MutationObserver(syncIconColors).observe(owner,{attributes:true,attributeFilter:['data-theme']});
    const unsupported=control=>{control.disabled=true;control.title='暂未启用';};
    // Preserve source entry points while suppressing unimplemented mutations.
    dialog.querySelectorAll('.wzh-settings-general button,.wzh-settings-general input,.wzh-settings-general textarea').forEach(unsupported);
    dialog.querySelectorAll('[data-settings-panel="agent"] input,[data-settings-panel="agent"] select,[data-settings-panel="agent"] textarea').forEach(unsupported);
    ['trainChatSettingsShowKey','trainChatSettingsFetchModels','trainChatSkillsDirectoryOpen','trainChatSkillsDirectoryChange','trainChatSkillsUploadConfirm','trainChatMcpAdd','trainChatKnowledgeAdd'].forEach(id=>{const control=$(id);if(control)unsupported(control);});
    unsupported(dialog.querySelector('[data-settings-agent="custom"]'));
    dialog.querySelectorAll('[data-skills-filter="stats"],[data-mcp-filter="stats"],[data-knowledge-filter="stats"]').forEach(unsupported);
    const drop=$('trainChatSkillsDropzone');drop.setAttribute('aria-disabled','true');drop.tabIndex=-1;drop.title='暂未启用';
    function renderCatalog(name){
      const prefix={skills:'Skills',mcp:'Mcp',knowledge:'Knowledge'}[name],host=$('trainChat'+prefix+'Content');
      host.innerHTML=source.catalogs[name][filters[name]];
      const query=$('trainChat'+prefix+'Search').value.trim().toLowerCase();
      host.querySelectorAll('.wzh-skills-item').forEach(row=>row.hidden=!!query&&!row.textContent.toLowerCase().includes(query));
      host.querySelectorAll('.wzh-skills-group').forEach(group=>group.hidden=![...group.querySelectorAll('.wzh-skills-item')].some(row=>!row.hidden));
      host.querySelectorAll('button[role="switch"],button[data-skills-action="delete"],button[data-skills-action="directory"],button[data-mcp-action="delete"],button[data-mcp-action="directory"],button[data-knowledge-action="delete"],button[data-knowledge-action="directory"]').forEach(unsupported);
      dialog.querySelectorAll('[data-'+name+'-filter]').forEach(button=>{const active=button.dataset[name+'Filter']===filters[name];button.classList.toggle('is-active',active);button.setAttribute('aria-selected',String(active));});
    }
    function show(next){
      if(!labels[next])next='general';section=next;dialog.dataset.settingsSection=next;
      dialog.querySelectorAll('[data-settings-section]').forEach(button=>{const active=button.dataset.settingsSection===next;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
      dialog.querySelectorAll('[data-settings-panel]').forEach(panel=>panel.hidden=panel.dataset.settingsPanel!==next);
      $('trainChatSettingsHeading').textContent=labels[next];$('agentSettingsMcpState').hidden=next!=='msagent-mcp';
      dialog.querySelector('.wzh-settings-foot').hidden=next!=='agent';$('trainChatSkillsUploadFoot').hidden=true;
      scroll.scrollTop=0;
      if(next==='msagent-mcp')renderMcp();
      if(source.catalogs[next])renderCatalog(next);
      if(next==='skills'){$('trainChatSkillsCatalog').hidden=false;$('trainChatSkillsUpload').hidden=true;}
    }
    function ready(enabled){const badge=$('agentSettingsMcpState');badge.textContent=enabled?'已就绪':'未开启';badge.classList.toggle('is-paused',!enabled);}
    function center(){const layer=dialog.parentElement;dialog.style.left=Math.max(0,(layer.clientWidth-dialog.offsetWidth)/2)+'px';dialog.style.top=Math.max(0,(layer.clientHeight-dialog.offsetHeight)/2)+'px';}
    dialog.addEventListener('click',e=>{
      const navigation=e.target.closest('.wzh-settings-nav-item[data-settings-section]');if(navigation){show(navigation.dataset.settingsSection);return;}
      const agent=e.target.closest('[data-settings-agent]');if(agent&&!agent.disabled){dialog.querySelectorAll('[data-settings-agent]').forEach(card=>{card.classList.toggle('is-selected',card===agent);card.setAttribute('aria-pressed',String(card===agent));});const name=agent.querySelector('span')?.firstChild?.textContent?.trim()||agent.textContent.trim();$('trainChatSettingsAgentName').value=name;$('trainChatSettingsAgentConfigTitle').textContent=name;return;}
      const mode=e.target.closest('[data-settings-mode]');if(mode){const script=mode.dataset.settingsMode==='script';dialog.querySelectorAll('[data-settings-mode]').forEach(tab=>{const active=tab===mode;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));});$('trainChatSettingsFormPanel').hidden=script;$('trainChatSettingsScriptPanel').hidden=!script;return;}
      for(const name of Object.keys(filters)){const tab=e.target.closest('[data-'+name+'-filter]');if(tab&&!tab.disabled){filters[name]=tab.dataset[name+'Filter'];renderCatalog(name);return;}}
      if(e.target.closest('#trainChatSkillsAdd')){$('trainChatSkillsCatalog').hidden=true;$('trainChatSkillsUpload').hidden=false;$('trainChatSkillsUploadFoot').hidden=false;return;}
      if(e.target.closest('#trainChatSkillsUploadBack,#trainChatSkillsUploadCancel')){$('trainChatSkillsCatalog').hidden=false;$('trainChatSkillsUpload').hidden=true;$('trainChatSkillsUploadFoot').hidden=true;return;}
      const action=e.target.closest('[data-skills-action],[data-mcp-action],[data-knowledge-action]');
      if(action&&!action.disabled){const operation=action.dataset.skillsAction||action.dataset.mcpAction||action.dataset.knowledgeAction,row=action.closest('.wzh-skills-item');if(!row)return;const menu=row.querySelector('.wzh-skills-menu');if(operation==='menu'){menu.hidden=!menu.hidden;action.setAttribute('aria-expanded',String(!menu.hidden));}if(operation==='details'){const detail=row.querySelector('.wzh-skills-detail');if(detail)detail.hidden=!detail.hidden;if(menu)menu.hidden=true;}}
    });
    for(const [name,prefix]of Object.entries({skills:'Skills',mcp:'Mcp',knowledge:'Knowledge'}))$('trainChat'+prefix+'Search').addEventListener('input',()=>renderCatalog(name));
    nav.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...nav.querySelectorAll('button')],index=buttons.indexOf(e.target);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length;buttons[next].click();buttons[next].focus();});
    const head=dialog.querySelector('.wzh-settings-head');
    head.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();const start={x:event.clientX,y:event.clientY,left:dialog.offsetLeft,top:dialog.offsetTop};head.classList.add('is-dragging');const move=e=>{const parent=dialog.parentElement;dialog.style.left=Math.max(0,Math.min(parent.clientWidth-dialog.offsetWidth,start.left+e.clientX-start.x))+'px';dialog.style.top=Math.max(0,Math.min(parent.clientHeight-dialog.offsetHeight,start.top+e.clientY-start.y))+'px';};const end=()=>{head.classList.remove('is-dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);});
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(dialog.open)center();}).observe(dialog.parentElement);
    show('general');
    return Object.freeze({show,ready,center,get section(){return section;}});
  }
  window.MS_AGENT_SETTINGS=Object.freeze({mount});
})();

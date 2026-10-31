// 助手设置是界面原型：设置仅在当前页面内存中暂存，不连接模型服务。
(function () {
  'use strict';

  function initSettingsDialog() {
    const dialog = document.getElementById('trainChatSettingsDialog');
    const trigger = document.getElementById('trainChatKeyBtn');
    const mainWindow = document.querySelector('.pto-ide-frame');
    if (!dialog || !trigger || !mainWindow) return;

    const overlay = document.createElement('div');
    overlay.className = 'wzh-settings-overlay';
    overlay.id = 'trainChatSettingsOverlay';
    overlay.hidden = true;
    overlay.appendChild(dialog);
    mainWindow.appendChild(overlay);
    const dragHandle = dialog.querySelector('.wzh-settings-head');
    const closeButton = document.getElementById('trainChatSettingsClose');
    const footer = dialog.querySelector('.wzh-settings-foot');
    const saveButton = document.getElementById('trainChatSettingsSave');
    const cancelButton = document.getElementById('trainChatSettingsCancel');
    const warning = document.getElementById('trainChatSettingsWarning');
    const warningSave = document.getElementById('trainChatSettingsWarningSave');
    const warningDiscard = document.getElementById('trainChatSettingsWarningDiscard');

    function moveDialog(left, top) {
      const maxLeft = Math.max(0, overlay.clientWidth - dialog.offsetWidth);
      const maxTop = Math.max(0, overlay.clientHeight - dialog.offsetHeight);
      dialog.style.left = Math.round(Math.min(Math.max(0, left), maxLeft)) + 'px';
      dialog.style.top = Math.round(Math.min(Math.max(0, top), maxTop)) + 'px';
    }

    function centerDialog() {
      moveDialog((overlay.clientWidth - dialog.offsetWidth) / 2,
        (overlay.clientHeight - dialog.offsetHeight) / 2);
    }

    let drag = null;
    dragHandle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target !== dragHandle) return;
      event.preventDefault();
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: dialog.offsetLeft,
        top: dialog.offsetTop,
      };
      dragHandle.setPointerCapture(event.pointerId);
      dragHandle.classList.add('is-dragging');
    });
    dragHandle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      moveDialog(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      dragHandle.classList.remove('is-dragging');
      if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
    };
    dragHandle.addEventListener('pointerup', endDrag);
    dragHandle.addEventListener('pointercancel', endDrag);
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        if (dialog.open) moveDialog(dialog.offsetLeft, dialog.offsetTop);
      }).observe(mainWindow);
    } else {
      window.addEventListener('resize', () => {
        if (dialog.open) moveDialog(dialog.offsetLeft, dialog.offsetTop);
      });
    }

    const agentNames = {
      insight: 'MS Insight Native',
      opencode: 'OpenCode',
      claude: 'Claude Code',
      codex: 'Codex',
      trae: 'Trae',
      custom: '自定义 Agent',
    };
    const initialAgents = {
      insight: {
        name: agentNames.insight,
        key: 'sk-demo-insight-001',
        endpoint: 'https://insight.example.com/v1',
        format: 'openai',
        model: 'insight-chat',
        script: ['# 示例启动脚本（不会执行）', 'AGENT_ENDPOINT=https://insight.example.com/v1 AGENT_MODEL=insight-chat ./start-agent.sh'].join('\n'),
      },
      opencode: {
        name: agentNames.opencode,
        key: 'sk-demo-opencode-001',
        endpoint: 'https://opencode.example.com/v1',
        format: 'openai',
        model: 'opencode-chat',
        script: ['# 示例启动脚本（不会执行）', 'AGENT_ENDPOINT=https://opencode.example.com/v1 AGENT_MODEL=opencode-chat ./start-agent.sh'].join('\n'),
      },
      codex: {
        name: agentNames.codex,
        key: 'sk-demo-codex-001',
        endpoint: 'https://codex.example.com/v1',
        format: 'openai',
        model: 'codex-chat',
        script: ['# 示例启动脚本（不会执行）', 'AGENT_ENDPOINT=https://codex.example.com/v1 AGENT_MODEL=codex-chat ./start-agent.sh'].join('\n'),
      },
    };
    const fields = {
      name: document.getElementById('trainChatSettingsAgentName'),
      key: document.getElementById('trainChatSettingsApiKey'),
      endpoint: document.getElementById('trainChatSettingsEndpoint'),
      format: document.getElementById('trainChatSettingsFormat'),
      model: document.getElementById('trainChatSettingsModel'),
      script: document.getElementById('trainChatSettingsScript'),
    };
    const heading = document.getElementById('trainChatSettingsHeading');
    const agentConfigTitle = document.getElementById('trainChatSettingsAgentConfigTitle');
    const navItems = [...dialog.querySelectorAll('[data-settings-section]')];
    const panels = [...dialog.querySelectorAll('[data-settings-panel]')];
    const cards = [...dialog.querySelectorAll('[data-settings-agent]')];
    const tabs = [...dialog.querySelectorAll('[data-settings-mode]')];
    let saved = { agentId: 'insight', agents: initialAgents };
    let draft = null;
    let warningReturnFocus = null;

    const clone = (value) => JSON.parse(JSON.stringify(value));

    function collectAgent() {
      if (!draft) return;
      draft.agents[draft.agentId] = {
        name: fields.name.value.trim() || agentNames[draft.agentId],
        key: fields.key.value,
        endpoint: fields.endpoint.value.trim(),
        format: fields.format.value,
        model: fields.model.value.trim(),
        script: fields.script.value,
      };
    }

    function comparable(state) {
      const agents = {};
      Object.keys(agentNames).forEach((id) => {
        const config = state.agents[id] || {};
        agents[id] = {
          name: config.name || agentNames[id],
          key: config.key || '',
          endpoint: config.endpoint || '',
          format: config.format || 'openai',
          model: config.model || '',
          script: config.script || '',
        };
      });
      return JSON.stringify({ agentId: state.agentId, agents });
    }

    function isDirty() {
      if (!draft) return false;
      collectAgent();
      return comparable(draft) !== comparable(saved);
    }

    function updateDirty() {
      const dirty = isDirty();
      saveButton.disabled = !dirty;
      cancelButton.disabled = !dirty;
      syncAgentBadges();
    }

    function saveDraft() {
      collectAgent();
      saved = clone(draft);
      updateDirty();
    }

    function hideWarning(restoreFocus = false) {
      warning.hidden = true;
      if (restoreFocus) {
        const target = warningReturnFocus?.isConnected && !warningReturnFocus.disabled && warningReturnFocus.getClientRects().length
          ? warningReturnFocus : closeButton;
        target.focus({ preventScroll: true });
      }
      warningReturnFocus = null;
    }

    function showWarning() {
      warningReturnFocus = document.activeElement;
      warning.hidden = false;
      warningSave.focus({ preventScroll: true });
    }

    function requestAction(action) {
      if (isDirty()) showWarning();
      else action();
    }

    function syncAgentBadges() {
      if (!draft) return;
      cards.forEach((card) => {
        const badge = card.querySelector('.wzh-settings-agent-unconfigured');
        if (!badge) return;
        const config = draft.agents[card.dataset.settingsAgent] || {};
        badge.hidden = Boolean(config.script?.trim() || (config.endpoint?.trim() && config.model?.trim()));
      });
    }

    function renderAgent() {
      const id = draft.agentId;
      const config = draft.agents[id] || {};
      cards.forEach((card) => {
        const selected = card.dataset.settingsAgent === id;
        card.classList.toggle('is-selected', selected);
        card.setAttribute('aria-pressed', String(selected));
      });
      syncAgentBadges();
      fields.name.value = config.name || agentNames[id];
      agentConfigTitle.textContent = fields.name.value;
      fields.name.readOnly = id !== 'custom';
      fields.key.value = config.key || '';
      fields.endpoint.value = config.endpoint || '';
      fields.format.value = config.format || 'openai';
      fields.model.value = config.model || '';
      fields.script.value = config.script || '';
      fields.key.type = 'password';
      const showKey = document.getElementById('trainChatSettingsShowKey');
      showKey.setAttribute('aria-pressed', 'false');
      showKey.setAttribute('aria-label', '显示 API 密钥');
    }

    function setSection(section) {
      navItems.forEach((item) => {
        const active = item.dataset.settingsSection === section;
        item.classList.toggle('is-active', active);
        if (active) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      panels.forEach((panel) => { panel.hidden = panel.dataset.settingsPanel !== section; });
      heading.textContent = { general: '通用', agent: 'Agent', skills: 'Skills', mcp: 'MCP', knowledge: '知识库' }[section];
      footer.hidden = section !== 'agent';
    }

    function setMode(mode) {
      tabs.forEach((tab) => {
        const active = tab.dataset.settingsMode === mode;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      document.getElementById('trainChatSettingsFormPanel').hidden = mode !== 'form';
      document.getElementById('trainChatSettingsScriptPanel').hidden = mode !== 'script';
    }

    trigger.addEventListener('click', () => {
      draft = clone(saved);
      renderAgent();
      setSection('agent');
      setMode('form');
      updateDirty();
      overlay.hidden = false;
      dialog.show();
      centerDialog();
      closeButton.focus({ preventScroll: true });
      trigger.setAttribute('aria-expanded', 'true');
    });
    dialog.addEventListener('close', () => {
      draft = null;
      hideWarning();
      overlay.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus({ preventScroll: true });
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) requestAction(() => dialog.close());
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (warning.hidden) requestAction(() => dialog.close());
    });
    document.addEventListener('keydown', (event) => {
      if (!dialog.open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!warning.hidden) {
          hideWarning(true);
        } else requestAction(() => dialog.close());
        return;
      }
      if (event.key !== 'Tab') return;
      const focusRoot = warning.hidden ? dialog : warning;
      const focusable = [...focusRoot.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary')]
        .filter((element) => element.getClientRects().length);
      if (!focusable.length) return;
      const current = focusable.indexOf(document.activeElement);
      if (current === -1 || (!event.shiftKey && current === focusable.length - 1)) {
        event.preventDefault();
        focusable[0].focus();
      } else if (event.shiftKey && current === 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      }
    }, true);
    closeButton.addEventListener('click', () => requestAction(() => dialog.close()));
    cancelButton.addEventListener('click', () => { if (isDirty()) showWarning(); });
    saveButton.addEventListener('click', saveDraft);
    warningSave.addEventListener('click', () => {
      saveDraft();
      hideWarning(true);
    });
    warningDiscard.addEventListener('click', () => {
      draft = clone(saved);
      renderAgent();
      updateDirty();
      hideWarning(true);
    });
    navItems.forEach((item) => item.addEventListener('click', () => {
      if (item.classList.contains('is-active')) return;
      requestAction(() => setSection(item.dataset.settingsSection));
    }));
    cards.forEach((card) => card.addEventListener('click', () => {
      if (draft.agentId === card.dataset.settingsAgent) return;
      collectAgent();
      draft.agentId = card.dataset.settingsAgent;
      renderAgent();
      updateDirty();
    }));
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;
      setMode(tab.dataset.settingsMode);
    }));
    dialog.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      setMode(next.dataset.settingsMode);
      next.focus();
    });
    document.getElementById('trainChatSettingsShowKey').addEventListener('click', (event) => {
      const button = event.currentTarget;
      const visible = fields.key.type === 'password';
      fields.key.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', visible ? '隐藏 API 密钥' : '显示 API 密钥');
    });
    Object.values(fields).forEach((field) => {
      field.addEventListener('input', updateDirty);
      field.addEventListener('change', updateDirty);
    });
    fields.name.addEventListener('input', () => {
      agentConfigTitle.textContent = fields.name.value.trim() || agentNames[draft.agentId];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsDialog, { once: true });
  } else {
    initSettingsDialog();
  }
})();

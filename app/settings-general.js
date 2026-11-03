// 通用设置保存在本机浏览器；快捷 Prompt 最多三组，每次加载页面恢复预设。
(function () {
  'use strict';

  function initGeneralSettings() {
    const section = document.querySelector('[data-settings-panel="general"]');
    const list = document.getElementById('trainChatGeneralPrompts');
    if (!section || !list) return;

    // 固定使用主题表「图表色」的 18、11、15、17、10 号色。
    const iconColors = {
      light: ['#5CA2E9', '#BF68FA', '#87C859', '#F69E39', '#2CB8C9'],
      dark: ['#55C6F4', '#CE80D3', '#00AD9F', '#F5A15E', '#4FBEC2'],
    };
    const icons = [...section.querySelectorAll('.wzh-general-icon')];
    function syncIconColors() {
      const palette = document.documentElement.dataset.theme === 'dark' ? iconColors.dark : iconColors.light;
      icons.forEach((icon, index) => icon.style.setProperty('--general-icon-bg', palette[index]));
    }
    syncIconColors();
    new MutationObserver(syncIconColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const defaults = {
      launch: 'default',
      window: 'split',
      locate: true,
      update: true,
      promptMode: 'system',
      prompts: [
        {
          title: '推理性能关键指标统计',
          body: '用mfu-calc这个skill计算整体 MFU；用infer-latency-throughput-calc这个skill计算吞吐，TTFT和 TTOTP，结果同步合入 C:\\Users\\1377\\myinfer\\inferenceReport.md',
        },
        {
          title: 'GPU、代际Golden性能对比',
          body: 'D:\\golden-spe.xlsx 是我们GPU、A3硬件环境的golden表，请对照后输出差距表',
        },
      ],
    };
    const storageKey = 'msi-general-settings-v1';
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) { /* 浏览器可能禁用本地存储。 */ }
    const state = {
      launch: ['default', 'click'].includes(stored?.launch) ? stored.launch : defaults.launch,
      window: ['split', 'floating'].includes(stored?.window) ? stored.window : defaults.window,
      locate: typeof stored?.locate === 'boolean' ? stored.locate : defaults.locate,
      update: typeof stored?.update === 'boolean' ? stored.update : defaults.update,
      // Prompt 来源和编辑仅在当前页面生效，刷新后欢迎页使用系统卡片。
      promptMode: defaults.promptMode,
      prompts: defaults.prompts.map((entry) => ({ ...entry })),
    };
    const cloneState = (value) => ({ ...value, prompts: value.prompts.map((entry) => ({ ...entry })) });
    let active = cloneState(state);
    window.MSI_GENERAL_SETTINGS = {
      getState: () => cloneState(active),
      applyOnAssistantStart: () => {
        active = cloneState(state);
        syncWelcomeGuides();
        document.dispatchEvent(new CustomEvent('msi:general-settings-apply', { detail: cloneState(active) }));
      },
    };

    const messages = document.getElementById('trainChatMessages');
    const guideSelector = '.wzh-chat-welcome .wzh-chat-guide-list';
    const defaultGuideCards = [...(messages?.querySelector(guideSelector)?.children || [])]
      .map((card) => card.cloneNode(true));
    function syncWelcomeGuides() {
      const guideList = messages?.querySelector(guideSelector);
      if (!guideList) return;
      if (!defaultGuideCards.length) return;
      if (active.promptMode === 'system') {
        guideList.replaceChildren(...defaultGuideCards.map((card) => card.cloneNode(true)));
        return;
      }
      const cards = active.prompts.filter((prompt) => prompt.title.trim() && prompt.body.trim()).slice(0, 3)
        .map((prompt, index) => {
          const card = defaultGuideCards[index % defaultGuideCards.length].cloneNode(true);
          card.dataset.scenario = 'custom';
          card.dataset.prompt = prompt.body.trim();
          card.querySelector('.wzh-chat-guide-title').textContent = prompt.title.trim();
          card.querySelector('.wzh-chat-guide-desc').textContent = prompt.body.trim();
          card.querySelector('.wzh-chat-guide-tag')?.remove();
          return card;
        });
      guideList.replaceChildren(...cards);
    }
    if (messages && defaultGuideCards.length) {
      new MutationObserver(syncWelcomeGuides).observe(messages, { childList: true });
      syncWelcomeGuides();
    }

    function publish(key) {
      const preferences = { ...state };
      delete preferences.promptMode;
      delete preferences.prompts;
      try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) { /* 临时会话仍可演示。 */ }
      if (key === 'locate') {
        active.locate = state.locate;
        document.dispatchEvent(new CustomEvent('msi:general-settings-live', { detail: { key, value: active.locate } }));
      } else if (key === 'promptMode' || key === 'prompts') {
        active[key] = key === 'prompts' ? state.prompts.map((entry) => ({ ...entry })) : state[key];
        syncWelcomeGuides();
      }
    }

    function syncChoices() {
      section.querySelectorAll('[data-general-choice]').forEach((group) => {
        const value = state[group.dataset.generalChoice];
        group.querySelectorAll('[data-value]').forEach((button) => {
          const active = button.dataset.value === value;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });
      });
      section.querySelectorAll('[data-general-switch]').forEach((button) => {
        button.setAttribute('aria-checked', String(state[button.dataset.generalSwitch]));
      });
      list.hidden = state.promptMode !== 'custom';
    }

    function makeField(index, key, placeholder) {
      const wrapper = document.createElement('div');
      const display = document.createElement('button');
      display.type = 'button';
      display.className = 'wzh-general-prompt-text';
      const edit = document.createElement(key === 'title' ? 'input' : 'textarea');
      edit.className = 'wzh-general-prompt-edit' + (key === 'body' ? ' wzh-general-prompt-edit--body' : '');
      edit.hidden = true;
      edit.setAttribute('aria-label', key === 'title' ? 'Prompt 标题' : 'Prompt 内容');
      edit.placeholder = placeholder;
      if (key === 'title') edit.type = 'text';
      else edit.rows = 1;
      const value = state.prompts[index]?.[key] || '';
      display.textContent = value || placeholder;
      display.classList.toggle('is-placeholder', !value);
      edit.value = value;

      let displayHeight = 0;
      function fitBodyEditor() {
        if (key !== 'body') return;
        edit.style.height = 'auto';
        edit.style.height = Math.max(displayHeight, edit.scrollHeight) + 'px';
      }

      display.addEventListener('click', () => {
        displayHeight = display.getBoundingClientRect().height;
        display.hidden = true;
        edit.hidden = false;
        fitBodyEditor();
        edit.focus();
        edit.setSelectionRange(edit.value.length, edit.value.length);
      });
      edit.addEventListener('input', () => {
        if (!state.prompts[index]) state.prompts[index] = { title: '', body: '' };
        state.prompts[index][key] = edit.value;
        publish('prompts');
        fitBodyEditor();
        list.children[index].classList.toggle('is-empty', !state.prompts[index].title && !state.prompts[index].body);
        if (state.prompts.length < 3 && list.children.length === state.prompts.length) {
          list.appendChild(makeCard(state.prompts.length));
        }
      });
      edit.addEventListener('blur', () => {
        const value = edit.value.trim();
        if (state.prompts[index]) state.prompts[index][key] = value;
        edit.value = value;
        edit.style.height = '';
        display.textContent = value || placeholder;
        display.classList.toggle('is-placeholder', !value);
        edit.hidden = true;
        display.hidden = false;
        if (state.prompts[index] && !state.prompts[index].title && !state.prompts[index].body) {
          state.prompts.splice(index, 1);
          renderPrompts();
        }
        publish('prompts');
      });
      edit.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          edit.blur();
        } else if (key === 'title' && event.key === 'Enter') {
          event.preventDefault();
          edit.blur();
        }
      });
      wrapper.append(display, edit);
      return wrapper;
    }

    function makeCard(index) {
      const entry = state.prompts[index];
      const card = document.createElement('div');
      card.className = 'wzh-general-prompt-card' + (!entry ? ' is-empty' : '');
      card.dataset.promptIndex = String(index);

      const drag = document.createElement('button');
      drag.type = 'button';
      drag.className = 'wzh-general-drag';
      drag.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="3" r="1.25"/><circle cx="11" cy="3" r="1.25"/><circle cx="5" cy="8" r="1.25"/><circle cx="11" cy="8" r="1.25"/><circle cx="5" cy="13" r="1.25"/><circle cx="11" cy="13" r="1.25"/></svg>';
      drag.setAttribute('aria-label', '拖动调整 Prompt 顺序');
      drag.draggable = Boolean(entry);
      drag.tabIndex = entry ? 0 : -1;
      const fields = document.createElement('div');
      fields.className = 'wzh-general-prompt-fields';
      const titleRow = document.createElement('div');
      titleRow.className = 'wzh-general-prompt-title-row';
      titleRow.appendChild(makeField(index, 'title', '添加标题'));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'wzh-general-delete';
      remove.setAttribute('aria-label', '删除 Prompt');
      remove.addEventListener('click', () => {
        state.prompts.splice(index, 1);
        renderPrompts();
        publish('prompts');
      });
      titleRow.appendChild(remove);
      fields.append(titleRow, makeField(index, 'body', '添加 Prompt，如需要 Agent 做的事、对指定工具/文件的调用和修改…'));
      card.append(drag, fields);
      return card;
    }

    function renderPrompts() {
      list.replaceChildren();
      const count = Math.min(3, state.prompts.length + 1);
      for (let index = 0; index < count; index += 1) list.appendChild(makeCard(index));
    }

    section.querySelectorAll('[data-general-choice]').forEach((group) => {
      group.addEventListener('click', (event) => {
        const button = event.target.closest('[data-value]');
        if (!button || !group.contains(button)) return;
        const key = group.dataset.generalChoice;
        state[key] = button.dataset.value;
        syncChoices();
        publish(key);
      });
    });
    section.querySelectorAll('[data-general-switch]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.generalSwitch;
        state[key] = !state[key];
        syncChoices();
        publish(key);
      });
    });

    let draggedIndex = null;
    list.addEventListener('dragstart', (event) => {
      const handle = event.target.closest('.wzh-general-drag');
      if (!handle || !handle.draggable) { event.preventDefault(); return; }
      draggedIndex = Number(handle.closest('[data-prompt-index]').dataset.promptIndex);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(draggedIndex));
      handle.closest('.wzh-general-prompt-card').classList.add('is-dragging');
    });
    list.addEventListener('dragover', (event) => {
      const target = event.target.closest('[data-prompt-index]');
      if (draggedIndex === null || !target || Number(target.dataset.promptIndex) >= state.prompts.length) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.is-drop-target').forEach((card) => card.classList.remove('is-drop-target'));
      target.classList.add('is-drop-target');
    });
    list.addEventListener('drop', (event) => {
      const target = event.target.closest('[data-prompt-index]');
      if (draggedIndex === null || !target) return;
      const destination = Number(target.dataset.promptIndex);
      if (destination >= state.prompts.length) return;
      event.preventDefault();
      const [moved] = state.prompts.splice(draggedIndex, 1);
      state.prompts.splice(destination, 0, moved);
      draggedIndex = null;
      renderPrompts();
      publish('prompts');
    });
    list.addEventListener('dragend', () => {
      draggedIndex = null;
      list.querySelectorAll('.is-dragging, .is-drop-target').forEach((card) => {
        card.classList.remove('is-dragging', 'is-drop-target');
      });
    });

    renderPrompts();
    syncChoices();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGeneralSettings, { once: true });
  } else {
    initGeneralSettings();
  }
})();

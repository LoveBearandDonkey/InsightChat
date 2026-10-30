/* Move the floating assistant out of the main frame and give it desktop geometry. */
(function () {
  function init() {
    const desktop = document.getElementById('msiDesktop');
    const panel = document.getElementById('trainChatPanel');
    const header = panel?.querySelector('.wzh-chat-head');
    const vizHeader = panel?.querySelector('.wzh-chat-viz-head');
    const floatButton = document.getElementById('trainChatFloatBtn');
    const mainFrame = desktop?.querySelector('.pto-ide-frame');
    const mainChatToggle = document.getElementById('trainChatToggle');
    if (!desktop || !panel || !header || !floatButton || !mainFrame) return;

    const STORAGE_KEY = 'msi-chat-float-window-v1';
    const TASKBAR_HEIGHT = 42;
    const FLOAT_MIN_WIDTH = 360;
    const FLOAT_MIN_HEIGHT = 400;
    const VIZ_MIN_WIDTH = 760;
    const VIZ_MIN_HEIGHT = 460;
    const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
    const bounds = () => ({ width: window.innerWidth, height: Math.max(0, window.innerHeight - TASKBAR_HEIGHT) });
    const anchor = document.createComment('assistant inline position');
    panel.before(anchor);

    function defaultGeometry() {
      const { width, height } = bounds();
      const w = Math.min(480, Math.max(0, width - 16));
      const h = Math.min(700, Math.max(0, height - 96));
      return { x: Math.max(0, width - w - 24), y: Math.min(48, Math.max(0, height - h)), w, h };
    }

    function readSaved() {
      try {
        const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
        if (value && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(value[key]))) return value;
      } catch (_) { /* Optional state for direct-open pages. */ }
      return { ...defaultGeometry(), floating: false };
    }

    const state = readSaved();
    function save() {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Optional state. */ }
    }

    function fit(rect, minWidth, minHeight) {
      const { width, height } = bounds();
      const maxWidth = Math.max(0, width - 16);
      const maxHeight = Math.max(0, height - 16);
      const w = clamp(Math.round(rect.w), Math.min(minWidth, maxWidth), maxWidth);
      const h = clamp(Math.round(rect.h), Math.min(minHeight, maxHeight), maxHeight);
      return {
        x: clamp(Math.round(rect.x), 0, width - w),
        y: clamp(Math.round(rect.y), 0, height - h),
        w, h,
      };
    }

    function renderFloat() {
      Object.assign(state, fit(state, FLOAT_MIN_WIDTH, FLOAT_MIN_HEIGHT));
      panel.style.setProperty('--msi-float-x', state.x + 'px');
      panel.style.setProperty('--msi-float-y', state.y + 'px');
      panel.style.setProperty('--msi-float-w', state.w + 'px');
      panel.style.setProperty('--msi-float-h', state.h + 'px');
    }

    function renderVisualization(rect) {
      const fitted = fit(rect, VIZ_MIN_WIDTH, VIZ_MIN_HEIGHT);
      panel.style.setProperty('--wzh-viz-left', fitted.x + 'px');
      panel.style.setProperty('--wzh-viz-top', fitted.y + 'px');
      panel.style.setProperty('--wzh-viz-right', Math.round(window.innerWidth - fitted.x - fitted.w) + 'px');
      panel.style.setProperty('--wzh-viz-bottom', Math.round(window.innerHeight - fitted.y - fitted.h) + 'px');
    }

    function currentRect() {
      const rect = panel.getBoundingClientRect();
      return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    }

    // Capture the docked panel before the assistant's click handler changes its layout.
    floatButton.addEventListener('click', () => {
      if (!panel.classList.contains('is-open') || panel.classList.contains('is-floating') ||
          panel.classList.contains('is-visualizing')) return;
      const rect = currentRect();
      const { width } = bounds();
      Object.assign(state, {
        x: Math.min(rect.x + 40, Math.max(0, width - rect.w - 8)),
        y: rect.y,
        w: rect.w,
        h: rect.h,
      });
    }, true);

    function syncMainToggleLabel() {
      if (!mainChatToggle) return;
      const label = !panel.classList.contains('is-open') ? '打开智能对话' :
        panel.classList.contains('is-floating') && desktop.dataset.activeWindow === 'main'
          ? '显示智能对话' : '关闭智能对话';
      mainChatToggle.title = label;
      mainChatToggle.setAttribute('aria-label', label);
    }

    function activateWindow(which) {
      if (!panel.classList.contains('is-open')) {
        desktop.dataset.activeWindow = 'main';
      } else if (!panel.classList.contains('is-floating')) {
        delete desktop.dataset.activeWindow;
      } else {
        desktop.dataset.activeWindow = which;
      }
      syncMainToggleLabel();
    }

    function syncFloating() {
      const floating = panel.classList.contains('is-floating');
      if (!panel.classList.contains('is-open')) activateWindow('main');
      if (floating && panel.parentNode !== desktop) {
        if (panel.classList.contains('is-visualizing')) {
          panel.style.setProperty('--wzh-viz-top', '48px');
          panel.style.setProperty('--wzh-viz-bottom', '90px');
          panel.style.setProperty('--wzh-viz-left', '100px');
          panel.style.setProperty('--wzh-viz-right', '100px');
        }
        desktop.append(panel);
        activateWindow('chat');
      }
      if (!floating && panel.parentNode === desktop) {
        if (panel.classList.contains('is-visualizing')) {
          panel.style.setProperty('--wzh-viz-top', '0px');
          panel.style.setProperty('--wzh-viz-bottom', '8px');
          panel.style.setProperty('--wzh-viz-left', '8px');
          panel.style.setProperty('--wzh-viz-right', '8px');
        }
        anchor.after(panel);
        activateWindow('main');
      }
      state.floating = floating;
      if (floating) renderFloat();
      syncMainToggleLabel();
      save();
    }

    const edges = {
      n: '调整智能对话窗口上边缘', e: '调整智能对话窗口右边缘',
      s: '调整智能对话窗口下边缘', w: '调整智能对话窗口左边缘',
      ne: '调整智能对话窗口右上角', se: '调整智能对话窗口右下角',
      sw: '调整智能对话窗口左下角', nw: '调整智能对话窗口左上角',
    };
    for (const [edge, label] of Object.entries(edges)) {
      const handle = document.createElement('div');
      handle.className = 'msi-chat-window-resize msi-chat-window-resize--' + edge;
      handle.dataset.chatResizeEdge = edge;
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-label', label);
      handle.tabIndex = 0;
      panel.append(handle);
    }

    function startPointer(event, move, done) {
      if (event.button !== 0) return;
      event.preventDefault();
      const originX = event.clientX;
      const originY = event.clientY;
      document.body.classList.add('is-chat-window-dragging');
      const onMove = (next) => move(next.clientX - originX, next.clientY - originY);
      const onEnd = () => {
        document.body.classList.remove('is-chat-window-dragging');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        done?.();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    }

    function resized(start, edge, dx, dy, minWidth, minHeight) {
      const { width, height } = bounds();
      const minW = Math.min(minWidth, Math.max(0, width - 16));
      const minH = Math.min(minHeight, Math.max(0, height - 16));
      const next = { ...start };
      if (edge.includes('w')) {
        next.x = clamp(start.x + dx, 0, start.x + start.w - minW);
        next.w = start.x + start.w - next.x;
      }
      if (edge.includes('e')) next.w = clamp(start.w + dx, minW, width - start.x);
      if (edge.includes('n')) {
        next.y = clamp(start.y + dy, 0, start.y + start.h - minH);
        next.h = start.y + start.h - next.y;
      }
      if (edge.includes('s')) next.h = clamp(start.h + dy, minH, height - start.y);
      return next;
    }

    function moveWindow(start, dx, dy) {
      const fitted = fit({ ...start, x: start.x + dx, y: start.y + dy },
        panel.classList.contains('is-visualizing') ? VIZ_MIN_WIDTH : FLOAT_MIN_WIDTH,
        panel.classList.contains('is-visualizing') ? VIZ_MIN_HEIGHT : FLOAT_MIN_HEIGHT);
      if (panel.classList.contains('is-visualizing')) renderVisualization(fitted);
      else { Object.assign(state, fitted); renderFloat(); }
    }

    const onHeaderPointerDown = (event) => {
      if (!panel.classList.contains('is-floating') || !panel.classList.contains('is-open') ||
          panel.classList.contains('is-viz-expanding')) return;
      if (event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
      const start = currentRect();
      startPointer(event, (dx, dy) => moveWindow(start, dx, dy), save);
    };
    header.addEventListener('pointerdown', onHeaderPointerDown);
    vizHeader?.addEventListener('pointerdown', onHeaderPointerDown);

    panel.querySelectorAll('[data-chat-resize-edge]').forEach((handle) => {
      const edge = handle.dataset.chatResizeEdge;
      const apply = (start, dx, dy) => {
        const visualizing = panel.classList.contains('is-visualizing');
        const next = resized(start, edge, dx, dy,
          visualizing ? VIZ_MIN_WIDTH : FLOAT_MIN_WIDTH,
          visualizing ? VIZ_MIN_HEIGHT : FLOAT_MIN_HEIGHT);
        if (visualizing) renderVisualization(next);
        else { Object.assign(state, next); renderFloat(); }
      };
      handle.addEventListener('pointerdown', (event) => {
        if (!panel.classList.contains('is-floating') || panel.classList.contains('is-viz-expanding')) return;
        event.stopPropagation();
        const start = currentRect();
        startPointer(event, (dx, dy) => apply(start, dx, dy), save);
      });
      handle.addEventListener('keydown', (event) => {
        if (!panel.classList.contains('is-floating') || panel.classList.contains('is-viz-expanding')) return;
        const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
        if (!delta) return;
        event.preventDefault();
        apply(currentRect(), ...delta);
        save();
      });
    });

    new MutationObserver(syncFloating).observe(panel, { attributes: true, attributeFilter: ['class'] });
    mainFrame.addEventListener('pointerdown', (event) => {
      if (event.target.closest('#trainChatToggle') || mainFrame.classList.contains('is-desktop-maximized')) return;
      activateWindow('main');
    });
    mainFrame.addEventListener('focusin', (event) => {
      if (!event.target.closest('#trainChatToggle') && !mainFrame.classList.contains('is-desktop-maximized')) {
        activateWindow('main');
      }
    });
    panel.addEventListener('pointerdown', () => activateWindow('chat'));
    panel.addEventListener('focusin', () => activateWindow('chat'));
    document.addEventListener('msi:focus-chat-window', () => activateWindow('chat'));
    if (state.floating) floatButton.click();
    syncFloating();
    window.addEventListener('resize', () => {
      if (!panel.classList.contains('is-floating')) return;
      renderFloat();
      if (panel.classList.contains('is-visualizing') && !panel.classList.contains('is-viz-expanding')) {
        renderVisualization(currentRect());
      }
      save();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

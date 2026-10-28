/* Desktop window geometry is shared by chat, timeline and compare pages. */
(function () {
  const desktop = document.getElementById('msiDesktop');
  const frame = desktop?.querySelector('.pto-ide-frame');
  const titlebar = frame?.querySelector('.pto-ide-frame__topbar');
  if (!desktop || !frame || !titlebar) return;

  const TASKBAR_HEIGHT = 42;
  const HORIZONTAL_MARGIN = 80;
  const VERTICAL_MARGIN = 40;
  const MIN_WIDTH = 900;
  const MIN_HEIGHT = 520;
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
  const bounds = () => ({ width: window.innerWidth, height: Math.max(0, window.innerHeight - TASKBAR_HEIGHT) });

  function defaultGeometry() {
    const { width, height } = bounds();
    return {
      x: HORIZONTAL_MARGIN,
      y: VERTICAL_MARGIN,
      w: Math.max(0, width - HORIZONTAL_MARGIN * 2),
      h: Math.max(0, height - VERTICAL_MARGIN * 2),
    };
  }

  // Window geometry lives only for this page load. Refresh always starts at the default inset.
  const state = { ...defaultGeometry(), maximized: false, customized: false };
  let hidden = false;
  let shown = defaultGeometry();

  function fit(geometry) {
    const { width, height } = bounds();
    // Keep the top-left anchor when DevTools reduces the viewport; shrink before shifting.
    const minWidth = Math.min(MIN_WIDTH, Math.max(0, width - HORIZONTAL_MARGIN * 2));
    const minHeight = Math.min(MIN_HEIGHT, Math.max(0, height - VERTICAL_MARGIN * 2));
    const x = clamp(Math.round(geometry.x), 0, width - minWidth);
    const y = clamp(Math.round(geometry.y), 0, height - minHeight);
    return {
      x, y,
      w: clamp(Math.round(geometry.w), minWidth, width - x),
      h: clamp(Math.round(geometry.h), minHeight, height - y),
    };
  }

  const maxButton = document.getElementById('msiWindowMaximize');
  const taskbarApp = document.getElementById('msiTaskbarApp');
  const taskbarStart = document.getElementById('msiTaskbarStart');
  const WALLPAPER_KEY = 'msi-desktop-wallpaper';

  function setLightWallpaper(light) {
    desktop.classList.toggle('is-light-wallpaper', light);
    if (taskbarStart) {
      taskbarStart.setAttribute('aria-pressed', String(light));
      const label = light ? '切换为深色桌面壁纸' : '切换为浅色桌面壁纸';
      taskbarStart.title = label;
      taskbarStart.setAttribute('aria-label', label);
    }
    try { localStorage.setItem(WALLPAPER_KEY, light ? 'light' : 'dark'); } catch (_) { /* Optional preference. */ }
  }

  try { setLightWallpaper(localStorage.getItem(WALLPAPER_KEY) === 'light'); }
  catch (_) { setLightWallpaper(false); }
  taskbarStart?.addEventListener('click', () => setLightWallpaper(!desktop.classList.contains('is-light-wallpaper')));

  function render() {
    shown = fit(state.customized ? state : defaultGeometry());
    frame.style.left = shown.x + 'px';
    frame.style.top = shown.y + 'px';
    frame.style.width = shown.w + 'px';
    frame.style.height = shown.h + 'px';
    frame.classList.toggle('is-desktop-maximized', state.maximized);
    frame.classList.toggle('is-desktop-hidden', hidden);
    taskbarApp?.classList.toggle('is-active', !hidden);
    maxButton?.setAttribute('aria-pressed', String(state.maximized));
    if (maxButton) {
      maxButton.disabled = false;
      maxButton.title = state.maximized ? '还原窗口' : '最大化';
      maxButton.setAttribute('aria-label', maxButton.title);
    }
  }

  function setMaximized(value) {
    state.maximized = value;
    hidden = false;
    render();
  }

  function openWindow() { hidden = false; render(); }
  function hideWindow() { hidden = true; render(); }

  document.getElementById('msiWindowMinimize')?.addEventListener('click', hideWindow);
  document.getElementById('msiWindowClose')?.addEventListener('click', hideWindow);
  maxButton?.addEventListener('click', () => setMaximized(!state.maximized));
  taskbarApp?.addEventListener('click', () => hidden ? openWindow() : hideWindow());
  document.getElementById('msiDesktopShortcut')?.addEventListener('click', () => { if (hidden) openWindow(); });
  titlebar.addEventListener('dblclick', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    setMaximized(!state.maximized);
  });

  function startPointer(event, move, end) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let dx = 0;
    let dy = 0;
    let pendingFrame = 0;
    document.body.classList.add('is-desktop-dragging');
    const flush = () => { pendingFrame = 0; move(dx, dy); };
    const onMove = (next) => {
      dx = next.clientX - startX;
      dy = next.clientY - startY;
      if (!pendingFrame) pendingFrame = requestAnimationFrame(flush);
    };
    const onEnd = () => {
      if (pendingFrame) cancelAnimationFrame(pendingFrame);
      move(dx, dy);
      end?.();
      document.body.classList.remove('is-desktop-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  titlebar.addEventListener('pointerdown', (event) => {
    if (state.maximized || frame.classList.contains('is-desktop-maximized')) return;
    if (event.target.closest('button, a, input, select, textarea, [data-no-window-drag]')) return;
    const start = { ...shown };
    let moved = false;
    frame.style.willChange = 'transform';
    startPointer(event, (dx, dy) => {
      if (dx || dy) {
        if (!moved) Object.assign(state, start);
        moved = true;
        state.customized = true;
      }
      const { width, height } = bounds();
      state.x = clamp(start.x + dx, 0, width - start.w);
      state.y = clamp(start.y + dy, 0, height - start.h);
      // Moving a composited layer avoids relaying out the entire workbench per pointer event.
      frame.style.transform = `translate3d(${state.x - start.x}px, ${state.y - start.y}px, 0)`;
    }, () => {
      frame.style.transform = '';
      frame.style.willChange = '';
      render();
    });
  });

  function resized(start, edge, dx, dy) {
    const { width, height } = bounds();
    const result = { ...start };
    const minWidth = Math.min(MIN_WIDTH, Math.max(0, width - HORIZONTAL_MARGIN * 2));
    const minHeight = Math.min(MIN_HEIGHT, Math.max(0, height - VERTICAL_MARGIN * 2));
    if (edge.includes('w')) {
      result.x = clamp(start.x + dx, 0, start.x + start.w - minWidth);
      result.w = start.x + start.w - result.x;
    }
    if (edge.includes('e')) result.w = clamp(start.w + dx, minWidth, width - start.x);
    if (edge.includes('n')) {
      result.y = clamp(start.y + dy, 0, start.y + start.h - minHeight);
      result.h = start.y + start.h - result.y;
    }
    if (edge.includes('s')) result.h = clamp(start.h + dy, minHeight, height - start.y);
    return result;
  }

  frame.querySelectorAll('[data-resize-edge]').forEach((handle) => {
    const edge = handle.dataset.resizeEdge;
    handle.addEventListener('pointerdown', (event) => {
      if (frame.classList.contains('is-desktop-maximized')) return;
      event.stopPropagation();
      const start = { ...shown };
      state.customized = true;
      startPointer(event, (dx, dy) => {
        Object.assign(state, resized(start, edge, dx, dy));
        render();
      });
    });
    handle.addEventListener('keydown', (event) => {
      if (frame.classList.contains('is-desktop-maximized')) return;
      const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
      if (!delta) return;
      event.preventDefault();
      state.customized = true;
      Object.assign(state, resized(shown, edge, ...delta));
      render();
    });
  });

  const clock = document.getElementById('msiTaskbarClock');
  function updateClock() {
    if (!clock) return;
    const now = new Date();
    const options = { timeZone: 'Asia/Shanghai' };
    clock.textContent = now.toLocaleTimeString('zh-CN', { ...options, hour: '2-digit', minute: '2-digit', hour12: false }) + '\n' +
      now.toLocaleDateString('zh-CN', { ...options, year: 'numeric', month: 'numeric', day: 'numeric' });
    clock.dateTime = now.toISOString();
  }

  window.addEventListener('resize', render);
  updateClock();
  setInterval(updateClock, 30_000);
  render();
})();

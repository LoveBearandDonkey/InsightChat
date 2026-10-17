/* Connect the local MemoryViz bundle to the two fixed charts and shared detail panel. */
(async function () {
  'use strict';
  const viewName = location.hash === '#allocator' ? 'Allocator State History' : 'Active Memory Timeline';
  const encoded = window.MSI_MEMORY_SNAPSHOT_GZIP_BASE64;
  if (!encoded || !window.MSI_MEMORY_VIZ || !window.DecompressionStream) {
    throw new Error('MemoryViz local assets or gzip support are missing');
  }
  const binary = atob(encoded);
  const compressed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) compressed[i] = binary.charCodeAt(i);
  delete window.MSI_MEMORY_SNAPSHOT_GZIP_BASE64;
  const buffer = await new Response(
    new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
  window.MSI_MEMORY_VIZ.add_snapshot_buffer('snapshot.pickle', buffer, viewName);

  window.addEventListener('msi-memory-link-selection', (event) => {
    window.parent.postMessage({
      type: 'msi-memory-link-selection',
      view: viewName,
      selection: event.detail,
    }, '*');
  });

  let detail = null;
  let lastDetail = null;
  let lastToolbar = null;
  function findDetail() {
    return viewName === 'Active Memory Timeline'
      ? document.querySelector('div[style*="grid-column: 1; grid-row: 3;"]')
      : document.querySelector('pre[style*="grid-column: 1 / 3; grid-row: 2"]');
  }
  function publishDetail() {
    if (!detail?.isConnected) detail = findDetail();
    const value = detail?.textContent || '';
    if (value === lastDetail) return;
    lastDetail = value;
    window.parent.postMessage({type: 'msi-memory-detail', view: viewName, text: value}, '*');
  }
  function publishToolbar() {
    if (viewName !== 'Active Memory Timeline') return;
    const toolbar = document.querySelector('.msi-memory-native-toolbar');
    const range = toolbar?.querySelector('input[type="range"]');
    if (!range) return;
    const labels = toolbar.querySelectorAll('label');
    const state = {
      value: Number(range.value),
      max: Number(range.max),
      addressMatches: labels[1]?.textContent || '',
      frameMatches: labels[2]?.textContent || '',
    };
    const signature = JSON.stringify(state);
    if (signature === lastToolbar) return;
    lastToolbar = signature;
    window.parent.postMessage({type: 'msi-memory-toolbar', view: viewName, ...state}, '*');
  }
  const detailObserver = new MutationObserver(publishDetail);
  const toolbarObserver = new MutationObserver(publishToolbar);
  function watchOutputs() {
    detailObserver.disconnect();
    toolbarObserver.disconnect();
    detail = findDetail();
    if (detail) detailObserver.observe(detail, {subtree: true, childList: true, characterData: true});
    const toolbar = document.querySelector('.msi-memory-native-toolbar');
    if (toolbar) toolbarObserver.observe(toolbar, {subtree: true, childList: true, characterData: true});
    publishDetail();
    publishToolbar();
  }
  watchOutputs();
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'msi-memory-theme') {
      const root = document.documentElement;
      root.dataset.theme = event.data.theme;
      root.style.setProperty('--msi-viz-accent', event.data.accent);
      root.style.setProperty('--msi-viz-tint', event.data.tint);
      root.style.setProperty('--msi-viz-danger', event.data.danger);
      root.style.setProperty('--msi-viz-purple', event.data.purple);
      root.style.setProperty('--msi-viz-foreground', event.data.foreground);
      root.style.setProperty('--msi-viz-scrollbar-thumb', event.data.border);
      root.style.setProperty('--msi-viz-scrollbar-thumb-hover', event.data.muted);
      event.data.palette?.forEach((color, index) => {
        root.style.setProperty(`--msi-trace-${String(index + 1).padStart(2, '0')}-bg`, color);
      });
      return;
    }
    if (event.data?.type === 'msi-memory-link-target') {
      window.dispatchEvent(new CustomEvent('msi-memory-link-target', {
        detail: event.data.selection,
      }));
      return;
    }
    if (event.data?.type !== 'msi-memory-control' || viewName !== 'Active Memory Timeline') return;
    const toolbar = document.querySelector('.msi-memory-native-toolbar');
    if (!toolbar) return;
    const {control, value} = event.data;
    if (!['range', 'address', 'frame'].includes(control)) return;
    const input = control === 'range'
      ? toolbar.querySelector('input[type="range"]')
      : toolbar.querySelector(`input[placeholder="${control === 'address' ? 'Search address (hex)...' : 'Search stack frame...'}"]`);
    if (!input) return;
    input.value = control === 'range'
      ? String(Math.max(0, Math.min(Number(input.max), Number(value))))
      : String(value ?? '');
    input.dispatchEvent(new Event(control === 'range' ? 'change' : 'input', {bubbles: true}));
    if (control === 'range') watchOutputs();
  });
  window.parent.postMessage({type: 'msi-memory-ready', view: viewName}, '*');
  function focusView() {
    window.parent.postMessage({type: 'msi-memory-focus', view: viewName}, '*');
  }
  document.body.addEventListener('pointerenter', focusView);
  document.body.addEventListener('focusin', focusView);
})().catch(error => {
  document.body.textContent = '内存快照加载失败：' + error.message;
});

/* One operator-name palette for the main timeline and embedded report. */
(() => {
  function colorForName(name) {
    const normalized = String(name).replace(/( )?\d+/g, '').trim() || String(name);
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    const slot = String((hash % 18) + 1).padStart(2, '0');
    return { bg: 'var(--msi-trace-' + slot + '-bg)', fg: 'var(--msi-trace-task-fg)' };
  }
  window.MsiTraceColors = Object.freeze({ colorForName });
})();

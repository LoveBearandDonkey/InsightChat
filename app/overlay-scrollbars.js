// 只为指定的纵向滚动区绘制不参与布局的滚动提示。
(function () {
  'use strict';

  function initOverlayScrollbars() {
    ['.wzh-settings-scroll', '#contentCard', '#msiOverviewPanel', '#msiTuningDocumentPanel'].forEach((selector) => {
      const scroller = document.querySelector(selector);
      const host = scroller?.parentElement;
      if (!scroller || !host) return;
      host.classList.add('wzh-overlay-scrollbar-host');
      const track = document.createElement('div');
      track.className = 'wzh-overlay-vscroll';
      track.hidden = true;
      track.setAttribute('aria-hidden', 'true');
      const thumb = document.createElement('div');
      thumb.className = 'wzh-overlay-vscroll-thumb';
      track.appendChild(thumb);
      host.appendChild(track);

      let frame = 0;
      let hideTimer = 0;
      let hovering = false;
      function update() {
        frame = 0;
        const height = scroller.clientHeight;
        const range = scroller.scrollHeight - height;
        const overflow = getComputedStyle(scroller).overflowY;
        track.hidden = height <= 0 || range <= 1 || overflow === 'hidden' || overflow === 'clip';
        if (track.hidden) return;
        track.style.top = `${scroller.offsetTop}px`;
        track.style.left = `${scroller.offsetLeft + scroller.offsetWidth - 8}px`;
        track.style.height = `${height}px`;
        const thumbHeight = Math.min(height, Math.max(28, height * height / scroller.scrollHeight));
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.top = `${scroller.scrollTop / range * (height - thumbHeight)}px`;
      }
      function scheduleUpdate() {
        if (!frame) frame = requestAnimationFrame(update);
      }
      function showTemporarily() {
        track.classList.add('is-visible');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!hovering) track.classList.remove('is-visible');
        }, 800);
      }

      scroller.addEventListener('scroll', () => { scheduleUpdate(); showTemporarily(); }, { passive: true });
      scroller.addEventListener('mouseenter', () => {
        hovering = true;
        track.classList.add('is-visible');
        scheduleUpdate();
      });
      scroller.addEventListener('mouseleave', () => {
        hovering = false;
        clearTimeout(hideTimer);
        track.classList.remove('is-visible');
      });
      if (typeof ResizeObserver === 'function') {
        const resize = new ResizeObserver(scheduleUpdate);
        resize.observe(scroller);
        resize.observe(host);
        [...scroller.children].forEach((child) => resize.observe(child));
        new MutationObserver((records) => {
          records.forEach((record) => {
            record.addedNodes.forEach((node) => { if (node.nodeType === 1) resize.observe(node); });
            record.removedNodes.forEach((node) => { if (node.nodeType === 1) resize.unobserve(node); });
          });
          scheduleUpdate();
        }).observe(scroller, { childList: true });
      } else {
        window.addEventListener('resize', scheduleUpdate);
        new MutationObserver(scheduleUpdate).observe(scroller, { subtree: true, childList: true, attributes: true });
      }
      scheduleUpdate();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOverlayScrollbars, { once: true });
  else initOverlayScrollbars();
})();

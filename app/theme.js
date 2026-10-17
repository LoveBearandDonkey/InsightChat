    /* ── 主题切换:计算(浅) → 新无限(浅) → 追光(深) 三态循环,顺序见 window.MI_THEMES。
         图标表示「当前主题」的明暗:浅色皮肤是太阳,深色皮肤是月亮。
         所以在计算点太阳会切到新无限(还是太阳),再点才切到追光(变月亮)。
         同时写 html/body 上的 data-theme(明暗基座)与 data-brand(品牌皮肤)。 ── */
    (() => {
      const MOON = 'M12 3a6.5 6.5 0 0 0 7.8 8.8A8 8 0 1 1 12 3z';
      const SUN = 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4';
      const THEMES = window.MI_THEMES;
      const btn = document.getElementById('themeToggle');
      const icon = document.getElementById('themeToggleIcon');
      function apply(i) {
        const t = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
        const next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
        for (const el of [document.documentElement, document.body]) {
          if (!el) continue;
          el.dataset.themeId = t.id;
          el.dataset.theme = t.mode;
          if (t.brand) el.dataset.brand = t.brand; else delete el.dataset.brand;
        }
        if (icon) icon.innerHTML = '<path d="' + (t.mode === 'dark' ? MOON : SUN) + '"></path>';
        if (btn) {
          btn.setAttribute('aria-pressed', String(t.mode === 'light'));
          btn.title = '当前主题:' + t.label + '(点击切换到' + next.label + ')';
          btn.setAttribute('aria-label', btn.title);
        }
      }
      const start = THEMES.findIndex(t => t.id === document.documentElement.dataset.themeId);
      let idx = start < 0 ? 0 : start;
      apply(idx);
      btn?.addEventListener('click', () => { apply(++idx); });
    })();

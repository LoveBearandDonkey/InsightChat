/* A lightweight, per-task notebook for findings collected from the assistant. */
(function () {
  function renderMarkdown(source) {
    const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
    const inline = (value) => {
      const protectedHtml = [];
      const protect = (html) => '\u0000' + (protectedHtml.push(html) - 1) + '\u0000';
      return escape(value)
        .replace(/`([^`\n]+)`/g, (_, code) => protect('<code>' + code + '</code>'))
        .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, label, url) =>
          /^(?:https?:\/\/[^\s"<>]+|(?:\.\.?\/)*[A-Za-z0-9_./~%-]+)$/i.test(url)
            ? protect('<img src="' + url + '" alt="' + label + '" loading="lazy">') : match)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
          (_, label, url) => protect('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'))
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
        .replace(/\u0000(\d+)\u0000/g, (_, index) => protectedHtml[Number(index)]);
    };
    const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    const tableSeparator = (line) => /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
    const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    const listMatch = (line) => line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
    const isBlockStart = (index) => {
      const line = lines[index];
      return /^\s*```/.test(line) || /^#{1,6}\s+/.test(line) || /^\s*>/.test(line) ||
        /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) || !!listMatch(line) ||
        (line.includes('|') && index + 1 < lines.length && tableSeparator(lines[index + 1]));
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^\s*```/.test(line)) {
        const code = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
        if (i < lines.length) i++;
        out.push('<pre><code>' + escape(code.join('\n')) + '</code></pre>');
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && tableSeparator(lines[i + 1])) {
        const headers = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
        out.push('<table><thead><tr>' + headers.map((cell) => '<th>' + inline(cell) + '</th>').join('') +
          '</tr></thead><tbody>' + rows.map((row) => '<tr>' + row.map((cell) => '<td>' + inline(cell) + '</td>').join('') +
          '</tr>').join('') + '</tbody></table>');
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
        i++; continue;
      }
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push('<blockquote><p>' + quote.map(inline).join('<br>') + '</p></blockquote>');
        continue;
      }
      const list = listMatch(line);
      if (list) {
        const ordered = !!list[2];
        const items = [];
        const start = ordered ? Number(list[2]) : 1;
        while (i < lines.length) {
          const match = listMatch(lines[i]);
          if (!match || !!match[2] !== ordered) break;
          items.push('<li>' + inline(match[3]) + '</li>');
          i++;
        }
        out.push(ordered ? '<ol start="' + start + '">' + items.join('') + '</ol>' : '<ul>' + items.join('') + '</ul>');
        continue;
      }
      const paragraph = [];
      while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !isBlockStart(i))) {
        paragraph.push(inline(lines[i++]));
      }
      out.push('<p>' + paragraph.join('<br>') + '</p>');
    }
    return out.join('');
  }

  function init() {
    const editor = document.getElementById('msiTuningDocumentEditor');
    const preview = document.getElementById('msiTuningDocumentPreview');
    const previewShell = document.getElementById('msiTuningPreviewShell');
    const tocAnchor = document.getElementById('msiTuningTocAnchor');
    const tocTrigger = document.getElementById('msiTuningTocTrigger');
    const tocNav = document.getElementById('msiTuningDocumentTocNav');
    const toc = document.getElementById('msiTuningDocumentToc');
    const modeTabs = Array.from(document.querySelectorAll('.msi-tuning-mode-button'));
    const status = document.getElementById('msiTuningDocumentStatus');
    const messages = document.getElementById('trainChatMessages');
    const titleButton = document.getElementById('msiTuningDocumentTitleBtn');
    const titleInput = document.getElementById('msiTuningDocumentTitleInput');
    const titleName = document.getElementById('msiTuningDocumentTitleName');
    const titleSuffix = document.getElementById('msiTuningDocumentTitleSuffix');
    const panel = document.getElementById('msiTuningDocumentPanel');
    const toolbar = panel?.querySelector('.msi-tuning-toolbar');
    const uploadImageButton = toolbar?.querySelector('.msi-tuning-image-button');
    const actionsHome = document.getElementById('msiTuningActionsHome');
    const actionsFloating = document.getElementById('msiTuningActionsFloating');
    const actions = actionsHome?.querySelector('.msi-tuning-document-actions');
    const resetButton = document.getElementById('msiTuningDocumentReset');
    const backToTop = document.getElementById('msiTuningBackToTop');
    const sourceBanner = document.getElementById('msiTuningSourceBanner');
    const sourceBannerProgress = document.getElementById('msiTuningSourceBannerProgress');
    const sourceBannerClose = document.getElementById('msiTuningSourceBannerClose');
    const sourceName = document.getElementById('msiTuningSourceName');
    const summarizeButton = document.getElementById('msiTuningSummarize');
    if (!editor || !messages) return;

    const storageKey = (task) => 'msi-tuning-document-v1:' + encodeURIComponent(task);
    const titleKey = (task) => 'msi-tuning-document-title-v1:' + encodeURIComponent(task);
    const summaryKey = (task) => 'msi-tuning-document-summary-v1:' + encodeURIComponent(task);
    let taskName = window.MSI_ANCHOR_NAME || document.getElementById('msiContentTitle')?.textContent.trim() || 'profile_dir';
    let selectedText = '';
    const summarizedTasks = new Set();
    const dismissedSourceTasks = new Set();
    let mode = 'edit';
    let summaryTimer = null;
    let summaryFrame = null;
    let summaryRun = 0;
    let summaryBase = null;
    let tocCloseTimer = null;

    function renderPreview() {
      if (!preview) return;
      preview.innerHTML = editor.value.trim()
        ? renderMarkdown(editor.value)
        : '<p class="msi-tuning-document-preview-empty">暂无内容，点击“编辑”开始记录。</p>';
      if (!toc) return;
      toc.replaceChildren();
      const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (!headings.length) {
        const empty = document.createElement('li');
        empty.className = 'msi-tuning-document-toc-empty';
        empty.textContent = '暂无目录';
        toc.appendChild(empty);
        return;
      }
      const items = document.createDocumentFragment();
      headings.forEach((heading, index) => {
        heading.id = 'msi-tuning-heading-' + index;
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.target = heading.id;
        button.textContent = heading.textContent.trim() || '未命名章节';
        button.title = button.textContent;
        button.style.paddingLeft = Math.min(48, 8 + (Number(heading.tagName[1]) - 1) * 10) + 'px';
        item.appendChild(button);
        items.appendChild(item);
      });
      toc.appendChild(items);
    }

    function updateTocActive() {
      if (mode !== 'preview' || !toc || !panel) return;
      const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (!headings.length) return;
      const threshold = panel.getBoundingClientRect().top + (toolbar?.getBoundingClientRect().height || 32) + 56;
      let active = 0;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= threshold) active = index;
      });
      toc.querySelectorAll('button').forEach((button, index) => {
        if (index === active) button.setAttribute('aria-current', 'location');
        else button.removeAttribute('aria-current');
      });
    }

    function setTocPopoverOpen(open) {
      if (tocCloseTimer !== null) clearTimeout(tocCloseTimer);
      tocCloseTimer = null;
      tocAnchor?.classList.toggle('is-open', open);
      tocTrigger?.setAttribute('aria-expanded', String(open));
    }

    tocAnchor?.addEventListener('mouseenter', () => setTocPopoverOpen(true));
    tocAnchor?.addEventListener('mouseleave', () => {
      if (tocAnchor.contains(document.activeElement)) return;
      tocCloseTimer = setTimeout(() => setTocPopoverOpen(false), 180);
    });
    tocAnchor?.addEventListener('focusin', () => setTocPopoverOpen(true));
    tocAnchor?.addEventListener('focusout', (event) => {
      if (!tocAnchor.contains(event.relatedTarget)) setTocPopoverOpen(false);
    });
    tocAnchor?.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      setTocPopoverOpen(false);
      tocTrigger?.blur();
    });
    tocTrigger?.addEventListener('click', () => setTocPopoverOpen(true));

    function setMode(next, focusEditor = false) {
      if (!preview || !previewShell || !modeTabs.length) return;
      const scrollTop = panel.scrollTop;
      mode = next;
      if (mode === 'preview') renderPreview();
      editor.hidden = mode !== 'edit';
      preview.hidden = mode !== 'preview';
      if (tocNav) tocNav.hidden = mode !== 'preview';
      if (mode !== 'preview') setTocPopoverOpen(false);
      previewShell.classList.toggle('is-preview', mode === 'preview');
      modeTabs.forEach((tab) => {
        const active = tab.dataset.tuningMode === mode;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      if (mode === 'edit') resizeEditor();
      panel.scrollTop = scrollTop;
      if (mode === 'preview') updateTocActive();
      if (focusEditor) editor.focus({ preventScroll: true });
    }

    toc?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-target]');
      if (!button || !toc.contains(button)) return;
      const heading = document.getElementById(button.dataset.target);
      if (!heading) return;
      // The toolbar grows by 24px the first time it becomes floating.
      const offset = toolbar?.classList.contains('is-floating') ? 68 : 44;
      const top = panel.scrollTop + heading.getBoundingClientRect().top - panel.getBoundingClientRect().top - offset;
      panel.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });

    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => setMode(tab.dataset.tuningMode, tab.dataset.tuningMode === 'edit'));
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = modeTabs[(modeTabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + modeTabs.length) % modeTabs.length];
        setMode(next.dataset.tuningMode);
        next.focus();
      });
    });

    function syncSourceBanner() {
      if (!sourceBanner) return;
      if (sourceName) sourceName.textContent = taskName;
      let summarized = summarizedTasks.has(taskName);
      try { summarized ||= localStorage.getItem(summaryKey(taskName)) === '1'; }
      catch (_) { /* The banner still works for this page when storage is unavailable. */ }
      const dismissed = dismissedSourceTasks.has(taskName);
      sourceBanner.hidden = taskName !== 'profile_dir' || (summaryBase === null && (summarized || dismissed));
      if (resetButton) resetButton.hidden = taskName !== 'profile_dir' || (!summarized && !dismissed && !editor.value.trim());
    }

    sourceBannerClose?.addEventListener('click', () => {
      dismissedSourceTasks.add(taskName);
      syncSourceBanner();
    });

    function stopSummaryTyping(restore = false) {
      summaryRun++;
      if (summaryTimer !== null) clearTimeout(summaryTimer);
      if (summaryFrame !== null) cancelAnimationFrame(summaryFrame);
      summaryTimer = null;
      summaryFrame = null;
      if (restore && summaryBase !== null) {
        editor.value = summaryBase;
        save();
        resizeEditor();
      }
      summaryBase = null;
      editor.readOnly = false;
      editor.classList.remove('is-generating');
      editor.removeAttribute('aria-busy');
      sourceBanner?.classList.remove('is-summarizing');
      if (sourceBannerProgress) sourceBannerProgress.hidden = true;
      if (summarizeButton) summarizeButton.disabled = false;
      if (uploadImageButton) uploadImageButton.disabled = false;
      modeTabs.forEach((tab) => { tab.disabled = false; });
    }

    summarizeButton?.addEventListener('click', () => {
      if (summaryBase !== null) return;
      const answer = (window.MSI_GET_PROFILING_ANSWER?.() || '')
        .replace(/\[\[lane:[^:\]]+::([^\]]+)\]\]/g, '$1').trim();
      if (!answer) return;
      const summaryTask = taskName;
      summaryBase = editor.value;
      const separator = !summaryBase || summaryBase.endsWith('\n\n') ? '' : summaryBase.endsWith('\n') ? '\n' : '\n\n';
      const prefix = summaryBase + separator;
      const characters = Array.from(answer);
      const run = ++summaryRun;
      window.WZH_ACTIVATE_ANALYSIS_TAB?.('tuning-document');
      setMode('edit');
      sourceBanner.hidden = false;
      sourceBanner.classList.add('is-summarizing');
      if (sourceBannerProgress) sourceBannerProgress.hidden = false;
      summarizeButton.disabled = true;
      if (uploadImageButton) uploadImageButton.disabled = true;
      editor.readOnly = true;
      editor.classList.add('is-generating');
      editor.setAttribute('aria-busy', 'true');
      modeTabs.forEach((tab) => { tab.disabled = true; });
      panel.scrollTop = panel.scrollHeight;
      summaryTimer = setTimeout(() => {
        summaryTimer = null;
        if (run !== summaryRun || taskName !== summaryTask) return;
        editor.value = prefix;
        let started = null;
        let painted = 0;
        let written = 0;
        const type = (now) => {
          if (run !== summaryRun || taskName !== summaryTask) return;
          if (started === null) started = now;
          if (now - painted < 32 && now - started < 5000) {
            summaryFrame = requestAnimationFrame(type);
            return;
          }
          painted = now;
          const count = Math.min(characters.length, Math.ceil(characters.length * Math.min(1, (now - started) / 5000)));
          if (count > written) {
            editor.value += characters.slice(written, count).join('');
            written = count;
            resizeEditor();
            panel.scrollTop = panel.scrollHeight;
          }
          if (now - started < 5000) {
            summaryFrame = requestAnimationFrame(type);
            return;
          }
          editor.value = prefix + answer;
          save();
          summarizedTasks.add(summaryTask);
          try { localStorage.setItem(summaryKey(summaryTask), '1'); }
          catch (_) { /* Keep the banner dismissed for this page. */ }
          stopSummaryTyping();
          setMode('preview');
          syncSourceBanner();
          panel.scrollTop = panel.scrollHeight;
        };
        summaryFrame = requestAnimationFrame(type);
      }, 1000);
    });

    resetButton?.addEventListener('click', () => {
      stopSummaryTyping();
      editor.value = '';
      summarizedTasks.delete(taskName);
      dismissedSourceTasks.delete(taskName);
      try { localStorage.removeItem(summaryKey(taskName)); }
      catch (_) { /* The banner can still be restored for this page. */ }
      save();
      syncSourceBanner();
      setMode('edit');
      panel.scrollTop = 0;
      updateBackToTop();
      syncFloatingToolbar();
    });

    function updateBackToTop() {
      if (backToTop) backToTop.hidden = panel.scrollTop <= 160;
    }

    function syncFloatingToolbar() {
      if (!toolbar || !actionsHome || !actionsFloating || !actions || panel.hidden) return;
      const stickyTop = panel.getBoundingClientRect().top +
        parseFloat(getComputedStyle(panel).paddingTop) + parseFloat(getComputedStyle(toolbar).top);
      const floating = panel.scrollTop > 0 && toolbar.getBoundingClientRect().top <= stickyTop + 1;
      if (floating && actions.parentElement !== actionsFloating) {
        actionsHome.style.width = actions.getBoundingClientRect().width + 'px';
        actionsFloating.appendChild(actions);
      } else if (!floating && actions.parentElement !== actionsHome) {
        actionsHome.appendChild(actions);
        actionsHome.style.width = '';
      }
      toolbar.classList.toggle('is-floating', floating);
      if (floating) {
        const panelRect = panel.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        toolbar.style.setProperty('--msi-tuning-float-left', panelRect.left + 16 - toolbarRect.left + 'px');
        toolbar.style.setProperty('--msi-tuning-float-width', Math.max(0, panelRect.width - 32) + 'px');
      }
    }

    panel.addEventListener('scroll', () => { updateBackToTop(); syncFloatingToolbar(); updateTocActive(); }, { passive: true });
    backToTop?.addEventListener('click', () => {
      panel.scrollTop = 0;
    });

    function resizeEditor() {
      if (!panel || panel.hidden) return;
      if (editor.hidden) { updateBackToTop(); syncFloatingToolbar(); return; }
      // Measure the text without the flex fill so the editor can also shrink after deletions.
      const scrollTop = panel.scrollTop;
      editor.style.flex = 'none';
      editor.style.height = '0px';
      const contentHeight = editor.scrollHeight;
      editor.style.height = contentHeight + 'px';
      editor.style.flex = '';
      panel.scrollTop = scrollTop;
      updateBackToTop();
      syncFloatingToolbar();
    }

    if (panel && 'ResizeObserver' in window) {
      new ResizeObserver(resizeEditor).observe(panel);
    } else {
      window.addEventListener('resize', resizeEditor);
    }

    function renderTitle(value) {
      const suffix = ' 调优文档';
      const hasSuffix = value.endsWith(suffix) && value.length > suffix.length;
      titleName.textContent = hasSuffix ? value.slice(0, -suffix.length) : value;
      titleSuffix.textContent = hasSuffix ? suffix : '';
      titleButton.title = '重命名“' + value + '”';
    }

    function endTitleEdit(commit) {
      if (!titleInput || titleInput.hidden) return;
      if (commit) {
        const value = titleInput.value.trim();
        if (value) {
          renderTitle(value);
          try { localStorage.setItem(titleKey(taskName), value); }
          catch (_) { status.textContent = '标题保存失败'; }
        }
      }
      titleInput.hidden = true;
      titleButton.hidden = false;
    }

    titleButton?.addEventListener('click', () => {
      titleInput.value = (titleName.textContent + titleSuffix.textContent).trim();
      titleButton.hidden = true;
      titleInput.hidden = false;
      titleInput.focus();
      titleInput.select();
    });
    titleInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); endTitleEdit(true); titleButton.focus(); }
      if (event.key === 'Escape') { event.preventDefault(); endTitleEdit(false); titleButton.focus(); }
    });
    titleInput?.addEventListener('blur', () => endTitleEdit(true));

    function load(task) {
      stopSummaryTyping(true);
      endTitleEdit(false);
      taskName = task || 'profile_dir';
      try {
        editor.value = localStorage.getItem(storageKey(taskName)) || '';
        renderTitle(localStorage.getItem(titleKey(taskName)) || taskName + ' 调优文档');
        status.textContent = '自动保存于本机';
      } catch (_) {
        editor.value = '';
        renderTitle(taskName + ' 调优文档');
        status.textContent = '此浏览器无法保存文档';
      }
      syncSourceBanner();
      setMode(editor.value.trim() ? 'preview' : 'edit');
    }

    function save() {
      try {
        localStorage.setItem(storageKey(taskName), editor.value);
        status.textContent = '已自动保存于本机';
      } catch (_) {
        status.textContent = '保存失败，请复制文档内容备份';
      }
    }

    function append(text, options = {}) {
      stopSummaryTyping(true);
      const addition = String(text || '').trim();
      if (!addition) return false;
      const existing = editor.value;
      const separator = !existing || existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
      editor.value = existing + separator + addition;
      save();
      syncSourceBanner();
      window.WZH_ACTIVATE_ANALYSIS_TAB?.('tuning-document');
      setMode(options.preview ? 'preview' : 'edit');
      if (!options.preview) {
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
      if (options.scrollToEnd !== false) panel.scrollTop = panel.scrollHeight;
      return true;
    }

    uploadImageButton?.addEventListener('click', () => {
      if (!append('![性能时间线截图](../../src/pic/screenimage.png)', { preview: true, scrollToEnd: false })) return;
      const image = Array.from(preview.querySelectorAll('img')).pop();
      if (!image) return;
      const scrollToImage = () => requestAnimationFrame(() => {
        if (!image.isConnected || preview.hidden || panel.hidden) return;
        const panelRect = panel.getBoundingClientRect();
        const toolbarBottom = toolbar?.getBoundingClientRect().bottom || panelRect.top;
        const offset = Math.max(0, toolbarBottom - panelRect.top) + 16;
        const top = panel.scrollTop + image.getBoundingClientRect().top - panelRect.top - offset;
        panel.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      image.loading = 'eager';
      if (image.complete) scrollToImage();
      else {
        image.addEventListener('load', scrollToImage, { once: true });
        image.addEventListener('error', scrollToImage, { once: true });
      }
    });

    function addAnswer(message) {
      const answer = message?.querySelector('.wzh-chat-answer');
      if (!answer) return false;
      const response = (answer._markdownSource || answer.innerText || answer.textContent || '')
        .replace(/\[\[lane:[^:\]]+::([^\]]+)\]\]/g, '$1').trim();
      if (!response) return false;
      let prior = message.previousElementSibling;
      while (prior && !prior.classList.contains('wzh-chat-qcard')) prior = prior.previousElementSibling;
      const question = prior?.querySelector('.wzh-chat-qcard-text')?.innerText?.trim() || '';
      return append((question ? '**提问：**\n\n' + question + '\n\n' : '') + '**回答：**\n\n' + response,
        { preview: true });
    }

    window.MSI_TUNING_DOCUMENT = { addAnswer, append };
    editor.addEventListener('input', () => { resizeEditor(); save(); syncSourceBanner(); });
    window.addEventListener('msi:task-selected', (event) => {
      const next = event.detail?.taskName;
      if (next && next !== taskName) load(next);
    });
    load(taskName);

    const menu = document.createElement('div');
    menu.className = 'wzh-chat-selection-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', '划选文本操作');
    menu.hidden = true;
    for (const [action, label] of [['copy', '复制'], ['add', '添加到调优文档'], ['ask', '提问']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.selectionAction = action;
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      menu.appendChild(button);
    }
    document.body.appendChild(menu);

    function hideMenu() { menu.hidden = true; }
    function updateMenu() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) { hideMenu(); return; }
      const range = selection.getRangeAt(0);
      const parent = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      const section = parent?.closest('.wzh-chat-think-body, .wzh-chat-answer');
      if (!section || !messages.contains(section) || !section.contains(range.startContainer) ||
          !section.contains(range.endContainer) || parent.closest('.wzh-chat-answer-actions')) {
        hideMenu(); return;
      }
      selectedText = selection.toString().trim();
      if (!selectedText) { hideMenu(); return; }
      const rect = range.getBoundingClientRect();
      menu.hidden = false;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      menu.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)) + 'px';
      menu.style.top = (rect.top >= height + 12 ? rect.top - height - 8 : Math.min(window.innerHeight - height - 8, rect.bottom + 8)) + 'px';
    }

    messages.addEventListener('pointerup', () => requestAnimationFrame(updateMenu));
    messages.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') hideMenu();
      else requestAnimationFrame(updateMenu);
    });
    menu.addEventListener('pointerdown', (event) => event.preventDefault());
    menu.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-selection-action]')?.dataset.selectionAction;
      if (!action || !selectedText) return;
      const text = selectedText;
      hideMenu();
      window.getSelection()?.removeAllRanges();
      if (action === 'add') append(text);
      if (action === 'ask') {
        const input = document.getElementById('trainChatInput');
        if (!input) return;
        input.value = (input.value.trim() ? input.value.trimEnd() + '\n\n' : '') + '关于以下内容，我想问：\n“' + text + '”\n\n';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
      if (action === 'copy') {
        try {
          if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
          else {
            const helper = document.createElement('textarea');
            helper.value = text;
            helper.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(helper);
            helper.select();
            document.execCommand('copy');
            helper.remove();
          }
        } catch (_) { /* Browser clipboard permissions may deny copying. */ }
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (!menu.contains(event.target)) hideMenu();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideMenu(); });
    messages.addEventListener('scroll', hideMenu, { passive: true });
    window.addEventListener('resize', hideMenu);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

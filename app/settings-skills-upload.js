// 本地 Skill 选择仅用于当前页面预览；浏览器不会将文件写入客户端目录。
(function () {
  'use strict';

  function initSkillsUpload() {
    const section = document.querySelector('[data-settings-panel="skills"]');
    if (!section) return;
    const dialog = document.getElementById('trainChatSettingsDialog');
    const catalog = document.getElementById('trainChatSkillsCatalog');
    const view = document.getElementById('trainChatSkillsUpload');
    const foot = document.getElementById('trainChatSkillsUploadFoot');
    const zone = document.getElementById('trainChatSkillsDropzone');
    const folderInput = document.createElement('input');
    folderInput.type = 'file';
    folderInput.multiple = true;
    folderInput.webkitdirectory = true;
    folderInput.hidden = true;
    view.appendChild(folderInput);
    const selected = document.getElementById('trainChatSkillsSelected');
    const list = document.getElementById('trainChatSkillsSelectedList');
    const count = document.getElementById('trainChatSkillsSelectedCount');
    const confirm = document.getElementById('trainChatSkillsUploadConfirm');
    const error = document.getElementById('trainChatSkillsUploadError');
    const directoryName = document.getElementById('trainChatSkillsDirectoryName');
    const scroll = dialog.querySelector('.wzh-settings-scroll');
    let entries = [];
    let expandedKey = null;
    let dragDepth = 0;
    const copiedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>';

    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); return true; } catch { /* 浏览器可能拒绝权限，继续尝试页面复制。 */ }
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* 无剪贴板权限时返回失败。 */ }
      textarea.remove();
      return copied;
    }

    function showError(message) {
      error.textContent = message;
      error.hidden = !message;
    }

    function reset() {
      entries = [];
      expandedKey = null;
      dragDepth = 0;
      folderInput.value = '';
      directoryName.textContent = 'D:\\Program\\MindStudio Insight\\skills';
      zone.classList.remove('is-dragover');
      showError('');
      render();
    }

    function leave(restoreFocus = true) {
      catalog.hidden = false;
      view.hidden = true;
      foot.hidden = true;
      dialog.classList.remove('is-skills-upload');
      reset();
      if (restoreFocus) document.getElementById('trainChatSkillsAdd').focus({ preventScroll: true });
    }

    function open() {
      reset();
      catalog.hidden = true;
      view.hidden = false;
      foot.hidden = false;
      dialog.classList.add('is-skills-upload');
      scroll.scrollTop = 0;
      document.getElementById('trainChatSkillsUploadBack').focus({ preventScroll: true });
    }

    function formatSize(bytes) {
      return bytes < 1024 ? `${bytes} B` : bytes < 1048576
        ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
    }

    function frontmatter(text, field) {
      const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
      const line = match?.[1].split(/\r?\n/).find(item => new RegExp(`^${field}\\s*:`,'i').test(item));
      return line ? line.replace(new RegExp(`^${field}\\s*:\\s*`,'i'), '').trim().replace(/^['"]|['"]$/g, '') : '';
    }

    function render() {
      const hasEntries = entries.length > 0;
      zone.classList.toggle('has-selection', hasEntries);
      selected.hidden = !hasEntries;
      confirm.disabled = !hasEntries;
      count.textContent = String(entries.length);
      list.replaceChildren();
      entries.forEach((entry) => {
        const card = document.createElement('div');
        card.className = 'wzh-skills-selected-card';
        card.classList.toggle('is-expanded', expandedKey === entry.key);
        const row = document.createElement('div');
        row.className = 'wzh-skills-selected-row';
        row.addEventListener('click', (event) => {
          if (event.target.closest('button')) return;
          expandedKey = expandedKey === entry.key ? null : entry.key;
          render();
        });
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.className = 'wzh-skills-selected-expand';
        expand.setAttribute('aria-label', `${expandedKey === entry.key ? '收起' : '展开'} ${entry.name}`);
        expand.setAttribute('aria-expanded', String(expandedKey === entry.key));
        expand.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m7 4 5 5-5 5"/></svg>';
        expand.addEventListener('click', () => { expandedKey = expandedKey === entry.key ? null : entry.key; render(); });
        const folder = document.createElement('span');
        folder.className = 'wzh-skills-folder';
        folder.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'wzh-skills-selected-name';
        name.textContent = entry.name;
        const size = document.createElement('span');
        size.className = 'wzh-skills-selected-size';
        size.textContent = formatSize(entry.size);
        const check = document.createElement('span');
        check.className = 'wzh-skills-selected-check';
        check.setAttribute('aria-label', '已识别 SKILL.md');
        const actions = document.createElement('div');
        actions.className = 'wzh-skills-selected-actions';
        const openFile = document.createElement('button');
        openFile.type = 'button';
        openFile.className = 'wzh-skills-selected-action wzh-skills-selected-action--directory';
        openFile.title = '打开目录';
        openFile.setAttribute('aria-label', `打开 ${entry.name} 的目录`);
        openFile.innerHTML = '<span class="wzh-skills-selected-action-icon" aria-hidden="true"></span>';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'wzh-skills-selected-action wzh-skills-selected-action--delete';
        remove.title = '移除';
        remove.setAttribute('aria-label', `移除 ${entry.name}`);
        remove.innerHTML = '<span class="wzh-skills-selected-action-icon" aria-hidden="true"></span>';
        remove.addEventListener('click', () => {
          entries = entries.filter(item => item.key !== entry.key);
          if (expandedKey === entry.key) expandedKey = null;
          render();
        });
        actions.append(check, openFile, remove);
        row.append(expand, folder, name, size, actions);
        card.appendChild(row);
        if (expandedKey === entry.key) {
          const preview = document.createElement('div');
          preview.className = 'wzh-skills-selected-preview';
          const title = document.createElement('strong');
          title.textContent = 'Skill.md';
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.className = 'wzh-chat-answer-action wzh-skills-selected-copy';
          copy.setAttribute('aria-label', `复制 ${entry.name} 的 SKILL.md 内容`);
          copy.title = '复制内容';
          copy.innerHTML = '<img src="../../src/pic/icon/Copy.svg" alt="">';
          copy.addEventListener('click', async () => {
            if (!(await copyText(entry.text))) { showError('浏览器未允许复制，请手动选取预览内容。'); return; }
            showError('');
            clearTimeout(copy._copyTimer);
            copy.classList.add('is-copied');
            copy.innerHTML = copiedIcon;
            copy.title = '已复制';
            copy.setAttribute('aria-label', '已复制');
            copy._copyTimer = setTimeout(() => {
              copy.classList.remove('is-copied');
              copy.innerHTML = '<img src="../../src/pic/icon/Copy.svg" alt="">';
              copy.title = '复制内容';
              copy.setAttribute('aria-label', `复制 ${entry.name} 的 SKILL.md 内容`);
            }, 1000);
          });
          const code = document.createElement('div');
          code.className = 'wzh-skills-selected-code';
          const lines = entry.text.split(/\r?\n/).slice(0, 10);
          const lineNumbers = document.createElement('span');
          lineNumbers.className = 'wzh-skills-selected-line-numbers';
          lineNumbers.setAttribute('aria-hidden', 'true');
          lineNumbers.textContent = lines.map((_, index) => index + 1).join('\n');
          const body = document.createElement('pre');
          body.textContent = lines.join('\n') || 'SKILL.md 为空';
          code.append(lineNumbers, body);
          preview.append(title, copy, code);
          card.appendChild(preview);
        }
        list.appendChild(card);
      });
    }

    async function addFiles(fileRecords) {
      const records = fileRecords.filter(record => record.file && !record.path.split('/').some(part => part.startsWith('.')));
      const skillFiles = records.filter(record => /^skill\.md$/i.test(record.file.name));
      if (!skillFiles.length) { showError('未找到 SKILL.md，请选择包含该文件的 Skill 文件或文件夹。'); return; }
      showError('');
      const next = await Promise.all(skillFiles.map(async (record) => {
        const text = await record.file.text();
        const parts = record.path.split('/');
        const folder = parts.length > 1 ? parts.at(-2) : '';
        const name = frontmatter(text, 'name') || folder || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || '未命名 Skill';
        const description = frontmatter(text, 'description') || text.replace(/^---[\s\S]*?---/, '').match(/^(?!#|\s*$)(.+)$/m)?.[1]?.trim() || '本地导入的 Skill';
        const base = record.path.slice(0, -record.file.name.length);
        const size = records.filter(item => base && item.path.startsWith(base)).reduce((sum, item) => sum + item.file.size, 0) || record.file.size;
        return { key: `${record.path}:${record.file.size}:${record.file.lastModified}`, name, description, size, text };
      }));
      next.forEach((entry) => { if (!entries.some(item => item.key === entry.key)) entries.push(entry); });
      if (next.length) expandedKey = next.at(-1).key;
      render();
    }

    function fromFileList(files) {
      return [...files].map(file => ({ file, path: file.webkitRelativePath || file.name }));
    }

    function showDemoSkills() {
      if (entries.length) return;
      const demoDocument = (name, description, situation, firstStep, secondStep) => [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        '---',
        `# ${name}`,
        '## 适用场景',
        situation,
        '## 分析步骤',
        `1. ${firstStep}`,
        `2. ${secondStep}`,
      ].join('\n');
      entries = [
        { key: 'demo-slow-card', name: '快慢卡分析', description: '分析训练任务中的快慢卡差异。', size: 1331692,
          text: demoDocument('快慢卡分析', '分析训练任务中的快慢卡差异。', '训练迭代耗时不均、部分计算卡持续落后时使用。', '对比每张卡的计算、通信与等待耗时。', '定位慢卡并给出负载和网络排查建议。') },
        { key: 'demo-memory', name: '内存分析', description: '分析内存使用与性能瓶颈。', size: 936000,
          text: demoDocument('内存分析', '分析内存使用与性能瓶颈。', '内存占用偏高、频繁分配或出现溢出时使用。', '汇总峰值占用、分配记录与释放时序。', '识别异常增长并给出内存优化建议。') },
      ];
      expandedKey = 'demo-memory';
      showError('');
      render();
    }

    function readEntry(entry, path) {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file(file => resolve([{ file, path: `${path}${entry.name}` }]), () => resolve([]));
          return;
        }
        const reader = entry.createReader();
        const children = [];
        const read = () => reader.readEntries(async (batch) => {
          if (!batch.length) { resolve((await Promise.all(children.map(child => readEntry(child, `${path}${entry.name}/`)))).flat()); return; }
          children.push(...batch);
          read();
        }, () => resolve([]));
        read();
      });
    }

    document.getElementById('trainChatSkillsAdd').addEventListener('click', open);
    document.getElementById('trainChatSkillsUploadBack').addEventListener('click', leave);
    document.getElementById('trainChatSkillsUploadCancel').addEventListener('click', leave);
    confirm.addEventListener('click', () => {
      if (!entries.length) { showError('请先选择包含 SKILL.md 的文件。'); return; }
      section.dispatchEvent(new CustomEvent('skills:added', { detail: entries.map(({ name, description }) => ({ name, description })) }));
      leave();
    });
    zone.addEventListener('click', showDemoSkills);
    zone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDemoSkills(); }
    });
    folderInput.addEventListener('change', async () => {
      const files = fromFileList(folderInput.files);
      if (files.length) directoryName.textContent = files[0].path.split('/')[0];
      await addFiles(files);
      folderInput.value = '';
    });
    document.getElementById('trainChatSkillsDirectoryChange').addEventListener('click', () => folderInput.click());
    zone.addEventListener('dragenter', (event) => { event.preventDefault(); dragDepth++; zone.classList.add('is-dragover'); });
    zone.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', (event) => { event.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; zone.classList.remove('is-dragover'); } });
    zone.addEventListener('drop', async (event) => {
      event.preventDefault();
      dragDepth = 0;
      zone.classList.remove('is-dragover');
      const items = [...(event.dataTransfer.items || [])];
      const roots = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
      const files = roots.length ? (await Promise.all(roots.map(entry => readEntry(entry, '')))).flat() : fromFileList(event.dataTransfer.files);
      await addFiles(files);
    });
    dialog.addEventListener('settings:section-change', (event) => {
      if (event.detail.section !== 'skills' && !view.hidden) leave(false);
    });
    dialog.addEventListener('close', () => {
      if (!view.hidden) leave(false);
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSkillsUpload, { once: true });
  else initSkillsUpload();
})();

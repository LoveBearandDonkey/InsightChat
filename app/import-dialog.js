// 导入弹窗只预览用户授权的本机目录；确认按钮暂不执行导入。
(function () {
  'use strict';

  function initImportDialog() {
    const dialog = document.getElementById('msiImportDialog');
    const trigger = document.getElementById('msiImportBtn');
    if (!dialog || !trigger) return;

    const pathInput = document.getElementById('msiImportPath');
    const clearButton = document.getElementById('msiImportClear');
    const browser = document.getElementById('msiImportBrowser');
    const folderInput = document.getElementById('msiImportFolderInput');
    let lastSelectedRow = null;
    let selectedDirectoryHandle = null;

    function syncClearButton() {
      clearButton.hidden = !pathInput.value;
    }

    function setPath(value, row) {
      pathInput.value = value;
      syncClearButton();
      lastSelectedRow?.classList.remove('is-selected');
      lastSelectedRow = row || null;
      lastSelectedRow?.classList.add('is-selected');
    }

    function resetBrowser() {
      browser.replaceChildren();
      const message = document.createElement('p');
      message.className = 'msi-import-empty';
      message.textContent = 'D:\\ 尚未授权。点击此处在系统窗口中选择 D 盘或其子目录，也可拖入文件或文件夹。';
      browser.appendChild(message);
      lastSelectedRow = null;
      selectedDirectoryHandle = null;
      folderInput.value = '';
    }

    function addRow(parent, name, kind, path, depth, loadChildren) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'msi-import-tree-row';
      row.setAttribute('role', 'treeitem');
      row.style.setProperty('--depth', depth);
      row.title = path;
      const arrow = document.createElement('span');
      arrow.className = 'msi-import-tree-arrow';
      arrow.textContent = kind === 'directory' ? '▸' : '';
      const icon = document.createElement('span');
      icon.className = 'msi-import-tree-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = kind === 'directory' ? '📁' : '📄';
      const label = document.createElement('span');
      label.className = 'msi-import-tree-label';
      label.textContent = name;
      row.append(arrow, icon, label);
      parent.appendChild(row);

      if (kind === 'directory') {
        row.setAttribute('aria-expanded', 'false');
        const children = document.createElement('div');
        children.setAttribute('role', 'group');
        children.hidden = true;
        parent.appendChild(children);
        let loaded = false;
        row.addEventListener('click', async () => {
          setPath(path, row);
          const opening = children.hidden;
          children.hidden = !opening;
          row.setAttribute('aria-expanded', String(opening));
          if (opening && !loaded) {
            loaded = true;
            await loadChildren(children, depth + 1);
          }
        });
      } else {
        row.addEventListener('click', () => setPath(path, row));
      }
      return row;
    }

    async function showDirectoryHandle(handle) {
      browser.replaceChildren();
      async function addHandle(parent, entry, path, depth) {
        addRow(parent, entry.name, entry.kind, path, depth, async (children, nextDepth) => {
          try {
            const entries = [];
            for await (const child of entry.values()) entries.push(child);
            entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'zh-CN')
              : a.kind === 'directory' ? -1 : 1));
            for (const child of entries) {
              await addHandle(children, child, path + '\\' + child.name, nextDepth);
            }
          } catch (_) {
            const message = document.createElement('p');
            message.className = 'msi-import-empty';
            message.textContent = '无法读取此目录，请重新选择';
            children.appendChild(message);
          }
        });
      }
      await addHandle(browser, handle, handle.name, 0);
      browser.querySelector('.msi-import-tree-row')?.click();
    }

    function showInputFiles(files) {
      if (!files.length) return;
      const root = { name: '', kind: 'directory', children: new Map() };
      for (const file of files) {
        const parts = (file.webkitRelativePath || file.name).split('/');
        let node = root;
        for (let index = 0; index < parts.length; index++) {
          const name = parts[index];
          if (!node.children.has(name)) {
            node.children.set(name, {
              name,
              kind: index === parts.length - 1 ? 'file' : 'directory',
              children: new Map(),
            });
          }
          node = node.children.get(name);
        }
      }
      browser.replaceChildren();
      function addNode(parent, node, path, depth) {
        addRow(parent, node.name, node.kind, path, depth, async (children, nextDepth) => {
          const entries = [...node.children.values()].sort((a, b) =>
            a.kind === b.kind ? a.name.localeCompare(b.name, 'zh-CN') : a.kind === 'directory' ? -1 : 1);
          for (const child of entries) addNode(children, child, path + '\\' + child.name, nextDepth);
        });
      }
      for (const node of root.children.values()) addNode(browser, node, node.name, 0);
      browser.querySelector('.msi-import-tree-row')?.click();
    }

    function showDroppedEntries(entries) {
      browser.replaceChildren();
      function addEntry(parent, entry, path, depth) {
        addRow(parent, entry.name, entry.isDirectory ? 'directory' : 'file', path, depth,
          async (children, nextDepth) => {
            try {
              const reader = entry.createReader();
              const all = [];
              while (true) {
                const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                if (!batch.length) break;
                all.push(...batch);
              }
              all.sort((a, b) => a.isDirectory === b.isDirectory
                ? a.name.localeCompare(b.name, 'zh-CN') : a.isDirectory ? -1 : 1);
              for (const child of all) addEntry(children, child, path + '\\' + child.name, nextDepth);
            } catch (_) {
              const message = document.createElement('p');
              message.className = 'msi-import-empty';
              message.textContent = '无法读取此目录，请重新选择';
              children.appendChild(message);
            }
          });
      }
      for (const entry of entries) addEntry(browser, entry, entry.name, 0);
      browser.querySelector('.msi-import-tree-row')?.click();
    }

    function requestDirectoryAccess() {
      if (!window.showDirectoryPicker) {
        folderInput.click();
        return;
      }
      // 目录选择器必须在用户点击的同一调用链中启动。
      let picker;
      try {
        picker = window.showDirectoryPicker({ id: 'msi-import-d-drive', mode: 'read' });
      } catch (_) {
        folderInput.click();
        return;
      }
      picker
        .then((handle) => {
          selectedDirectoryHandle = handle;
          showDirectoryHandle(handle);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') folderInput.click();
        });
    }

    syncClearButton();
    trigger.addEventListener('click', () => {
      dialog.showModal();
      if (!selectedDirectoryHandle) requestDirectoryAccess();
    });
    document.getElementById('msiImportClose').addEventListener('click', () => dialog.close());
    document.getElementById('msiImportCancel').addEventListener('click', () => dialog.close());
    browser.addEventListener('click', (event) => {
      if (event.target === browser || event.target.classList.contains('msi-import-empty')) {
        requestDirectoryAccess();
      }
    });
    folderInput.addEventListener('change', () => showInputFiles(folderInput.files));
    browser.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      browser.classList.add('is-drag-over');
    });
    browser.addEventListener('dragleave', (event) => {
      if (!browser.contains(event.relatedTarget)) browser.classList.remove('is-drag-over');
    });
    browser.addEventListener('drop', (event) => {
      event.preventDefault();
      browser.classList.remove('is-drag-over');
      const entries = Array.from(event.dataTransfer?.items || [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.webkitGetAsEntry?.())
        .filter(Boolean);
      if (entries.length) showDroppedEntries(entries);
      else showInputFiles(event.dataTransfer?.files || []);
    });
    clearButton.addEventListener('click', () => {
      setPath('');
      resetBrowser();
      pathInput.focus();
    });
    pathInput.addEventListener('input', syncClearButton);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => trigger.focus());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initImportDialog);
  else initImportDialog();
})();

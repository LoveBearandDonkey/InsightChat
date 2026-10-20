// 这个文件只负责「壳」的两块内容:左边的性能任务树、右边的泳道视图。
// 左树只展示「任务 → rank」两级；具体落盘文件仍可由对话框的 # 引用列表访问。
// 泳道的结构对齐 profileCompare.html 的训练级 Timeline(Ascend Hardware ▸ Stream N /
// Communication / Overlap Analysis / HBM ...)。rank0/trace_view.json 使用从真实 trace 抽取的
// 任务与 flow，其余文件仍按文件名种子确定性生成；数据直接内嵌在本脚本中。
(function () {
  'use strict';

  /* ══ 1. 性能任务目录:data 下的任务 → 各任务的 rank 目录 ════════════ */
  const RANK_FILES = [
    'trace_view.json',            // Timeline 主件,Text 模式必出
    'kernel_details.csv',         // 算子级明细(cube 利用率、MFU 都从它算,带 Input/Output Shapes 列)
    'op_statistic.csv',
    'api_statistic.csv',
    'step_trace_time.csv',        // 每步的计算/通信/Free 拆解,communicationOverlapComputation 在这里
    'communication.json',
    'communication_matrix.json',
  ];
  // 名称取自 D:/Projects/msagent/data。顶层目录代表一次任务，不再代表某张卡；
  // 子项才是 rank。时间戳保留在真实路径里，展示名去掉时间戳并把 rank 放在最前，
  // 避免窄侧栏里同一节点的多个采集目录无法区分。
  const TASK_CAPTURE_SOURCES = [
    ['eta_eager_l1', [
      '1640123b27bd_12093_20260110074326034_ascend_pt',
    ]],
    ['level2', [
      'rank_0_ascend_pt', 'rank_1_ascend_pt', 'rank_2_ascend_pt', 'rank_3_ascend_pt',
    ]],
    ['MultiProfLevel2MemoryUB_db', [
      'node1_2166651_20240619060505060_ascend_pt',
      'node1_2166652_20240619060505059_ascend_pt',
      'node1_2166653_20240619060505061_ascend_pt',
      'node1_2166654_20240619060505060_ascend_pt',
      'node1_2166655_20240619060505059_ascend_pt',
      'node1_2166656_20240619060505059_ascend_pt',
      'node1_2166657_20240619060505060_ascend_pt',
      'node1_2166658_20240619060505060_ascend_pt',
      'ubuntu2204_1660963_20240619060440181_ascend_pt',
      'ubuntu2204_1660964_20240619060440179_ascend_pt',
      'ubuntu2204_1660965_20240619060440181_ascend_pt',
      'ubuntu2204_1660966_20240619060440181_ascend_pt',
      'ubuntu2204_1660970_20240619060440179_ascend_pt',
      'ubuntu2204_1660971_20240619060440180_ascend_pt',
      'ubuntu2204_1660972_20240619060440181_ascend_pt',
      'ubuntu2204_1660973_20240619060440181_ascend_pt',
    ]],
    ['operator', []],
    ['profile_dir', [
      'ubuntu122_14296_20260120112328147_ascend_pt',
      'ubuntu122_14297_20260120112328150_ascend_pt',
      'ubuntu122_14298_20260120112328150_ascend_pt',
      'ubuntu122_14299_20260120112328147_ascend_pt',
      'localhost.localdomain_10699_20260120112415091_ascend_pt',
      'localhost.localdomain_10700_20260120112415091_ascend_pt',
      'localhost.localdomain_10701_20260120112415091_ascend_pt',
      'localhost.localdomain_10702_20260120112415090_ascend_pt',
    ]],
    ['verl', [
      '1/e2e/localhost.localdomain_214483_20260116064439460_ascend_pt',
    ]],
  ];

  function rankDisplayName(rank, source) {
    const leaf = source.split('/').pop();
    if (/^rank_\d+_ascend_pt$/.test(leaf)) return leaf.replace(/^rank_(\d+)/, 'rank$1');
    const compact = leaf
      .replace(/_\d{17}_ascend_pt$/, '_ascend_pt')
      .replace(/^localhost\.localdomain_/, 'localhost_');
    return 'rank' + rank + '_' + compact;
  }

  function makeRank(taskName, source, rank) {
    const rootDir = taskName + ' / ' + source.replace(/\//g, ' / ');
    return {
      name: rankDisplayName(rank, source),
      ref: 'rank' + rank,
      dir: rootDir + ' / ASCEND_PROFILER_OUTPUT',
      rootDir,
      files: RANK_FILES.concat(['profiler_info_' + rank + '.json', 'profiler_metadata.json']),
    };
  }

  const COMPARE_TASK_TYPES = {
    MultiProfLevel2MemoryUB_db: 'memory',
    operator: 'operator',
  };
  const PROF_TASKS = TASK_CAPTURE_SOURCES.map(([name, sources]) => ({
    name,
    dir: name,
    compareType: COMPARE_TASK_TYPES[name] || 'timeline',
    open: name === 'profile_dir',
    ranks: sources.map((source, rank) => makeRank(name, source, rank)),
  }));
  const selectedTask = PROF_TASKS.find((task) => task.name === 'profile_dir');
  const PROF_FOLDERS = selectedTask.ranks;
  const PROF_ROOT = { name: 'data', dir: 'data', tasks: PROF_TASKS };

  // 该文件在采集结果里的完整路径:profiler_info / profiler_metadata 落在 *_ascend_pt 根下,
  // 其余交付件都在 ASCEND_PROFILER_OUTPUT/ 里,两者的路径不一样,tooltip 和 # 列表都按这个给。
  const filePath = (folder, file) =>
    (/^profiler_(info|metadata)/.test(file) ? folder.rootDir : folder.dir) + ' / ' + file;

  // 对话框输入 # 时仍可引用当前 profile_dir 任务下的具体文件；文件不再占用左树层级。
  window.MSI_PROF_TREE = PROF_ROOT;
  window.MSI_CTX_FILES = PROF_FOLDERS.reduce((acc, folder) => {
    folder.files.forEach((file) => acc.push({
      name: folder.ref + '/' + file,
      path: filePath(folder, file),
    }));
    return acc;
  }, [{ name: selectedTask.name, path: selectedTask.dir + '（整个采集目录，8 卡）' }]);

  // 内容页挂在一级任务目录；二级 rank 仅展示采集构成，不再各自维护页面。
  let selected = { task: selectedTask };
  let compareMode = false;
  let compareTasks = [];
  let manageMode = false;
  const managedTasks = new Set();
  const managedRanks = new Set();
  const deletedTasks = new Set();
  const deletedRanks = new Set();
  const pinnedLaneIds = new Set();
  window.MSI_ANCHOR_NAME = selected.task.name;

  /* ══ 2. 确定性随机:同一个文件名永远画出同一张泳道图 ══════════════ */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  const nameHtml = (name) => '<span class="msi-tree-name" data-full-name="' + esc(name) + '">' + esc(name) + '</span>';

  function updateTreeNames() {
    const names = document.querySelectorAll('#msiTree .msi-tree-name');
    if (!names.length) return;
    const context = document.createElement('canvas').getContext('2d');
    names.forEach((element) => { element.textContent = element.dataset.fullName; });
    names.forEach((element) => {
      const fullName = element.dataset.fullName;
      const available = element.getBoundingClientRect().width - 2;
      context.font = getComputedStyle(element).font;
      const fits = (value) => context.measureText(value).width <= available;
      if (fits(fullName)) return;

      const chars = Array.from(fullName);
      const ellipsis = '…';
      let left = 1;
      let right = 1;
      if (!fits(chars[0] + ellipsis + chars[chars.length - 1])) {
        element.textContent = ellipsis;
        return;
      }
      while (left + right < chars.length) {
        const prefix = chars.slice(0, left).join('');
        const suffix = chars.slice(-right).join('');
        const addLeft = prefix + chars[left] + ellipsis + suffix;
        const addRight = prefix + ellipsis + chars[chars.length - right - 1] + suffix;
        const leftFits = fits(addLeft);
        const rightFits = fits(addRight);
        if (!leftFits && !rightFits) break;
        if (leftFits && (!rightFits || context.measureText(prefix).width <= context.measureText(suffix).width)) {
          left++;
        } else {
          right++;
        }
      }
      element.textContent = chars.slice(0, left).join('') + ellipsis + chars.slice(-right).join('');
    });
  }

  /* ══ 3. 左树渲染 ═════════════════════════════════════════════════ */
  const CARET = '<svg class="msi-tree-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>';
  const FILE_ICON = '<svg class="msi-tree-file-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v5h4"></path></svg>';
  const rankKey = (taskIndex, rankIndex) => taskIndex + ':' + rankIndex;
  const visibleRanks = (task, taskIndex) => task.ranks.map((_, index) => index)
    .filter((index) => !deletedRanks.has(rankKey(taskIndex, index)));

  function managementCheck(checked, mixed = false) {
    return '<span class="msi-tree-check" data-manage-check="1" role="checkbox"' +
      ' aria-checked="' + (mixed ? 'mixed' : String(checked)) + '"' +
      ' title="' + (mixed ? '部分采集项已选' : (checked ? '取消选择' : '选择删除项')) + '">' +
      (mixed ? '−' : (checked ? '✓' : '')) + '</span>';
  }

  function syncManageControls() {
    const button = document.getElementById('msiManageDelete');
    if (button) button.disabled = !managedTasks.size && !managedRanks.size;
    const selectAll = document.getElementById('msiManageSelectAll');
    if (!selectAll) return;
    const remaining = PROF_TASKS.map((_, index) => index).filter((index) => !deletedTasks.has(index));
    const allSelected = remaining.length > 0 && remaining.every((index) => managedTasks.has(index));
    selectAll.disabled = !remaining.length;
    selectAll.checked = allSelected;
    selectAll.indeterminate = !allSelected && (managedTasks.size > 0 || managedRanks.size > 0);
  }

  function renderTree() {
    const host = document.getElementById('msiTree');
    if (!host) return;
    host.classList.toggle('is-compare-mode', compareMode);
    host.classList.toggle('is-manage-mode', manageMode);
    const rows = [];
    const taskRow = (task, taskIndex) => {
      const checked = compareTasks.includes(task);
      const differentType = compareMode && compareTasks[0] &&
        task.compareType !== compareTasks[0].compareType;
      const disabled = !checked && (differentType || (compareMode && compareTasks.length >= 2));
      const on = selected.task === task;
      const roleIndex = compareTasks.indexOf(task);
      const roleName = roleIndex === 0 ? '基线' : (roleIndex === 1 ? '对比' : '');
      const ranks = visibleRanks(task, taskIndex);
      const selectedRanks = ranks.filter((index) => managedRanks.has(rankKey(taskIndex, index))).length;
      const manageCheck = manageMode
        ? managementCheck(managedTasks.has(taskIndex), selectedRanks > 0 && !managedTasks.has(taskIndex))
        : '';
      const check = compareMode
        ? '<span class="msi-tree-check" data-compare-check="1" role="checkbox"' +
            ' aria-checked="' + (checked ? 'true' : 'false') + '"' +
            ' aria-disabled="' + (disabled ? 'true' : 'false') + '"' +
            ' title="' + (differentType ? '非同类型任务，不支持对比' :
              (disabled ? '最多选择 2 个任务' : (checked ? '取消选择' : '选择任务'))) + '">' +
            (checked ? '✓' : '') +
          '</span>'
        : '';
      const role = compareMode && roleName
        ? '<span class="msi-tree-compare-role msi-tree-compare-role--' + (roleIndex === 0 ? 'baseline' : 'compare') + '"' +
            ' data-compare-swap="1" aria-disabled="' + (compareTasks.length < 2 ? 'true' : 'false') + '"' +
            ' title="' + (compareTasks.length < 2 ? roleName : '点击互换基线和对比') + '">' + roleName + '</span>'
        : '';
      return '<button class="msi-tree-row msi-tree-row--folder' + (on ? ' is-selected' : '') +
        (role ? ' has-compare-role' : '') + '" type="button" role="treeitem"' +
        ' data-task="' + taskIndex + '" aria-expanded="' + (task.open ? 'true' : 'false') + '"' +
        ' aria-selected="' + (on ? 'true' : 'false') + '" aria-label="' + esc(task.name) + '"' +
        ' title="' + esc(task.dir) + '">' +
          check + manageCheck + CARET +
          '<img class="msi-tree-mark" src="../../src/pic/icon/folder.svg" alt="">' +
          nameHtml(task.name) + role +
        '</button>';
    };
    const rankRow = (rank, taskIndex, rankIndex) =>
      '<button class="msi-tree-row msi-tree-row--folder msi-tree-row--d1" type="button" role="treeitem"' +
      ' data-task="' + taskIndex + '" data-rank="' + rankIndex + '"' +
      ' aria-selected="false" aria-label="' + esc(rank.name) + '"' +
      ' title="' + esc(rank.rootDir) + '">' +
        (manageMode ? managementCheck(managedTasks.has(taskIndex) || managedRanks.has(rankKey(taskIndex, rankIndex))) : '') +
        CARET.replace('msi-tree-caret', 'msi-tree-caret msi-tree-caret--placeholder') +
        FILE_ICON +
        nameHtml(rank.name) +
      '</button>';

    PROF_TASKS.forEach((task, ti) => {
      if (deletedTasks.has(ti)) return;
      rows.push(taskRow(task, ti));
      if (!task.open) return;
      task.ranks.forEach((rank, ri) => {
        if (deletedRanks.has(rankKey(ti, ri))) return;
        rows.push(rankRow(rank, ti, ri));
      });
    });
    host.innerHTML = rows.join('');
    updateTreeNames();
  }

  function initTree() {
    const host = document.getElementById('msiTree');
    if (!host) return;
    host.addEventListener('click', (e) => {
      const row = e.target.closest('.msi-tree-row');
      if (!row) return;
      const task = PROF_TASKS[Number(row.dataset.task)];
      if (!task) return;
      const manageCheck = e.target.closest('[data-manage-check]');
      if (manageMode && manageCheck) {
        if (row.dataset.rank === undefined) toggleManageTask(Number(row.dataset.task));
        else toggleManageRank(Number(row.dataset.task), Number(row.dataset.rank));
        return;
      }
      const role = e.target.closest('.msi-tree-compare-role');
      if (role) {
        if (role.getAttribute('aria-disabled') !== 'true') swapCompareRoles();
        return;
      }
      const check = e.target.closest('.msi-tree-check');
      if (check) {
        if (check.getAttribute('aria-disabled') !== 'true') toggleCompareTask(task);
        return;
      }
      if (row.dataset.rank === undefined) {
        if (compareMode || manageMode || e.target.closest('.msi-tree-caret')) {
          task.open = !task.open;
          renderTree();
        } else {
          selectTask(task);
        }
        return;
      }
      // 二级 rank 只展示任务包含的采集项，不再切换内容页面。
    });
    renderTree();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(updateTreeNames).observe(host);
    } else {
      window.addEventListener('resize', updateTreeNames);
    }
    document.fonts?.ready.then(updateTreeNames);
  }

  function toggleManageTask(taskIndex) {
    if (managedTasks.has(taskIndex)) managedTasks.delete(taskIndex);
    else {
      managedTasks.add(taskIndex);
      visibleRanks(PROF_TASKS[taskIndex], taskIndex).forEach((index) => managedRanks.delete(rankKey(taskIndex, index)));
    }
    renderTree();
    syncManageControls();
  }

  function toggleManageRank(taskIndex, rankIndex) {
    const key = rankKey(taskIndex, rankIndex);
    const ranks = visibleRanks(PROF_TASKS[taskIndex], taskIndex);
    if (managedTasks.delete(taskIndex)) {
      ranks.forEach((index) => { if (index !== rankIndex) managedRanks.add(rankKey(taskIndex, index)); });
    } else if (managedRanks.has(key)) managedRanks.delete(key);
    else managedRanks.add(key);
    renderTree();
    syncManageControls();
  }

  function toggleManageAll(checked) {
    if (!manageMode) return;
    managedTasks.clear();
    managedRanks.clear();
    if (checked) PROF_TASKS.forEach((_, index) => {
      if (!deletedTasks.has(index)) managedTasks.add(index);
    });
    renderTree();
    syncManageControls();
  }

  function setManageMode(active) {
    manageMode = active;
    managedTasks.clear();
    managedRanks.clear();
    document.querySelectorAll('#msiSideToolbar .msi-side-normal-action').forEach((el) => { el.hidden = active; });
    const back = document.getElementById('msiCompareBack');
    if (back) {
      back.hidden = !active;
      back.title = active ? '退出管理' : '退出对比';
      back.setAttribute('aria-label', back.title);
    }
    const heading = document.getElementById('msiCompareHeading');
    if (heading) {
      heading.hidden = !active;
      heading.textContent = active ? '管理' : '对比';
    }
    const selectAllLabel = document.getElementById('msiManageSelectAllLabel');
    if (selectAllLabel) selectAllLabel.hidden = !active;
    const deleteButton = document.getElementById('msiManageDelete');
    if (deleteButton) deleteButton.hidden = !active;
    syncManageControls();
    renderTree();
  }

  function deleteManagedItems() {
    if (!manageMode || (!managedTasks.size && !managedRanks.size)) return;
    managedTasks.forEach((index) => deletedTasks.add(index));
    managedRanks.forEach((key) => deletedRanks.add(key));
    managedTasks.clear();
    managedRanks.clear();
    syncManageControls();
    const nextTask = PROF_TASKS.find((_, index) => !deletedTasks.has(index));
    if (deletedTasks.has(PROF_TASKS.indexOf(selected.task))) {
      if (nextTask) selectTask(nextTask);
      else {
        renderTree();
        renderContentTitle();
        document.getElementById('contentCard')?.classList.add('has-no-tasks');
      }
    } else {
      renderTree();
      renderContentTitle();
    }
  }

  function selectTask(task) {
    if (!task || deletedTasks.has(PROF_TASKS.indexOf(task))) return;
    selected = { task };
    task.open = true;
    applySelection();
  }

  function renderContentTitle() {
    const title = document.getElementById('msiContentTitle');
    if (!title) return;
    if (PROF_TASKS.every((_, index) => deletedTasks.has(index))) {
      title.textContent = '暂无任务';
      return;
    }
    if (!compareMode) {
      const options = PROF_TASKS.map((task, taskIndex) => {
        if (deletedTasks.has(taskIndex)) return '';
        const current = task === selected.task;
        return '<button class="msi-title-picker-option' + (current ? ' is-current' : '') + '" type="button"' +
          ' role="option" aria-selected="' + (current ? 'true' : 'false') + '" data-title-task="' + taskIndex + '">' +
          '<span class="msi-title-picker-option-name">' + esc(task.name) + '</span>' +
          (current ? '<span class="msi-title-picker-option-check" aria-hidden="true">✓</span>' : '') +
        '</button>';
      }).join('');
      title.innerHTML = '<button class="msi-title-picker-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="msi-title-picker-name">' + esc(selected.task.name) + '</span>' +
          '<svg class="msi-title-picker-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"></path></svg>' +
        '</button>' +
        '<div class="msi-title-picker-menu" role="listbox" aria-label="切换任务目录" hidden>' + options + '</div>';
      return;
    }
    const tagItems = compareTasks.map((task, roleIndex) => {
      const taskIndex = PROF_TASKS.indexOf(task);
      const roleName = roleIndex === 0 ? '基线' : '对比';
      return '<span class="msi-compare-tag" title="' + esc(task.name) + '">' +
        '<span class="msi-compare-tag-name">' + esc(task.name + '（' + roleName + '）') + '</span>' +
        '<button class="msi-compare-tag-close" type="button" data-compare-remove="' + taskIndex + '"' +
        ' aria-label="取消选择 ' + esc(task.name) + '" title="取消选择">×</button>' +
      '</span>';
    });
    const swap = '<button class="msi-compare-swap" type="button" data-compare-swap="1"' +
      ' aria-label="互换基线和对比" title="互换基线和对比">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12"></path><path d="m15 4 3 3-3 3"></path>' +
      '<path d="M18 17H6"></path><path d="m9 14-3 3 3 3"></path></svg></button>';
    const tags = tagItems.length === 2 ? tagItems.join(swap) : tagItems.join('');
    title.innerHTML = '<span class="msi-content-title-label">任务对比</span>' +
      (tags ? '<span class="msi-compare-title-items">' + tags + '</span>' : '');
  }

  function toggleCompareTask(task) {
    if (!compareMode) return;
    const index = compareTasks.indexOf(task);
    if (index >= 0) compareTasks.splice(index, 1);
    else if (compareTasks.length < 2 &&
      (!compareTasks[0] || task.compareType === compareTasks[0].compareType)) compareTasks.push(task);
    pinnedLaneIds.clear();
    renderTree();
    renderContentTitle();
    refreshCompareSwimlanes();
  }

  function swapCompareRoles() {
    if (!compareMode || compareTasks.length < 2) return;
    compareTasks = [compareTasks[1], compareTasks[0]];
    renderTree();
    renderContentTitle();
    refreshCompareSwimlanes();
  }

  function setCompareMode(active) {
    compareMode = active;
    compareTasks = active ? [deletedTasks.has(PROF_TASKS.indexOf(selected.task))
      ? PROF_TASKS.find((_, index) => !deletedTasks.has(index))
      : selected.task].filter(Boolean) : [];
    pinnedLaneIds.clear();
    document.querySelectorAll('.msi-side-normal-action').forEach((el) => { el.hidden = active; });
    document.querySelectorAll('.msi-tab--normal-only').forEach((el) => { el.hidden = active; });
    const visibleActiveTab = document.querySelector('.msi-tab.is-active:not([hidden])');
    if (!visibleActiveTab) {
      activateAnalysisTab('timeline');
    }
    syncOverviewTabAvailability();
    const back = document.getElementById('msiCompareBack');
    if (back) back.hidden = !active;
    const heading = document.getElementById('msiCompareHeading');
    if (heading) heading.hidden = !active;
    renderTree();
    renderContentTitle();
    refreshCompareSwimlanes();
  }

  function refreshCompareSwimlanes() {
    selectedTraceTaskId = null;
    selectedPreviewBar = null;
    renderSelectionDetail();
    renderSwimlanes();
    syncTimelineControls();
  }

  function closeTitlePicker() {
    const title = document.getElementById('msiContentTitle');
    const toggle = title?.querySelector('.msi-title-picker-toggle');
    const menu = title?.querySelector('.msi-title-picker-menu');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  }

  function initCompareMode() {
    document.getElementById('msiCompareBtn')?.addEventListener('click', () => setCompareMode(true));
    document.getElementById('msiManageBtn')?.addEventListener('click', () => setManageMode(true));
    document.getElementById('msiManageSelectAll')?.addEventListener('change', (event) =>
      toggleManageAll(event.target.checked));
    document.getElementById('msiManageDelete')?.addEventListener('click', deleteManagedItems);
    document.getElementById('msiCompareBack')?.addEventListener('click', () => {
      if (manageMode) setManageMode(false);
      else setCompareMode(false);
    });
    document.getElementById('msiContentTitle')?.addEventListener('click', (e) => {
      const swap = e.target.closest('.msi-compare-swap');
      if (swap) {
        swapCompareRoles();
        return;
      }
      const close = e.target.closest('.msi-compare-tag-close');
      if (close) {
        const task = PROF_TASKS[Number(close.dataset.compareRemove)];
        if (task) toggleCompareTask(task);
        return;
      }
      const option = e.target.closest('.msi-title-picker-option');
      if (option) {
        closeTitlePicker();
        selectTask(PROF_TASKS[Number(option.dataset.titleTask)]);
        return;
      }
      const toggle = e.target.closest('.msi-title-picker-toggle');
      if (!toggle) return;
      const menu = toggle.parentElement.querySelector('.msi-title-picker-menu');
      const open = menu?.hidden !== false;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (menu) menu.hidden = !open;
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#msiContentTitle')) closeTitlePicker();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTitlePicker(); });
  }

  function initSidebarDrawer() {
    const frame = document.querySelector('.pto-ide-frame');
    const sidebar = document.getElementById('msiSidebar');
    const menu = document.getElementById('msiSidebarMenu');
    const fold = document.getElementById('msiSidebarFold');
    if (!frame || !sidebar || !menu || !fold) return;
    let closeTimer;
    const isCollapsed = () => frame.classList.contains('is-sidebar-collapsed');
    const clearCloseTimer = () => { window.clearTimeout(closeTimer); };
    const setDrawerOpen = (open) => {
      if (!isCollapsed()) return;
      clearCloseTimer();
      frame.classList.toggle('is-sidebar-drawer-open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? '固定工程树侧栏' : '展开工程树侧栏');
      menu.title = menu.getAttribute('aria-label');
      sidebar.setAttribute('aria-hidden', String(!open));
    };
    const scheduleClose = () => {
      clearCloseTimer();
      closeTimer = window.setTimeout(() => {
        if (menu.matches(':hover') || sidebar.matches(':hover')) return;
        if (sidebar.contains(document.activeElement)) menu.focus({ preventScroll: true });
        setDrawerOpen(false);
      }, 160);
    };
    const restore = () => {
      clearCloseTimer();
      frame.classList.remove('is-sidebar-collapsed', 'is-sidebar-drawer-open');
      sidebar.removeAttribute('aria-hidden');
      menu.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
      fold.title = '收起侧栏';
      fold.setAttribute('aria-label', fold.title);
      const focusTarget = fold.hidden ? sidebar.querySelector('button:not([hidden])') : fold;
      requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
    };
    fold.addEventListener('click', () => {
      if (isCollapsed()) {
        restore();
        return;
      }
      frame.classList.add('is-sidebar-collapsed');
      menu.hidden = false;
      fold.title = '固定工程树侧栏';
      fold.setAttribute('aria-label', fold.title);
      setDrawerOpen(false);
      menu.focus({ preventScroll: true });
    });
    menu.addEventListener('pointerenter', () => setDrawerOpen(true));
    menu.addEventListener('pointerleave', scheduleClose);
    sidebar.addEventListener('pointerenter', clearCloseTimer);
    sidebar.addEventListener('pointerleave', scheduleClose);
    sidebar.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!sidebar.contains(document.activeElement) && !menu.matches(':hover') &&
          !sidebar.matches(':hover')) setDrawerOpen(false);
      }, 0);
    });
    menu.addEventListener('click', restore);
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' || !isCollapsed()) return;
      event.preventDefault();
      setDrawerOpen(true);
      sidebar.querySelector('button:not([hidden])')?.focus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isCollapsed() ||
        !frame.classList.contains('is-sidebar-drawer-open')) return;
      setDrawerOpen(false);
      menu.focus({ preventScroll: true });
    });
  }

  // 选中一级任务后，内容区、标题下拉与对话锚点统一挂到该任务目录。
  function applySelection() {
    document.getElementById('contentCard')?.classList.remove('has-no-tasks');
    selected.task.open = true;
    renderTree();
    renderContentTitle();
    syncOverviewTabAvailability();
    window.MSI_ANCHOR_NAME = selected.task.name;
    const chipName = document.getElementById('trainChatAnchorName');
    if (chipName) chipName.textContent = selected.task.name;
    selectedTraceTaskId = null;
    clearTraceTaskFocus();
    renderSwimlanes();
    syncTimelineControls();
    requestAnimationFrame(() => {
      const host = document.getElementById('msiTree');
      const row = host?.querySelector('.msi-tree-row.is-selected');
      if (!host || !row) return;
      const hostRect = host.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      if (rowRect.top < hostRect.top || rowRect.bottom > hostRect.bottom) {
        host.scrollTo({ top: Math.max(0, host.scrollTop + rowRect.top - hostRect.top - host.clientHeight / 3), behavior: 'smooth' });
      }
    });
  }

  /* ══ 4. 泳道:泳道树(左列) + 轨道(右列) ═══════════════════════ */
  const ROW_H = 29;       // 普通泳道行高
  const AREA_H = 42;      // HBM 带宽曲线行高
  const DUR_MS = 1200; // 示意任务的完整时间范围始终不变
  const ZOOM_SCALES = [1, 1.5, 2, 3, 4, 6, 8];
  let zoomIdx = 0; // 默认完整时间范围刚好适配泳道宽度
  let autoHeightEnabled = false;
  let timelineToolStateDirty = false;
  let resetMouseTools = () => {};
  let boxTimeSelection = null;

  function clearBoxTimeSelection() {
    boxTimeSelection?.overlay.remove();
    boxTimeSelection = null;
    updateTimelineResetButton();
  }

  function clearBoxSelection() {
    document.querySelectorAll('#msiTimelineSwims .is-box-selected')
      .forEach((bar) => bar.classList.remove('is-box-selected'));
    clearBoxTimeSelection();
  }

  function updateBoxTimeSelection() {
    if (!boxTimeSelection) return;
    const { panel, overlay, start, end } = boxTimeSelection;
    const body = panel.querySelector('.msi-swim-body');
    const head = panel.querySelector('.msi-swim-head');
    const corner = panel.querySelector('.msi-swim-corner');
    const ruler = panel.querySelector('.msi-swim-ruler');
    if (!body || !head || !corner || !ruler || !body.clientWidth) return;
    const panelRect = panel.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const headRect = head.getBoundingClientRect();
    const width = Math.max(0, body.clientWidth - corner.offsetWidth);
    const left = start * ruler.clientWidth - body.scrollLeft;
    const right = end * ruler.clientWidth - body.scrollLeft;
    const clamp = (x) => Math.max(0, Math.min(width, x));
    Object.assign(overlay.style, {
      left: (bodyRect.left - panelRect.left + corner.offsetWidth) + 'px',
      top: (headRect.top - panelRect.top) + 'px',
      width: width + 'px',
      height: (bodyRect.bottom - headRect.top) + 'px',
    });
    overlay.style.setProperty('--msi-time-mask-top', headRect.height + 'px');
    const leftMask = overlay.querySelector('.msi-time-selection-mask--left');
    const rightMask = overlay.querySelector('.msi-time-selection-mask--right');
    leftMask.style.width = clamp(left) + 'px';
    rightMask.style.left = clamp(right) + 'px';
    rightMask.style.width = (width - clamp(right)) + 'px';
    [[overlay.querySelector('.msi-time-selection-line--start'), left],
     [overlay.querySelector('.msi-time-selection-line--end'), right]].forEach(([line, x]) => {
      line.hidden = x < 0 || x > width;
      line.style.left = x + 'px';
    });
  }

  function showBoxTimeSelection(panel, start, end) {
    const overlay = document.createElement('div');
    overlay.className = 'msi-time-selection-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="msi-time-selection-mask msi-time-selection-mask--left"></div>' +
      '<div class="msi-time-selection-mask msi-time-selection-mask--right"></div>' +
      '<div class="msi-time-selection-line msi-time-selection-line--start"></div>' +
      '<div class="msi-time-selection-line msi-time-selection-line--end"></div>';
    panel.appendChild(overlay);
    boxTimeSelection = { panel, overlay, start, end };
    updateBoxTimeSelection();
    updateTimelineResetButton();
  }

  // NPU Metrics 与任务条共用同一套主题色。面积图只保存基色；填充透明度和
  // 描边明度由 areaTrack 结合当前主题生成，避免深色主题继续使用浅色粉彩。
  const HBM_LANES = [
    { label: 'HBM 0 read/Bandwidth',  color: 'var(--msi-trace-05-bg)' },
    { label: 'HBM 1 read/Bandwidth',  color: 'var(--msi-trace-11-bg)' },
    { label: 'HBM 2 read/Bandwidth',  color: 'var(--msi-trace-03-bg)' },
    { label: 'HBM 0 write/Bandwidth', color: 'var(--msi-trace-07-bg)' },
    { label: 'HBM 1 write/Bandwidth', color: 'var(--msi-trace-15-bg)' },
    { label: 'HBM 2 write/Bandwidth', color: 'var(--msi-trace-04-bg)' },
  ];

  // 泳道树:group 行可折叠,leaf 行是真正画东西的那一行。
  // track 决定这一行右边画什么:dense=密集事件条、bars=算子任务条、area=带宽曲线、空=不画。
  function buildLanes() {
    return [
      { id: 'card-0', label: 'Card: 0 · rank0', group: true, open: true, children: [
        { id: 'proc', label: 'Process 3430895', group: true, open: true, children: [
          { id: 'thread-main', label: 'Thread 3430895', group: true, open: true, children: [
            { id: 'proc-py', label: 'PyTorch (CPU)', group: true, open: true, track: 'bars', children: [
              { id: 'acl', label: 'acl', group: true, open: true, children: [
                { id: 'proc-cann', label: 'runtime / CANN', track: 'bars' },
              ] },
            ] },
          ] },
          { id: 'thread-3433310', label: 'Thread 3433310', track: 'dense', density: .34, staticCollapsed: true },
          { id: 'thread-3433327', label: 'Thread 3433327', track: 'dense', density: .38, staticCollapsed: true },
          { id: 'thread-3433329', label: 'Thread 3433329', track: 'dense', density: .32, staticCollapsed: true },
        ] },
        { id: 'ahw', label: 'Ascend Hardware', group: true, open: true, children: [
          { id: 'stream-0', label: 'Stream 0', track: 'bars' },
          { id: 'stream-2', label: 'Stream 2', track: 'bars' },
          { id: 'stream-3', label: 'Stream 3', track: 'bars' },
          { id: 'stream-4', label: 'Stream 4', track: 'bars' },
          { id: 'stream-5', label: 'Stream 5', track: 'bars' },
          { id: 'stream-6', label: 'Stream 6', track: 'bars' },
          { id: 'stream-7', label: 'Stream 7', track: 'bars' },
        ] },
        { id: 'comm', label: 'Communication', group: true, open: true, children: [
          { id: 'comm-default', label: 'Default Group', group: true, open: false, track: 'dense', density: .55, children: [
            { id: 'comm-default-p0', label: 'Plane 0', track: 'dense', density: .35 },
            { id: 'comm-default-p1', label: 'Plane 1', track: 'dense', density: .35 },
            { id: 'comm-default-p2', label: 'Plane 2', track: 'dense', density: .35 },
            { id: 'comm-default-p3', label: 'Plane 3', track: 'dense', density: .35 },
          ] },
          { id: 'comm-pp', label: 'PP Group / hcom_batchSendRecv', group: true, open: false, track: 'bars', children: [
            { id: 'comm-pp-p0', label: 'Plane 0', track: 'dense', density: .5 },
            { id: 'comm-pp-p1', label: 'Plane 1', track: 'dense', density: .5 },
          ] },
          { id: 'comm-ar', label: 'DP Group / hcom_allReduce', group: true, open: false, track: 'bars', children: [
            { id: 'comm-dp-p0', label: 'Plane 0', track: 'dense', density: .52 },
            { id: 'comm-dp-p1', label: 'Plane 1', track: 'dense', density: .52 },
          ] },
          { id: 'comm-ag', label: 'Embedding Group / hcom_allGather', group: true, open: false, track: 'bars', children: [
            { id: 'comm-emb-p0', label: 'Plane 0', track: 'dense', density: .46 },
            { id: 'comm-emb-p1', label: 'Plane 1', track: 'dense', density: .46 },
          ] },
        ] },
        { id: 'ovl', label: 'Overlap Analysis', group: true, open: true, children: [
          { id: 'ovl-c', label: 'Computing', track: 'bars' },
          { id: 'ovl-comm', label: 'Communication', track: 'bars' },
          { id: 'ovl-nc', label: 'Communication (Not Overlapped)', track: 'bars' },
          { id: 'ovl-free', label: 'Free', track: 'bars' },
        ] },
        { id: 'npu-metrics', label: 'NPU Metrics', group: true, open: true, children: [
          { id: 'hbm', label: 'HBM', group: true, open: true, children: HBM_LANES.slice(0, 4).map((h, i) => (
            { id: 'hbm-' + i, label: h.label, track: 'area', area: h }
          )) },
          { id: 'acc-pmu', label: 'ACC PMU', group: true, open: true, children: [0, 1, 2, 3].map((i) => ({
            id: 'acc-' + i, label: 'Accelerator ' + i + ' / readBandwidth', track: 'area',
            area: { color: ['var(--msi-trace-05-bg)', 'var(--msi-trace-11-bg)', 'var(--msi-trace-03-bg)', 'var(--msi-trace-07-bg)'][i] },
          })) },
          { id: 'qos', label: 'QOS', group: true, open: true, children: [
            { id: 'qos-0', label: 'QoS 0: OTHERS / Bandwidth', track: 'area', area: { color: 'var(--msi-trace-03-bg)' } },
            { id: 'qos-1', label: 'QoS 1: AIC_DAT_QOS / Bandwidth', track: 'area', area: { color: 'var(--msi-trace-15-bg)' } },
          ] },
          { id: 'freq', label: 'AI Core Freq', group: true, open: true, children: [
            { id: 'freq-c', label: 'AI Core Freq (MHz)', track: 'area', area: { color: 'var(--msi-trace-04-bg)' } },
          ] },
        ] },
      ] },
      { id: 'card-1', label: 'Card: 1', group: true, open: false, track: 'dense', density: .48, children: [] },
      { id: 'card-2', label: 'Card: 2', group: true, open: false, track: 'dense', density: .48, children: [] },
      { id: 'card-3', label: 'Card: 3', group: true, open: false, track: 'dense', density: .48, children: [] },
    ];
  }

  let LANES = buildLanes();
  const DEFAULT_LANE_OPEN = new Map();
  function rememberDefaultLaneState(nodes) {
    nodes.forEach((lane) => {
      if (lane.group) DEFAULT_LANE_OPEN.set(lane.id, lane.open);
      if (lane.children) rememberDefaultLaneState(lane.children);
    });
  }
  rememberDefaultLaneState(LANES);
  function findLane(laneId, nodes = LANES) {
    for (const lane of nodes) {
      if (lane.id === laneId) return lane;
      const found = lane.children && findLane(laneId, lane.children);
      if (found) return found;
    }
    return null;
  }
  function openLanePath(laneId, nodes = LANES) {
    for (const lane of nodes) {
      if (lane.id === laneId) return true;
      if (lane.children && openLanePath(laneId, lane.children)) {
        lane.open = true;
        return true;
      }
    }
    return false;
  }
  // 找不到时子树必须返回 null 而不是 []:空数组是真值,以前第一棵子树没找到就把 [] 当结果
  // 一路返回上去,搜索到 PyTorch 那一支就停了,Stream / Communication / Overlap 全都查不到,
  // 调用链上的路径只好回退成 stream-2 这种裸 id,看着像缩写。对外仍保证返回数组。
  function lanePath(laneId, nodes = LANES, parents = []) {
    const walk = (list, chain) => {
      for (const lane of list) {
        const path = chain.concat(lane);
        if (lane.id === laneId) return path;
        const found = lane.children && walk(lane.children, path);
        if (found) return found;
      }
      return null;
    };
    return walk(nodes, parents) || [];
  }
  // 当前选中的泳道行,点任意一行切换;真实样例的 Device 任务集中在 Stream 2。
  const DEFAULT_SELECTED_LANE_ID = 'stream-2';
  let selectedLaneId = DEFAULT_SELECTED_LANE_ID;

  /* 从 rank_0/trace_view.json 的 ProfilerStep#13 起始窗口抽取。
     每行依次是：序号、Python 算子及时间、CANN launch 时间、Device 算子及时间、
     Device Task Id、两端共享的 connection_id、Task Type。时间单位均为 ms，
     以 ProfilerStep#13 起点为 0 点。 */
  const TRACE_WINDOW_MS = 810.63277;
  const TRACE_DISPATCH_ROWS = [
    [22, 'aclnnMatmul', 5.64939, .01121, 5.66864, .01271, 'aclnnMatmul_MatMulV3Common_MatMulV3', 5.66364, .1704, 34493, 33389, 'AI_CORE'],
  ];
  const REAL_TRACE_TASKS = [];
  const REAL_TRACE_EDGES = [];
  TRACE_DISPATCH_ROWS.forEach((r) => {
    const [n, pyName, pyStart, pyDur, cannStart, cannDur, devName, devStart, devDur, taskId, connectionId, taskType] = r;
    REAL_TRACE_TASKS.push(
      { id: 'py-' + n, laneId: 'proc-py', name: pyName, start: pyStart, dur: pyDur, kind: 'python' },
      { id: 'cann-' + n, laneId: 'proc-cann', name: 'Node@launch', start: cannStart, dur: cannDur, kind: 'cann', connectionId },
      { id: 'dev-' + n, laneId: 'stream-2', name: devName, start: devStart, dur: devDur, kind: 'device', taskId, connectionId, taskType },
    );
    REAL_TRACE_EDGES.push(
      { source: 'py-' + n, target: 'dev-' + n, type: 'operator' },
      { source: 'cann-' + n, target: 'dev-' + n, type: 'dispatch', connectionId },
    );
  });

  // 同一 ProfilerStep 内各泳道的真实采样。每条泳道保留 3–4 个代表事件，
  // 既避免 7.9 万条原始事件把单文件页面撑爆，也不会再出现大片空泳道。
  const TRACE_CONTEXT_ROWS = [
    // Stream 0 在该 step 只有 metadata、没有 X 任务；用四段明确标注的 Idle 区间保留其结构位置。
    ['stream-0', 's0-a', 'Idle', 42, 36, 'idle', null, null, 'NO_DEVICE_TASK'],
    ['stream-0', 's0-b', 'Idle', 212, 48, 'idle', null, null, 'NO_DEVICE_TASK'],
    ['stream-0', 's0-c', 'Idle', 438, 42, 'idle', null, null, 'NO_DEVICE_TASK'],
    ['stream-0', 's0-d', 'Idle', 684, 54, 'idle', null, null, 'NO_DEVICE_TASK'],
    ['proc-py', 'py-hccl-b', 'HcclBatchSendRecv', 154.95459, .00464, 'python', null, null, 'cpu_op'],
    ['proc-py', 'py-hccl-c', 'HcclBatchSendRecv', 393.32875, .00637, 'python', null, null, 'cpu_op'],
    ['proc-cann', 'cann-hccl-a', 'AscendCL@hcom_batchSendRecv_', 74.02418, .36001, 'cann', null, 38717, 'HOST_HCCL'],
    ['proc-cann', 'cann-hccl-b', 'AscendCL@hcom_batchSendRecv_', 154.97541, .36031, 'cann', null, 44237, 'HOST_HCCL'],
    ['proc-cann', 'cann-hccl-c', 'AscendCL@hcom_batchSendRecv_', 393.357, .3941, 'cann', null, 48893, 'HOST_HCCL'],
    ['stream-2', 's2-b', 'aclnnFlashAttentionScore_FlashAttentionScore_FlashAttentionScore', 141.732, .88876, 'device', 35336, 43395, 'MIX_AIC'],
    ['stream-2', 's2-c', 'aclnnCast_CastAiCore_Cast', 596.2, .00114, 'device', 36198, 51193, 'AI_VECTOR_CORE'],
    ['stream-2', 's2-d', 'aclnnNonzeroV2_NonzeroAiCore_NonZero', 810.2255, .00292, 'device', 37060, 58261, 'MIX_AIV'],
    ['stream-3', 's3-a', 'EVENT_WAIT', 9.998, .82168, 'device', 758, 33750, 'EVENT_WAIT'],
    ['stream-3', 's3-b', 'EVENT_WAIT', 104.68, .82012, 'device', 776, 40720, 'EVENT_WAIT'],
    ['stream-3', 's3-c', 'EVENT_WAIT', 361.845, 2.18046, 'device', 794, 47022, 'EVENT_WAIT'],
    ['stream-3', 's3-d', 'EVENT_WAIT', 634.501, 2.2007, 'device', 813, 53303, 'EVENT_WAIT'],
    ['stream-4', 's4-a', 'EVENT_WAIT', 742.51425, .00002, 'device', 276, 55229, 'EVENT_WAIT'],
    ['stream-4', 's4-b', 'Notify Wait', 796.8335, .36812, 'device', 281, 57341, 'Notify Wait'],
    ['stream-4', 's4-c', 'Notify Wait', 798.39, .00496, 'device', 285, 57394, 'Notify Wait'],
    ['stream-4', 's4-d', 'EVENT_RECORD', 800.158, .00002, 'device', 291, 57485, 'EVENT_RECORD'],
    ['stream-5', 's5-a', 'EVENT_WAIT', 676.8975, 19.57748, 'device', 83, 53761, 'EVENT_WAIT'],
    ['stream-5', 's5-b', 'SDMA', 710.478, .38128, 'device', 85, 53764, 'SDMA'],
    ['stream-5', 's5-c', 'Notify Wait', 724.65425, .00364, 'device', 86, 53764, 'Notify Wait'],
    ['stream-5', 's5-d', 'EVENT_RECORD', 731.10175, .00002, 'device', 88, 53824, 'EVENT_RECORD'],
    ['stream-6', 's6-a', 'EVENT_WAIT', 3.41175, .00002, 'device', 156, 33226, 'EVENT_WAIT'],
    ['stream-6', 's6-b', 'EVENT_WAIT', 3.69175, .0039, 'device', 159, 33268, 'EVENT_WAIT'],
    ['stream-6', 's6-c', 'EVENT_WAIT', 76.40675, .00002, 'device', 162, 38811, 'EVENT_WAIT'],
    ['stream-6', 's6-d', 'EVENT_RECORD', 77.09725, .00002, 'device', 167, 38878, 'EVENT_RECORD'],
    // connection_id 38718 的硬件通信任务在原始 trace 中展开为 SDMA/Notify；
    // 泳道交互按产品语义聚合成用户指定的 AI_CORE 中间节点。
    ['stream-7', 'pp-ai-core', 'AI_CORE', 74.311, .43614, 'device', 157, 38718, 'AI_CORE'],
    ['stream-7', 's7-b', 'SDMA', 155.2665, .0006, 'device', 161, 44238, 'SDMA'],
    ['stream-7', 's7-c', 'EVENT_RECORD', 313.821, .00002, 'device', 162, 44266, 'EVENT_RECORD'],
    ['stream-7', 's7-d', 'EVENT_RECORD', 552.00425, .00002, 'device', 166, 48918, 'EVENT_RECORD'],
    ['stream-8', 's8-a', 'EVENT_WAIT', 645.889, 2.32398, 'device', 299, 53584, 'EVENT_WAIT'],
    ['stream-8', 's8-b', 'EVENT_RECORD', 674.52475, .00002, 'device', 305, 53650, 'EVENT_RECORD'],
    ['stream-8', 's8-c', 'Notify Wait', 770.05, .00002, 'device', 313, 57097, 'Notify Wait'],
    ['stream-8', 's8-d', 'EVENT_RECORD', 790.17775, .00002, 'device', 320, 57175, 'EVENT_RECORD'],
    ['stream-9', 's9-a', 'EVENT_WAIT', 790.48925, .00002, 'device', 156, 57190, 'EVENT_WAIT'],
    ['stream-9', 's9-b', 'EVENT_RECORD', 793.84425, .00002, 'device', 159, 57213, 'EVENT_RECORD'],
    ['stream-9', 's9-c', 'EVENT_RECORD', 794.571, .00002, 'device', 162, 57254, 'EVENT_RECORD'],
    ['stream-9', 's9-d', 'EVENT_RECORD', 796.19, .00002, 'device', 167, 57307, 'EVENT_RECORD'],
    ['comm-pp', 'comm-pp-a', 'hcom_batchSendRecv', 74.311, .43614, 'communication', null, 38718, 'PAIRWISE'],
    ['comm-pp', 'comm-pp-b', 'hcom_batchSendRecv__128_4_1', 155.2665, 158.55328, 'communication', null, 44238, 'PAIRWISE'],
    ['comm-pp', 'comm-pp-c', 'hcom_batchSendRecv__128_5_1', 397.11425, 154.88838, 'communication', null, 48894, 'PAIRWISE'],
    ['comm-ar', 'comm-ar-a', 'hcom_allReduce__170_1_1', 696.47675, 34.62392, 'communication', null, 53764, 'RING'],
    ['comm-ar', 'comm-ar-b', 'hcom_allReduce__612_4_1', 742.913, .82084, 'communication', null, 55232, 'RING'],
    ['comm-ar', 'comm-ar-c', 'hcom_allReduce__346_3_1', 790.71675, 3.12578, 'communication', null, 57196, 'RING'],
    ['comm-ar', 'comm-ar-d', 'hcom_allReduce__612_6_1', 798.0305, .3655, 'communication', null, 57394, 'RING'],
    ['comm-ag', 'comm-ag-a', 'hcom_allGather__097_6_1', 769.65725, 12.0179, 'communication', null, 57097, 'RING'],
    ['comm-ag', 'comm-ag-b', 'hcom_allGather__097_7_1', 781.68, 8.4962, 'communication', null, 57144, 'RING'],
    ['comm-ag', 'comm-ag-c', 'hcom_allGather__612_7_1', 799.61525, .54158, 'communication', null, 57448, 'RING'],
    ['ovl-comm', 'ovl-comm-a', 'Communication', 74.311, .43614, 'overlap', null, null, 'Communication'],
    ['ovl-comm', 'ovl-comm-b', 'Communication', 155.2665, 158.55328, 'overlap', null, null, 'Communication'],
    ['ovl-comm', 'ovl-comm-c', 'Communication', 397.11425, 154.88838, 'overlap', null, null, 'Communication'],
    ['ovl-comm', 'ovl-comm-d', 'Communication', 648.2145, 26.30914, 'overlap', null, null, 'Communication'],
    ['ovl-nc', 'ovl-nc-a', 'Communication(Not Overlapped)', 74.311, .43614, 'overlap', null, null, 'Not Overlapped'],
    ['ovl-nc', 'ovl-nc-b', 'Communication(Not Overlapped)', 155.2665, 158.55328, 'overlap', null, null, 'Not Overlapped'],
    ['ovl-nc', 'ovl-nc-c', 'Communication(Not Overlapped)', 397.11425, 154.88838, 'overlap', null, null, 'Not Overlapped'],
    ['ovl-nc', 'ovl-nc-d', 'Communication(Not Overlapped)', 648.2145, 26.30914, 'overlap', null, null, 'Not Overlapped'],
    ['ovl-c', 'ovl-c-a', 'Computing', .20625, 1.89292, 'overlap', null, null, 'Computing'],
    ['ovl-c', 'ovl-c-b', 'Computing', 141.732, .88876, 'overlap', null, null, 'Computing'],
    ['ovl-c', 'ovl-c-c', 'Computing', 595.32225, .01824, 'overlap', null, null, 'Computing'],
    ['ovl-c', 'ovl-c-d', 'Computing', 810.2255, .00292, 'overlap', null, null, 'Computing'],
    ['ovl-free', 'ovl-free-a', 'Free', 2.099, 1.88118, 'overlap', null, null, 'Free'],
    ['ovl-free', 'ovl-free-b', 'Free', 143.5455, .2, 'overlap', null, null, 'Free'],
    ['ovl-free', 'ovl-free-c', 'Free', 595.624, .00004, 'overlap', null, null, 'Free'],
    ['ovl-free', 'ovl-free-d', 'Free', 810.20525, .0203, 'overlap', null, null, 'Free'],
  ];
  TRACE_CONTEXT_ROWS.forEach(([laneId, id, name, start, dur, kind, taskId, connectionId, taskType]) => {
    REAL_TRACE_TASKS.push({ id, laneId, name, start, dur, kind, taskId, connectionId, taskType });
  });
  REAL_TRACE_TASKS.push(
    { id: 'py-hcclbatchsendrecv', laneId: 'proc-py', name: 'hcclbatchsendrecv', start: 73.99492, dur: .00896, kind: 'python', connectionId: 38718 },
  );
  REAL_TRACE_EDGES.push(
    { source: 'py-hcclbatchsendrecv', target: 'pp-ai-core', type: 'dispatch', connectionId: 38718 },
    { source: 'pp-ai-core', target: 'comm-pp-a', type: 'communication', connectionId: 38718 },
  );

  // 原始 trace 只有一部分事件带完整 flow。其余任务按时间与泳道关系构造稳定的推断链：
  // 每条边优先满足“上游结束 <= 下游开始”，并避免同泳道自连。推断结果由数据排序决定，
  // 因此刷新后不会变化；显式 PP 链保持独立，不会被推断边污染。
  function addInferredTraceEdges() {
    const occupied = new Set(REAL_TRACE_EDGES.flatMap((edge) => [edge.source, edge.target]));
    const pool = REAL_TRACE_TASKS
      .filter((task) => !occupied.has(task.id))
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

    while (pool.length) {
      const chain = [pool.shift()];
      while (chain.length < 4 && pool.length) {
        const prev = chain[chain.length - 1];
        const prevEnd = prev.start + prev.dur;
        let index = pool.findIndex((task) => task.laneId !== prev.laneId && task.start + 1e-9 >= prevEnd);
        if (index < 0) break;
        const next = pool.splice(index, 1)[0];
        REAL_TRACE_EDGES.push({ source: prev.id, target: next.id, type: 'inferred', inferred: true });
        chain.push(next);
      }

      // 时间窗末尾偶尔只剩一条：把它接到最近且已完成的异泳道上游，确保也可查看关系。
      if (chain.length === 1) {
        const target = chain[0];
        const upstream = REAL_TRACE_TASKS
          .filter((task) => !occupied.has(task.id) && task.id !== target.id && task.laneId !== target.laneId && task.start + task.dur <= target.start + 1e-9)
          .sort((a, b) => (b.start + b.dur) - (a.start + a.dur))[0];
        if (upstream) REAL_TRACE_EDGES.push({ source: upstream.id, target: target.id, type: 'inferred', inferred: true });
      }
    }
  }
  addInferredTraceEdges();
  const REAL_TRACE_TASK_BY_ID = Object.fromEntries(REAL_TRACE_TASKS.map((t) => [t.id, t]));
  const isRealTraceSelection = (task = (compareMode ? compareTasks[0] : selected.task)) => task?.name === 'profile_dir';
  const traceSwimBody = () => document.getElementById(
    compareMode && compareTasks[1] && isRealTraceSelection(compareTasks[1]) ? 'msiSwimBodyCompare' : 'msiSwimBody'
  );

  // 算子任务条的配色:浅底 + 同色系深字,浅色/深色主题下都读得出来。
  const BAR_COLORS = [
    { bg: '#dbc8f7', fg: '#563a86' },
    { bg: '#fbc3e0', fg: '#8a3d66' },
    { bg: '#c0e6c7', fg: '#2c6a3d' },
    { bg: '#c5d9fb', fg: '#2c5296' },
    { bg: '#ffdab0', fg: '#875320' },
    { bg: '#b9f0e3', fg: '#226d5c' },
  ];
  // 宽条上写得下名字的那些:同步段和大算子,对应截图里的 EVENT_WAIT / AI_CORE / Notify Wait
  const WIDE_NAMES = [
    'AI_CORE', 'Notify Wait', 'EVENT_WAIT', 'AI_VECTOR_CORE',
    'aclnnMatmul_MatMulV3Common_MatMulV3', 'aclnnMatmul_MatMulV3',
    'SwiGlu', 'RmsNorm', 'FlashAttentionScore', 'aclnnAdd_AddAiCore_Add',
  ];

  /* —— 三种轨道画法 —— */

  // 密集事件条:折叠的分组行用它概括下面那一堆事件。折叠态只是「这里有东西」的提示,
  // 不承担分辨事件类型的职责,所以统一一个极淡的底色(见 .msi-dense-bar),不再逐条上色;
  // 形状上仍然成团——团内细条只留 1px 缝连成一片,团与团之间才留白。参考 src/pic/截图.png。
  const DENSE_EVENT_COLORS = ['#d9cdf5', '#c5d9fb', '#c0e6c7', '#f7d8b5', '#b9f0e3', '#fbc3e0'];
  function denseTrack(rnd, density, colorful = false) {
    const W = 1000, H = ROW_H, Y = 4, BH = H - 8;
    const rect = (x, w, fill) => '<rect class="msi-dense-bar" x="' + x.toFixed(1) + '" y="' + Y +
      '" width="' + Math.max(0.6, w).toFixed(1) + '" height="' + BH + '"' +
      (fill ? ' style="fill:' + fill + '"' : '') + '></rect>';

    let out = '';
    let x = rnd() * 25;
    let colorIndex = Math.floor(rnd() * DENSE_EVENT_COLORS.length);
    while (x < W) {
      // 每一簇视作一个事件族。展开的可见泳道逐簇换色；折叠分组仍使用统一灰色概览。
      const fill = colorful ? DENSE_EVENT_COLORS[colorIndex] : '';
      colorIndex = (colorIndex + 1 + Math.floor(rnd() * (DENSE_EVENT_COLORS.length - 1))) % DENSE_EVENT_COLORS.length;
      if (rnd() < 0.14 + density * 0.14) {
        // 一根宽的同步段
        const w = Math.min(30 + rnd() * 120 * density, W - x);
        out += rect(x, w, fill);
        x += w;
      } else {
        // 一团细条:团内只留 1px 缝,团外才是真空白
        const end = Math.min(W, x + (28 + rnd() * 130) * (0.5 + density));
        while (x < end) {
          const w = Math.min(2 + rnd() * 4, end - x);
          out += rect(x, w, fill);
          x += w + 1;
        }
      }
      x += 8 + rnd() * 130 * (1 - density);
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + out + '</svg>';
  }

  // 算子任务条:HTML 绝对定位(不是 SVG),条上的算子名才不会被横向拉伸变形。
  function barsTrack(rnd, lane) {
    let previousName = null;
    let previousColorIndex = -1;
    let barIndex = 0;
    const pick = (name) => {
      let index = Math.floor(rnd() * BAR_COLORS.length);
      if (previousName !== null && previousName !== name && index === previousColorIndex) {
        index = (index + 1) % BAR_COLORS.length;
      }
      previousName = name;
      previousColorIndex = index;
      return BAR_COLORS[index];
    };
    const bar = (x, w, text, tip) => {
      const ms = (w * DUR_MS / 100).toFixed(2);
      const name = tip || text || 'kernel';
      const c = pick(name);
      return '<span class="msi-bar' + (text ? '' : ' msi-bar--tick') + '" style="left:' + x.toFixed(2) +
        '%;width:' + w.toFixed(2) + '%;background:' + c.bg + ';color:' + c.fg + '"' +
        ' data-preview-id="' + lane.id + '-' + barIndex++ + '"' +
        ' data-op="' + esc(name) + '" data-dur="' + ms + '"' +
        // 保留完整名称，初始没有文字的窄条也能在缩放后补上标签。
        ' data-label="' + esc(name) + '"' +
        ' title="' + esc(name) + ' · ' + ms + 'ms">' + (text ? esc(text) : '') + '</span>';
    };

    let html = '';
    let x = rnd() * 3;
    while (x < 99) {
      if (rnd() < 0.3) {
        // 初始窄条先不写字，放大后的文字由 fitBarLabels 补上。
        const w = Math.min(5 + rnd() * 17, 99 - x);
        if (w < 0.5) break;
        const name = WIDE_NAMES[Math.floor(rnd() * WIDE_NAMES.length)];
        html += bar(x, w, w < 4.5 ? '' : name, name);
        x += w;
      } else {
        // 一团细条:按固定小间隙背靠背排
        const end = Math.min(99, x + 3 + rnd() * 15);
        while (x < end) {
          const w = Math.min(0.3 + rnd() * 0.7, end - x);
          html += bar(x, w, '', '');
          x += w + 0.1;
        }
      }
      // 团与团之间的空白。整体比上一版稀一半,但**稀在团之间**:间隔取双峰分布——
      // 多数是中等间隔,三成概率来一段长空白,于是形成「一团一团 + 大片留白」,
      // 而不是把每根条都均匀拉开(那样只会变成一片稀疏的栅栏,团簇感就没了)。
      x += rnd() < 0.35 ? 14 + rnd() * 30 : 4 + rnd() * 11;
    }
    return html;
  }

  // 主时间线与报告嵌入图共用同一算子名哈希和 18 色映射。
  const TRACE_TASK_COLOR_BY_ID = new Map();
  function traceTaskColor(task) {
    if (!TRACE_TASK_COLOR_BY_ID.has(task.id)) {
      TRACE_TASK_COLOR_BY_ID.set(task.id, window.MsiTraceColors.colorForName(task.name));
    }
    return TRACE_TASK_COLOR_BY_ID.get(task.id);
  }
  function realTraceTrack(lane) {
    return REAL_TRACE_TASKS.filter((task) => task.laneId === lane.id)
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).map((task) => {
      const c = traceTaskColor(task);
      const left = task.start / TRACE_WINDOW_MS * 100;
      const trueWidth = task.dur / TRACE_WINDOW_MS * 100;
      const width = Math.max(.62, trueWidth); // 微秒级 launch 也要保留可点击宽度
      const meta = task.kind === 'device'
        ? ' · Task ' + task.taskId + ' · connection_id ' + task.connectionId + ' · ' + task.taskType
        : (task.connectionId ? ' · connection_id ' + task.connectionId : '');
      return '<span class="msi-bar" style="left:' + left.toFixed(3) + '%;width:' + width.toFixed(3) +
        '%;background:' + c.bg + ';color:' + c.fg + '" data-task-id="' + task.id +
        '" data-op="' + esc(task.name) + '" data-dur="' + task.dur.toFixed(5) +
        '" data-label="' + esc(task.name) + '" title="' + esc(task.name + ' · ' +
        task.start.toFixed(5) + 'ms · ' + task.dur.toFixed(5) + 'ms' + meta) + '">' +
        esc(task.name) + '</span>';
    }).join('');
  }

  // 带宽曲线:随机游走 + 几个峰,画成填色面积图。
  function areaTrack(rnd, area) {
    const W = 1000, H = AREA_H, N = 150;
    const fill = 'color-mix(in srgb, ' + area.color + ' var(--msi-metric-fill-strength), transparent)';
    const stroke = 'color-mix(in srgb, ' + area.color + ' var(--msi-metric-stroke-strength), var(--foreground))';
    const pts = [];
    let v = 0.35 + rnd() * 0.2;
    const peaks = [0.12 + rnd() * 0.15, 0.4 + rnd() * 0.15, 0.7 + rnd() * 0.2];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      v += (rnd() - 0.5) * 0.13;
      // 叠几个高斯包,让曲线有明显的波峰而不是纯噪声
      let bump = 0;
      peaks.forEach((p, k) => { bump += (0.25 + k * 0.05) * Math.exp(-Math.pow((t - p) / 0.07, 2)); });
      const y = Math.max(0.06, Math.min(0.96, v * 0.6 + bump));
      pts.push([t * W, H - 3 - y * (H - 8)]);
    }
    let d = 'M0,' + H + ' L' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (let i = 1; i < pts.length; i++) d += ' L' + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1);
    d += ' L' + W + ',' + H + ' Z';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
             '<path d="' + d + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"></path>' +
           '</svg>';
  }

  function trackHtml(lane, rnd, task) {
    // 展开的分组行不画东西:那条密集带只是折叠态下用来概括子行的,展开后子行各画各的,
    // 再留着就成了一条没有含义的占位灰带。
    if (isRealTraceSelection(task) && REAL_TRACE_TASKS.some((event) => event.laneId === lane.id)) {
      return realTraceTrack(lane);
    }
    if (lane.group && lane.open) return '';
    if (isRealTraceSelection(task)) {
      // 指标泳道保留曲线；折叠分组保留概览带，避免内容区出现大片空白。
      if (lane.track === 'area') return areaTrack(rnd, lane.area);
      if (lane.track === 'dense') return denseTrack(rnd, lane.density || 0.5, !lane.group && !lane.staticCollapsed);
      return '';
    }
    if (lane.track === 'dense') return denseTrack(rnd, lane.density || 0.5, !lane.group && !lane.staticCollapsed);
    if (lane.track === 'bars') return barsTrack(rnd, lane);
    if (lane.track === 'area') return areaTrack(rnd, lane.area);
    return '';
  }

  function laneRow(lane, depth, rnd, task) {
    const h = lane.track === 'area' ? AREA_H : ROW_H;
    // 箭头单独做成按钮:点箭头只管折叠/展开,点行内其它地方是「选中这条泳道」。
    // 两个动作分开,才不会一点标题就把整组收起来。
    const caret = lane.group
      ? '<button class="msi-lane-caret-btn" type="button" data-toggle="' + lane.id +
        '" aria-expanded="' + (lane.open ? 'true' : 'false') + '" aria-label="展开或收起">' +
          '<svg class="msi-lane-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>' +
        '</button>'
      : (lane.staticCollapsed
        ? '<span class="msi-lane-caret-static" aria-label="已折叠的线程概览" title="已折叠的线程概览">' +
            '<svg class="msi-lane-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>' +
          '</span>'
        : '<span class="msi-lane-caret-slot" aria-hidden="true"></span>');
    return (
      '<div class="msi-lane-row' + (lane.id === selectedLaneId ? ' is-selected' : '') +
        '" data-lane="' + lane.id + '" style="height:' + h + 'px">' +
        '<div class="msi-lane-label" style="padding-left:' + (12 + depth * 18) + 'px"' +
        ' title="' + esc(lane.label) + '">' +
          caret +
          '<span class="msi-lane-text">' + esc(lane.label) + '</span>' +
        '</div>' +
        '<div class="msi-lane-track">' + trackHtml(lane, rnd, task) + '</div>' +
      '</div>'
    );
  }

  // 独立置顶卡片复用原图的行，并将两项任务的时间坐标映射到同一刻度。
  function pinnedLaneRows(upperBody, lowerBody) {
    if (!compareMode || !compareTasks[1] || !pinnedLaneIds.size) return [];
    const sharedSpan = pinnedTimeSpan();
    const pairs = [...pinnedLaneIds].map((laneId) => {
      const lane = findLane(laneId);
      if (!lane || lane.group || lane.children?.length) return null;
      const rows = [upperBody, lowerBody].map((body, taskIndex) => {
        const original = [...body.querySelectorAll('.msi-lane-row')]
          .find((row) => row.dataset.lane === laneId && !row.closest('.msi-pinned-card'));
        const fallback = document.createElement('div');
        if (!original) fallback.innerHTML = laneRow(lane, 0,
          mulberry32(hashSeed(compareTasks[taskIndex].name + lane.id)), compareTasks[taskIndex]);
        const clone = (original || fallback.firstElementChild)?.cloneNode(true);
        if (!clone) return '';
        clone.classList.remove('is-selected');
        clone.dataset.pinnedTaskIndex = String(taskIndex);
        const label = clone.querySelector('.msi-lane-label');
        label?.removeAttribute('style');
        const role = taskIndex === 0 ? '基线' : '对比';
        const taskName = compareTasks[taskIndex].name;
        if (label) label.title = role + '：' + taskName + ' / ' + lane.label;
        const name = clone.querySelector('.msi-lane-text');
        name.dataset.fullName = taskName + ' / ' + lane.label;
        name.innerHTML = '<span class="msi-tree-compare-role msi-tree-compare-role--' +
          (taskIndex === 0 ? 'baseline' : 'compare') + '">' +
          '<span class="msi-pinned-role-name">' + role + '：</span>' +
          '<span class="msi-pinned-task-name">' + esc(taskName) + '</span></span>' +
          '<span class="msi-pinned-lane-name"> / ' + esc(lane.label) + '</span>';
        const track = clone.querySelector('.msi-lane-track');
        if (track) {
          const domain = document.createElement('div');
          domain.className = 'msi-pinned-domain';
          domain.style.width = (taskTimeSpan(compareTasks[taskIndex]) / sharedSpan * 100) + '%';
          while (track.firstChild) domain.appendChild(track.firstChild);
          track.appendChild(domain);
        }
        clone.querySelectorAll('.msi-bar[data-preview-id]').forEach((bar) => {
          bar.dataset.previewId = 'pinned-' + taskIndex + '-' + bar.dataset.previewId;
        });
        return clone.outerHTML;
      });
      if (rows.some((row) => !row)) return null;
      return '<section class="msi-pinned-pair" aria-label="' + esc(lane.label) +
        ' 同名泳道对比">' + rows.join('') + '</section>';
    }).filter(Boolean);
    return pairs;
  }

  function ensurePinnedCard(stack, upper) {
    let card = document.getElementById('msiPinnedCard');
    if (card) return card;
    // 其它入口页也加载同一脚本；进入对比模式时使用相同的独立置顶区域。
    card = document.createElement('div');
    card.id = 'msiPinnedCard';
    card.className = 'msi-pinned-card';
    card.setAttribute('aria-label', '同名置顶');
    card.hidden = true;
    card.innerHTML = '<div class="msi-pinned-card-title"><span>同名置顶</span>' +
      '<button class="msi-pinned-remove" type="button" data-clear-pinned="1"' +
      ' aria-label="取消全部置顶" title="取消全部置顶">' +
      '<img src="../../src/pic/icon/close.svg" alt=""></button></div>' +
      '<div class="msi-swim-head msi-pinned-head">' +
        '<div class="msi-swim-corner"></div>' +
        '<div class="msi-swim-ruler" id="msiPinnedRuler" aria-label="同名泳道共用时间尺"></div>' +
        '<button class="msi-timeline-reset" id="msiPinnedTimelineReset" type="button"' +
        ' aria-label="复原时间线视图" title="复原视图" hidden>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.4-5.7M20 4v5h-5"></path></svg>' +
        '</button>' +
      '</div>' +
      '<div class="msi-swim-body msi-pinned-body" id="msiPinnedBody"></div>';
    stack.insertBefore(card, upper);
    return card;
  }

  /* ══ 任务条上的算子名:超长时中间省略 ═══════════════════════════════
     CSS 的 text-overflow 只会省尾巴,而条上的字是居中的 —— 溢出时头尾同时被切,
     "…nvFusion…" 这种两头都缺的样子最难认。改成头尾各留一截、中间用 … 顶掉:
     算子名的辨识度基本都在前缀(算子类别)和后缀(序号/精度)上,这两截留住就够认。
     只能靠 JS 量宽度,CSS 做不到中间省略。 */
  const ELLIPSIS = '…';
  let measureCtx = null;

  // 用 canvas 量而不是往 DOM 里塞一个探针元素:量一次不触发重排,二分时要量十几次
  function textWidth(str, font) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = font;
    return measureCtx.measureText(str).width;
  }

  // 二分"总共保留几个字",头 ceil(k/2) 尾 floor(k/2) —— 头比尾多留一个,
  // 因为读的时候先看到头,前缀多一个字对认算子更有用。
  function middleEllipsis(text, avail, font) {
    if (textWidth(text, font) <= avail) return text;
    if (textWidth(ELLIPSIS, font) > avail) return '';   // 连一个省略号都摆不下,索性空着
    let lo = 0, hi = text.length - 1, best = ELLIPSIS;
    while (lo <= hi) {
      const k = (lo + hi) >> 1;
      const head = text.slice(0, Math.ceil(k / 2));
      const tailLen = k - head.length;
      const str = head + ELLIPSIS + (tailLen ? text.slice(text.length - tailLen) : '');
      if (textWidth(str, font) <= avail) { best = str; lo = k + 1; } else { hi = k - 1; }
    }
    return best;
  }

  function fitBarLabels(body) {
    const bars = body.querySelectorAll('.msi-bar[data-label]');
    if (!bars.length) return;
    const cs = getComputedStyle(bars[0]);
    // canvas 的 font 简写里 line-height 可省;省掉免得 computed 值是 normal 时拼出非法字符串
    const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    // 先全部量完再统一写:量(读布局)和写交替会来回触发重排
    const jobs = [];
    bars.forEach((el) => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) jobs.push([el, w - pad]);   // 宽度为 0 = 面板收着还没布局,这轮跳过,等 RO 再来
    });
    jobs.forEach(([el, avail]) => {
      el.textContent = avail > 0 ? middleEllipsis(el.dataset.label, avail, font) : '';
    });
  }

  let selectedTraceTaskId = null;
  let selectedPreviewBar = null;

  function traceComponent(taskId) {
    const ids = new Set(taskId ? [taskId] : []);
    const edges = [];
    let grew = true;
    while (grew) {
      grew = false;
      REAL_TRACE_EDGES.forEach((edge) => {
        if (!ids.has(edge.source) && !ids.has(edge.target)) return;
        if (!edges.includes(edge)) edges.push(edge);
        if (!ids.has(edge.source)) { ids.add(edge.source); grew = true; }
        if (!ids.has(edge.target)) { ids.add(edge.target); grew = true; }
      });
    }
    return { ids, edges };
  }

  function orderedTraceComponent(taskId) {
    const component = traceComponent(taskId);
    const indegree = new Map([...component.ids].map((id) => [id, 0]));
    component.edges.forEach((edge) => indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1));
    const byTime = (a, b) => (REAL_TRACE_TASK_BY_ID[a]?.start || 0) - (REAL_TRACE_TASK_BY_ID[b]?.start || 0) || a.localeCompare(b);
    const ready = [...component.ids].filter((id) => !indegree.get(id)).sort(byTime);
    const ordered = [];
    while (ready.length) {
      const id = ready.shift();
      ordered.push(id);
      component.edges.filter((edge) => edge.source === id).forEach((edge) => {
        indegree.set(edge.target, indegree.get(edge.target) - 1);
        if (!indegree.get(edge.target)) { ready.push(edge.target); ready.sort(byTime); }
      });
    }
    [...component.ids].sort(byTime).forEach((id) => { if (!ordered.includes(id)) ordered.push(id); });
    return { ...component, ordered };
  }

  function taskLaneLabel(task) {
    const path = lanePath(task.laneId);
    if (!path.length) return task.laneId;
    if (task.kind === 'python') return 'PyTorch (CPU)';
    if (task.kind === 'cann') return 'PyTorch (CPU) / runtime / CANN';
    if (task.kind === 'device') return 'Ascend Hardware / ' + path[path.length - 1].label;
    if (task.kind === 'communication') return 'Communication / ' + path[path.length - 1].label.replace(' Group / ', ' / ');
    if (task.kind === 'overlap') return 'Overlap Analysis / ' + path[path.length - 1].label;
    return path.map((lane) => lane.label).join(' / ');
  }

  // 调用链节点上方的路径:不做任何缩写,从泳道树根到叶子逐级拼全。
  function taskLaneFullPath(task) {
    const path = lanePath(task.laneId);
    return path.length ? path.map((lane) => lane.label).join(' / ') : task.laneId;
  }

  function taskKindLabel(task) {
    return ({ python: 'CPU 接口', cann: 'CANN 下发', device: 'NPU 任务', communication: '通信任务', overlap: '分析区间', idle: '空闲区间' })[task.kind] || '任务';
  }

  function taskExplanation(task) {
    if (task.kind === 'python') return 'CPU 框架接口，发起算子或通信调用';
    if (task.kind === 'cann') return 'CANN Runtime 接收并下发设备任务';
    if (task.kind === 'device') return 'NPU Stream 上执行的硬件任务';
    if (task.kind === 'communication') return '通信平面执行对应 HCCL 任务';
    if (task.kind === 'overlap') return '计算与通信重叠分析区间';
    return '该时间段内的泳道任务';
  }

  function chainArrowHtml() {
    // 直线而不是 S 弯:线和箭头都压在 svg 的垂直中线(y=14)上,配合网格里 align-self: center,
    // 两端正好落在相邻任务条的高度中点;竖向尾链把它转 90° 后同理落在条的水平中线。
    return '<span class="msi-chain-arrow" aria-hidden="true"><svg viewBox="0 0 38 28"><path d="M2 14 H34"></path><path d="m30 10 4 4-4 4"></path></svg></span>';
  }

  function renderChainLayout(chain, items, nodeHtml, note = '') {
    const nodeMinWidth = 120;
    const nodeMaxWidth = 220;
    const arrowWidth = 38;
    const availableWidth = chain.clientWidth || chain.parentElement?.clientWidth || nodeMinWidth;
    const nodeWidth = Math.min(nodeMaxWidth, Math.max(nodeMinWidth,
      Math.floor((availableWidth - (items.length - 1) * arrowWidth) / Math.max(1, items.length))));
    chain.dataset.layoutWidth = String(availableWidth);
    chain.style.setProperty('--msi-chain-node-w', nodeWidth + 'px');
    chain.innerHTML = '<div class="msi-chain-row">' +
      items.map((item, index) => nodeHtml(item, index < items.length - 1)).join('') +
      '</div>' + note;
    chain.scrollLeft = 0;
  }

  function previewBarMetrics(bar) {
    const start = parseFloat(bar.style.left) * DUR_MS / 100;
    const dur = parseFloat(bar.style.width) * DUR_MS / 100;
    return { start, dur, name: bar.dataset.op || 'kernel' };
  }

  // 示意数据没有真实 flow。挑选时间位置最近、分属不同泳道的两个可见事件，
  // 让示意时间线也能展示跨泳道的时间顺序；详情中明确标注这只是推断关系。
  function previewRelatedBars(bar, body) {
    const middle = (item) => parseFloat(item.style.left) + parseFloat(item.style.width) / 2;
    const laneId = bar.closest('.msi-lane-row')?.dataset.lane;
    const pinnedTaskIndex = bar.closest('.msi-lane-row')?.dataset.pinnedTaskIndex;
    const candidates = [...body.querySelectorAll('.msi-bar[data-preview-id]')]
      .filter((item) => item !== bar && item.closest('.msi-lane-row')?.dataset.lane !== laneId &&
        (pinnedTaskIndex === undefined
          ? item.closest('.msi-lane-row')?.dataset.pinnedTaskIndex === undefined
          : item.closest('.msi-lane-row')?.dataset.pinnedTaskIndex === pinnedTaskIndex))
      .sort((a, b) => Math.abs(middle(a) - middle(bar)) - Math.abs(middle(b) - middle(bar)));
    const related = [bar];
    const lanes = new Set([laneId]);
    for (const item of candidates) {
      const lane = item.closest('.msi-lane-row')?.dataset.lane;
      if (lanes.has(lane)) continue;
      related.push(item);
      lanes.add(lane);
      if (related.length === 3) break;
    }
    return related.sort((a, b) => middle(a) - middle(b));
  }

  function renderPreviewDetail() {
    const { bar, task } = selectedPreviewBar;
    const basics = document.getElementById('msiTaskBasics');
    const chain = document.getElementById('msiCallChain');
    const row = bar.closest('.msi-lane-row');
    if (!basics || !chain || !row) return;
    setSelectionPanelCollapsed(false);
    activateFootTab('chain');
    const metrics = previewBarMetrics(bar);
    const laneName = row.querySelector('.msi-lane-text');
    const lane = laneName?.dataset.fullName || laneName?.textContent || row.dataset.lane;
    const path = lanePath(row.dataset.lane).map((item) => item.label).join(' / ') || lane;
    const titleBar = '<span class="msi-basic-taskbar" style="background:' + bar.style.background +
      ';color:' + bar.style.color + '">' + esc(metrics.name) + '</span>';
    const fields = [
      ['标题', titleBar, true], ['任务', task.name], ['泳道', path], ['类型', '示意事件'],
      ['开始时间', metrics.start.toFixed(2) + ' ms'],
      ['结束时间', (metrics.start + metrics.dur).toFixed(2) + ' ms'],
      ['持续时间', metrics.dur.toFixed(2) + ' ms'], ['数据来源', '页面生成的示意数据'],
    ];
    basics.innerHTML = fields.map(([key, value, isHtml]) =>
      '<dt>' + esc(key) + '</dt><dd>' + (isHtml ? value : esc(value)) + '</dd>').join('');

    const nearby = previewRelatedBars(bar, selectedPreviewBar.body);
    const nodeHtml = (item, arrowRight) => {
      const info = previewBarMetrics(item);
      const itemRow = item.closest('.msi-lane-row');
      const itemPath = lanePath(itemRow.dataset.lane).map((lane) => lane.label).join(' / ');
      const description = item === bar ? '当前选中事件' : '邻近泳道的示意事件';
      return '<div class="msi-chain-step"><div class="msi-chain-node">' +
        '<span class="msi-chain-path" title="' + esc(itemPath) + '">' + esc(itemPath) + '</span>' +
        '<button class="msi-chain-taskbar' + (item === bar ? ' is-current' : '') +
          '" type="button" data-locate-preview="' + esc(item.dataset.previewId) + '" style="background:' +
          item.style.background + ';color:' + item.style.color + '" title="查看 ' + esc(info.name) + '">' +
          esc(info.name) + '</button>' +
        '<div class="msi-chain-foot"><span class="msi-chain-explain">' + description + '</span>' +
          '<span class="msi-chain-dur">耗时 ' + info.dur.toFixed(2) + ' ms</span></div>' +
        '</div>' + (arrowRight ? chainArrowHtml() : '') + '</div>';
    };
    renderChainLayout(chain, nearby, nodeHtml,
      '<p class="msi-chain-note">示意数据缺少真实调用关系；连线仅表示邻近泳道事件的时间顺序。</p>');
  }

  // 左栏「选中详情」和页签无关,只看有没有选中:有就放 key-value,没有放「请选择泳道对象」。
  function syncFootDetailColumn() {
    const basics = document.getElementById('msiTaskBasics');
    const empty = document.getElementById('msiDetailEmpty');
    const has = !!REAL_TRACE_TASK_BY_ID[selectedTraceTaskId] || !!selectedPreviewBar?.bar.isConnected;
    if (basics) basics.hidden = !has;
    if (empty) empty.hidden = has;
  }

  // 右栏页签切换 + 内容区取舍:面板展开时右栏一定有东西——「调用链」有选中就画调用流,
  // 没选中放「请选择泳道对象」;其余页签一律放「敬请期待」。收起时整块 body 由 CSS 藏掉。
  function activateFootTab(tabName) {
    const panel = document.getElementById('msiSelectionPanel');
    const chain = document.getElementById('msiCallChain');
    const placeholder = document.getElementById('msiFootPlaceholder');
    if (!panel) return;
    panel.querySelectorAll('.msi-foot-tab').forEach((tab) => {
      const active = tab.dataset.footTab === tabName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const collapsed = panel.classList.contains('is-collapsed');
    const showChain = !collapsed && tabName === 'chain' &&
      (!!selectedTraceTaskId || !!selectedPreviewBar?.bar.isConnected);
    if (chain) chain.hidden = !showChain;
    if (placeholder) {
      placeholder.textContent = tabName === 'chain' ? '请选择泳道对象' : '敬请期待';
      placeholder.hidden = collapsed || showChain;
    }
    syncFootDetailColumn();
  }

  // 左栏(选中详情)单独折叠:只改左右两栏的宽度比,右栏页签内容不受影响。
  // 栏宽一变调用链一行能放几个也跟着变,所以收完要重画一次。
  function setDetailColumnCollapsed(collapsed) {
    const panel = document.getElementById('msiSelectionPanel');
    const fold = document.getElementById('msiDetailFold');
    if (!panel || !fold) return;
    panel.classList.toggle('is-detail-collapsed', collapsed);
    fold.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    fold.setAttribute('aria-label', collapsed ? '展开选中详情' : '折叠选中详情');
    fold.title = collapsed ? '展开选中详情' : '折叠选中详情';
    if (selectedTraceTaskId || selectedPreviewBar) requestAnimationFrame(() => renderSelectionDetail());
  }

  function setSelectionPanelCollapsed(collapsed) {
    const panel = document.getElementById('msiSelectionPanel');
    const toggle = document.getElementById('msiDetailClose');
    if (!panel || !toggle) return;
    panel.classList.toggle('is-collapsed', collapsed);
    panel.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? '展开详情栏' : '收起详情栏');
    toggle.title = collapsed ? '展开详情栏' : '收起详情栏';
    if (collapsed) {
      panel.querySelectorAll('.msi-foot-tab').forEach((tab) => tab.setAttribute('aria-selected', 'false'));
      const chain = document.getElementById('msiCallChain');
      if (chain) chain.hidden = true;
      const placeholder = document.getElementById('msiFootPlaceholder');
      if (placeholder) placeholder.hidden = true;
    } else {
      const activeTab = panel.querySelector('.msi-foot-tab.is-active');
      activateFootTab(activeTab?.dataset.footTab || 'chain');
    }
  }

  function renderSelectionDetail() {
    const basics = document.getElementById('msiTaskBasics');
    const chain = document.getElementById('msiCallChain');
    const task = REAL_TRACE_TASK_BY_ID[selectedTraceTaskId];
    if (!task && selectedPreviewBar?.bar.isConnected) {
      renderPreviewDetail();
      return;
    }
    if (!basics || !chain || !task) {
      // 没有选中:按当前页签重算内容区(展开时会落到「请选择泳道对象」占位)
      const activeTab = document.querySelector('#msiSelectionPanel .msi-foot-tab.is-active');
      activateFootTab(activeTab?.dataset.footTab || 'chain');
      return;
    }
    // 选中了任务条就一定把面板拉开——用户手动收起后再点泳道,也要重新弹出详情。
    // 右栏若停在别的页签就切回「调用链」,保证点一下泳道就能看到调用流。
    setSelectionPanelCollapsed(false);
    activateFootTab('chain');
    const end = task.start + task.dur;
    // 「标题」这行不写纯文字:复用泳道/调用链任务条的配色,直接给一个同色的矩形条,
    // 一眼能和图上那根条对上。第三项 true 表示 value 已经是 HTML,不再转义。
    const titleColor = traceTaskColor(task);
    const titleBar = '<span class="msi-basic-taskbar" style="background:' + titleColor.bg +
      ';color:' + titleColor.fg + '">' + esc(task.name) + '</span>';
    const fields = [
      ['标题', titleBar, true],
      ['泳道', taskLaneLabel(task)],
      ['类型', task.taskType || taskKindLabel(task)],
      ['开始时间', task.start.toFixed(5) + ' ms'],
      ['结束时间', end.toFixed(5) + ' ms'],
      ['持续时间', task.dur.toFixed(5) + ' ms'],
      ['Task ID', task.taskId ?? '—'],
      ['connection_id', task.connectionId ?? '推断关系'],
    ];
    basics.innerHTML = fields.map(([key, value, isHtml]) =>
      '<dt>' + esc(key) + '</dt><dd>' + (isHtml ? value : esc(value)) + '</dd>').join('');

    const component = orderedTraceComponent(task.id);
    const nodeHtml = (id, arrowRight) => {
      const node = REAL_TRACE_TASK_BY_ID[id];
      if (!node) return '';
      const arrow = arrowRight ? chainArrowHtml() : '';
      const color = traceTaskColor(node);
      return '<div class="msi-chain-step">' +
        '<div class="msi-chain-node">' +
          '<span class="msi-chain-path" title="' + esc(taskLaneFullPath(node)) + '">' + esc(taskLaneFullPath(node)) + '</span>' +
          '<button class="msi-chain-taskbar' + (id === task.id ? ' is-current' : '') + '" type="button" data-locate-task="' + esc(id) + '"' +
            ' style="background:' + color.bg + ';color:' + color.fg + '" title="定位到 ' + esc(node.name) + '">' + esc(node.name) + '</button>' +
          '<div class="msi-chain-foot">' +
            '<span class="msi-chain-explain" title="' + esc(taskExplanation(node)) + '">' + esc(taskExplanation(node)) + '</span>' +
            '<span class="msi-chain-dur">耗时 ' + esc(node.dur.toFixed(3)) + ' ms</span>' +
          '</div>' +
        '</div>' + arrow + '</div>';
    };
    // 一行放几个:按最小宽度算出上限;剩下的宽度再均分给这几个节点——
    // 节点一律等宽(宽窄跟内容走的话,用户会把宽的条误读成耗时长),
    // 上限 220px 兜住只有两三个节点时条子被拉得过长。
    renderChainLayout(chain, component.ordered, nodeHtml);
  }

  // 详情和泳道必须使用完全相同的端点集合。若关系链中的某条泳道被用户折叠，
  // 选择任务时先展开该连通分量涉及的全部父级，再绘线和生成详情。
  function revealTraceComponent(taskId) {
    const body = traceSwimBody();
    const component = traceComponent(taskId);
    const missing = [...component.ids].some((id) => !body?.querySelector('.msi-bar[data-task-id="' + id + '"]'));
    if (missing) {
      component.ids.forEach((id) => {
        const task = REAL_TRACE_TASK_BY_ID[id];
        if (task) openLanePath(task.laneId);
      });
      renderSwimlanes();
    } else {
      drawTraceTaskLinks();
    }
    renderSelectionDetail();
  }

  function initSelectionPanel() {
    const panel = document.getElementById('msiSelectionPanel');
    if (!panel) return;
    const chain = document.getElementById('msiCallChain');
    if (chain && typeof ResizeObserver === 'function') {
      let resizeFrame = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (chain.hidden) return;
          let count = 0;
          if (selectedTraceTaskId) count = orderedTraceComponent(selectedTraceTaskId).ordered.length;
          else if (selectedPreviewBar?.bar.isConnected) {
            count = previewRelatedBars(selectedPreviewBar.bar, selectedPreviewBar.body).length;
          }
          if (!count) return;
          if (Math.abs(chain.clientWidth - Number(chain.dataset.layoutWidth)) > 1) renderSelectionDetail();
        });
      }).observe(chain);
    }
    panel.addEventListener('click', (event) => {
      const close = event.target.closest('#msiDetailClose');
      if (close) {
        setSelectionPanelCollapsed(!panel.classList.contains('is-collapsed'));
        return;
      }
      const fold = event.target.closest('#msiDetailFold');
      if (fold) { setDetailColumnCollapsed(!panel.classList.contains('is-detail-collapsed')); return; }
      const title = event.target.closest('#msiDetailTitle');
      if (title) { setSelectionPanelCollapsed(false); return; }
      const node = event.target.closest('[data-locate-task]');
      if (node) { locateTraceTask(node.dataset.locateTask); return; }
      const preview = event.target.closest('[data-locate-preview]');
      if (preview && selectedPreviewBar?.bar.isConnected) {
        const bar = [...selectedPreviewBar.body.querySelectorAll('.msi-bar[data-preview-id]')]
          .find((item) => item.dataset.previewId === preview.dataset.locatePreview);
        if (bar) {
          selectPreviewBar(bar, selectedPreviewBar.body, true);
          centerBarInView(selectedPreviewBar.body, bar, true);
        }
        return;
      }
      const tab = event.target.closest('.msi-foot-tab');
      if (tab) {
        setSelectionPanelCollapsed(false);
        activateFootTab(tab.dataset.footTab);
      }
    });
    // 每次进页面都从收起态开始(不记忆上次状态):标记里已写 is-collapsed,这里再走一遍
    // setSelectionPanelCollapsed 把按钮文案 / aria / 内容区隐藏一起对齐,免得两处不一致。
    setSelectionPanelCollapsed(true);
  }

  function traceLinkLayerHtml(bodyId) {
    return '<svg class="msi-link-layer" aria-hidden="true">' +
      '<defs>' +
        // 线形箭头(开口 V 形,不填充),按像素画(userSpaceOnUse)不随线宽缩放;refX 对准 V 尖,
        // 尖端正好落在目标条左边缘。颜色不在这里写死,交给 CSS 的 .msi-link-arrow--* 和线同源。
        ['dispatch', 'operator', 'communication'].map((type) =>
          '<marker id="msiArrow' + type[0].toUpperCase() + type.slice(1) + '-' + bodyId + '" markerUnits="userSpaceOnUse"' +
            ' markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">' +
            '<path class="msi-link-arrow msi-link-arrow--' + type + '" d="M2.5,1.5 L9,5 L2.5,8.5"></path>' +
          '</marker>').join('') +
      '</defs><g class="msi-link-paths"></g></svg>';
  }

  function clearTraceTaskFocus() {
    selectedTraceTaskId = null;
    selectedPreviewBar = null;
    renderSelectionDetail();
    document.querySelectorAll('#msiPinnedBody, #msiSwimBody, #msiSwimBodyCompare').forEach((item) => {
      item.classList.remove('has-task-focus');
      item.querySelectorAll('.msi-bar.is-picked,.msi-bar.is-related').forEach((el) => {
        el.classList.remove('is-picked', 'is-related');
      });
      const paths = item.querySelector('.msi-link-paths');
      if (paths) paths.innerHTML = '';
    });
    updateTimelineResetButton();
  }

  function drawTraceTaskLinks() {
    const body = traceSwimBody();
    if (!body || !selectedTraceTaskId) return;
    const bars = new Map([...body.querySelectorAll('.msi-bar[data-task-id]')]
      .map((bar) => [bar.dataset.taskId, bar]));
    const component = traceComponent(selectedTraceTaskId);
    drawTaskLinks(body, bars, component.edges, selectedTraceTaskId, component.ids);
  }

  function drawPreviewTaskLinks() {
    const selection = selectedPreviewBar;
    if (!selection?.bar.isConnected) return;
    const related = previewRelatedBars(selection.bar, selection.body);
    const bars = new Map(related.map((bar) => [bar.dataset.previewId, bar]));
    const edges = related.slice(1).map((bar, index) => ({
      source: related[index].dataset.previewId,
      target: bar.dataset.previewId,
      type: 'dispatch',
    }));
    drawTaskLinks(selection.body, bars, edges, selection.bar.dataset.previewId, new Set(bars.keys()));
  }

  function drawTaskLinks(body, bars, edges, selectedId, related) {
    const layer = body?.querySelector('.msi-link-layer');
    const mount = layer?.querySelector('.msi-link-paths');
    if (!layer || !mount) return;
    body.querySelectorAll('.msi-bar').forEach((el) => {
      const id = el.dataset.taskId || el.dataset.previewId;
      el.classList.toggle('is-related', related.has(id));
      el.classList.toggle('is-picked', id === selectedId);
    });
    body.classList.add('has-task-focus');

    // 只按泳道内容计算连线画布；把画布自身计入 scrollWidth 会在窗口缩小时保留旧宽度。
    const content = [...body.children].filter((child) => child !== layer);
    const width = Math.max(body.clientWidth, ...content.map((child) => child.scrollWidth));
    const height = Math.max(body.clientHeight, ...content.map((child) => child.offsetTop + child.offsetHeight));
    layer.setAttribute('width', width);
    layer.setAttribute('height', height);
    layer.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    layer.style.width = width + 'px';
    layer.style.height = height + 'px';
    const bodyRect = body.getBoundingClientRect();
    const point = (id, outgoing) => {
      const el = bars.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: (outgoing ? r.right : r.left) - bodyRect.left + body.scrollLeft,
        y: (r.top + r.bottom) / 2 - bodyRect.top + body.scrollTop,
      };
    };
    // 连线三条规矩:出口永远在源条右侧中点、入口永远在目标条左侧中点、两端切线水平。
    // 控制点各自朝外伸(源向右、目标向左),不随目标在前在后翻方向 —— 以前目标在左后方时
    // 控制点会反过来往左伸,线从右边缘出来就立刻折回穿过条身,看着像从条底下钻出来。
    // 现在目标靠后时曲线先向右再 S 形折回,出口始终干净地朝右。
    const DOT_R = 2.4;
    mount.innerHTML = edges.map((edge) => {
      const a = point(edge.source, true), b = point(edge.target, false);
      if (!a || !b) return '';
      const dx = b.x - a.x, dy = b.y - a.y;
      const bend = dx >= 0
        ? Math.max(20, dx * .46)
        : Math.max(36, Math.min(120, -dx * .5 + Math.abs(dy) * .35));
      const d = 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ' C' +
        (a.x + bend).toFixed(1) + ',' + a.y.toFixed(1) + ' ' +
        (b.x - bend).toFixed(1) + ',' + b.y.toFixed(1) + ' ' +
        b.x.toFixed(1) + ',' + b.y.toFixed(1);
      const cls = edge.type === 'operator' ? ' msi-link-path--operator'
        : (edge.type === 'communication' ? ' msi-link-path--communication' : '');
      const marker = edge.type === 'operator' ? 'msiArrowOperator'
        : (edge.type === 'communication' ? 'msiArrowCommunication' : 'msiArrowDispatch');
      // 出口点整个放在条的右边缘外侧(圆心外移一个半径):连线层 z-index 4 压不过选中条的 5,
      // 圆心压在边缘上会被条盖掉一半,窄条上甚至整个看不见,就成了「有的出口没点」。
      return '<path class="msi-link-path' + cls + '" d="' + d + '" marker-end="url(#' + marker + '-' + body.id + ')"></path>' +
        '<circle class="msi-link-dot' + cls.replace('msi-link-path', 'msi-link-dot') + '" cx="' + (a.x + DOT_R).toFixed(1) + '" cy="' + a.y.toFixed(1) + '" r="' + DOT_R + '"></circle>';
    }).join('');
  }

  function selectTraceTask(taskId) {
    if (!REAL_TRACE_TASK_BY_ID[taskId]) return;
    const wasSelected = selectedTraceTaskId === taskId;
    clearTraceTaskFocus();
    if (!wasSelected) {
      selectedTraceTaskId = taskId;
      revealTraceComponent(taskId);
      centerTraceTaskInView(taskId, false);
    }
    updateTimelineResetButton();
  }

  function selectPreviewBar(bar, body, keepSelected = false) {
    const wasSelected = selectedPreviewBar?.bar === bar;
    clearTraceTaskFocus();
    if (wasSelected && !keepSelected) return;
    const pinnedIndex = bar.closest('.msi-lane-row')?.dataset.pinnedTaskIndex;
    const task = compareMode ? compareTasks[pinnedIndex === undefined
      ? (body.id === 'msiSwimBodyCompare' ? 1 : 0) : Number(pinnedIndex)] : selected.task;
    if (!task) return;
    selectedPreviewBar = { bar, body, task };
    renderSelectionDetail();
    drawPreviewTaskLinks();
    if (!keepSelected) centerBarInView(body, bar, false);
    updateTimelineResetButton();
  }

  // 把任务条滚到泳道可视区正中(只动泳道自己的滚动容器,不用 scrollIntoView 免得整页跟着滚)。
  // 一定要放在 renderSelectionDetail 之后、下一帧再量尺寸:底部详情面板一拉开,
  // .msi-swim-body 立刻被挤矮,若按拉开前的高度算中点,靠下的条正好落在被面板盖住的那一截。
  // 右键路径不走这里——菜单锚在条上,容器一滚菜单就会被关掉。
  function centerTraceTaskInView(taskId, flash) {
    const body = traceSwimBody();
    if (!body) return;
    const bar = body.querySelector('.msi-bar[data-task-id="' + taskId + '"]');
    if (bar) centerBarInView(body, bar, flash);
  }

  function centerBarInView(body, bar, flash) {
    requestAnimationFrame(() => {
      const row = bar?.closest('.msi-lane-row');
      if (!bar || !row) return;
      const bodyRect = body.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      // 纵向:按 rect 差算而不是 offsetTop —— .msi-swim-body 不一定是 offsetParent。
      const top = body.scrollTop + (rowRect.top - bodyRect.top) - (body.clientHeight - rowRect.height) / 2;
      // 横向:条在视野里就不动(别打扰用户正在看的时间段),跑出去了才把条的中点拉回中央。
      let left = body.scrollLeft;
      if (barRect.left < bodyRect.left || barRect.right > bodyRect.left + body.clientWidth) {
        left = body.scrollLeft + (barRect.left + barRect.width / 2 - bodyRect.left) - body.clientWidth / 2;
      }
      body.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: 'smooth' });
      if (flash) {
        bar.classList.remove('is-locate-flash');
        void bar.offsetWidth; // 强制重排:连点同一个条两次也要能重放动画
        bar.classList.add('is-locate-flash');
      }
    });
  }

  function renderSwimlanes() {
    clearBoxSelection();
    const stack = document.getElementById('msiTimelineSwims');
    const upper = document.getElementById('msiSwim');
    const lower = document.getElementById('msiSwimCompare');
    if (!stack || !upper || !lower) return;
    const pinnedCard = ensurePinnedCard(stack, upper);
    const pinnedBody = pinnedCard.querySelector('.msi-pinned-body');
    stack.classList.toggle('is-compare', compareMode);
    lower.hidden = !compareMode || !compareTasks[1];
    document.getElementById('msiSwimTitle').hidden = !compareMode;
    const panels = compareMode
      ? [[upper, compareTasks[0], '基线'], ...(compareTasks[1] ? [[lower, compareTasks[1], '对比']] : [])]
      : [[upper, selected.task, '']];
    panels.forEach(([panel, task, role]) => {
      const body = panel.querySelector('.msi-swim-body');
      const title = panel.querySelector('.msi-swim-title');
      panel.querySelector('.msi-swim-head').hidden = !task;
      if (!selectedTraceTaskId) body.classList.remove('has-task-focus');
      const name = task?.name || '请勾选对比项';
      title.innerHTML = role
        ? '<span class="msi-swim-title-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
          '<span class="msi-tree-compare-role msi-tree-compare-role--' +
          (role === '基线' ? 'baseline' : 'compare') + '">' + role + '</span>'
        : '<span class="msi-swim-title-name">' + esc(name) + '</span>';
      panel.setAttribute('aria-label', (role ? role + ' · ' : '') + name);
      if (!task) {
        body.innerHTML = '<div class="msi-swim-empty">请在左侧勾选' + role + '任务</div>';
        return;
      }
      const rnd = mulberry32(hashSeed(task.name));
      const out = [];
      const appendLane = (lane, depth) => {
        out.push(laneRow(lane, depth, rnd, task));
        if (lane.group && lane.open && lane.children) {
          lane.children.forEach((child) => appendLane(child, depth + 1));
        }
      };
      LANES.forEach((lane) => appendLane(lane, 0));
      body.innerHTML = out.join('') + traceLinkLayerHtml(body.id);
      fitBarLabels(body);
    });
    const upperBody = upper.querySelector('.msi-swim-body');
    const lowerBody = lower.querySelector('.msi-swim-body');
    const pinnedRows = pinnedLaneRows(upperBody, lowerBody);
    pinnedCard.hidden = !pinnedRows.length;
    pinnedBody.innerHTML = pinnedRows.length
      ? pinnedRows.join('') + traceLinkLayerHtml(pinnedBody.id) : '';
    if (pinnedRows.length) fitBarLabels(pinnedBody);
    // 置顶卡片从隐藏变为可见后，时间尺才有实际宽度可用于避让标签。
    renderRuler();
    if (selectedPreviewBar && !selectedPreviewBar.bar.isConnected) {
      const { body, task, bar } = selectedPreviewBar;
      const pinnedIndex = bar.closest('.msi-lane-row')?.dataset.pinnedTaskIndex;
      const replacement = [...body.querySelectorAll('.msi-bar[data-preview-id]')]
        .find((item) => item.dataset.previewId === bar.dataset.previewId &&
          item.closest('.msi-lane-row')?.dataset.pinnedTaskIndex === pinnedIndex);
      selectedPreviewBar = replacement ? { body, task, bar: replacement } : null;
      renderSelectionDetail();
    }
    if (selectedTraceTaskId) requestAnimationFrame(drawTraceTaskLinks);
    else if (selectedPreviewBar) requestAnimationFrame(drawPreviewTaskLinks);
    updateTimelineResetButton();
  }

  /* ══ 色块的左键选中 + 右键菜单 ═══════════════════════════════════
     色块使用算子菜单；对比模式叶子泳道的空白处使用置顶菜单。 */
  const CTX_MENU = [
    [{ act: 'chat', label: '置入智能对话', icon: true },
     { act: 'analyze', label: '智能分析', icon: true }],
    [{ label: '应用时间范围分析' }],
    [{ label: '全屏显示' },
     { label: '撤销缩放(0)', key: 'Backspace', disabled: true },
     { label: '重置缩放', key: 'Ctrl+0', disabled: true }],
    [{ label: '设置基准算子' },
     { label: '恢复所有卡的默认偏移量' }],
    [{ label: '隐藏泳道' }],
    [{ label: '泳道高度自适应' }],
    [{ label: '在事件视图中显示' },
     { label: '算子框选模式' },
     { label: '跳转到连线算子' }],
  ];

  function laneMenu(laneLabel) {
    return [
      [{ label: '撤销缩放(0)', key: 'Backspace', disabled: true },
       { label: '重置缩放', key: 'Ctrl+0', disabled: true }],
      [{ act: 'pin-same-lane', label: '置顶同名泳道（' + laneLabel + '）' }],
      [{ label: '恢复所有卡的默认偏移量' }],
      [{ label: '隐藏泳道' }],
      [{ label: '泳道高度自适应' }],
      [{ label: '在事件视图中显示' },
       { label: '算子框选模式' }],
    ];
  }

  let menuEl = null;
  let menuCtx = null;   // 右键点中的那个色块的信息
  let menuOpenedAt = 0; // 弹出时刻:用来忽略「开菜单这一下自己带出来的」click
  let menuAnchor = null; // 菜单锚在哪个色块上 —— 判断某次滚动关不关菜单要靠它

  // 刚弹出来的 120ms 内的 click 不算「点了外面」,只为吃掉右键手势自己派生出来的那一次。
  const settled = (ms) => performance.now() - menuOpenedAt >= ms;

  function menuHtml(groups) {
    return groups.map((group) => group.map((it) => (
      '<button class="msi-ctxmenu-item" type="button" role="menuitem"' +
      (it.act ? ' data-act="' + it.act + '"' : '') +
      (it.disabled ? ' disabled' : '') + '>' +
        (it.icon ? '<img class="msi-ctxmenu-icon" src="../../src/pic/icon/msinsightbotAvatar.png" alt="">' : '') +
        '<span>' + esc(it.label) + '</span>' +
        (it.key ? '<span class="msi-ctxmenu-key">' + esc(it.key) + '</span>' : '') +
      '</button>'
    )).join('')).join('<div class="msi-ctxmenu-sep" role="separator"></div>');
  }

  function buildMenu() {
    const el = document.createElement('div');
    el.className = 'msi-ctxmenu';
    el.setAttribute('role', 'menu');
    el.hidden = true;
    el.innerHTML = menuHtml(CTX_MENU);
    document.body.appendChild(el);
    return el;
  }

  function closeMenu() {
    if (menuEl) menuEl.hidden = true;
    menuCtx = null;
    menuAnchor = null;
  }

  function openMenu(x, y, ctx, anchor, groups = CTX_MENU) {
    if (!menuEl) menuEl = buildMenu();
    menuEl.innerHTML = menuHtml(groups);
    menuEl.classList.toggle('msi-ctxmenu--lane', !!ctx?.laneId);
    menuCtx = ctx;
    menuAnchor = anchor || null;
    menuEl.hidden = false;
    menuOpenedAt = performance.now();
    // 先摆到 0,0 量出尺寸,再决定往哪边翻,免得贴着视口边缘被切掉
    menuEl.style.left = '0px';
    menuEl.style.top = '0px';
    const r = menuEl.getBoundingClientRect();
    const left = x + r.width > window.innerWidth - 8 ? Math.max(8, x - r.width) : x;
    const top = y + r.height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - r.height - 8) : y;
    menuEl.style.left = left + 'px';
    menuEl.style.top = top + 'px';
  }

  // 把当前色块的信息塞进右侧对话框的输入框。面板收着就先把它打开。
  function sendToChat(text) {
    const toggle = document.getElementById('trainChatToggle');
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
    const input = document.getElementById('trainChatInput');
    if (!input) return;
    const cur = input.value;
    // 接在已有内容后面时补一份 CHIP_GAP,否则 #标签会和前面的字黏在一起;行首不用留白
    const glue = !cur || /\n$/.test(cur) ? '' : (window.WZH_CHIP_GAP || '   ');
    input.value = cur.replace(/[ \t]+$/, '') + glue + text;
    // 派发 input 事件:输入框的高亮层、自动高度、发送键可用态都挂在这个事件上
    input.dispatchEvent(new Event('input', { bubbles: true }));
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) { /* 忽略 */ }
  }

  function runMenuAct(act) {
    if (!menuCtx || !act) return;
    if (act === 'pin-same-lane') {
      if (compareMode && compareTasks[1] && findLane(menuCtx.laneId)) {
        pinnedLaneIds.add(menuCtx.laneId);
        renderSwimlanes();
      }
      return;
    }
    const { op, dur, lane } = menuCtx;
    const ref = (window.WZH_CHIP_HASH || '# ') + (menuCtx.taskName || selected.task.name);
    const gap = window.WZH_CHIP_GAP || '   ';   // 和输入框里 # 标签同一份留白
    if (act === 'chat') {
      sendToChat(ref + gap + lane + ' 上的 ' + op + '(' + dur + 'ms) ');
    } else if (act === 'analyze') {
      sendToChat(ref + gap + lane + ' 上的算子 ' + op + '，耗时 ' + dur + 'ms，请分析它的计算上下游，诊断它的性能。');
    }
  }

  function openLaneMenu(e, row) {
    if (!compareMode || !compareTasks[1] || !row) return false;
    const lane = findLane(row.dataset.lane);
    if (!lane || lane.group || lane.children?.length) return false;
    e.preventDefault();
    openMenu(e.clientX, e.clientY, { laneId: lane.id }, row, laneMenu(lane.label));
    return true;
  }

  function initBarMenu() {
    const bodies = [document.getElementById('msiPinnedBody'), document.getElementById('msiSwimBody'), document.getElementById('msiSwimBodyCompare')].filter(Boolean);
    if (!bodies.length) return;

    // 左键:选中这个色块(整张泳道图同时只选中一个)
    bodies.forEach((body) => {
    body.addEventListener('click', (e) => {
      const bar = e.target.closest('.msi-bar');
      if (!bar) return;
      if (bar.dataset.taskId) {
        selectTraceTask(bar.dataset.taskId);
        return;
      }
      selectPreviewBar(bar, body);
    });

    // 右键:选中并弹菜单
    body.addEventListener('contextmenu', (e) => {
      const bar = e.target.closest('.msi-bar');
      if (!bar) return;
      e.preventDefault();
      if (bar.dataset.taskId) {
        clearTraceTaskFocus();
        selectedTraceTaskId = bar.dataset.taskId;
        revealTraceComponent(bar.dataset.taskId);
      } else {
        selectPreviewBar(bar, body, true);
      }
      const row = bar.closest('.msi-lane-row');
      const pinnedIndex = row?.dataset.pinnedTaskIndex;
      const task = compareMode ? compareTasks[pinnedIndex === undefined
        ? (body.id === 'msiSwimBodyCompare' ? 1 : 0) : Number(pinnedIndex)] : selected.task;
      openMenu(e.clientX, e.clientY, {
        op: bar.dataset.op || '未命名事件',
        dur: bar.dataset.dur || '0',
        lane: row ? (row.querySelector('.msi-lane-text')?.dataset.fullName ||
          row.querySelector('.msi-lane-text')?.textContent || '') : '',
        taskName: task?.name,
      }, bar.dataset.taskId ? (body.querySelector('.msi-bar[data-task-id="' + bar.dataset.taskId + '"]') || bar) : bar);
    });
    });

    // 详情栏「完整调用链」里的任务条:右键复用同一套菜单(含「置入智能对话 / 智能分析」),
    // 上下文从任务数据取,lane 用叶子泳道名,和泳道里右键得到的一致。不改当前选中。
    const chain = document.getElementById('msiCallChain');
    chain?.addEventListener('contextmenu', (e) => {
      const bar = e.target.closest('.msi-chain-taskbar');
      const task = bar && REAL_TRACE_TASK_BY_ID[bar.dataset.locateTask];
      if (!task) return;
      e.preventDefault();
      const path = lanePath(task.laneId);
      openMenu(e.clientX, e.clientY, {
        op: task.name,
        dur: task.dur.toFixed(5),
        lane: path.length ? path[path.length - 1].label : task.laneId,
        taskName: 'profile_dir',
      }, bar);
    });

    document.addEventListener('click', (e) => {
      if (!menuEl || menuEl.hidden) return;
      const item = e.target.closest('.msi-ctxmenu-item');
      if (item && menuEl.contains(item)) {
        if (item.disabled) return;
        runMenuAct(item.dataset.act);   // 没接行为的项就只是关掉菜单
        closeMenu();
        return;
      }
      if (!settled(120)) return;
      closeMenu();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    // 滚动会让菜单和它锚定的色块错位,所以要关 —— 但只关"真把色块滚跑了"的那种。
    // 这个监听挂在 window 捕获阶段,页面里任意滚动容器的 scroll 都会打到它。
    // 右侧对话区回答生成时每帧都在自动贴底,那跟泳道图里的色块没有半点关系;
    // 早先无条件 closeMenu,结果就是"回答中右键,菜单一出来就没了"。
    // 判据只有一条:滚的这个容器包不包着当前锚点。不包 = 色块没动 = 不用管。
    window.addEventListener('scroll', (e) => {
      if (!menuAnchor) return;
      const t = e.target === document || e.target === window ? document.documentElement : e.target;
      if (!(t instanceof Node) || !t.contains(menuAnchor)) return;
      closeMenu();
    }, true);
    window.addEventListener('resize', closeMenu);
    // 菜单自己身上再右键,别把系统菜单叠上来
    document.addEventListener('contextmenu', (e) => {
      if (menuEl && !menuEl.hidden && menuEl.contains(e.target)) e.preventDefault();
    });
  }

  function initSwimlanes() {
    document.getElementById('msiPinnedCard')?.addEventListener('click', (e) => {
      if (!e.target.closest('[data-clear-pinned]')) return;
      pinnedLaneIds.clear();
      renderSwimlanes();
    });
    const bodies = [document.getElementById('msiPinnedBody'), document.getElementById('msiSwimBody'), document.getElementById('msiSwimBodyCompare')].filter(Boolean);
    if (!bodies.length) return;
    bodies.forEach((body) => {
    body.addEventListener('click', (e) => {
      const tog = e.target.closest('.msi-lane-caret-btn');
      if (tog) {
        const lane = findLane(tog.dataset.toggle);
        if (lane) { lane.open = !lane.open; renderSwimlanes(); }
        return;
      }
      const row = e.target.closest('.msi-lane-row');
      if (!row || !row.dataset.lane) return;
      if (!e.target.closest('.msi-bar')) clearTraceTaskFocus();
      selectedLaneId = row.dataset.lane;
      // 只切 class 不重画:同一个种子重画结果完全一样,白白再生成一遍
      bodies.forEach((item) => item.querySelectorAll('.msi-lane-row.is-selected').forEach((el) => el.classList.remove('is-selected')));
      row.classList.add('is-selected');
      updateTimelineResetButton();
    });
    body.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.msi-bar')) return;
      openLaneMenu(e, e.target.closest('.msi-lane-row'));
    });
    // 条宽写的是百分比,容器一变宽窄,能塞下的字数就变了 —— 面板展开/收起、窗口缩放
    // 都要重算一遍省略位置。只改 textContent 不改布局,不会把 RO 自己再触发一轮。
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        fitBarLabels(body);
        if (selectedTraceTaskId) drawTraceTaskLinks();
        else if (selectedPreviewBar?.body === body) drawPreviewTaskLinks();
      }).observe(body);
    }
    });
  }

  // 反向交互:对话里的锚点点一下,泳道图定位到对应那一行。
  // 右键「置入智能对话」是图 → 对话,这个是对话 → 图,一来一回才算协作而不是单向问答。
  // 返回 true/false,让对话那侧知道要不要给点击回执。
  function locateLane(laneId) {
    const body = compareMode && compareTasks[1] && isRealTraceSelection(compareTasks[1])
      ? traceSwimBody() : document.getElementById('msiSwimBody');
    if (!body || !laneId) return false;
    if (!findLane(laneId)) return false;
    // 目标可能嵌套四层；沿祖先链全部展开后再定位。
    openLanePath(laneId);
    renderSwimlanes();
    const row = body.querySelector('.msi-lane-row[data-lane="' + laneId + '"]');
    if (!row) return false;

    selectedLaneId = laneId;
    body.querySelectorAll('.msi-lane-row.is-selected').forEach((el) => el.classList.remove('is-selected'));
    row.classList.add('is-selected');
    updateTimelineResetButton();

    // 不能用 scrollIntoView:它会连带把整个页面滚起来。这里只动泳道自己的滚动容器,
    // 位置按 rect 差算而不是 offsetTop —— .msi-swim-body 不一定是 offsetParent。
    const bodyRect = body.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const y = body.scrollTop + (rowRect.top - bodyRect.top) - (body.clientHeight - rowRect.height) / 2;
    body.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });

    row.classList.remove('is-locate-flash');
    void row.offsetWidth; // 强制重排:连点同一个锚点两次也要能重放动画
    row.classList.add('is-locate-flash');
    return true;
  }
  function locateTraceTask(taskId) {
    const task = REAL_TRACE_TASK_BY_ID[taskId];
    const body = traceSwimBody();
    if (!task || !body) return false;
    selectedTraceTaskId = taskId;
    selectedLaneId = task.laneId;
    traceComponent(taskId).ids.forEach((id) => {
      const relatedTask = REAL_TRACE_TASK_BY_ID[id];
      if (relatedTask) openLanePath(relatedTask.laneId);
    });
    renderSwimlanes();
    renderSelectionDetail();
    // 连线由 renderSwimlanes 里的 rAF 画;这里只负责把条居中(面板已在上一行拉开,量到的是挤矮后的高度)
    centerTraceTaskInView(taskId, true);
    return true;
  }
  // 对话框在另一个 IIFE 里,和 sendToChat 一样只能借 window 搭桥
  window.WZH_LOCATE_LANE = locateLane;

  /* ══ 5. 顶部时间尺 ═════════════════════════════════════════════════ */
  function taskTimeSpan(task) {
    return isRealTraceSelection(task) ? TRACE_WINDOW_MS : DUR_MS;
  }

  function pinnedTimeSpan() {
    return compareMode && compareTasks[0] && compareTasks[1]
      ? Math.max(taskTimeSpan(compareTasks[0]), taskTimeSpan(compareTasks[1])) : null;
  }

  function syncPinnedTimeDomain() {
    const sharedSpan = pinnedTimeSpan();
    if (!sharedSpan) return;
    document.querySelectorAll('#msiPinnedBody .msi-lane-row[data-pinned-task-index]').forEach((row) => {
      const task = compareTasks[Number(row.dataset.pinnedTaskIndex)];
      const domain = row.querySelector('.msi-pinned-domain');
      if (task && domain) domain.style.width = (taskTimeSpan(task) / sharedSpan * 100) + '%';
    });
    if (selectedPreviewBar?.body.id === 'msiPinnedBody') requestAnimationFrame(drawPreviewTaskLinks);
  }

  function syncPreviewBarDurations() {
    document.querySelectorAll('#msiPinnedBody .msi-bar[data-preview-id], #msiSwimBody .msi-bar[data-preview-id], #msiSwimBodyCompare .msi-bar[data-preview-id]')
      .forEach((bar) => {
        const dur = (parseFloat(bar.style.width) * DUR_MS / 100).toFixed(2);
        bar.dataset.dur = dur;
        bar.title = (bar.dataset.op || 'kernel') + ' · ' + dur + 'ms';
      });
    if (selectedPreviewBar?.bar.isConnected) renderSelectionDetail();
  }

  function renderRuler() {
    syncSwimScale();
    ['msiSwimBody', 'msiSwimBodyCompare', 'msiPinnedBody'].forEach((id) => {
      const body = document.getElementById(id);
      if (body) fitBarLabels(body);
    });
    [[document.getElementById('msiRuler'), compareMode ? compareTasks[0] : selected.task],
     [document.getElementById('msiRulerCompare'), compareTasks[1]]].forEach(([host, task]) => {
      if (!host) return;
      host.innerHTML = task ? rulerTicks(taskTimeSpan(task)) : '';
      fitRulerLabels(host);
    });
    const pinnedRuler = document.getElementById('msiPinnedRuler');
    const sharedSpan = pinnedTimeSpan();
    if (pinnedRuler) {
      pinnedRuler.innerHTML = sharedSpan ? rulerTicks(sharedSpan) : '';
      fitRulerLabels(pinnedRuler);
    }
    syncPinnedTimeDomain();
    updateAutoHeight();
    updateBoxTimeSelection();
    updateTimelineResetButton();
  }

  function fitRulerLabels(host) {
    if (!host.clientWidth) return;
    const ticks = Array.from(host.querySelectorAll('.msi-ruler-tick'));
    if (ticks.length < 2) return;
    const bounds = ticks.map((tick) => tick.getBoundingClientRect());
    const endLeft = bounds[bounds.length - 1].left;
    let previousRight = -Infinity;
    ticks.slice(0, -1).forEach((tick, index) => {
      const { left, right } = bounds[index];
      if (left < previousRight + 8 || right > endLeft - 8) {
        tick.textContent = '';
      } else {
        previousRight = right;
      }
    });
  }

  function rulerTicks(spanMs) {
    const ticks = [];
    for (let i = 0; i <= 10; i++) {
      const endCls = i === 10 ? ' msi-ruler-tick--end' : '';
      const tickMs = i * spanMs / 10;
      ticks.push('<span class="msi-ruler-tick' + endCls + '" style="left:' + (i * 10) + '%">' +
                 (Number.isInteger(tickMs) ? tickMs : tickMs.toFixed(1)) + 'ms</span>');
    }
    return ticks.join('');
  }

  /* ══ 6. 时间轴缩放：放大时间刻度，保持完整数据范围 ════════════════ */
  function fmtSpan(ms) {
    if (ms < 1000) return (Number.isInteger(ms) ? ms : ms.toFixed(1)) + 'ms';
    const s = ms / 1000;
    return (Number.isInteger(s) ? s : s.toFixed(1)) + 's';
  }

  function isLaneExpansionModified(nodes = LANES) {
    return nodes.some((lane) =>
      (lane.group && lane.open !== DEFAULT_LANE_OPEN.get(lane.id)) ||
      (lane.children && isLaneExpansionModified(lane.children)));
  }

  function updateTimelineResetButton() {
    const bodies = ['msiSwimBody', 'msiSwimBodyCompare', 'msiPinnedBody']
      .map((id) => document.getElementById(id)).filter(Boolean);
    const modified = !!(zoomIdx > 0 || timelineToolStateDirty || boxTimeSelection ||
      selectedTraceTaskId || selectedPreviewBar || selectedLaneId !== DEFAULT_SELECTED_LANE_ID ||
      pinnedLaneIds.size || isLaneExpansionModified() ||
      bodies.some((body) => body.scrollLeft || body.scrollTop ||
        body.querySelector('.is-box-selected')));
    ['msiTimelineReset', 'msiPinnedTimelineReset'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.hidden = !modified;
    });
  }

  function resetTimelineView() {
    zoomIdx = 0;
    selectedLaneId = DEFAULT_SELECTED_LANE_ID;
    LANES = buildLanes();
    pinnedLaneIds.clear();
    clearBoxSelection();
    clearTraceTaskFocus();
    resetMouseTools();
    ['msiSwimBody', 'msiSwimBodyCompare', 'msiPinnedBody'].forEach((id) => {
      const body = document.getElementById(id);
      if (body) { body.scrollLeft = 0; body.scrollTop = 0; }
    });
    setSelectionPanelCollapsed(true);
    renderSwimlanes();
    syncTimelineControls();
    updateTimelineResetButton();
  }

  function updateAutoHeight() {
    let changed = false;
    ['msiSwimBody', 'msiSwimBodyCompare'].forEach((id) => {
      const body = document.getElementById(id);
      if (!body) return;
      const rows = [...body.querySelectorAll(':scope > .msi-lane-row')];
      const previouslyHidden = new Set(rows.filter((row) => row.classList.contains('is-auto-empty')));
      rows.forEach((row) => row.classList.remove('is-auto-empty'));
      if (!autoHeightEnabled || body.parentElement.hidden || !body.clientWidth) {
        if (previouslyHidden.size) changed = true;
        return;
      }
      const corner = body.parentElement.querySelector('.msi-swim-corner');
      const ruler = body.parentElement.querySelector('.msi-swim-ruler');
      if (!corner || !ruler?.clientWidth) {
        if (previouslyHidden.size) changed = true;
        return;
      }
      const visibleStart = body.scrollLeft / ruler.clientWidth;
      const visibleEnd = (body.scrollLeft + body.clientWidth - corner.offsetWidth) / ruler.clientWidth;
      const rowsByLane = new Map(rows.map((row) => [row.dataset.lane, row]));
      const keepLane = (lane) => {
        const row = rowsByLane.get(lane.id);
        if (!row) return false;
        // Existing collapsed branches stay as the user's baseline.
        if (lane.group && !lane.open) return true;
        let hasVisibleChild = false;
        if (lane.group && lane.children) lane.children.forEach((child) => {
          hasVisibleChild = keepLane(child) || hasVisibleChild;
        });
        const hasVisibleBar = [...row.querySelectorAll('.msi-bar')].some((bar) => {
          const start = parseFloat(bar.style.left) / 100;
          const end = start + parseFloat(bar.style.width) / 100;
          return end > visibleStart && start < visibleEnd;
        });
        // Summary and metric tracks carry content without operator bars.
        const keep = hasVisibleBar || hasVisibleChild || lane.staticCollapsed ||
          !!row.querySelector('.msi-lane-track svg');
        row.classList.toggle('is-auto-empty', !keep);
        return keep;
      };
      LANES.forEach(keepLane);
      if (rows.some((row) => previouslyHidden.has(row) !== row.classList.contains('is-auto-empty'))) changed = true;
    });
    if (changed) {
      if (selectedTraceTaskId) requestAnimationFrame(drawTraceTaskLinks);
      else if (selectedPreviewBar?.bar.isConnected) requestAnimationFrame(drawPreviewTaskLinks);
    }
  }

  function syncSwimScale() {
    ['msiSwim', 'msiSwimCompare', 'msiPinnedCard'].forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel || panel.hidden) return;
      const body = panel.querySelector('.msi-swim-body');
      const corner = panel.querySelector('.msi-swim-corner');
      const ruler = panel.querySelector('.msi-swim-ruler');
      if (!body || !corner || !ruler || !body.clientWidth) return;
      const trackWidth = Math.max(1, body.clientWidth - corner.offsetWidth);
      panel.style.setProperty('--msi-track-w', (trackWidth * ZOOM_SCALES[zoomIdx]) + 'px');
      ruler.style.transform = 'translateX(-' + body.scrollLeft + 'px)';
    });
  }

  function applyZoom() {
    syncTimelineControls();
    updateTimelineResetButton();
    if (selectedTraceTaskId) requestAnimationFrame(drawTraceTaskLinks);
    else if (selectedPreviewBar?.bar.isConnected) requestAnimationFrame(drawPreviewTaskLinks);
  }

  function syncTimelineControls() {
    const val = document.getElementById('msiZoomVal');
    const out = document.getElementById('msiZoomOut');
    const inc = document.getElementById('msiZoomIn');
    const span = compareMode ? (pinnedTimeSpan() || DUR_MS) : taskTimeSpan(selected.task);
    if (val) val.textContent = fmtSpan(span / ZOOM_SCALES[zoomIdx]);
    if (out) out.disabled = zoomIdx === 0;
    if (inc) inc.disabled = zoomIdx === ZOOM_SCALES.length - 1;
    renderRuler();
    syncPreviewBarDurations();
  }

  function initZoom() {
    const swims = document.getElementById('msiTimelineSwims');
    if (swims && typeof ResizeObserver === 'function') {
      new ResizeObserver(renderRuler).observe(swims);
    } else {
      window.addEventListener('resize', renderRuler);
    }
    document.fonts?.ready.then(renderRuler);
    const out = document.getElementById('msiZoomOut');
    const inc = document.getElementById('msiZoomIn');
    if (out) out.addEventListener('click', () => { if (zoomIdx > 0) { zoomIdx--; applyZoom(); } });
    if (inc) inc.addEventListener('click', () => { if (zoomIdx < ZOOM_SCALES.length - 1) { zoomIdx++; applyZoom(); } });
    const bodies = ['msiSwimBody', 'msiSwimBodyCompare', 'msiPinnedBody']
      .map((id) => document.getElementById(id)).filter(Boolean);
    const syncHorizontalScroll = (body) => {
      bodies.forEach((other) => {
        if (other !== body && other.scrollLeft !== body.scrollLeft) other.scrollLeft = body.scrollLeft;
        const ruler = other.parentElement?.querySelector('.msi-swim-ruler');
        if (ruler) ruler.style.transform = 'translateX(-' + other.scrollLeft + 'px)';
      });
      updateAutoHeight();
      updateBoxTimeSelection();
      updateTimelineResetButton();
    };
    bodies.forEach((body) => body.addEventListener('scroll', () => syncHorizontalScroll(body)));
    ['msiTimelineReset', 'msiPinnedTimelineReset'].forEach((id) =>
      document.getElementById(id)?.addEventListener('click', resetTimelineView));
    swims?.addEventListener('wheel', (event) => {
      if (!event.ctrlKey || !event.deltaY) return;
      const panel = event.target.closest('.msi-swim, .msi-pinned-card');
      if (!panel) return;
      const body = panel.querySelector('.msi-swim-body');
      const corner = panel.querySelector('.msi-swim-corner');
      if (!body || !corner || !body.clientWidth) return;
      event.preventDefault();
      const nextIdx = Math.max(0, Math.min(ZOOM_SCALES.length - 1,
        zoomIdx + (event.deltaY < 0 ? 1 : -1)));
      if (nextIdx === zoomIdx) return;
      const trackWidth = Math.max(0, body.clientWidth - corner.offsetWidth);
      const anchorX = Math.max(0, Math.min(trackWidth,
        event.clientX - body.getBoundingClientRect().left - corner.offsetWidth));
      const nextScrollLeft = (body.scrollLeft + anchorX) *
        ZOOM_SCALES[nextIdx] / ZOOM_SCALES[zoomIdx] - anchorX;
      zoomIdx = nextIdx;
      applyZoom();
      body.scrollLeft = nextScrollLeft;
      syncHorizontalScroll(body);
    }, { passive: false });
    applyZoom();
  }

  function initMouseModes() {
    const tools = document.getElementById('msiMouseTools');
    const stack = document.getElementById('msiTimelineSwims');
    const status = document.getElementById('msiMouseStatus');
    const help = document.getElementById('msiMouseHelp');
    const helpToggle = document.getElementById('msiMouseHelpToggle');
    const collapse = document.getElementById('msiMouseToolsCollapse');
    const grip = document.getElementById('msiMouseToolsGrip');
    if (!tools || !stack) return;
    let primaryMode = 'select';
    let boxEnabled = false;
    let allowBoxClick = false;
    let drag = null;
    const bodies = ['msiSwimBody', 'msiSwimBodyCompare', 'msiPinnedBody']
      .map((id) => document.getElementById(id)).filter(Boolean);
    const announce = (message) => { if (status) status.textContent = message; };
    const clampToolsTop = (top) => Math.max(0, Math.min(top,
      tools.parentElement.clientHeight - tools.offsetHeight));
    if (grip) {
      let toolsDrag = null;
      grip.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        grip.setPointerCapture(event.pointerId);
        toolsDrag = { pointerId: event.pointerId, y: event.clientY, top: tools.offsetTop };
      });
      grip.addEventListener('pointermove', (event) => {
        if (!toolsDrag || toolsDrag.pointerId !== event.pointerId) return;
        tools.style.top = clampToolsTop(toolsDrag.top + event.clientY - toolsDrag.y) + 'px';
      });
      const finishToolsDrag = (event) => {
        if (!toolsDrag || toolsDrag.pointerId !== event.pointerId) return;
        if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
        toolsDrag = null;
      };
      grip.addEventListener('pointerup', finishToolsDrag);
      grip.addEventListener('pointercancel', finishToolsDrag);
      grip.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const step = event.shiftKey ? 40 : 10;
        tools.style.top = clampToolsTop(tools.offsetTop + (event.key === 'ArrowDown' ? step : -step)) + 'px';
      });
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => {
          if (tools.style.top) tools.style.top = clampToolsTop(tools.offsetTop) + 'px';
        }).observe(tools.parentElement);
      }
    }
    const syncToolState = (message) => {
      timelineToolStateDirty = primaryMode !== 'select' || boxEnabled || autoHeightEnabled;
      stack.dataset.mouseMode = boxEnabled ? 'box' : primaryMode;
      tools.querySelectorAll('[data-mouse-mode]').forEach((button) => {
        const tool = button.dataset.mouseMode;
        const active = tool === primaryMode ||
          (tool === 'box' && boxEnabled) || (tool === 'adaptive' && autoHeightEnabled);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      announce(message);
      updateTimelineResetButton();
    };
    const chooseTool = (next) => {
      const wasBoxEnabled = boxEnabled;
      if (next === 'adaptive') {
        autoHeightEnabled = !autoHeightEnabled;
        updateAutoHeight();
      } else if (next === 'box') {
        boxEnabled = !boxEnabled;
        if (boxEnabled) primaryMode = 'select';
      } else if (next === 'select' || next === 'pan') {
        primaryMode = next;
        boxEnabled = false;
      }
      if (wasBoxEnabled && !boxEnabled) clearBoxTimeSelection();
      const label = ({ select: '选择模式', pan: '拖拽模式', adaptive: '高度自适应', box: '框选模式' })[next];
      const enabled = next === 'adaptive' ? autoHeightEnabled : next === 'box' ? boxEnabled : true;
      syncToolState(label + (enabled ? '已开启' : '已关闭'));
    };
    resetMouseTools = () => {
      primaryMode = 'select';
      boxEnabled = false;
      autoHeightEnabled = false;
      updateAutoHeight();
      syncToolState('选择模式已开启');
    };
    tools.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mouse-mode]');
      if (button) { chooseTool(button.dataset.mouseMode); return; }
      if (event.target.closest('#msiMouseHelpToggle')) {
        help.hidden = !help.hidden;
        helpToggle.setAttribute('aria-expanded', String(!help.hidden));
        return;
      }
      if (event.target.closest('#msiMouseToolsCollapse')) {
        const collapsed = tools.classList.toggle('is-collapsed');
        collapse.setAttribute('aria-expanded', String(!collapsed));
        collapse.setAttribute('aria-label', collapsed ? '展开鼠标模式面板' : '收起鼠标模式面板');
        collapse.title = collapse.getAttribute('aria-label');
        help.hidden = true;
        helpToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (!tools.contains(event.target) && !help.hidden) {
        help.hidden = true;
        helpToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !help.hidden) {
        help.hidden = true;
        helpToggle.setAttribute('aria-expanded', 'false');
        helpToggle.focus();
      }
    });

    bodies.forEach((body) => {
      // Track drags use the active gesture; a click still selects an event while box selection is on.
      body.addEventListener('click', (event) => {
        if (!allowBoxClick && (boxEnabled || primaryMode === 'pan') && event.target.closest('.msi-lane-track')) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      body.addEventListener('pointerdown', (event) => {
        const gesture = boxEnabled ? 'box' : primaryMode;
        if (gesture === 'select' || event.button !== 0 || !event.target.closest('.msi-lane-track')) return;
        const row = event.target.closest('.msi-lane-row');
        if (gesture === 'box' && !row) return;
        event.preventDefault();
        body.setPointerCapture(event.pointerId);
        body.classList.add('is-mouse-dragging');
        drag = {
          body, kind: gesture, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          scrollLeft: body.scrollLeft, scrollTop: body.scrollTop, row, clickTarget: event.target,
        };
        if (gesture === 'box') {
          const selection = document.createElement('div');
          selection.className = 'msi-mouse-selection';
          body.appendChild(selection);
          drag.selection = selection;
        }
      });
      body.addEventListener('pointermove', (event) => {
        if (!drag || drag.body !== body || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (drag.kind === 'pan') {
          body.scrollLeft = drag.scrollLeft - dx;
          body.scrollTop = drag.scrollTop - dy;
        } else if (drag.kind === 'box' && drag.selection) {
          if (!drag.started && Math.abs(dx) > 3) {
            clearBoxSelection();
            drag.started = true;
          }
          const rect = body.getBoundingClientRect();
          const laneWidth = body.parentElement.querySelector('.msi-swim-corner')?.offsetWidth || 0;
          const minX = rect.left + laneWidth;
          const x1 = Math.max(minX, Math.min(rect.right, drag.x));
          const x2 = Math.max(minX, Math.min(rect.right, event.clientX));
          const rowRect = drag.row.getBoundingClientRect();
          Object.assign(drag.selection.style, {
            left: (Math.min(x1, x2) - rect.left + body.scrollLeft) + 'px',
            top: (rowRect.top - rect.top + body.scrollTop) + 'px',
            width: Math.abs(x2 - x1) + 'px', height: rowRect.height + 'px',
          });
        }
      });
      const finish = (event) => {
        if (!drag || drag.body !== body || drag.pointerId !== event.pointerId) return;
        let clickTarget = null;
        if (drag.kind === 'box' && drag.selection) {
          const rect = drag.selection.getBoundingClientRect();
          let count = 0;
          if (drag.started && rect.width > 3 && rect.height > 3 && event.type !== 'pointercancel') {
            drag.row.querySelectorAll('.msi-bar').forEach((bar) => {
              const r = bar.getBoundingClientRect();
              if (r.left < rect.right && r.right > rect.left) {
                bar.classList.add('is-box-selected');
                count++;
              }
            });
            const panel = body.parentElement;
            const corner = panel.querySelector('.msi-swim-corner');
            const ruler = panel.querySelector('.msi-swim-ruler');
            if (corner && ruler?.clientWidth) {
              const start = (parseFloat(drag.selection.style.left) - corner.offsetWidth) / ruler.clientWidth;
              const end = (parseFloat(drag.selection.style.left) + rect.width - corner.offsetWidth) / ruler.clientWidth;
              showBoxTimeSelection(panel, Math.max(0, Math.min(1, start)), Math.max(0, Math.min(1, end)));
            }
            announce('已框选 ' + count + ' 个事件');
            updateTimelineResetButton();
          } else if (!drag.started && event.type !== 'pointercancel') {
            clickTarget = drag.clickTarget;
          }
          drag.selection.remove();
        }
        body.classList.remove('is-mouse-dragging');
        if (body.hasPointerCapture(event.pointerId)) body.releasePointerCapture(event.pointerId);
        drag = null;
        if (clickTarget?.isConnected) {
          allowBoxClick = true;
          try {
            clickTarget.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY,
            }));
          } finally {
            allowBoxClick = false;
          }
        }
      };
      body.addEventListener('pointerup', finish);
      body.addEventListener('pointercancel', finish);
    });
    syncToolState('选择模式已开启');
  }

  /* ══ 7. 视图切换；概览逻辑按需加载 ════════════════════════════════ */
  let overviewLoad = null;
  let overviewInitialized = false;
  function ensureOverview() {
    if (overviewInitialized) return Promise.resolve();
    if (window.MSI_OVERVIEW) {
      window.MSI_OVERVIEW.init(activateAnalysisTab);
      overviewInitialized = true;
      return Promise.resolve();
    }
    if (!overviewLoad) {
      overviewLoad = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'app/overview.js';
        script.onload = () => {
          if (!window.MSI_OVERVIEW) { reject(new Error('概览逻辑未注册')); return; }
          window.MSI_OVERVIEW.init(activateAnalysisTab);
          overviewInitialized = true;
          resolve();
        };
        script.onerror = () => reject(new Error('概览逻辑加载失败'));
        document.head.appendChild(script);
      });
    }
    return overviewLoad;
  }

  let memoryBlobURL = null;
  function ensureMemoryFrames() {
    const embedded = window.MSI_MEMORY_FRAME;
    if (embedded && !memoryBlobURL) {
      // Large data: iframe URLs can render blank; share one Blob URL in the single-file build.
      const binary = atob(embedded.slice('data:text/html;base64,'.length));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      memoryBlobURL = URL.createObjectURL(new Blob([bytes], { type: 'text/html' }));
    }
    document.querySelectorAll('.msi-memory-frame').forEach((frame) => {
      if (frame.getAttribute('src')) return;
      const source = frame.dataset.src;
      frame.src = memoryBlobURL ? memoryBlobURL + source.slice(source.indexOf('#')) : source;
    });
  }

  function activateAnalysisTab(name) {
    if (!['overview', 'timeline', 'memory', 'operator'].includes(name)) return false;
    if (name === 'overview' && (compareMode || selected.task.name !== 'profile_dir')) return false;
    document.querySelectorAll('.msi-tab').forEach((tab) => {
      const active = tab.dataset.analysisTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const overview = document.getElementById('msiOverviewPanel');
    const timeline = document.getElementById('msiTimelinePanel');
    const memory = document.getElementById('msiMemoryPanel');
    const operator = document.getElementById('msiOperatorPanel');
    if (overview) overview.hidden = name !== 'overview';
    if (timeline) timeline.hidden = name !== 'timeline';
    if (memory) memory.hidden = name !== 'memory';
    if (operator) operator.hidden = name !== 'operator';
    if (name === 'memory') ensureMemoryFrames();
    if (name === 'overview') ensureOverview().catch((error) => {
      const detail = document.getElementById('msiOvIssueDetail');
      if (detail) detail.textContent = error.message;
    });
    if (name === 'timeline') requestAnimationFrame(() => {
      renderRuler();
      if (selectedTraceTaskId) drawTraceTaskLinks();
      else drawPreviewTaskLinks();
    });
    return true;
  }
  window.WZH_ACTIVATE_ANALYSIS_TAB = activateAnalysisTab;

  function syncOverviewTabAvailability() {
    const tab = document.querySelector('.msi-tab[data-analysis-tab="overview"]');
    if (!tab) return;
    const available = !compareMode && selected.task.name === 'profile_dir';
    tab.disabled = !available;
    tab.title = available ? '查看 profile_dir 性能总览' : '性能总览仅适用于 profile_dir 记录';
    if (!available && tab.classList.contains('is-active')) activateAnalysisTab('timeline');
  }

  function renderMemoryDetail(container, raw, color = '', pathMode = 'key', onPathModeChange = () => {}) {
    if (!container) return;
    const text = (raw || '').trim();
    container.replaceChildren();
    const node = (tag, className, value) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (value != null) element.textContent = value;
      return element;
    };
    if (!text || text === 'none' || text.startsWith('在上方图表中悬停或点击')) {
      const empty = node('div', 'msi-memory-detail-empty');
      empty.append(node('strong', '', '选择内存块或事件'),
        node('span', '', '点击上方图表或事件列表，查看大小、地址和调用路径。'));
      container.append(empty);
      return;
    }

    const lines = text.split(/\r?\n/);
    const metrics = [];
    const addMetric = (label, value) => {
      if (value && value !== 'None') metrics.push({label, value: value.trim()});
    };
    const totalLine = /^\((.+?) allocated \/ (.+?) reserved\)$/.exec(lines[0]);
    if (totalLine) {
      addMetric('已分配', totalLine[1].replace(/\s*\([^)]*bytes\)/, ''));
      addMetric('已保留', totalLine[2].replace(/\s*\([^)]*bytes\)/, ''));
      lines.shift();
    }
    const headline = (lines.shift() || '').trim();
    const actionLabels = {
      alloc: '分配事件', free: '释放事件', free_requested: '请求释放',
      free_completed: '完成释放', segment_alloc: '分配段',
      segment_free: '释放段', segment_map: '映射段',
      segment_unmap: '解除映射', oom: '显存不足', snapshot: '快照',
    };
    const action = /^([a-z_]+)\b/.exec(headline)?.[1];
    const kind = headline.includes('mapped range') ? '映射内存段'
      : headline.includes('cached segment') ? '缓存内存段'
      : headline.includes('allocation') ? '内存分配'
      : actionLabels[action] || '内存详情';
    const field = (label, next) => {
      const match = new RegExp(`${label}:\\s*(.*?)(?=,\\s*(?:${next})|$)`).exec(headline);
      return match?.[1]?.trim() || '';
    };
    const addressRaw = field('Addr', 'Size') ||
      /^b'?[0-9a-f]+(?:_\d+)?'?(?=\s|$)/i.exec(headline)?.[0] ||
      (action && action !== 'oom' && action !== 'snapshot'
        ? /^\S+\s+(\S+)/.exec(headline)?.[1] : '') || '';
    const addressParts = /^b'?([0-9a-f]+)(?:_(\d+))?'?$/i.exec(addressRaw);
    const address = addressParts ? `0x${addressParts[1]}` : addressRaw;
    const version = addressParts?.[2];
    const sizeRaw = field('Size', 'Total memory used after allocation|Cached capacity|Compile context|stream|pool_id|timestamp') ||
      (action ? /^\S+\s+\S+\s+(.+)$/.exec(headline)?.[1] : '') || '';
    const size = sizeRaw.replace(/\s*\([^)]*bytes\)/, '')
      .replace(/\s+(allocation|cached segment|mapped range)$/i, '').trim();
    addMetric('大小', size);
    addMetric('使用中', field('Total memory used after allocation', 'Compile context|stream|pool_id|timestamp')
      .replace(/\s*\([^)]*bytes\)/, ''));
    const stream = /\bstream\s+(\d+)/.exec(headline)?.[1] ||
      /^\s*\(stream\s+(\d+)\)/.exec(lines[0] || '')?.[1];
    if (/^\s*\(stream\s+\d+\)/.test(lines[0] || '')) lines.shift();
    addMetric('Stream', stream);
    const pool = /\bpool_id\s+(\([^)]*\)|unknown)/.exec(headline)?.[1];
    addMetric('内存池', pool === 'unknown' ? '未知' : pool);
    const compile = field('Compile context', 'stream|pool_id|timestamp');
    addMetric('编译上下文', compile);
    const timestamp = /\btimestamp\s+(.+)$/.exec(headline)?.[1];
    if (timestamp) {
      const date = new Date(timestamp.replace(/\s*\([^)]*\)$/, ''));
      addMetric('时间', Number.isNaN(date.getTime()) ? timestamp :
        new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium'}).format(date));
    }

    const groups = [];
    let group = {title: '调用路径', frames: []};
    groups.push(group);
    const notes = [];
    const headings = {
      'Creation stack:': '创建调用栈', 'Release stack:': '释放调用栈',
      'Snapshot provenance:': '快照来源',
    };
    for (const line of lines) {
      const value = line.trim();
      if (!value) continue;
      if (headings[value] || value.startsWith('=== Forward Pass Stack Trace')) {
        group = {title: headings[value] || '前向传播调用栈', frames: []};
        groups.push(group);
        continue;
      }
      if (value.startsWith('>> FX:') && group.frames.length) {
        group.frames.at(-1).extra = value.slice(3).trim();
        continue;
      }
      const frame = /^(.*?):(\d+):(.*)$/.exec(line);
      if (frame && !line.includes('Addr:')) {
        group.frames.push({file: frame[1], line: frame[2], call: frame[3].trim()});
      } else {
        notes.push(value);
      }
    }

    const overview = node('section', 'msi-memory-detail-overview');
    const fields = node('dl', 'msi-memory-detail-fields');
    if (address) {
      const addressValue = node('dd', 'msi-memory-detail-address-value');
      if (color) {
        const dot = node('span', 'msi-memory-detail-color-dot');
        dot.style.backgroundColor = color;
        dot.setAttribute('aria-hidden', 'true');
        addressValue.append(dot);
      }
      addressValue.append(node('span', 'msi-memory-detail-address-text', address));
      if (version != null) addressValue.append(node('small', '', `版本${version}`));
      fields.append(node('dt', '', '内存地址'), addressValue);
    }
    fields.append(node('dt', '', '类型'), node('dd', '', kind));
    for (const {label, value} of metrics) {
      fields.append(node('dt', '', label), node('dd', 'msi-memory-detail-mono', value));
    }
    overview.append(fields);

    const path = node('section', 'msi-memory-detail-path');
    const framesCount = groups.reduce((sum, item) => sum + item.frames.length, 0);
    const stackGroups = groups.filter(item => item.frames.length).map((item) => {
      const ordered = [...item.frames].reverse();
      const appFrames = ordered.filter(frame => /\.py$/i.test(frame.file) &&
        !/[\\/]site-packages[\\/]|[\\/]lib[\\/]python/i.test(frame.file));
      const keyFrames = new Set([...appFrames.slice(-3), ...item.frames.slice(0, 4)]);
      const featured = ordered.length <= 7 ? ordered : ordered.filter(frame => keyFrames.has(frame));
      return {title: item.title, full: ordered, key: featured.length ? featured : ordered.slice(-5)};
    });
    const keyCount = stackGroups.reduce((sum, item) => sum + item.key.length, 0);
    const pathHead = node('div', 'msi-memory-detail-path-head');
    pathHead.setAttribute('role', 'tablist');
    pathHead.setAttribute('aria-label', '调用路径');
    const panels = {
      key: node('div', 'msi-memory-detail-path-panel'),
      full: node('div', 'msi-memory-detail-path-panel'),
    };
    const tabs = {};
    for (const [mode, label, count] of [['key', '关键调用路径', keyCount], ['full', '完整调用路径', framesCount]]) {
      const tab = node('button', 'msi-memory-detail-path-tab', `${label}（${count}）`);
      tab.type = 'button';
      tab.id = `msiMemoryPathTab-${mode}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `msiMemoryPathPanel-${mode}`);
      tabs[mode] = tab;
      pathHead.append(tab);
      panels[mode].id = `msiMemoryPathPanel-${mode}`;
      panels[mode].setAttribute('role', 'tabpanel');
      panels[mode].setAttribute('aria-labelledby', tab.id);
    }
    const setPathMode = (mode) => {
      for (const name of ['key', 'full']) {
        tabs[name].setAttribute('aria-selected', String(name === mode));
        panels[name].hidden = name !== mode;
      }
      onPathModeChange(mode);
    };
    for (const mode of ['key', 'full']) tabs[mode].addEventListener('click', () => setPathMode(mode));
    pathHead.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = tabs.key.getAttribute('aria-selected') === 'true' ? 'full' : 'key';
      setPathMode(next);
      tabs[next].focus();
    });
    const frameList = (frames) => {
      const list = node('ol', 'msi-memory-detail-stack');
      for (const [index, frame] of frames.entries()) {
        const entry = node('li', 'msi-memory-detail-frame');
        const file = frame.file.split(/[\\/]/).pop() || '运行时';
        const call = frame.call.replace(/\(.*$/, '').split('::').pop() || frame.call;
        const title = node('span', 'msi-memory-detail-title', call);
        title.title = frame.call;
        const head = node('div', 'msi-memory-detail-frame-head');
        head.append(title);
        if (index < frames.length - 1) head.insertAdjacentHTML('beforeend', chainArrowHtml());
        const location = node('span', 'msi-chain-explain msi-memory-detail-location',
          `${file}${frame.line === '0' ? '' : `:${frame.line}`}`);
        location.title = `${frame.file}${frame.line === '0' ? '' : `:${frame.line}`}`;
        entry.append(head, location);
        if (frame.extra) entry.append(node('small', 'msi-memory-detail-extra', frame.extra));
        list.append(entry);
      }
      return list;
    };
    for (const mode of ['key', 'full']) {
      const panel = panels[mode];
      for (const item of stackGroups) {
        if (stackGroups.length > 1) panel.append(node('div', 'msi-memory-detail-stack-label', item.title));
        panel.append(frameList(item[mode]));
      }
      if (!framesCount) panel.append(node('p', 'msi-memory-detail-no-stack', '这条记录没有可用的调用栈。'));
      const original = node('details', 'msi-memory-detail-raw');
      original.open = true;
      original.append(node('summary', '', '原始详情'), node('pre', '', text));
      panel.append(original);
    }
    path.append(pathHead, panels.key, panels.full);
    setPathMode(pathMode === 'full' ? 'full' : 'key');
    if (notes.length) {
      const extra = node('details', 'msi-memory-detail-raw');
      if (!framesCount) extra.open = true;
      extra.append(node('summary', '', `补充信息 · ${notes.length} 行`),
        node('pre', '', notes.join('\n')));
      path.append(extra);
    }
    container.append(overview, path);
  }

  function initAnalysisTabs() {
    document.querySelector('.msi-tabs')?.addEventListener('click', (event) => {
      const tab = event.target.closest('.msi-tab[data-analysis-tab]');
      if (tab && !tab.disabled) activateAnalysisTab(tab.dataset.analysisTab);
    });
    const memoryFrames = {
      'Active Memory Timeline': document.getElementById('msiMemoryTimelineFrame'),
      'Allocator State History': document.getElementById('msiMemoryAllocatorFrame'),
    };
    const memoryResetButtons = {
      'Active Memory Timeline': document.querySelector('[data-memory-reset="timeline"]'),
      'Allocator State History': document.querySelector('[data-memory-reset="allocator"]'),
    };
    const memoryZoomControls = {
      'Active Memory Timeline': document.querySelector('[data-memory-zoom="timeline"]'),
      'Allocator State History': document.querySelector('[data-memory-zoom="allocator"]'),
    };
    const memoryReady = new Set();
    Object.values(memoryZoomControls).forEach((control) => {
      if (!control) return;
      const toggle = control.querySelector('.msi-memory-zoom-toggle');
      const setExpanded = (expanded) => toggle?.setAttribute('aria-expanded', String(expanded));
      control.addEventListener('pointerenter', () => setExpanded(true));
      control.addEventListener('pointerleave', () => setExpanded(control.contains(document.activeElement)));
      control.addEventListener('focusin', () => setExpanded(true));
      control.addEventListener('focusout', () => requestAnimationFrame(() =>
        setExpanded(control.matches(':hover') || control.contains(document.activeElement))));
    });
    Object.entries(memoryResetButtons).forEach(([view, button]) => {
      button?.addEventListener('click', () =>
        memoryFrames[view]?.contentWindow?.postMessage({type: 'msi-memory-reset-view'}, '*'));
    });
    const pendingMemoryLink = {};
    function syncMemoryTheme() {
      const theme = document.documentElement.dataset.theme;
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--brand-accent').trim();
      const tint = styles.getPropertyValue('--brand-tint').trim();
      const danger = styles.getPropertyValue('--danger').trim();
      const purple = styles.getPropertyValue('--brand-purple').trim();
      const foreground = styles.getPropertyValue('--foreground').trim();
      const border = styles.getPropertyValue('--border-default').trim();
      const muted = styles.getPropertyValue('--foreground-muted').trim();
      Object.values(memoryFrames).forEach((frame) => {
        if (frame?.getAttribute('src')) frame.contentWindow?.postMessage({type: 'msi-memory-theme', theme, accent, tint, danger, purple, foreground, border, muted}, '*');
      });
    }
    Object.values(memoryFrames).forEach((frame) => frame?.addEventListener('load', syncMemoryTheme));
    new MutationObserver(syncMemoryTheme).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme', 'data-brand']});
    const memoryDetail = document.getElementById('msiMemoryDetail');
    const memoryPanel = document.getElementById('msiMemoryPanel');
    const memoryFoot = document.getElementById('msiMemoryFoot');
    const memoryToggle = document.getElementById('msiMemoryDetailToggle');
    const memoryTitle = document.getElementById('msiMemoryDetailTitle');
    const memoryRange = document.getElementById('msiMemoryRange');
    const memoryRangeValue = document.getElementById('msiMemoryRangeValue');
    const memoryAddressSearch = document.getElementById('msiMemoryAddressSearch');
    const memoryFrameSearch = document.getElementById('msiMemoryFrameSearch');
    const memoryAddressMatches = document.getElementById('msiMemoryAddressMatches');
    const memoryFrameMatches = document.getElementById('msiMemoryFrameMatches');
    const memoryUnfreed = {
      total: document.getElementById('msiMemoryUnfreedTotal'),
      max: document.getElementById('msiMemoryUnfreedMax'),
      min: document.getElementById('msiMemoryUnfreedMin'),
    };
    const details = {};
    let focusedView = 'Active Memory Timeline';
    function setMemoryDetailExpanded(expanded) {
      memoryPanel?.classList.toggle('is-detail-expanded', expanded);
      memoryFoot?.classList.toggle('is-collapsed', !expanded);
      memoryFoot?.setAttribute('aria-expanded', String(expanded));
      memoryTitle?.setAttribute('aria-expanded', String(expanded));
      memoryToggle?.setAttribute('aria-expanded', String(expanded));
      const label = expanded ? '收起详情栏' : '展开详情栏';
      if (memoryToggle) {
        memoryToggle.setAttribute('aria-label', label);
        memoryToggle.title = label;
      }
      if (expanded && memoryPanel) requestAnimationFrame(() => {
        if (memoryPanel.classList.contains('is-detail-expanded')) memoryPanel.scrollTop = memoryPanel.scrollHeight;
      });
      else if (memoryPanel) memoryPanel.scrollTop = 0;
    }
    memoryFoot?.querySelector('.msi-foot-head')?.addEventListener('click', () =>
      setMemoryDetailExpanded(memoryFoot.classList.contains('is-collapsed')));
    function sendMemoryControl(control, value) {
      memoryFrames['Active Memory Timeline']?.contentWindow?.postMessage({type: 'msi-memory-control', control, value}, '*');
    }
    function updateMemoryRangeProgress() {
      if (!memoryRange) return;
      const min = Number(memoryRange.min);
      const max = Number(memoryRange.max);
      const value = Number(memoryRange.value);
      const progress = max > min ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) : 0;
      memoryRange.style.setProperty('--msi-memory-range-progress', `${progress}%`);
    }
    memoryRange?.addEventListener('input', () => {
      if (memoryRangeValue) memoryRangeValue.textContent = `${memoryRange.value} / ${memoryRange.max} 条记录`;
      updateMemoryRangeProgress();
    });
    memoryRange?.addEventListener('change', () => sendMemoryControl('range', memoryRange.value));
    memoryAddressSearch?.addEventListener('input', () => sendMemoryControl('address', memoryAddressSearch.value));
    memoryFrameSearch?.addEventListener('input', () => sendMemoryControl('frame', memoryFrameSearch.value));
    function matchCount(value) {
      const count = Number.parseInt(value, 10);
      return Number.isNaN(count) ? '' : `${count} 项`;
    }
    let memoryPathMode = 'key';
    function showMemoryDetail() {
      const detail = details[focusedView];
      renderMemoryDetail(memoryDetail, detail?.text, detail?.color, memoryPathMode, (mode) => { memoryPathMode = mode; });
    }
    window.addEventListener('message', (event) => {
      const view = event.data?.view;
      if (!Object.hasOwn(memoryFrames, view) || event.source !== memoryFrames[view]?.contentWindow) return;
      if (event.data.type === 'msi-memory-ready') {
        memoryReady.add(view);
        syncMemoryTheme();
        if (pendingMemoryLink[view]) {
          memoryFrames[view].contentWindow.postMessage({
            type: 'msi-memory-link-target',
            selection: pendingMemoryLink[view],
          }, '*');
          delete pendingMemoryLink[view];
        }
        return;
      }
      if (event.data.type === 'msi-memory-view-modified') {
        const button = memoryResetButtons[view];
        if (button) {
          button.dataset.viewModified = String(event.data.modified);
          button.disabled = !event.data.modified;
        }
        return;
      }
      if (event.data.type === 'msi-memory-interval-stats' && view === 'Active Memory Timeline') {
        const formatKB = (bytes) => Number.isFinite(bytes) ? (bytes / 1024).toFixed(3) : '—';
        if (memoryUnfreed.total) memoryUnfreed.total.textContent = formatKB(event.data.total);
        if (memoryUnfreed.max) memoryUnfreed.max.textContent = formatKB(event.data.max);
        if (memoryUnfreed.min) memoryUnfreed.min.textContent = formatKB(event.data.min);
        return;
      }
      if (event.data.type === 'msi-memory-link-selection') {
        const targetView = view === 'Active Memory Timeline'
          ? 'Allocator State History' : 'Active Memory Timeline';
        if (memoryReady.has(targetView)) {
          memoryFrames[targetView]?.contentWindow?.postMessage({
            type: 'msi-memory-link-target',
            selection: event.data.selection,
          }, '*');
        } else {
          pendingMemoryLink[targetView] = event.data.selection;
        }
        return;
      }
      if (event.data.type === 'msi-memory-toolbar') {
        if (memoryRange) {
          memoryRange.max = String(Math.max(1, event.data.max));
          memoryRange.value = String(event.data.value);
          memoryRange.disabled = event.data.max === 0;
          updateMemoryRangeProgress();
        }
        if (memoryRangeValue) memoryRangeValue.textContent = `${event.data.value} / ${event.data.max} 条记录`;
        if (memoryAddressSearch) memoryAddressSearch.disabled = false;
        if (memoryFrameSearch) memoryFrameSearch.disabled = false;
        if (memoryAddressMatches) memoryAddressMatches.textContent = matchCount(event.data.addressMatches);
        if (memoryFrameMatches) memoryFrameMatches.textContent = matchCount(event.data.frameMatches);
        return;
      }
      if (event.data.type === 'msi-memory-focus') focusedView = view;
      else if (event.data.type === 'msi-memory-detail') details[view] = {text: event.data.text, color: event.data.color};
      else return;
      if (view === focusedView) showMemoryDetail();
    });
    updateMemoryRangeProgress();
    showMemoryDetail();
  }

  /* ══ 8. 启动 ═══════════════════════════════════════════════════ */
  function boot() {
    const swimStack = document.getElementById('msiTimelineSwims');
    const baselineSwim = document.getElementById('msiSwim');
    if (swimStack && baselineSwim) ensurePinnedCard(swimStack, baselineSwim);
    initTree();
    initCompareMode();
    initSidebarDrawer();
    initZoom();
    initMouseModes();
    initSwimlanes();
    initBarMenu();
    initSelectionPanel();
    applySelection();
    initAnalysisTabs();
    const entry = document.documentElement.dataset.entryView;
    activateAnalysisTab(entry === 'overview' ? 'overview' : 'timeline');
    if (entry === 'compare') {
      setCompareMode(true);
      const requested = new URLSearchParams(window.location.search).get('compare');
      const task = requested && PROF_TASKS.find((item) => item.name === requested && item !== selected.task);
      if (task) toggleCompareTask(task);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

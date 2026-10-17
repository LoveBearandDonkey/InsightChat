(function () {
  let activateAnalysisTab = () => false;
  const PROFILE_OVERVIEW_ISSUES = [
    {
      priority: 'P0', benefit: '-28%', difficulty: '中',
      title: 'PP 末级（stage3, rank6/7）计算过载，制造约 35% 单步 bubble',
      impact: '单步约 10.80 s 被末级计算 gating。全集群每步约 6 卡 × 3.77 s ≈ 22.6 卡·秒空耗在 bubble，约占集群总算力时间的 26%。',
      evidence: 'cluster_time_summary 的 ClusterTimeSummary 表显示：8 卡 step 时间几乎相同（10796.6–10800.6 ms，CV≈0.012%），属于典型全局同步训练，无硬件型快/慢卡。但 stage3（rank6/7）计算均值 9257 ms，stage0–2 均值 6147 ms，末级多算 3110 ms/step（1.51×）。compute_op_sum 与 kernel_details.csv 进一步定位到：MatMulV2（lm_head/logits 投影，平均 16.0 ms/次 × 64 次 ≈ 1024 ms）仅出现在 stage3 的 rank6/7；末级 loss 相关 vector 算子耗时还是 stage0 的约 1.6×。rank0–5 因此每步在 P2P recv 上空等 3.51–4.05 s（均值 3.77 s）。',
      steps: [
        '采用非均匀 PP 切分：减少最后一级 decoder 层数，使用 --decoder-last-pipeline-num-layers 按实测微调，使 stage3 计算从约 9.26 s 降到约 6.4 s。',
        '开启 lm_head 张量切分或 vocab-parallel cross-entropy，把 logits GEMM 与交叉熵计算摊到多卡。',
        '复采时提高 num_microbatches，并确认采用 1F1B 调度，进一步压低固有 bubble。',
      ],
      verification: '重采后再跑 msprof-analyze -m cluster_time_summary，确认 stage3 与 stage0–2 的计算耗时极差小于 10%，stage0–2 的 communicationWaitStageTime 从约 3.77 s 降至 1.5 s 以下，单步降至约 7.5–8.0 s。',
      view: '算子视图 + Timeline 视图（系统调优）',
    },
    {
      priority: 'P0', benefit: '-12%', difficulty: '中',
      title: '计算-通信零重叠（Overlapped=0），暴露通信 100% 进入关键路径',
      impact: '暴露通信和流水线 bubble 直接落在关键路径；即便链路本身健康，这部分时间也无法被掩盖。结合末级负载不均，stage0–2 暴露通信中约 80% 实际为 stage 等待。',
      evidence: '8 卡 step_trace_time.csv 与 ClusterTimeSummary 的 communicationOverlapComputation 列全部为 0.0，即没有任何通信被计算掩盖。Communication(Not Overlapped) 与 Communication 完全相等；rank0 step4 的 4389.6 ms 通信全部暴露。RDMA P2P，以及 rank0/1 单卡约 0.93–0.94 s/2step 的大 allreduce 和 rank6/7 各 270 个小 allreduce，均未与计算并行。',
      steps: [
        '开启 interleaved 1F1B（virtual pipeline），用更细的 micro-stage 让前向与反向交错。',
        '开启 overlap_grad_reduce，并为梯度 reduce 配置独立通信 stream，让 DP allreduce 隐藏到反向计算之后。',
        '确认 PP P2P 使用独立 stream，避免通信与计算串行化。',
      ],
      verification: '重采后 ClusterTimeSummary.communicationOverlapComputation 应大于 0，各卡“暴露通信”占 step 的比例至少下降 10 个百分点。',
      view: 'Timeline 视图（系统调优）',
    },
    {
      priority: 'P1', benefit: '', difficulty: '低',
      title: '关键环境变量未设置（缓存 / 显存分配器）',
      impact: 'aclnn 缓存和 host 缓存偏小会增加算子下发开销；缺少 expandable_segments 容易造成显存分配器碎片。本次未开启 profile_memory，因此碎片量暂未量化。',
      evidence: 'profiler_metadata.json 的 ENV_VARIABLES 中 ACLNN_CACHE_LIMIT、HOST_CACHE_CAPACITY、PYTORCH_NPU_ALLOC_CONF 均为空。msprof-analyze advisor 的 Environment Variable Issues 建议设置：ACLNN_CACHE_LIMIT=100000、HOST_CACHE_CAPACITY=20、PYTORCH_NPU_ALLOC_CONF=expandable_segments:True。',
      steps: [
        '在训练启动脚本中设置 export ACLNN_CACHE_LIMIT=100000。',
        '设置 export HOST_CACHE_CAPACITY=20。',
        '设置 export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True 后重新训练和采集。',
      ],
      verification: '重采后 advisor 不再提示 Environment Variable Issues，并对比 cann_api_sum，确认 host 侧下发与 Tiling API 总耗时下降。',
      view: 'Timeline 视图（系统调优）',
    },
    {
      priority: 'P1', benefit: '', difficulty: '低',
      title: '动态 Shape 触发算子在线编译',
      impact: '动态 shape 进入在线编译路径，会引入额外的 host 编译与下发开销，放大调度抖动。',
      evidence: 'msprof-analyze advisor 的 Operator Dynamic Shape Issues 命中，建议使用 torch_npu.npu.set_compile_mode(jit_compile=False)，并设置 torch_npu.npu.config.allow_internal_format = False。',
      steps: [
        '在训练入口初始化代码中调用 torch_npu.npu.set_compile_mode(jit_compile=False)。',
        '设置 torch_npu.npu.config.allow_internal_format = False，固定为静态 shape 编译路径。',
      ],
      verification: '重采后 advisor 不再提示 Dynamic Shape，cann_api_sum 中编译相关 API 耗时下降。',
      view: '算子视图',
    },
    {
      priority: 'P2', benefit: '', difficulty: '中',
      title: 'stage3 重载卡 AI Core 降频（rank6/7 低至 1200–1350 MHz）',
      impact: '末级处在 gating 路径，降频会进一步拉长单步。但当前降频幅度温和，影响次于负载不均与零重叠；降频可能同时来自 bubble 期空转和高负载下的功耗、散热约束。',
      evidence: 'freq_analysis 的 AbnormalFrequencyRanks 显示：rank6 出现 1200/1250/1300 MHz，rank7 出现 1250/1300 MHz 等低频样本，额定频率为 1800 MHz；负载较轻的 rank0 主要为 1700–1800 MHz。降频集中在计算最重的末级两卡。',
      steps: [
        '先完成 stage3 负载均衡，再复采观察 rank6/7 的频率是否回升至 1800 MHz。',
        '若负载拉平后仍然降频，排查 localhost 节点的散热条件与功耗墙。',
      ],
      verification: '重采后 freq_analysis 中 rank6/7 不再出现低于 1500 MHz 的样本。',
      view: '算子视图',
    },
  ];

  function overviewEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function renderOverviewIssue(index) {
    const issue = PROFILE_OVERVIEW_ISSUES[index];
    const detail = document.getElementById('msiOvIssueDetail');
    const list = document.getElementById('msiOvIssueList');
    if (!issue || !detail || !list) return;
    list.querySelectorAll('.msi-ov-issue-btn').forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    const steps = issue.steps.map((step) => '<li>' + overviewEscape(step) + '</li>').join('');
    const openTimeline = issue.view.includes('Timeline')
      ? '<button class="msi-ov-detail-action" type="button" data-overview-open-tab="timeline">在时间线中查看</button>'
      : '';
    detail.innerHTML =
      '<div class="msi-ov-detail-head">' +
        '<span class="msi-ov-badge msi-ov-badge--' + issue.priority.toLowerCase() + '">' + issue.priority + '</span>' +
        '<div class="msi-ov-detail-title">' + overviewEscape(issue.title) + '</div>' +
        (issue.benefit ? '<span class="msi-ov-badge msi-ov-badge--gain">' + overviewEscape(issue.benefit) + '</span>' : '') +
        '<span class="msi-ov-badge">难度 ' + overviewEscape(issue.difficulty) + '</span>' +
      '</div>' +
      '<div class="msi-ov-detail-block msi-ov-detail-block--impact"><div class="msi-ov-detail-label">影响</div><p class="msi-ov-detail-text">' + overviewEscape(issue.impact) + '</p></div>' +
      '<div class="msi-ov-detail-block"><div class="msi-ov-detail-label">证据</div><p class="msi-ov-detail-text">' + overviewEscape(issue.evidence) + '</p></div>' +
      '<div class="msi-ov-detail-block"><div class="msi-ov-detail-label">修复建议</div><ol class="msi-ov-detail-steps">' + steps + '</ol></div>' +
      '<div class="msi-ov-detail-block msi-ov-detail-block--verify"><div class="msi-ov-detail-label">验证标准</div><p class="msi-ov-detail-text">' + overviewEscape(issue.verification) + '</p></div>' +
      '<div class="msi-ov-detail-actions"><span class="msi-ov-tag">举证视图：' + overviewEscape(issue.view) + '</span>' + openTimeline + '</div>';
  }

  function initOverviewMetricEditor() {
    const board = document.getElementById('msiOvMetricBoard');
    const button = document.getElementById('msiOvMetricEditBtn');
    const panel = document.getElementById('msiOvMetricEditor');
    if (!board || !button || !panel) return;
    const cards = () => [...board.querySelectorAll('.msi-ov-metric')];
    let draggedItem = null;

    function renderEditor() {
      const shown = cards().filter((card) => !card.hidden);
      const hidden = cards().filter((card) => card.hidden);
      const row = (card, visible) => {
        const key = overviewEscape(card.dataset.metric);
        const name = overviewEscape(card.querySelector('.msi-ov-metric-name')?.textContent.trim() || key);
        return '<div class="msi-ov-editor-item' + (visible ? '' : ' is-muted') + '" data-metric="' + key + '"' +
          (visible ? ' draggable="true" tabindex="0" title="拖动排序，或按 Alt + 上下方向键"' : '') + '>' +
          '<span class="msi-ov-editor-handle" aria-hidden="true"' + (visible ? '' : ' style="visibility:hidden"') + '>⋮⋮</span>' +
          '<span class="msi-ov-editor-label">' + name + '</span>' +
          '<input type="checkbox" data-metric="' + key + '" aria-label="显示' + name + '"' + (visible ? ' checked' : '') + '></div>';
      };
      panel.innerHTML =
        '<div class="msi-ov-editor-title"><span>已显示</span><span>拖动排序</span></div>' +
        '<div class="msi-ov-editor-shown" id="msiOvEditorShown">' +
        (shown.length ? shown.map((card) => row(card, true)).join('') : '<div class="msi-ov-editor-empty">暂无显示的指标</div>') + '</div>' +
        '<div class="msi-ov-editor-title"><span>未显示</span><span>勾选加入看板</span></div>' +
        (hidden.length ? hidden.map((card) => row(card, false)).join('') : '<div class="msi-ov-editor-empty">所有指标均已显示</div>');
      board.classList.toggle('is-empty', shown.length === 0);
    }

    function setOpen(open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) renderEditor();
    }

    function syncBoardOrder() {
      const keys = [...panel.querySelectorAll('.msi-ov-editor-shown .msi-ov-editor-item')].map((item) => item.dataset.metric);
      keys.forEach((key) => {
        const card = cards().find((item) => item.dataset.metric === key);
        if (card) board.appendChild(card);
      });
      cards().filter((card) => card.hidden).forEach((card) => board.appendChild(card));
    }

    button.addEventListener('click', () => setOpen(panel.hidden));
    document.addEventListener('click', (event) => {
      if (!panel.hidden && !button.contains(event.target) && !panel.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) { setOpen(false); button.focus(); }
    });
    panel.addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[data-metric]');
      if (!checkbox) return;
      const card = cards().find((item) => item.dataset.metric === checkbox.dataset.metric);
      if (!card) return;
      card.hidden = !checkbox.checked;
      board.appendChild(card);
      renderEditor();
      [...panel.querySelectorAll('input[data-metric]')].find((input) => input.dataset.metric === checkbox.dataset.metric)?.focus();
    });
    panel.addEventListener('click', (event) => {
      const row = event.target.closest('.msi-ov-editor-item');
      if (!row || event.target.closest('input')) return;
      const checkbox = row.querySelector('input');
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    panel.addEventListener('dragstart', (event) => {
      draggedItem = event.target.closest('.msi-ov-editor-shown .msi-ov-editor-item');
      if (!draggedItem) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedItem.dataset.metric);
      requestAnimationFrame(() => draggedItem?.classList.add('is-dragging'));
    });
    panel.addEventListener('dragover', (event) => {
      const shown = panel.querySelector('.msi-ov-editor-shown');
      if (!draggedItem || !shown?.contains(event.target)) return;
      event.preventDefault();
      const next = [...shown.querySelectorAll('.msi-ov-editor-item:not(.is-dragging)')]
        .find((item) => event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2);
      shown.insertBefore(draggedItem, next || null);
    });
    panel.addEventListener('dragend', () => {
      if (!draggedItem) return;
      draggedItem.classList.remove('is-dragging');
      draggedItem = null;
      syncBoardOrder();
      renderEditor();
    });
    panel.addEventListener('keydown', (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const row = event.target.closest('.msi-ov-editor-shown .msi-ov-editor-item');
      if (!row) return;
      const sibling = event.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling?.classList.contains('msi-ov-editor-item')) return;
      event.preventDefault();
      if (event.key === 'ArrowUp') sibling.before(row);
      else sibling.after(row);
      syncBoardOrder();
      const key = row.dataset.metric;
      renderEditor();
      [...panel.querySelectorAll('.msi-ov-editor-item')].find((item) => item.dataset.metric === key)?.focus();
    });
    renderEditor();
  }

  const OVERVIEW_RUNTIME_COLORS = {
    compute: '#1267d6',
    overlap: '#1f9d72',
    communication: '#32aeb8',
    idle: '#6941d9',
    preprocess: '#ff6045',
    computeRatio: '#1684f8',
    communicationRatio: '#df4275',
  };

  const OVERVIEW_RUNTIME_SERIES = [
    { key: 'computeRatio', label: '计算占比', kind: 'line' },
    { key: 'communicationRatio', label: '通信占比', kind: 'line' },
    { key: 'compute', label: '计算时间（未重叠）', kind: 'bar' },
    { key: 'overlap', label: '计算通信重叠时间', kind: 'bar' },
    { key: 'communication', label: '通信时间（未重叠）', kind: 'bar' },
    { key: 'idle', label: '空闲时间', kind: 'bar' },
    { key: 'preprocess', label: '预处理时间', kind: 'bar' },
  ];

  const OVERVIEW_RUNTIME_DATA = [
    { rank: 0, compute: 6148, overlap: 0, communication: 4389, idle: 205, preprocess: 56 },
    { rank: 1, compute: 6151, overlap: 0, communication: 4362, idle: 228, preprocess: 57 },
    { rank: 2, compute: 6144, overlap: 0, communication: 4407, idle: 189, preprocess: 58 },
    { rank: 3, compute: 6154, overlap: 0, communication: 4375, idle: 212, preprocess: 57 },
    { rank: 4, compute: 6141, overlap: 0, communication: 4351, idle: 248, preprocess: 57 },
    { rank: 5, compute: 6145, overlap: 0, communication: 4398, idle: 198, preprocess: 58 },
    { rank: 6, compute: 9257, overlap: 0, communication: 1196, idle: 287, preprocess: 57 },
    { rank: 7, compute: 9254, overlap: 0, communication: 1248, idle: 239, preprocess: 58 },
  ];

  function runtimeData(step, domain, sort) {
    const stepFactor = step === '3' ? .992 : step === '4' ? 1.008 : 1;
    const domainFactor = domain === 'pp' ? .82 : domain === 'dp' ? .18 : 1;
    const data = OVERVIEW_RUNTIME_DATA.map((item, index) => {
      const jitter = step === 'mean' ? 1 : 1 + ((index % 3) - 1) * .003;
      const next = {
        ...item,
        compute: Math.round(item.compute * stepFactor * jitter),
        communication: Math.round(item.communication * domainFactor / stepFactor),
      };
      const total = next.compute + next.overlap + next.communication + next.idle + next.preprocess;
      next.computeRatio = next.compute / total * 100;
      next.communicationRatio = next.communication / total * 100;
      next.total = total;
      return next;
    });
    if (sort !== 'rank') data.sort((a, b) => (b[sort] || 0) - (a[sort] || 0) || a.rank - b.rank);
    return data;
  }

  function initOverviewRuntimeChart() {
    const chart = document.getElementById('msiOvRuntimeChart');
    const wrap = chart?.closest('.msi-ov-runtime-chart-wrap');
    const tooltip = document.getElementById('msiOvRuntimeTooltip');
    const legend = document.getElementById('msiOvRuntimeLegend');
    const stepSelect = document.getElementById('msiOvRuntimeStep');
    const domainSelect = document.getElementById('msiOvRuntimeDomain');
    const sortSelect = document.getElementById('msiOvRuntimeSort');
    const gapLabel = document.getElementById('msiOvRuntimeGap');
    if (!chart || !wrap || !tooltip || !legend || !stepSelect || !domainSelect || !sortSelect) return;

    const formatMs = (value) => value >= 1000
      ? (value / 1000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' s'
      : Math.round(value).toLocaleString('zh-CN') + ' ms';
    const formatAxis = (value) => value === 0 ? '0' : (value / 1000).toFixed(0) + 's';
    const esc = overviewEscape;
    const enabledSeries = new Set(OVERVIEW_RUNTIME_SERIES.map((series) => series.key));
    let currentData = [];
    let currentLayout = null;

    function renderLegend() {
      legend.innerHTML = OVERVIEW_RUNTIME_SERIES.map((series) => {
        const enabled = enabledSeries.has(series.key);
        return '<button class="msi-ov-runtime-legend-item' + (enabled ? '' : ' is-disabled') + '" type="button"' +
          ' data-runtime-legend="' + series.key + '" aria-pressed="' + (enabled ? 'true' : 'false') + '"' +
          ' title="' + (enabled ? '点击隐藏' : '点击显示') + series.label + '">' +
            '<i class="msi-ov-runtime-legend-swatch' + (series.kind === 'line' ? ' is-line' : '') + '" style="--legend-color:' + OVERVIEW_RUNTIME_COLORS[series.key] + '"></i>' +
            '<span>' + series.label + '</span>' +
          '</button>';
      }).join('');
    }

    function tooltipHtml(item, highlightedSeries) {
      return '<div class="msi-ov-runtime-tooltip-title">Rank ' + item.rank + '<span>' + esc(stepSelect.options[stepSelect.selectedIndex].text) + '</span></div>' +
        OVERVIEW_RUNTIME_SERIES.filter((series) => enabledSeries.has(series.key)).map((series) => {
          const value = series.kind === 'line' ? item[series.key].toFixed(1) + '%' : formatMs(item[series.key]);
          return '<div class="msi-ov-runtime-tooltip-row' + (series.key === highlightedSeries ? ' is-active' : '') + '" style="--dot-color:' + OVERVIEW_RUNTIME_COLORS[series.key] + '">' +
            '<i class="msi-ov-runtime-tooltip-dot" style="--dot-color:' + OVERVIEW_RUNTIME_COLORS[series.key] + '"></i>' +
            '<span>' + series.label + '</span><span class="msi-ov-runtime-tooltip-value">' + value + '</span></div>';
        }).join('') +
        '<div class="msi-ov-runtime-tooltip-row"><i></i><strong>总耗时</strong><span class="msi-ov-runtime-tooltip-value">' + formatMs(item.total) + '</span></div>';
    }

    function clearHighlight() {
      tooltip.hidden = true;
      chart.querySelectorAll('.is-dimmed, .is-highlighted').forEach((node) => node.classList.remove('is-dimmed', 'is-highlighted'));
      chart.querySelector('.hover-guide')?.remove();
    }

    function highlight(seriesKey, index, clientX, clientY) {
      const item = currentData[index];
      if (!item) return;
      chart.querySelectorAll('[data-runtime-series]').forEach((node) => {
        const active = node.dataset.runtimeSeries === seriesKey;
        node.classList.toggle('is-highlighted', active);
        node.classList.toggle('is-dimmed', !active);
      });
      chart.querySelector('.hover-guide')?.remove();
      const x = currentLayout.centerX(index);
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      guide.setAttribute('class', 'hover-guide');
      guide.setAttribute('x1', x); guide.setAttribute('x2', x);
      guide.setAttribute('y1', currentLayout.margin.top);
      guide.setAttribute('y2', currentLayout.height - currentLayout.margin.bottom);
      chart.appendChild(guide);

      tooltip.innerHTML = tooltipHtml(item, seriesKey);
      tooltip.hidden = false;
      const wrapRect = wrap.getBoundingClientRect();
      const chartRect = chart.getBoundingClientRect();
      const fallbackX = chartRect.left - wrapRect.left + x - wrap.scrollLeft;
      const localX = Number.isFinite(clientX) ? clientX - wrapRect.left : fallbackX;
      const localY = Number.isFinite(clientY) ? clientY - wrapRect.top : 92;
      const tipWidth = tooltip.offsetWidth || 252;
      const left = Math.max(8, Math.min(localX + 14, wrap.clientWidth - tipWidth - 8));
      const top = Math.max(8, Math.min(localY - 42, wrap.clientHeight - tooltip.offsetHeight - 8));
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }

    function indexFromPointer(clientX) {
      const rect = chart.getBoundingClientRect();
      if (!currentLayout || !rect.width) return 0;
      const viewX = (clientX - rect.left) * currentLayout.width / rect.width;
      return Math.max(0, Math.min(currentData.length - 1,
        Math.floor((viewX - currentLayout.margin.left) / currentLayout.groupWidth)));
    }

    function render() {
      currentData = runtimeData(stepSelect.value, domainSelect.value, sortSelect.value);
      const width = Math.max(600, Math.round(wrap.clientWidth - 16));
      const height = 300;
      const margin = { top: 28, right: 44, bottom: 42, left: 48 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const maxValue = 12000;
      const groupWidth = plotWidth / currentData.length;
      const barWidth = Math.min(46, groupWidth * .54);
      const y = (value) => margin.top + plotHeight - value / maxValue * plotHeight;
      const ratioY = (value) => margin.top + plotHeight - value / 100 * plotHeight;
      const centerX = (index) => margin.left + groupWidth * index + groupWidth / 2;
      const stackKeys = ['compute', 'overlap', 'communication', 'idle', 'preprocess'];
      currentLayout = { width, height, margin, groupWidth, centerX };
      let svg = '';

      for (let value = 0; value <= maxValue; value += 2000) {
        const lineY = y(value);
        svg += '<line class="grid-line" x1="' + margin.left + '" x2="' + (width - margin.right) + '" y1="' + lineY + '" y2="' + lineY + '"></line>';
        svg += '<text class="axis-text" x="' + (margin.left - 9) + '" y="' + (lineY + 3) + '" text-anchor="end">' + formatAxis(value) + '</text>';
        svg += '<text class="axis-text" x="' + (width - margin.right + 9) + '" y="' + (lineY + 3) + '">' + Math.round(value / maxValue * 100) + '%</text>';
      }
      svg += '<text class="axis-label" x="' + margin.left + '" y="14">耗时</text>';
      svg += '<text class="axis-label" x="' + (width - margin.right) + '" y="14" text-anchor="end">占比</text>';
      svg += '<line class="axis-line" x1="' + margin.left + '" x2="' + (width - margin.right) + '" y1="' + (margin.top + plotHeight) + '" y2="' + (margin.top + plotHeight) + '"></line>';

      currentData.forEach((item, index) => {
        let accumulated = 0;
        stackKeys.forEach((key, keyIndex) => {
          if (!enabledSeries.has(key)) return;
          const value = item[key];
          if (value <= 0) return;
          const top = y(accumulated + value);
          const segmentHeight = Math.max(1, y(accumulated) - top);
          svg += '<rect class="bar-segment" data-runtime-series="' + key + '" data-runtime-index="' + index + '" x="' + (centerX(index) - barWidth / 2) + '" y="' + top + '" width="' + barWidth + '" height="' + segmentHeight + '" fill="' + OVERVIEW_RUNTIME_COLORS[key] + '"' + (keyIndex === stackKeys.length - 1 ? ' rx="2"' : '') + ' tabindex="0" role="button" aria-label="Rank ' + item.rank + '，' + OVERVIEW_RUNTIME_SERIES.find((series) => series.key === key).label + '"></rect>';
          accumulated += value;
        });
        svg += '<text class="axis-text" x="' + centerX(index) + '" y="' + (height - 17) + '" text-anchor="middle">' + item.rank + '</text>';
      });

      ['computeRatio', 'communicationRatio'].forEach((key) => {
        if (!enabledSeries.has(key)) return;
        const points = currentData.map((item, index) => centerX(index) + ',' + ratioY(item[key])).join(' ');
        svg += '<polyline class="ratio-line" data-runtime-series="' + key + '" points="' + points + '" stroke="' + OVERVIEW_RUNTIME_COLORS[key] + '"></polyline>';
        svg += '<polyline class="series-hit-line" data-runtime-series="' + key + '" points="' + points + '"></polyline>';
        currentData.forEach((item, index) => {
          svg += '<circle class="ratio-point" data-runtime-series="' + key + '" data-runtime-index="' + index + '" cx="' + centerX(index) + '" cy="' + ratioY(item[key]) + '" r="3" fill="var(--surface-1)" stroke="' + OVERVIEW_RUNTIME_COLORS[key] + '" tabindex="0" role="button" aria-label="Rank ' + item.rank + '，' + OVERVIEW_RUNTIME_SERIES.find((series) => series.key === key).label + '"></circle>';
        });
      });

      svg += '<text class="axis-label" x="' + (width - margin.right) + '" y="' + (height - 3) + '" text-anchor="end">Rank ID</text>';
      chart.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      chart.innerHTML = svg;
      const computes = currentData.map((item) => item.compute);
      if (gapLabel) gapLabel.textContent = ((Math.max(...computes) - Math.min(...computes)) / 1000).toFixed(2) + ' s';

      chart.onpointermove = (event) => {
        const target = event.target.closest?.('[data-runtime-series]');
        if (!target) return clearHighlight();
        const index = target.dataset.runtimeIndex === undefined
          ? indexFromPointer(event.clientX)
          : Number(target.dataset.runtimeIndex);
        highlight(target.dataset.runtimeSeries, index, event.clientX, event.clientY);
      };
      chart.onfocusin = (event) => {
        const target = event.target.closest?.('[data-runtime-series][data-runtime-index]');
        if (target) highlight(target.dataset.runtimeSeries, Number(target.dataset.runtimeIndex));
      };
      chart.onfocusout = (event) => {
        if (!chart.contains(event.relatedTarget)) clearHighlight();
      };
      chart.onpointerleave = clearHighlight;
    }

    legend.addEventListener('click', (event) => {
      const button = event.target.closest('[data-runtime-legend]');
      if (!button) return;
      const key = button.dataset.runtimeLegend;
      if (enabledSeries.has(key)) enabledSeries.delete(key);
      else enabledSeries.add(key);
      clearHighlight();
      renderLegend();
      render();
    });
    [stepSelect, domainSelect, sortSelect].forEach((select) => select.addEventListener('change', render));
    let resizeFrame = 0;
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(render);
      }).observe(wrap);
    }
    renderLegend();
    render();
  }

  function initAnalysisOverview() {
    initOverviewRuntimeChart();
    initOverviewMetricEditor();
    const list = document.getElementById('msiOvIssueList');
    if (!list) return;
    list.innerHTML = PROFILE_OVERVIEW_ISSUES.map((issue, index) =>
      '<button class="msi-ov-issue-btn' + (index === 0 ? ' is-active' : '') + '" type="button" role="tab"' +
        ' aria-selected="' + (index === 0 ? 'true' : 'false') + '" data-overview-issue="' + index + '">' +
        '<span class="msi-ov-issue-btn-title">' + overviewEscape(issue.title) + '</span>' +
        '<span class="msi-ov-issue-meta">' +
          '<span class="msi-ov-badge msi-ov-badge--' + issue.priority.toLowerCase() + '">' + issue.priority + '</span>' +
          (issue.benefit ? '<span class="msi-ov-badge msi-ov-badge--gain">' + overviewEscape(issue.benefit) + '</span>' : '') +
          '<span class="msi-ov-badge">' + overviewEscape(issue.difficulty) + '</span>' +
        '</span>' +
      '</button>'
    ).join('');
    renderOverviewIssue(0);

    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-overview-issue]');
      if (button) renderOverviewIssue(Number(button.dataset.overviewIssue));
    });
    document.getElementById('msiOvIssueDetail')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-overview-open-tab]');
      if (button) activateAnalysisTab(button.dataset.overviewOpenTab);
    });
  }

  window.MSI_OVERVIEW = {
    init(onActivateTab) {
      activateAnalysisTab = onActivateTab;
      initAnalysisOverview();
    },
  };
})();

// 知识库目录与统计为当前页面的界面示例，不读取本地文档。
(function () {
  'use strict';

  function initKnowledgeSettings() {
    const section = document.querySelector('[data-settings-panel="knowledge"]');
    if (!section) return;
    const content = document.getElementById('trainChatKnowledgeContent');
    const search = document.getElementById('trainChatKnowledgeSearch');
    const filters = [...section.querySelectorAll('[data-knowledge-filter]')];
    const enabledCount = document.getElementById('trainChatKnowledgeEnabledCount');
    const disabledCount = document.getElementById('trainChatKnowledgeDisabledCount');
    const libraries = [
      { id: 'training', kind: 'custom', name: '训练性能知识库', description: '收录训练性能报告、调优笔记和排障手册。', enabled: true },
      { id: 'operator', kind: 'custom', name: '模型算子知识库', description: '汇集算子实现、融合策略和性能分析案例。', enabled: true },
      { id: 'operations', kind: 'custom', name: '集群运维知识库', description: '整理设备告警、网络故障与运维经验。', enabled: false },
      { id: 'inference', kind: 'custom', name: '推理性能知识库', description: '整理推理吞吐、时延分析和服务部署优化经验。', enabled: true },
      { id: 'pipeline', kind: 'custom', name: '数据流水线知识库', description: '收录数据预处理、加载瓶颈与流水线调优案例。', enabled: true },
      { id: 'distributed', kind: 'custom', name: '分布式训练知识库', description: '汇总并行策略、通信性能与多机训练排障记录。', enabled: false },
      { id: 'hardware', kind: 'custom', name: '硬件资源知识库', description: '整理设备利用率、内存带宽和资源配置建议。', enabled: true },
      { id: 'profiling', kind: 'custom', name: '性能分析案例库', description: '沉淀典型性能问题的定位过程与优化结果。', enabled: true },
      { id: 'ascend', kind: 'system', name: '华为昇腾知识库', description: '包含 2000+ 篇文档案例，覆盖昇腾开发、性能调优与故障排查。', enabled: true },
    ];
    const bookIcon = '<svg class="wzh-skills-icon" viewBox="0 0 42 42" aria-hidden="true"><path class="wzh-skills-icon-shape" d="M21 1 C37 1 41 5 41 21 C41 37 37 41 21 41 C5 41 1 37 1 21 C1 5 5 1 21 1Z"/><path class="wzh-skills-icon-glyph" d="M21 13c-2.6-1.7-5.4-1.9-9-1.2v17c3.6-.7 6.4-.5 9 1.2 2.6-1.7 5.4-1.9 9-1.2v-17c-3.6-.7-6.4-.5-9 1.2Zm0 0v17M15 16.5c1.4-.1 2.4.1 3.4.5m-3.4 3.1c1.4-.1 2.4.1 3.4.5m5.2-3.6c1-.4 2-.6 3.4-.5m-3.4 4.1c1-.4 2-.6 3.4-.5"/></svg>';
    const usageDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - 13 + index);
      const empty = index === 3 || index === 10;
      return {
        label: `${date.getMonth() + 1}月${date.getDate()}日`,
        system: empty ? 0 : (index === 13 ? 52 : 28 + ((index * 19 + 7) % 37)),
        custom: empty ? 0 : (index === 13 ? 7 : 2 + ((index * 3 + 1) % 9)),
      };
    });
    let filter = 'all';
    let openMenuId = null;
    let expandedId = null;
    let detailMode = 'details';

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function makeRow(library) {
      const item = element('div', 'wzh-skills-item');
      item.dataset.knowledgeId = library.id;
      const row = element('div', 'wzh-skills-row');
      if (library.kind === 'system') {
        const icon = element('span', 'wzh-knowledge-ascend-icon');
        const crop = element('span', 'wzh-knowledge-ascend-crop');
        const image = document.createElement('img');
        image.src = '../../src/pic/icon/ascend-official.svg';
        image.alt = '';
        crop.appendChild(image);
        icon.appendChild(crop);
        row.appendChild(icon);
      } else {
        const icon = element('span');
        icon.innerHTML = bookIcon;
        row.appendChild(icon.firstChild);
      }
      const copy = element('div', 'wzh-skills-copy');
      copy.append(element('strong', 'wzh-skills-name', library.name), element('span', 'wzh-skills-description', library.description));
      row.appendChild(copy);
      const menuWrap = element('div', 'wzh-skills-menu-wrap');
      const more = element('button', 'wzh-skills-more', '⋯');
      more.type = 'button';
      more.dataset.knowledgeAction = 'menu';
      more.setAttribute('aria-label', `${library.name}的更多操作`);
      more.setAttribute('aria-expanded', String(openMenuId === library.id));
      const menu = element('div', 'wzh-skills-menu');
      menu.hidden = openMenuId !== library.id;
      const actions = library.kind === 'system'
        ? [['details', '详情']]
        : [['details', '详情'], ['directory', '打开目录'], ['delete', '删除']];
      actions.forEach(([action, label]) => {
        const button = element('button', '', label);
        button.type = 'button';
        button.dataset.knowledgeAction = action;
        menu.appendChild(button);
      });
      menuWrap.append(more, menu);
      row.appendChild(menuWrap);
      const toggle = element('button', 'wzh-skills-switch');
      toggle.type = 'button';
      toggle.dataset.knowledgeAction = 'toggle';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', String(library.enabled));
      toggle.setAttribute('aria-label', `${library.enabled ? '关闭' : '开启'}${library.name}`);
      row.appendChild(toggle);
      item.appendChild(row);
      const detail = element('div', 'wzh-skills-detail');
      detail.hidden = expandedId !== library.id;
      detail.appendChild(element('p', '', detailMode === 'directory'
        ? '目录：当前为界面示例，尚未关联本地文件夹。'
        : `${library.description} 当前为界面示例，尚未索引实际文档。`));
      item.appendChild(detail);
      return item;
    }

    function renderStats() {
      const stats = element('div', 'wzh-skills-stats');
      const heading = element('h4', 'wzh-skills-stats-heading', '今日使用');
      stats.appendChild(heading);
      const metrics = element('div', 'wzh-skills-stats-metrics');
      const today = usageDays[13];
      [['5', '轮对话'], ['4', '个知识库'], [String(today.system + today.custom), '次引用']].forEach(([value, label]) => {
        const metric = element('div', 'wzh-skills-stats-metric');
        metric.append(element('strong', '', value), element('span', '', label));
        metrics.appendChild(metric);
      });
      stats.appendChild(metrics);
      stats.appendChild(element('h4', 'wzh-skills-stats-heading wzh-skills-stats-chart-heading', '近 2 周引用情况'));
      const card = element('div', 'wzh-skills-stats-card');
      const graph = element('div', 'wzh-skills-stats-graph');
      const axis = element('div', 'wzh-skills-stats-axis');
      const maxTotal = Math.max(...usageDays.map(day => day.system + day.custom));
      const scale = Math.max(60, Math.ceil(maxTotal / 20) * 20);
      [scale, scale / 2, 0].forEach(value => axis.appendChild(element('span', '', String(value))));
      const plot = element('div', 'wzh-skills-stats-plot');
      plot.setAttribute('role', 'img');
      plot.setAttribute('aria-label', `近 14 天知识库引用次数，蓝色为系统内置，橙色为自定义。${usageDays.map(day => `${day.label}系统${day.system}次、自定义${day.custom}次`).join('；')}`);
      usageDays.forEach(day => {
        const column = element('div', 'wzh-skills-stats-column');
        column.dataset.date = day.label;
        column.tabIndex = 0;
        column.setAttribute('aria-label', `${day.label}：系统内置 ${day.system} 次，自定义 ${day.custom} 次`);
        const systemHeight = Math.round(day.system / scale * 208);
        const customHeight = Math.max(2, Math.round(day.custom / scale * 208));
        column.style.setProperty('--column-bar-height', `${systemHeight + (day.custom ? customHeight : 0) + (day.system && day.custom ? 1 : 0)}px`);
        if (day.system || day.custom) {
          if (day.custom) {
            const customBar = element('span', 'wzh-skills-stats-bar wzh-skills-stats-bar--custom');
            customBar.style.height = `${customHeight}px`;
            column.appendChild(customBar);
          }
          if (day.system) {
            const systemBar = element('span', 'wzh-skills-stats-bar wzh-skills-stats-bar--system');
            systemBar.style.height = `${systemHeight}px`;
            column.appendChild(systemBar);
          }
        }
        const tooltip = element('div', 'wzh-skills-stats-tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.appendChild(element('span', 'wzh-skills-stats-tooltip-date', day.label));
        [['system', '系统内置', day.system], ['custom', '自定义', day.custom]].forEach(([kind, label, value]) => {
          const row = element('div', 'wzh-skills-stats-tooltip-row');
          row.append(element('i', `wzh-skills-stats-legend-dot wzh-skills-stats-legend-dot--${kind}`), element('span', '', label), element('strong', '', `${value} 次`));
          tooltip.appendChild(row);
        });
        column.appendChild(tooltip);
        plot.appendChild(column);
      });
      graph.append(axis, plot);
      card.appendChild(graph);
      const dates = element('div', 'wzh-skills-stats-dates');
      [usageDays[0], usageDays[6], usageDays[13]].forEach(day => dates.appendChild(element('span', '', day.label)));
      card.appendChild(dates);
      const legend = element('div', 'wzh-skills-stats-legend');
      [['system', '系统内置'], ['custom', '自定义']].forEach(([kind, label]) => {
        const entry = element('span', 'wzh-skills-stats-legend-item');
        entry.append(element('i', `wzh-skills-stats-legend-dot wzh-skills-stats-legend-dot--${kind}`), document.createTextNode(label));
        legend.appendChild(entry);
      });
      card.appendChild(legend);
      stats.appendChild(card);
      content.appendChild(stats);
    }

    function render() {
      const enabled = libraries.filter(library => library.enabled).length;
      enabledCount.textContent = String(enabled);
      disabledCount.textContent = String(libraries.length - enabled);
      filters.forEach(tab => {
        const active = tab.dataset.knowledgeFilter === filter;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      content.replaceChildren();
      if (filter === 'stats') { renderStats(); return; }
      const query = search.value.trim().toLocaleLowerCase();
      const visible = libraries.filter(library =>
        `${library.name} ${library.description}`.toLocaleLowerCase().includes(query) &&
        (filter === 'all' || library.enabled === (filter === 'enabled')));
      if (!visible.length) {
        content.appendChild(element('p', 'wzh-skills-empty', query ? '没有匹配的知识库。' : '当前分类没有知识库。'));
        return;
      }
      [['custom', '自定义'], ['system', '系统内置']].forEach(([kind, title]) => {
        const groupLibraries = visible.filter(library => library.kind === kind);
        if (!groupLibraries.length) return;
        const group = element('div', 'wzh-skills-group');
        if (groupLibraries.some(library => library.id === openMenuId)) group.classList.add('has-open-menu');
        const heading = element('h4', 'wzh-skills-group-title', title);
        if (kind === 'custom') heading.appendChild(element('span', 'wzh-skills-group-count', String(groupLibraries.length)));
        const list = element('div', 'wzh-skills-list');
        groupLibraries.forEach(library => list.appendChild(makeRow(library)));
        if (kind === 'system') {
          const stack = element('div', 'wzh-skills-stack');
          stack.appendChild(list);
          group.append(heading, stack);
        } else group.append(heading, list);
        content.appendChild(group);
      });
    }

    filters.forEach(tab => tab.addEventListener('click', () => {
      filter = tab.dataset.knowledgeFilter;
      openMenuId = null;
      render();
    }));
    section.querySelector('.wzh-skills-tabs').addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = filters.findIndex(tab => tab.dataset.knowledgeFilter === filter);
      const next = filters[(index + (event.key === 'ArrowRight' ? 1 : filters.length - 1)) % filters.length];
      filter = next.dataset.knowledgeFilter;
      openMenuId = null;
      render();
      next.focus();
    });
    search.addEventListener('input', () => { openMenuId = null; render(); });
    content.addEventListener('click', (event) => {
      const button = event.target.closest('[data-knowledge-action]');
      if (!button) return;
      event.stopPropagation();
      const id = button.closest('[data-knowledge-id]')?.dataset.knowledgeId;
      const library = libraries.find(entry => entry.id === id);
      if (!library) return;
      switch (button.dataset.knowledgeAction) {
        case 'toggle': library.enabled = !library.enabled; openMenuId = null; break;
        case 'menu': openMenuId = openMenuId === id ? null : id; break;
        case 'details':
        case 'directory': {
          const wasExpanded = expandedId === id && detailMode === button.dataset.knowledgeAction;
          detailMode = button.dataset.knowledgeAction;
          expandedId = wasExpanded ? null : id;
          openMenuId = null;
          break;
        }
        case 'delete':
          openMenuId = null;
          if (!window.confirm(`删除自定义知识库“${library.name}”？`)) { render(); return; }
          libraries.splice(libraries.indexOf(library), 1);
          if (expandedId === id) expandedId = null;
          break;
        default: return;
      }
      render();
    });
    document.addEventListener('click', (event) => {
      if (openMenuId && !event.target.closest('.wzh-settings-knowledge .wzh-skills-menu-wrap')) {
        openMenuId = null;
        render();
      }
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initKnowledgeSettings, { once: true });
  else initKnowledgeSettings();
})();

// MCP 设置页的服务与统计为界面示例；开关仅保留在当前页面，不建立外部连接。
(function () {
  'use strict';

  function initMcpSettings() {
    const section = document.querySelector('[data-settings-panel="mcp"]');
    if (!section) return;
    const content = document.getElementById('trainChatMcpContent');
    const search = document.getElementById('trainChatMcpSearch');
    const filters = [...section.querySelectorAll('[data-mcp-filter]')];
    const enabledCount = document.getElementById('trainChatMcpEnabledCount');
    const disabledCount = document.getElementById('trainChatMcpDisabledCount');
    const servers = [
      {
        id: 'huggingface', name: 'Hugging Face MCP',
        description: '搜索模型、数据集和论文，辅助模型选型与开发。',
        endpoint: 'https://huggingface.co/mcp',
        docs: 'https://huggingface.co/docs/hub/en/agents-mcp',
        enabled: true,
      },
      {
        id: 'github', name: 'GitHub MCP',
        description: '查看代码仓库、议题和拉取请求，辅助开发与代码审查。',
        endpoint: 'https://api.githubcopilot.com/mcp/',
        docs: 'https://github.com/github/github-mcp-server',
        enabled: true,
      },
      {
        id: 'sentry', name: 'Sentry MCP',
        description: '检索错误事件、堆栈和性能追踪，辅助定位故障。',
        endpoint: 'https://mcp.sentry.dev/mcp',
        docs: 'https://mcp.sentry.dev/',
        enabled: false,
      },
      {
        id: 'slack', name: 'Slack MCP',
        description: '搜索 Slack 消息、文件和频道，获取团队协作上下文。',
        endpoint: 'https://mcp.slack.com/mcp',
        docs: 'https://docs.slack.dev/ai/slack-mcp-server',
        enabled: false,
      },
    ];
    const iconPaths = {
      huggingface: '../../src/pic/icon/huggingface.svg',
      github: '../../src/pic/icon/github.svg',
      sentry: '../../src/pic/icon/sentry.svg',
    };
    const slackIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="12" y="1" width="5" height="13" rx="2.5" fill="#36C5F0"/><rect x="2" y="11" width="13" height="5" rx="2.5" fill="#36C5F0"/><rect x="17" y="11" width="13" height="5" rx="2.5" fill="#2EB67D"/><rect x="17" y="1" width="5" height="13" rx="2.5" fill="#2EB67D"/><rect x="17" y="18" width="5" height="13" rx="2.5" fill="#ECB22E"/><rect x="17" y="16" width="13" height="5" rx="2.5" fill="#ECB22E"/><rect x="2" y="16" width="13" height="5" rx="2.5" fill="#E01E5A"/><rect x="10" y="18" width="5" height="13" rx="2.5" fill="#E01E5A"/></svg>';
    const usageDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - 13 + index);
      const empty = index === 4 || index === 10;
      return {
        label: `${date.getMonth() + 1}月${date.getDate()}日`,
        weekday: '日一二三四五六'[date.getDay()],
        huggingface: empty ? 0 : (index === 13 ? 11 : 7 + ((index * 7 + 3) % 12)),
        github: empty ? 0 : (index === 13 ? 3 : 1 + ((index * 3 + 1) % 5)),
      };
    });
    let filter = 'all';
    let openMenuId = null;
    let expandedId = null;

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function makeRow(server) {
      const item = element('div', 'wzh-skills-item');
      item.dataset.mcpId = server.id;
      const row = element('div', 'wzh-skills-row');
      const icon = element('span', `wzh-mcp-icon wzh-mcp-icon--${server.id}`);
      if (server.id === 'slack') icon.innerHTML = slackIcon;
      else {
        const image = document.createElement('img');
        image.src = iconPaths[server.id];
        image.alt = '';
        icon.appendChild(image);
      }
      const copy = element('div', 'wzh-skills-copy');
      copy.append(element('strong', 'wzh-skills-name', server.name), element('span', 'wzh-skills-description', server.description));
      row.append(icon, copy);
      const menuWrap = element('div', 'wzh-skills-menu-wrap');
      const more = element('button', 'wzh-skills-more', '⋯');
      more.type = 'button';
      more.dataset.mcpAction = 'menu';
      more.setAttribute('aria-label', `${server.name}的更多操作`);
      more.setAttribute('aria-expanded', String(openMenuId === server.id));
      const menu = element('div', 'wzh-skills-menu');
      menu.hidden = openMenuId !== server.id;
      const details = element('button', '', '详情');
      details.type = 'button';
      details.dataset.mcpAction = 'details';
      const remove = element('button', '', '删除');
      remove.type = 'button';
      remove.dataset.mcpAction = 'delete';
      menu.append(details, remove);
      menuWrap.append(more, menu);
      row.appendChild(menuWrap);
      const toggle = element('button', 'wzh-skills-switch');
      toggle.type = 'button';
      toggle.dataset.mcpAction = 'toggle';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', String(server.enabled));
      toggle.setAttribute('aria-label', `${server.enabled ? '关闭' : '开启'}${server.name}`);
      row.appendChild(toggle);
      item.appendChild(row);
      const detail = element('div', 'wzh-skills-detail');
      detail.hidden = expandedId !== server.id;
      detail.appendChild(element('p', '', `${server.description} 当前为界面示例，尚未建立实际连接。`));
      detail.appendChild(element('p', '', `官方服务地址：${server.endpoint}`));
      const docs = element('a', '', '查看官方文档');
      docs.href = server.docs;
      docs.target = '_blank';
      docs.rel = 'noopener noreferrer';
      detail.appendChild(docs);
      item.appendChild(detail);
      return item;
    }

    function renderStats() {
      const stats = element('div', 'wzh-skills-stats');
      const heading = element('h4', 'wzh-skills-stats-heading', '今日使用');
      stats.appendChild(heading);
      const metrics = element('div', 'wzh-skills-stats-metrics');
      const today = usageDays[13];
      [['3', '轮对话'], ['2', '个 MCP'], [String(today.huggingface + today.github), '次调用']].forEach(([value, label]) => {
        const metric = element('div', 'wzh-skills-stats-metric');
        metric.append(element('strong', '', value), element('span', '', label));
        metrics.appendChild(metric);
      });
      stats.appendChild(metrics);
      stats.appendChild(element('h4', 'wzh-skills-stats-heading wzh-skills-stats-chart-heading', '近 2 周调用情况'));
      const card = element('div', 'wzh-skills-stats-card');
      const graph = element('div', 'wzh-skills-stats-graph');
      const axis = element('div', 'wzh-skills-stats-axis');
      const maxTotal = Math.max(...usageDays.map(day => day.huggingface + day.github));
      const tickUnit = maxTotal <= 30 ? 1 : 5;
      const step = Math.max(1, Math.ceil(maxTotal / (3 * tickUnit)) * tickUnit);
      const scale = step * 3;
      [scale, step * 2, step, 0].forEach(value => axis.appendChild(element('span', '', String(value))));
      const plot = element('div', 'wzh-skills-stats-plot');
      plot.setAttribute('role', 'img');
      plot.setAttribute('aria-label', `近 14 天 MCP 调用次数，蓝色为 Hugging Face，橙色为 GitHub。${usageDays.map(day => `${day.label}Hugging Face ${day.huggingface}次、GitHub ${day.github}次`).join('；')}`);
      usageDays.forEach(day => {
        const column = element('div', 'wzh-skills-stats-column');
        column.dataset.date = day.label;
        column.tabIndex = 0;
        column.setAttribute('aria-label', `${day.label}：Hugging Face ${day.huggingface} 次，GitHub ${day.github} 次`);
        const huggingfaceHeight = Math.round(day.huggingface / scale * 208);
        const githubHeight = Math.max(2, Math.round(day.github / scale * 208));
        if (day.huggingface || day.github) {
          if (day.github) {
            const github = element('span', 'wzh-skills-stats-bar wzh-skills-stats-bar--custom');
            github.style.height = `${githubHeight}px`;
            column.appendChild(github);
          }
          if (day.huggingface) {
            const huggingface = element('span', 'wzh-skills-stats-bar wzh-skills-stats-bar--system');
            huggingface.style.height = `${huggingfaceHeight}px`;
            column.appendChild(huggingface);
          }
        }
        const tooltip = element('div', 'wzh-skills-stats-tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        const tooltipHead = element('div', 'wzh-skills-stats-tooltip-head');
        tooltipHead.append(
          element('span', 'wzh-skills-stats-tooltip-date', `${day.label}（周${day.weekday}）`),
          element('strong', 'wzh-skills-stats-tooltip-total', `${day.huggingface + day.github} 次`),
        );
        tooltip.appendChild(tooltipHead);
        [['system', 'Hugging Face', day.huggingface], ['custom', 'GitHub', day.github]].forEach(([kind, label, value]) => {
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
      [['system', 'Hugging Face'], ['custom', 'GitHub']].forEach(([kind, label]) => {
        const entry = element('span', 'wzh-skills-stats-legend-item');
        entry.append(element('i', `wzh-skills-stats-legend-dot wzh-skills-stats-legend-dot--${kind}`), document.createTextNode(label));
        legend.appendChild(entry);
      });
      card.appendChild(legend);
      stats.appendChild(card);
      content.appendChild(stats);
    }

    function render() {
      const enabled = servers.filter(server => server.enabled).length;
      enabledCount.textContent = String(enabled);
      disabledCount.textContent = String(servers.length - enabled);
      filters.forEach(tab => {
        const active = tab.dataset.mcpFilter === filter;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      content.replaceChildren();
      if (filter === 'stats') { renderStats(); return; }
      const query = search.value.trim().toLocaleLowerCase();
      const visible = servers.filter(server =>
        `${server.name} ${server.description}`.toLocaleLowerCase().includes(query) &&
        (filter === 'all' || server.enabled === (filter === 'enabled')));
      if (!visible.length) {
        content.appendChild(element('p', 'wzh-skills-empty', query ? '没有匹配的 MCP 服务。' : '当前分类没有 MCP 服务。'));
        return;
      }
      const group = element('div', 'wzh-skills-group');
      if (visible.some(server => server.id === openMenuId)) group.classList.add('has-open-menu');
      const heading = element('h4', 'wzh-skills-group-title', 'MCP 服务');
      heading.appendChild(element('span', 'wzh-skills-group-count', String(visible.length)));
      const list = element('div', 'wzh-skills-list');
      visible.forEach(server => list.appendChild(makeRow(server)));
      group.append(heading, list);
      content.appendChild(group);
    }

    filters.forEach(tab => tab.addEventListener('click', () => {
      filter = tab.dataset.mcpFilter;
      openMenuId = null;
      render();
    }));
    section.querySelector('.wzh-skills-tabs').addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = filters.findIndex(tab => tab.dataset.mcpFilter === filter);
      const next = filters[(index + (event.key === 'ArrowRight' ? 1 : filters.length - 1)) % filters.length];
      filter = next.dataset.mcpFilter;
      openMenuId = null;
      render();
      next.focus();
    });
    search.addEventListener('input', () => { openMenuId = null; render(); });
    content.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mcp-action]');
      if (!button) return;
      event.stopPropagation();
      const id = button.closest('[data-mcp-id]')?.dataset.mcpId;
      const server = servers.find(entry => entry.id === id);
      if (!server) return;
      switch (button.dataset.mcpAction) {
        case 'toggle': server.enabled = !server.enabled; openMenuId = null; break;
        case 'menu': openMenuId = openMenuId === id ? null : id; break;
        case 'details': expandedId = expandedId === id ? null : id; openMenuId = null; break;
        case 'delete':
          openMenuId = null;
          if (!window.confirm(`删除自定义 MCP“${server.name}”？`)) { render(); return; }
          servers.splice(servers.indexOf(server), 1);
          if (expandedId === id) expandedId = null;
          break;
        default: return;
      }
      render();
    });
    document.addEventListener('click', (event) => {
      if (openMenuId && !event.target.closest('.wzh-settings-mcp .wzh-skills-menu-wrap')) {
        openMenuId = null;
        render();
      }
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMcpSettings, { once: true });
  else initMcpSettings();
})();

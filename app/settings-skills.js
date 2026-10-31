// Skills 目录是当前页面的交互示例，不读写用户磁盘或调用模型服务。
(function () {
  'use strict';

  function initSkillsCatalog() {
    const section = document.querySelector('[data-settings-panel="skills"]');
    if (!section) return;
    const content = document.getElementById('trainChatSkillsContent');
    const search = document.getElementById('trainChatSkillsSearch');
    const filters = [...section.querySelectorAll('[data-skills-filter]')];
    const enabledCount = document.getElementById('trainChatSkillsEnabledCount');
    const disabledCount = document.getElementById('trainChatSkillsDisabledCount');
    const skills = [
      { id: 'operator', kind: 'custom', name: '算子热点诊断', description: '定位模型运行中的高耗时算子、调度等待和计算热点。', enabled: true, usage: 0 },
      { id: 'communication', kind: 'custom', name: '通信瓶颈分析', description: '分析跨卡通信耗时、带宽利用率及计算通信重叠情况。', enabled: true, usage: 0 },
      { id: 'memory', kind: 'custom', name: '显存与吞吐优化', description: '关联峰值显存、批大小和吞吐表现，辅助调整训练配置。', enabled: false, usage: 0 },
      { id: 'overview', kind: 'system', name: '模型性能分析', description: '包含 50 个系统内置 Skills，覆盖算子、通信、显存等性能分析能力。', enabled: true, usage: 0, count: 50 },
    ];
    const icon = '<span class="wzh-skills-icon wzh-skills-icon--skill" aria-hidden="true"><span class="wzh-skills-icon-mark"></span></span>';
    let filter = 'all';
    let openMenuId = null;
    let expandedId = null;
    const usageDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - 13 + index);
      const empty = index === 2 || index === 9;
      const system = empty ? 0 : 23 + ((index * 29 + 11) % 39);
      const custom = empty ? 0 : 2 + ((index * 5 + 2) % 7);
      return {
        label: `${date.getMonth() + 1}月${date.getDate()}日`,
        weekday: '日一二三四五六'[date.getDay()],
        system: index === 13 ? 43 : system,
        custom: index === 13 ? 4 : custom,
      };
    });

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function makeRow(skill) {
      const item = element('div', 'wzh-skills-item');
      item.dataset.skillId = skill.id;
      const row = element('div', 'wzh-skills-row');
      const iconWrap = element('span');
      iconWrap.innerHTML = icon;
      row.appendChild(iconWrap.firstChild);
      const copy = element('div', 'wzh-skills-copy');
      const name = element('strong', 'wzh-skills-name', skill.name);
      if (skill.kind === 'system') {
        const mark = element('img', 'wzh-official-mark');
        mark.src = '../../src/pic/icon/官方认证.svg';
        mark.alt = '官方认证';
        mark.title = '官方认证';
        name.appendChild(mark);
      }
      copy.append(name, element('span', 'wzh-skills-description', skill.description));
      row.appendChild(copy);

      const menuWrap = element('div', 'wzh-skills-menu-wrap');
      const more = element('button', 'wzh-skills-more', '⋯');
      more.type = 'button';
      more.dataset.skillsAction = 'menu';
      more.setAttribute('aria-label', `${skill.name}的更多操作`);
      more.setAttribute('aria-expanded', String(openMenuId === skill.id));
      const menu = element('div', 'wzh-skills-menu');
      menu.hidden = openMenuId !== skill.id;
      const menuActions = skill.kind === 'system'
        ? [['details', '详情']]
        : [['details', '详情'], ['directory', '打开目录'], ['delete', '删除']];
      menuActions.forEach(([action, label]) => {
        const button = element('button', '', label);
        button.type = 'button';
        button.dataset.skillsAction = action;
        menu.appendChild(button);
      });
      menuWrap.append(more, menu);
      row.appendChild(menuWrap);

      const toggle = element('button', 'wzh-skills-switch');
      toggle.type = 'button';
      toggle.dataset.skillsAction = 'toggle';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', String(skill.enabled));
      toggle.setAttribute('aria-label', `${skill.enabled ? '关闭' : '开启'}${skill.name}`);
      row.appendChild(toggle);
      item.appendChild(row);

      const detail = element('div', 'wzh-skills-detail');
      detail.hidden = expandedId !== skill.id;
      detail.appendChild(element('p', '', skill.description));
      detail.appendChild(element('p', '', `来源：${skill.kind === 'custom' ? '自定义' : '系统内置'} · 状态：${skill.enabled ? '已开启' : '未开启'} · 使用次数：${skill.usage}`));
      item.appendChild(detail);
      return item;
    }

    function renderStats() {
      const stats = element('div', 'wzh-skills-stats');
      const todayHeading = element('h4', 'wzh-skills-stats-heading', '今日使用');
      stats.appendChild(todayHeading);
      const metrics = element('div', 'wzh-skills-stats-metrics');
      const today = usageDays[13];
      [['4', '轮对话'], ['32', '个 Skills'], [String(today.system + today.custom), '次调用']].forEach(([value, label]) => {
        const metric = element('div', 'wzh-skills-stats-metric');
        metric.append(element('strong', '', value), element('span', '', label));
        metrics.appendChild(metric);
      });
      stats.appendChild(metrics);
      stats.appendChild(element('h4', 'wzh-skills-stats-heading wzh-skills-stats-chart-heading', '近 2 周调用情况'));

      const card = element('div', 'wzh-skills-stats-card');
      const graph = element('div', 'wzh-skills-stats-graph');
      const axis = element('div', 'wzh-skills-stats-axis');
      const maxTotal = Math.max(...usageDays.map(day => day.system + day.custom));
      const tickUnit = maxTotal <= 30 ? 1 : 5;
      const step = Math.max(1, Math.ceil(maxTotal / (3 * tickUnit)) * tickUnit);
      const scale = step * 3;
      [scale, step * 2, step, 0].forEach(value => axis.appendChild(element('span', '', String(value))));
      const plot = element('div', 'wzh-skills-stats-plot');
      plot.setAttribute('role', 'img');
      plot.setAttribute('aria-label', `近 14 天 Skill 调用次数，蓝色为系统内置，橙色为自定义。${usageDays.map(day => `${day.label}系统${day.system}次、自定义${day.custom}次`).join('；')}`);
      usageDays.forEach((day) => {
        const column = element('div', 'wzh-skills-stats-column');
        column.dataset.date = day.label;
        column.tabIndex = 0;
        column.setAttribute('aria-label', `${day.label}：系统内置 ${day.system} 次，自定义 ${day.custom} 次`);
        const systemHeight = Math.round(day.system / scale * 208);
        const customHeight = Math.max(2, Math.round(day.custom / scale * 208));
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
        const tooltipHead = element('div', 'wzh-skills-stats-tooltip-head');
        tooltipHead.append(
          element('span', 'wzh-skills-stats-tooltip-date', `${day.label}（周${day.weekday}）`),
          element('strong', 'wzh-skills-stats-tooltip-total', `${day.system + day.custom} 次`),
        );
        tooltip.appendChild(tooltipHead);
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
      const enabled = skills.reduce((total, skill) => total + (skill.enabled ? (skill.count || 1) : 0), 0);
      const total = skills.reduce((sum, skill) => sum + (skill.count || 1), 0);
      enabledCount.textContent = String(enabled);
      disabledCount.textContent = String(total - enabled);
      filters.forEach((tab) => {
        const active = tab.dataset.skillsFilter === filter;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      const query = search.value.trim().toLocaleLowerCase();
      content.replaceChildren();
      if (filter === 'stats') {
        renderStats();
        return;
      }
      const visible = skills.filter(skill => {
        const matchesText = `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(query);
        return matchesText && (filter === 'all' || skill.enabled === (filter === 'enabled'));
      });
      if (!visible.length) {
        content.appendChild(element('p', 'wzh-skills-empty', query ? '没有匹配的 Skill。' : '当前分类没有 Skill。'));
        return;
      }
      [['custom', '自定义'], ['system', '系统内置']].forEach(([kind, title]) => {
        const groupSkills = visible.filter(skill => skill.kind === kind);
        if (!groupSkills.length) return;
        const group = element('div', 'wzh-skills-group');
        if (groupSkills.some(skill => skill.id === openMenuId)) group.classList.add('has-open-menu');
        const heading = element('h4', 'wzh-skills-group-title', title);
        const count = groupSkills.reduce((sum, skill) => sum + (skill.count || 1), 0);
        heading.appendChild(element('span', 'wzh-skills-group-count', String(count)));
        const list = element('div', 'wzh-skills-list');
        groupSkills.forEach(skill => list.appendChild(makeRow(skill)));
        if (kind === 'system') {
          const stack = element('div', 'wzh-skills-stack');
          stack.appendChild(list);
          group.append(heading, stack);
        } else group.append(heading, list);
        content.appendChild(group);
      });
    }

    filters.forEach(tab => tab.addEventListener('click', () => {
      filter = tab.dataset.skillsFilter;
      openMenuId = null;
      render();
    }));
    section.querySelector('.wzh-skills-tabs').addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = filters.findIndex(tab => tab.dataset.skillsFilter === filter);
      const next = filters[(index + (event.key === 'ArrowRight' ? 1 : filters.length - 1)) % filters.length];
      filter = next.dataset.skillsFilter;
      openMenuId = null;
      render();
      next.focus();
    });
    search.addEventListener('input', () => { openMenuId = null; render(); });
    content.addEventListener('click', (event) => {
      const button = event.target.closest('[data-skills-action]');
      if (!button) return;
      event.stopPropagation();
      const skillId = button.closest('[data-skill-id]')?.dataset.skillId;
      const skill = skills.find(entry => entry.id === skillId);
      if (!skill) return;
      switch (button.dataset.skillsAction) {
        case 'toggle': skill.enabled = !skill.enabled; openMenuId = null; break;
        case 'menu': openMenuId = openMenuId === skillId ? null : skillId; break;
        case 'details': {
          expandedId = expandedId === skillId ? null : skillId;
          openMenuId = null;
          break;
        }
        case 'directory': return;
        case 'delete':
          openMenuId = null;
          if (!window.confirm(`删除自定义 Skill“${skill.name}”？`)) { render(); return; }
          skills.splice(skills.indexOf(skill), 1);
          if (expandedId === skillId) expandedId = null;
          break;
        default: return;
      }
      render();
    });
    document.addEventListener('click', (event) => {
      if (openMenuId && !event.target.closest('.wzh-skills-menu-wrap')) {
        openMenuId = null;
        render();
      }
    });
    section.addEventListener('skills:added', (event) => {
      event.detail.forEach((entry) => {
        const existing = skills.find(skill => skill.kind === 'custom' && skill.name === entry.name);
        if (existing) {
          existing.description = entry.description;
          existing.enabled = true;
        } else {
          skills.push({ id: `uploaded-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: 'custom',
            name: entry.name, description: entry.description, enabled: true, usage: 0 });
        }
      });
      filter = 'all';
      search.value = '';
      render();
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSkillsCatalog, { once: true });
  else initSkillsCatalog();
})();

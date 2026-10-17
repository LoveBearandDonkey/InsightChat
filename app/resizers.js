// 三个可拖动的分隔:
//   1) 泳道图 ↕ 底部详情栏 —— 改 .msi-content-foot 上的 --msi-foot-h(详情栏内容区高度)
//   2) 内容区 ↔ 智能对话面板 —— 改 .wzh-chat-panel 上的 --wzh-chat-w(面板宽度)
//   3) 对话 ↔ 信息可视化 —— 改 .wzh-chat-panel 上的 --wzh-viz-chat-w(左栏宽度)
// 每处都只往元素上写一个 CSS 变量,不碰原来的 flex/grid 结构。
// 详情栏和挤入式对话面板上限是容器的 50%;可视化双栏各至少保留 25%。
// 分隔条的显隐不去改别人的 setOpen / setSelectionPanelCollapsed,而是用 MutationObserver
// 盯 class——那两个函数分别关在各自的 IIFE 里,盯 class 比互相调用少一层耦合。
(function () {
  const MAX_RATIO = 0.5;    // 详情栏 / 对话面板各自的占比上限
  const FOOT_MIN = 160;     // 和 .msi-foot-body 的 min-height 对齐
  const FOOT_DEFAULT = 232;
  const CHAT_MIN = 320;     // 再窄消息气泡和输入框就挤变形了
  const CHAT_DEFAULT = 480;
  const STEP = 24;          // 键盘方向键一次走多少

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

  // 分隔条通用拖动:按下记住起点和当前尺寸,移动时把「朝变大方向的位移」交给 apply。
  // 详情栏和挤入式对话面板往回拖会变大;可视化的左栏往右拖会变大。
  function bindDrag(handle, axis, read, apply, reset, growDirection = -1) {
    if (!handle) return;
    let base = 0;
    let origin = 0;
    const key = axis === 'y' ? 'clientY' : 'clientX';
    const onMove = (e) => apply(base + (e[key] - origin) * growDirection);
    const onUp = () => {
      handle.classList.remove('is-dragging');
      document.body.classList.remove('is-pane-resizing');
      document.body.removeAttribute('data-pane-resize-axis');
      window.removeEventListener('pointermove', onMove);
    };
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      base = read();
      origin = e[key];
      handle.classList.add('is-dragging');
      document.body.classList.add('is-pane-resizing');
      document.body.setAttribute('data-pane-resize-axis', axis);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
      window.addEventListener('pointercancel', onUp, { once: true });
    });
    // 双击回到默认尺寸:拖歪了不用一点点量回去
    handle.addEventListener('dblclick', () => reset());
    // 键盘:焦点落在分隔条上时方向键也能调,一次 24px
    handle.addEventListener('keydown', (e) => {
      const dir = axis === 'y'
        ? (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0)
        : (e.key === 'ArrowLeft' ? -growDirection : e.key === 'ArrowRight' ? growDirection : 0);
      if (dir) { e.preventDefault(); apply(read() + dir * STEP); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); reset(); }
    });
  }

  // class 变了就同步一次分隔条的显隐(顺带把已经拖过的尺寸重新夹一遍)
  function watchClass(el, sync) {
    if (!el || typeof MutationObserver !== 'function') return;
    new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function initPaneResizers() {
    const content = document.getElementById('contentCard');
    const foot = document.getElementById('msiSelectionPanel');
    const footBody = document.getElementById('msiFootBody');
    const footHandle = document.getElementById('msiFootResizer');
    const workarea = document.querySelector('.chat-shell-workarea');
    const chat = document.getElementById('trainChatPanel');
    const chatHandle = document.getElementById('chatShellResizer');
    const vizHandle = document.getElementById('trainChatVizResizer');

    /* ── 1. 泳道图 ↕ 底部详情栏 ────────────────────────────────── */
    const footOpen = () => !!foot && !foot.classList.contains('is-collapsed');
    // --msi-foot-h 管的只是内容区那一块,详情栏外面还有 40px 头部和下边距。
    // 先量出这部分固定开销,再从「内容区的一半」里刨掉,剩下的才是变量能给到的上限。
    function footMax() {
      const extra = foot.getBoundingClientRect().height - footBody.getBoundingClientRect().height;
      const max = content.clientHeight * MAX_RATIO - extra;
      return content.querySelector('.msi-timeline-swims.is-compare')
        ? Math.min(max, window.innerHeight * 0.18) : max;
    }
    const footRead = () => footBody.getBoundingClientRect().height || FOOT_DEFAULT;
    function footApply(px) {
      if (!footOpen()) return;
      const min = content.querySelector('.msi-timeline-swims.is-compare') ? 96 : FOOT_MIN;
      const h = Math.round(clamp(px, min, footMax()));
      foot.style.setProperty('--msi-foot-h', h + 'px');
      footHandle.setAttribute('aria-valuenow', String(h));
    }
    function footReset() {
      foot.style.removeProperty('--msi-foot-h');
      footHandle.removeAttribute('aria-valuenow');
    }
    // 窗口变小 / 详情栏刚展开时重新夹一遍;没手动拖过就不写死,留着 CSS 里的默认值
    function footClamp() {
      const cur = parseFloat(foot.style.getPropertyValue('--msi-foot-h'));
      if (Number.isFinite(cur) && footOpen()) footApply(cur);
    }
    // 收起再展开就回到默认高度:上一轮拖成什么样不带到下一次,重新打开永远是 232px
    let footWasOpen = false;
    function footSync() {
      const open = footOpen();
      if (open && !footWasOpen) footReset();
      footWasOpen = open;
      footHandle.hidden = !open;
      footClamp();
    }

    /* ── 2. 内容区 ↔ 智能对话面板 ──────────────────────────────── */
    // 悬浮窗形态下面板不占列宽,拖了也没意义,所以只在「挤入式且展开」时露出分隔条
    const chatInline = () => !!chat && chat.classList.contains('is-open') &&
      !chat.classList.contains('is-floating') && !chat.classList.contains('is-visualizing');
    const chatMax = () => workarea.clientWidth * MAX_RATIO;
    const chatRead = () => chat.getBoundingClientRect().width || CHAT_DEFAULT;
    function chatApply(px) {
      if (!chatInline()) return;
      const w = Math.round(clamp(px, CHAT_MIN, chatMax()));
      chat.style.setProperty('--wzh-chat-w', w + 'px');
      chatHandle.setAttribute('aria-valuenow', String(w));
    }
    function chatReset() {
      chat.style.removeProperty('--wzh-chat-w');
      chatHandle.removeAttribute('aria-valuenow');
    }
    function chatClamp() {
      const cur = parseFloat(chat.style.getPropertyValue('--wzh-chat-w'));
      if (Number.isFinite(cur) && chatInline()) chatApply(cur);
    }
    // 关掉再打开就回到默认宽度。只认 is-open 的翻转,不认 is-floating——
    // 切去悬浮窗再切回来算同一次打开,手动拖出来的宽度得留着。
    let chatWasOpen = false;
    function chatSync() {
      const open = !!chat && chat.classList.contains('is-open');
      if (open && !chatWasOpen) chatReset();
      chatWasOpen = open;
      chatHandle.hidden = !chatInline();
      chatClamp();
      if (vizHandle) {
        const visualizing = open && chat.classList.contains('is-visualizing');
        const expanding = chat.classList.contains('is-viz-expanding');
        if (!visualizing && vizWasOpen) vizReset();
        vizWasOpen = visualizing;
        vizHandle.hidden = !visualizing || expanding;
        if (!expanding) vizClamp();
      }
    }

    /* ── 3. 对话 ↔ 信息可视化 ─────────────────────────────────── */
    let vizWasOpen = false;
    const vizOpen = () => !!chat && chat.classList.contains('is-open') && chat.classList.contains('is-visualizing');
    const vizSpan = () => chat.clientWidth - vizHandle.offsetWidth;
    const vizRead = () => chat.querySelector('.wzh-chat-head').getBoundingClientRect().width;
    function vizApply(px) {
      if (!vizOpen()) return;
      const span = vizSpan();
      const w = Math.round(clamp(px, span * .25, span * .75));
      chat.style.setProperty('--wzh-viz-chat-w', w + 'px');
      vizHandle.setAttribute('aria-valuenow', String(w));
    }
    function vizReset() {
      chat.style.removeProperty('--wzh-viz-chat-w');
      vizHandle.removeAttribute('aria-valuenow');
    }
    function vizClamp() {
      const cur = parseFloat(chat.style.getPropertyValue('--wzh-viz-chat-w'));
      if (Number.isFinite(cur) && vizOpen()) vizApply(cur);
    }

    if (content && foot && footBody && footHandle) {
      bindDrag(footHandle, 'y', footRead, footApply, footReset);
      watchClass(foot, footSync);
      footSync();
    }
    if (workarea && chat && chatHandle) {
      // 拖的时候关掉 flex-basis 过渡,不然面板会慢半拍跟在指针后面
      chatHandle.addEventListener('pointerdown', () => chat.classList.add('is-resizing'));
      window.addEventListener('pointerup', () => chat.classList.remove('is-resizing'));
      bindDrag(chatHandle, 'x', chatRead, chatApply, chatReset);
      watchClass(chat, chatSync);
      chatSync();
    }

    if (chat && vizHandle) {
      bindDrag(vizHandle, 'x', vizRead, vizApply, vizReset, 1);
    }

    window.addEventListener('resize', () => {
      footClamp();
      chatClamp();
      if (vizHandle && !chat.classList.contains('is-viz-expanding')) vizClamp();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaneResizers, { once: true });
  } else {
    initPaneResizers();
  }
})();

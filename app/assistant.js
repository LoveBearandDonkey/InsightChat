// 智能对话：由 #trainChatToggle 控制面板，内容由本地演示场景提供。
(function () {
  const $ = (id) => document.getElementById(id);

  let chatHistory = [];
  let chatStreaming = false;
  let chatStopped = false;    // 本轮回答是否被用户按「停止回答」打断
  let activeResumeRound = null;
  let stoppedRound = null;    // 只保留最近一轮被用户停止的回答
  // 会话世代号：重置或插队中断当前回答时 +1。回答是一串异步流程，停止标志挡不住后续收尾
  // (改 chatStreaming、往 DOM 上补
  // 「已停止回答」)。这些收尾一旦落到新会话上就是污染,所以每轮开跑时记下当时的世代号,
  // 收尾前对一下:对不上说明"我这轮已经被丢掉了",直接撒手。
  let chatEpoch = 0;
  let restoreChatContext = () => {};

  // ── 首屏点阵底纹:canvas 逐点画一块椭圆形淡出的点阵,替代原来的 src/pic/点阵背景.png。
  // 之所以不引现成的点阵库(Magic UI DotPattern / react-bits DotGrid 之类):那些都是 React 组件,
  // 而这个文件是零依赖的单文件原型,搬进来的成本远大于这几十行。
  // 两种"闪动":
  //   1) 初始化——新建对话、每次展开抽屉,一圈波纹从中心向外扩散,点被波峰扫过时提亮;
  //   2) 鼠标经过——指针周围一片点提亮,指针离开后自己衰减回底色。
  // RAF 只在这两件事进行时跑:波纹放完、且指针停住不动,就停在最后一帧,静置时不烧 CPU。
  // prefers-reduced-motion 下两种动效都跳过,只画一张静态底纹。──
  const DOT_GAP = 10;           // 点阵行列间距(CSS px)
  const DOT_RADIUS = 2.0;       // 点半径
  const DOT_RIPPLE_MS = 1500;   // 波纹从中心扩到最外圈用时
  const DOT_RIPPLE_BAND = 90;   // 波峰前后的影响宽度,越大波纹越"厚"
  const DOT_HOVER_RADIUS = 130; // 指针提亮半径
  const DOT_HOVER_EASE = 0.12;  // 指针强度的追帧系数,亮起和熄灭都用这个速度

  // "R G B" 三元组(CSS 变量里那种不带 rgb() 包装的写法)→ [r, g, b]
  function parseRgbTriplet(raw, fallback) {
    const n = String(raw).trim().split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v));
    return n.length >= 3 ? n.slice(0, 3) : fallback;
  }

  let welcomeDots = null; // 同一时刻只可能有一块欢迎屏,句柄存全局,重建时先回收旧的

  function createWelcomeDots(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = canvas.closest('.wzh-chat-welcome-hero') || canvas.parentElement;
    const st = {
      dots: [], w: 0, h: 0, maxDist: 1,
      color: [99, 102, 241], hot: [123, 37, 244], alpha: 0.2,
      rippleStart: 0,           // 0 表示当前没有波纹
      hover: 0, hoverTarget: 0, // 当前/目标指针强度,0~1
      px: 0, py: 0,             // 指针在 canvas 坐标系里的位置
      raf: 0, moved: false, dead: false,
    };

    function readDotStyle() {
      const cs = getComputedStyle(canvas);
      st.color = parseRgbTriplet(cs.getPropertyValue('--wzh-dots-rgb'), st.color);
      st.hot = parseRgbTriplet(cs.getPropertyValue('--wzh-dots-hot-rgb'), st.color);
      const a = parseFloat(cs.getPropertyValue('--wzh-dots-alpha'));
      if (Number.isFinite(a)) st.alpha = a;
    }

    // 按当前尺寸重建点阵。中心最密、四周淡出成一块椭圆,形状照着原图那版底纹。
    function build() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (!w || !h) { st.dots = []; return false; }
      // DPR 上限取 2:再往上翻只是多烧填充率,这种很淡的底纹肉眼分不出
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      st.w = w; st.h = h;

      const cx = w / 2, cy = h / 2, rx = w * 0.52, ry = h * 0.42;
      const dots = [];
      for (let y = (h % DOT_GAP) / 2; y < h; y += DOT_GAP) {
        for (let x = (w % DOT_GAP) / 2; x < w; x += DOT_GAP) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          const d = Math.hypot(nx, ny);
          if (d >= 1) continue;
          // (1-d)² 收边 + 每个点一点随机抖动,否则淡出的边界会看出一条规整的椭圆线
          const base = (1 - d) * (1 - d) * (0.72 + Math.random() * 0.28);
          dots.push({ x, y, base, dist: Math.hypot(x - cx, y - cy), lit: 0 });
        }
      }
      st.dots = dots;
      st.maxDist = Math.hypot(rx, ry);
      return true;
    }

    function draw(now) {
      const { dots, w, h } = st;
      ctx.clearRect(0, 0, w, h);
      if (!dots.length) return;

      // 波峰半径走 easeOutCubic:一开始扩得快、后面慢下来,像水面荡开而不是匀速的圆
      let waveR = -1, waveFade = 0;
      if (st.rippleStart) {
        const t = (now - st.rippleStart) / DOT_RIPPLE_MS;
        if (t >= 1) {
          st.rippleStart = 0;
        } else {
          waveR = (1 - Math.pow(1 - t, 3)) * (st.maxDist + DOT_RIPPLE_BAND);
          waveFade = 1 - t * t; // 扩到外圈时整圈亮度也在退,收尾不会"啪"地断掉
        }
      }
      const hover = st.hover;

      // 先把每个点这一帧的"被照亮程度"算出来,再分冷/热两趟画:绝大多数点是冷的,
      // 能共用同一个 fillStyle 只改 globalAlpha,省掉每个点一次 rgba() 字符串拼接。
      let hotCount = 0;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        let lit = 0;
        if (waveR >= 0) {
          const dw = Math.abs(dot.dist - waveR);
          if (dw < DOT_RIPPLE_BAND) lit = Math.cos((dw / DOT_RIPPLE_BAND) * Math.PI / 2) * waveFade;
        }
        if (hover > 0.01) {
          const dh = Math.hypot(dot.x - st.px, dot.y - st.py);
          if (dh < DOT_HOVER_RADIUS) {
            const k = 1 - dh / DOT_HOVER_RADIUS;
            lit = Math.min(1, lit + k * k * hover);
          }
        }
        dot.lit = lit;
        if (lit > 0.01) hotCount++;
      }

      const [r, g, b] = st.color;
      const [hr, hg, hb] = st.hot;
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        if (dot.lit > 0.01) continue;
        const a = st.alpha * dot.base;
        if (a < 0.004) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!hotCount) return;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const lit = dot.lit;
        if (lit <= 0.01) continue;
        // 亮的点同时变浓、变大、往 hot 色偏一点,不只是调透明度,"闪"才看得出来。
        // 系数按"照到最亮时的倍数"来定:透明度最多 2.6 倍,半径最多 1.4 倍(2.0px → 2.8px)。
        const a = Math.min(0.9, st.alpha * dot.base * (1 + lit * 1.6));
        ctx.fillStyle = 'rgba(' + Math.round(r + (hr - r) * lit) + ','
          + Math.round(g + (hg - g) * lit) + ','
          + Math.round(b + (hb - b) * lit) + ','
          + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS * (1 + lit * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function schedule() {
      if (!st.raf && !st.dead) st.raf = requestAnimationFrame(frame);
    }

    function frame(now) {
      st.raf = 0;
      if (st.dead) return;
      const moved = st.moved;
      st.moved = false;
      st.hover += (st.hoverTarget - st.hover) * DOT_HOVER_EASE;
      if (Math.abs(st.hoverTarget - st.hover) < 0.005) st.hover = st.hoverTarget;
      draw(now);
      // 波纹没放完、指针强度还在追、或指针刚动过——才需要下一帧
      if (st.rippleStart || st.hover !== st.hoverTarget || moved) schedule();
    }

    function redraw() {
      if (!st.dots.length) build();
      draw(performance.now());
    }

    // ── 尺寸和主题变化都得重来一遍:面板从收起到展开、窗口缩放会改 canvas 的实际像素尺寸,
    // 换主题会改点的颜色。两个 observer 都只做"重建 + 重画一帧",不启动动画。 ──
    const ro = new ResizeObserver(() => { build(); draw(performance.now()); });
    ro.observe(canvas);
    const themeObs = new MutationObserver(() => { readDotStyle(); redraw(); });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-brand'] });

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      st.px = e.clientX - rect.left;
      st.py = e.clientY - rect.top;
      st.hoverTarget = 1;
      st.moved = true;
      schedule();
    }
    function onLeave() {
      st.hoverTarget = 0;
      schedule();
    }
    // 指针事件挂在 hero 上(canvas 自己是 pointer-events:none),且只对真正能悬停的指针开——
    // 触摸设备上点一下会留下一个不再移动的"指针",亮斑就会一直卡在那儿。
    const canHover = window.matchMedia('(hover: hover)').matches && !reduced;
    if (hero && canHover) {
      hero.addEventListener('pointermove', onMove);
      hero.addEventListener('pointerleave', onLeave);
    }

    readDotStyle();
    build();
    draw(performance.now());

    return {
      canvas,
      // 放一次扩散波纹。面板还没展开过、点阵还是空的时候,这里补一次 build。
      ripple() {
        if (st.dead) return;
        if (!st.dots.length && !build()) return;
        if (reduced) { draw(performance.now()); return; }
        st.rippleStart = performance.now();
        schedule();
      },
      destroy() {
        st.dead = true;
        if (st.raf) cancelAnimationFrame(st.raf);
        st.raf = 0;
        ro.disconnect();
        themeObs.disconnect();
        if (hero && canHover) {
          hero.removeEventListener('pointermove', onMove);
          hero.removeEventListener('pointerleave', onLeave);
        }
      },
    };
  }

  // 欢迎屏(重新)出现时调一次:接管当前这块 canvas 并放一圈波纹。
  // 欢迎屏已经被第一条消息顶掉时,顺手把上一块的 RAF 和监听回收掉。
  function playWelcomeDots() {
    const canvas = document.querySelector('#trainChatMessages .wzh-chat-welcome-dots');
    if (welcomeDots && welcomeDots.canvas !== canvas) {
      welcomeDots.destroy();
      welcomeDots = null;
    }
    if (!canvas) return;
    if (!welcomeDots) welcomeDots = createWelcomeDots(canvas);
    welcomeDots?.ripple();
  }

  // ── 首屏欢迎语打字机效果:只要还停在欢迎屏(未开始对话),每次打开抽屉都重新播放一遍。
  // 用一个自增 token 标记"当前是第几轮打字"——如果面板被快速关了又开、上一轮的 setTimeout
  // 链还没跑完,旧的 step() 发现自己的 token 已经过期就直接放弃,不会跟新一轮抢着写同一个
  // 已被清空重建的 cursor 节点(避免 insertAdjacentText 在已脱离文档的节点上报错)。 ──
  const WELCOME_TEXT = '你好，我是性能分析助手';
  let typewriterToken = 0;

  function typeWelcomeText(el, text) {
    const token = ++typewriterToken;
    el.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'wzh-chat-typewriter-cursor';
    el.appendChild(cursor);
    let i = 0;
    (function step() {
      if (token !== typewriterToken) return;
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i]);
        i += 1;
        setTimeout(step, 32);
      } else {
        setTimeout(() => { if (token === typewriterToken) cursor.remove(); }, 1200);
      }
    })();
  }

  function playWelcomeTypewriter() {
    playWelcomeDots(); // 欢迎屏还在就重放一圈点阵扩散,已经开始对话则顺手回收 canvas
    const el = document.querySelector('#trainChatMessages .wzh-chat-welcome-text');
    if (!el) return;
    typeWelcomeText(el, WELCOME_TEXT);
  }

  const STICK_THRESHOLD = 64;  // 距底部小于这个像素数即视为"贴着底部看最新消息"
  // 是否还要跟着最新内容走。一轮问答开始时置 true;用户自己滚了(滚轮/触摸/方向键/拖滚动条)
  // 就置 false,思考和回答继续往下长但视口不动;等用户自己滑回底部(或点「回到底部」)再恢复。
  let stickToBottom = true;
  const FADE_EPSILON = 6;      // 滚动余量小于这个像素数就当作已经到顶/到底,不再渐隐
  let fadeRaf = 0;

  function isNearBottom(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD;
  }

  function updateChatFade(el) {
    const msgEl = el || $('trainChatMessages');
    if (!msgEl) return;
    const rest = msgEl.scrollHeight - msgEl.clientHeight;
    const canScroll = rest > FADE_EPSILON;
    // 这里只刷新视觉状态，不根据 scroll 事件恢复自动跟随。内容重排（例如正式回答开始时
    // 自动收起思考块）和程序化 scrollTo 同样会触发 scroll；在这里恢复会误把用户刚刚
    // 取消的跟随重新打开。恢复跟随只由下方明确的用户向下滚动操作或「回到底部」触发。
    // 置顶的问题卡片就贴在滚动口顶沿,再叠一层顶端渐隐会把卡片上半截压暗;
    // 改由卡片自己的下沿遮罩(.is-stuck::after)承担"内容淡出"这件事。
    // 判定要同时满足两条:卡片已经压到内容区顶沿、且确实滚动过——
    // 只看前一条的话,scrollTop=0 时卡片本来就在顶沿,遮罩会无端亮着。
    const pinned = msgEl.querySelector('.wzh-chat-qcard.is-pinned');
    if (pinned) {
      const padTop = parseFloat(getComputedStyle(msgEl).paddingTop) || 0;
      const gap = pinned.getBoundingClientRect().top
        - (msgEl.getBoundingClientRect().top + padTop);
      pinned.classList.toggle('is-stuck', gap <= FADE_EPSILON && msgEl.scrollTop > FADE_EPSILON);
    }
    msgEl.classList.toggle('is-fade-top', canScroll && !pinned && msgEl.scrollTop > FADE_EPSILON);
    msgEl.classList.toggle('is-fade-bottom', canScroll && rest - msgEl.scrollTop > FADE_EPSILON);
    updateJumpBtn();
  }

  // 滚动/流式刷新期间调用很密集,合并到下一帧统一算一次
  function scheduleFadeUpdate(el) {
    if (fadeRaf) return;
    fadeRaf = requestAnimationFrame(() => { fadeRaf = 0; updateChatFade(el); });
  }

  function scrollChatToBottom(el, opts) {
    if (!el) return;
    const o = opts || {};
    if (o.onlyIfNearBottom && !stickToBottom) { scheduleFadeUpdate(el); return; }
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: o.instant ? 'auto' : 'smooth' });
    } catch (e) {
      el.scrollTop = el.scrollHeight; // 老引擎不支持 scrollTo(options) 时退回硬跳
    }
    scheduleFadeUpdate(el);
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 代码块统一由这里拼:外面套一层定位容器,右上角挂复制键。回答是打字机整段重渲染的,
  // 按钮会被反复重建,所以点击不在这里绑,走 boot 里挂在消息区上的事件委托。
  const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="9" y="9" width="11" height="11" rx="2"></rect>' +
    '<path d="M5 15V5a2 2 0 0 1 2-2h8"></path></svg>';
  const COPY_DONE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>';
  function codeBlock(code) {
    return '<div class="wzh-chat-codeblock"><pre><code>' + code + '</code></pre>' +
      '<button type="button" class="wzh-chat-copy" title="复制">' + COPY_ICON + '</button></div>';
  }

  // 剪贴板:navigator.clipboard 只在 https / localhost 下有,这个页面也可能被直接
  // 双击用 file:// 打开,所以留一条 execCommand 的退路。
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  // 极简 Markdown 渲染:本仓库页面不接 CDN 依赖以保持离线可用,这里只覆盖聊天回复常见的
  // 标题/加粗/行内代码/代码块/列表/段落。先整体转义再拼 HTML,模型或用户输入里的尖括号
  // 不会被当成标签解析。
  function renderMarkdown(text) {
    const lines = escHtml(text).split('\n');
    const out = [];
    let inCode = false, codeBuf = [];
    let listBuf = [], listType = null, listStart = 1;
    function flushList() {
      if (!listBuf.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      const startAttr = tag === 'ol' ? ' start="' + listStart + '"' : '';
      out.push('<' + tag + startAttr + '>' + listBuf.map((li) => '<li>' + li + '</li>').join('') + '</' + tag + '>');
      listBuf = []; listType = null; listStart = 1;
    }
    // 自定义语法 [[lane:<泳道id>::<锚点文字>]] → 可点的定位锚点(见 .wzh-chat-locate)。
    // 分隔符用 :: 不用 |:表格行是先按 | 切列再走 inline 的,用 | 会把锚点在表格里切断。
    const LOCATE_RE = /\[\[lane:([a-z0-9-]+)::([^\]]+)\]\]/g;
    const LOCATE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="5.5"></circle>' +
      '<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"></path></svg>';
    function inline(s) {
      return s
        // 打字机是逐字重渲染的(见 typeMarkdownInto),锚点打到一半时先藏起来,
        // 否则读者会看到半截 [[lane:ovl-free::泳道… 的原文闪过去
        .replace(/\[\[[^\]]*\]?$/, '')
        .replace(LOCATE_RE, function (m, id, label) {
          return '<button type="button" class="wzh-chat-locate" data-lane="' + id +
            '" title="在泳道图中定位">' + LOCATE_ICON + '<span>' + label + '</span></button>';
        })
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    // GFM 管道表格支持(「调整图表」演示场景的回答里要用表格罗列替换前后 + 提取结果)。
    function isSeparatorRow(line) {
      return /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);
    }
    function splitRow(line) {
      let t = line.trim();
      if (t.startsWith('|')) t = t.slice(1);
      if (t.endsWith('|')) t = t.slice(0, -1);
      return t.split('|').map((c) => c.trim());
    }

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith('```')) {
        if (inCode) { out.push(codeBlock(codeBuf.join('\n'))); codeBuf = []; inCode = false; }
        else { flushList(); inCode = true; }
        i++; continue;
      }
      if (inCode) { codeBuf.push(line); i++; continue; }

      if (line.includes('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
        flushList();
        const header = splitRow(line);
        let j = i + 2;
        const rows = [];
        while (j < lines.length && lines[j].includes('|') && lines[j].trim()) {
          rows.push(splitRow(lines[j]));
          j++;
        }
        out.push(
          '<table class="wzh-chat-table"><thead><tr>' +
          header.map((h2) => '<th>' + inline(h2) + '</th>').join('') +
          '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table>'
        );
        i = j; continue;
      }

      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { flushList(); out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      const ul = line.match(/^\s*[-*]\s+(.*)$/);
      if (ol) {
        if (listType !== 'ol') { flushList(); listType = 'ol'; listStart = Number(ol[1]) || 1; }
        listBuf.push(inline(ol[2])); i++; continue;
      }
      if (ul) { if (listType !== 'ul') flushList(); listType = 'ul'; listBuf.push(inline(ul[1])); i++; continue; }
      flushList();
      if (!line.trim()) { i++; continue; }
      out.push('<p>' + inline(line) + '</p>');
      i++;
    }
    flushList();
    if (inCode && codeBuf.length) out.push(codeBlock(codeBuf.join('\n')));
    return out.join('');
  }

  // AI 回复统一走"缩进正文"外壳(不加背景气泡、不加头像行——表格/卡片这类内容挤在有色
  // 气泡里会很难看),流式更新/脚本演示/错误提示都只需要改 bodyEl.innerHTML。
  function createAiMessageShell() {
    const div = document.createElement('div');
    div.className = 'wzh-chat-message ai';
    div.innerHTML = '<div class="wzh-chat-body-content"></div>';
    return { el: div, bodyEl: div.querySelector('.wzh-chat-body-content') };
  }

  let thinkingActive = false;   // 供「回到底部」按钮切换形态用（三个点 / 下箭头）
  let activeThink = null;       // 当前这轮的思考块,「新建对话」丢弃这一轮时要停掉它的秒表

  // 1m32s / 12s：与参考稿一致的紧凑写法，不写「0m」也不补零到分钟
  function fmtDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    return m ? m + 'm' + String(s % 60).padStart(2, '0') + 's' : s + 's';
  }

  // 提问里的上下文引用写成 #{...}，渲染成品牌蓝的引用块（对应输入框里 # 添加上下文）
  function renderQuestionText(text) {
    return escHtml(text)
      .replace(/#\{([^}]+)\}/g, (m, inner) => '<span class="wzh-chat-qref"># ' + inner + '</span>')
      .replace(/\n/g, '<br>');
  }

  // 思考正文只需要很轻的富文本：`code`、**强调**、空行分段，不走完整 markdown
  function renderThinkText(text) {
    return escHtml(text)
      .split(/\n{2,}/)
      .map((seg) => '<p>' + seg
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>') + '</p>')
      .join('');
  }

  // ── 会话主题行 ─────────────────────────────────────────────────────────
  // 发出第一个问题时冒出来的那一行(标题栏下方、置顶问题卡片上方)。默认从第一问里
  // 摘一句当主题,悬浮显示铅笔,点一下就地改名——一次会话往往要问好几轮,置顶卡片
  // 只留得住"最近这一问",而"这次会话在解决什么"要一直挂在最上面。
  const SESSION_TITLE_MAX = 20; // 自动摘出来的主题最多留这么多字,再长就省略号

  // 从第一问里摘主题:先脱掉 #{...} 的引用壳只留文字,再按标点切出第一个短句。
  function deriveSessionTitle(text) {
    const plain = String(text || '')
      .replace(/#\{([^}]+)\}/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return '新会话';
    const first = plain.split(/[。！？!?；;\n]/)[0].trim() || plain;
    return first.length > SESSION_TITLE_MAX
      ? first.slice(0, SESSION_TITLE_MAX) + '…'
      : first;
  }

  function setSessionTitle(title) {
    const rowEl = $('trainChatSession');
    const textEl = $('trainChatSessionText');
    if (!rowEl || !textEl) return;
    const t = String(title || '').trim() || '新会话';
    textEl.textContent = t;
    $('trainChatSessionBtn')?.setAttribute('title', t + '（点击重命名）');
    rowEl.hidden = false;
  }

  // 第一问落地时才建主题行;后续轮次沿用已有主题(用户可能已经手改过,别覆盖掉)
  function ensureSessionTitle(text, explicit) {
    const rowEl = $('trainChatSession');
    if (!rowEl || !rowEl.hidden) return;
    setSessionTitle(explicit || deriveSessionTitle(text));
  }

  function hideSessionTitle() {
    const rowEl = $('trainChatSession');
    if (!rowEl) return;
    endSessionTitleEdit(false);
    rowEl.hidden = true;
    const textEl = $('trainChatSessionText');
    if (textEl) textEl.textContent = '';
  }

  // 改名:按钮就地换成同尺寸的输入框(Enter/失焦保存,Esc 放弃)
  function beginSessionTitleEdit() {
    const btn = $('trainChatSessionBtn');
    const input = $('trainChatSessionInput');
    const textEl = $('trainChatSessionText');
    if (!btn || !input || !textEl || !input.hidden) return;
    input.value = textEl.textContent;
    btn.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }

  function endSessionTitleEdit(commit) {
    const btn = $('trainChatSessionBtn');
    const input = $('trainChatSessionInput');
    if (!btn || !input || input.hidden) return;
    if (commit) {
      const next = input.value.trim();
      if (next) setSessionTitle(next); // 改成空的就当没改,保留原主题
    }
    input.hidden = true;
    btn.hidden = false;
  }

  function initSessionTitle() {
    const btn = $('trainChatSessionBtn');
    const input = $('trainChatSessionInput');
    if (!btn || !input) return;
    btn.addEventListener('click', beginSessionTitleEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); endSessionTitleEdit(true); btn.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); endSessionTitleEdit(false); btn.focus(); }
    });
    input.addEventListener('blur', () => endSessionTitleEdit(true));
  }

  const QCARD_MAX_LINES = 3; // 锚点行之外，正文默认展示的行数

  function captureComposerContext() {
    const group = $('trainChatContextGroup');
    if (!group || group.hidden) return { directory: '', codePath: '' };
    const anchor = $('trainChatAnchorChip');
    const codeContext = $('trainChatCodeContext');
    const codeChip = $('trainChatCodeChip');
    return {
      directory: anchor && !anchor.hidden ? $('trainChatAnchorName')?.textContent.trim() || '' : '',
      codePath: codeContext && !codeContext.hidden && codeChip && !codeChip.hidden
        ? $('trainChatLocalCodePath')?.value || '' : '',
    };
  }

  function appendQuestionCard(text, opts) {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return null;
    msgEl.querySelector('.wzh-chat-welcome')?.remove();
    if (welcomeDots) { welcomeDots.destroy(); welcomeDots = null; } // 连同点阵 canvas 的 RAF/监听一起收掉
    // 只让最新一轮的卡片置顶：多张 sticky 卡会在顶部互相叠住
    msgEl.querySelectorAll('.wzh-chat-qcard.is-pinned').forEach((c) => c.classList.remove('is-pinned'));

    const o = opts || {};
    const context = o.context || captureComposerContext();
    const contextItems = [];
    if (context.directory) contextItems.push(
      '<span class="wzh-chat-qcard-context-item wzh-chat-qcard-directory">' +
        '<img src="../../src/pic/icon/folder.svg" alt=""><span>' + escHtml(context.directory) + '</span>' +
      '</span>');
    if (context.codePath) contextItems.push(
      '<span class="wzh-chat-qcard-context-item wzh-chat-qcard-code">' +
        '<img src="../../src/pic/icon/localfile.svg" alt=""><span>' + escHtml(context.codePath) + '</span>' +
      '</span>');
    ensureSessionTitle(text, o.sessionTitle); // 第一问落地时,顶上那行会话主题才出现
    flushPendingModelNote();                  // 欢迎屏上切过模型的话,标记补在这一问前面
    stickToBottom = true; // 新一轮提问:重新跟随最新内容
    const card = document.createElement('div');
    card.className = 'wzh-chat-qcard is-pinned' + (contextItems.length ? ' has-context' : '');
    card.innerHTML =
      '<button class="wzh-chat-qcard-toggle" type="button" aria-expanded="true" title="收起提问">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>' +
      '</button>' +
      (contextItems.length ? '<span class="wzh-chat-qcard-anchor">' +
        contextItems.join('<span class="wzh-chat-qcard-divider" aria-hidden="true"></span>') +
      '</span>' : '') +
      '<div class="wzh-chat-qcard-text">' + renderQuestionText(text) + '</div>';
    const directoryItem = card.querySelector('.wzh-chat-qcard-directory');
    if (directoryItem) directoryItem.title = context.directory;
    const codeItem = card.querySelector('.wzh-chat-qcard-code');
    if (codeItem) codeItem.title = context.codePath;

    const textEl = card.querySelector('.wzh-chat-qcard-text');
    const toggle = card.querySelector('.wzh-chat-qcard-toggle');
    function setCollapsed(collapsed) {
      card.classList.toggle('is-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.title = collapsed ? '展开提问' : '收起提问';
      scheduleFadeUpdate(msgEl);
    }
    // 折叠/展开挂在整张卡片上,箭头的点击冒泡到这里,两者是同一个动作:
    // 问题被夹住时正文只剩三行,最自然的手势是点卡片本身,而不是去瞄那个 20px 的小箭头。
    card.addEventListener('click', (e) => {
      if (!card.classList.contains('is-clampable')) return;  // 没夹住就没有折叠态可言
      if (e.target.closest('a')) return;                      // 正文里的链接照常走自己的行为
      // 划词选正文时松开鼠标也会触发 click,别把它当成折叠手势
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && card.contains(sel.anchorNode)) return;
      setCollapsed(!card.classList.contains('is-collapsed'));
    });

    msgEl.appendChild(card);
    // 量一次真实高度再决定要不要折叠：不足 3 行的短问题连折叠箭头都不出现。
    // 必须等布局完成后再量，插入的同一帧里 scrollHeight 还没定下来。
    requestAnimationFrame(() => {
      const lh = parseFloat(getComputedStyle(textEl).lineHeight) || 21;
      if (textEl.scrollHeight > lh * QCARD_MAX_LINES + 2) {
        card.classList.add('is-clampable');
        setCollapsed(true);                                 // 超长即默认折叠
      }
      scheduleFadeUpdate(msgEl);
    });
    scrollChatToBottom(msgEl);
    return card;
  }

  // 思考过程块。用法：
  //   const think = createThinkBlock(bodyEl, { clockScale });
  //   const node = think.startNode({ kind:'thinking'|'usetool', title, doneTitle });
  //   node.setText(...) / node.appendText(...); think.finishNode();
  //   think.finish();   // 正式回答开始时调用：停表 + 自动收起
  // clockScale 只服务于固定脚本演示——演示流程压到几秒跑完，但计时按真实排查节奏展示；
  function createThinkBlock(container, opts) {
    const o = opts || {};
    const scale = o.clockScale || 1;
    const msgEl = $('trainChatMessages');

    const box = document.createElement('div');
    box.className = 'wzh-chat-think';
    box.innerHTML =
      '<button class="wzh-chat-think-head" type="button" aria-expanded="false" title="展开/收起思考过程">' +
        '<span class="wzh-chat-think-head-label">思考中</span>' +
        '<span class="wzh-chat-think-head-time"></span>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>' +
      '</button>' +
      '<div class="wzh-chat-think-body"></div>';
    container.appendChild(box);

    const bodyEl = box.querySelector('.wzh-chat-think-body');
    const headBtn = box.querySelector('.wzh-chat-think-head');
    const headTimeEl = box.querySelector('.wzh-chat-think-head-time');
    const headLabelEl = box.querySelector('.wzh-chat-think-head-label');
    headBtn.addEventListener('click', () => {
      const collapsed = box.classList.toggle('is-collapsed');
      headBtn.setAttribute('aria-expanded', String(!collapsed));
      scheduleFadeUpdate(msgEl);
    });

    const startedAt = Date.now();
    const runEpoch = chatEpoch;
    let current = null;   // { el, timeEl, titleEl, doneTitle, startedAt }
    let ticker = 0;
    let totalMs = 0;

    thinkingActive = true;
    updateJumpBtn();

    function elapsed(from) { return (Date.now() - from) * scale; }

    function tick() {
      headTimeEl.textContent = fmtDuration(elapsed(startedAt));
      if (current) current.timeEl.textContent = fmtDuration(elapsed(current.startedAt));
    }
    ticker = setInterval(tick, 200);
    tick();

    // 思考过程自动滚屏：只在用户本来就贴着底部时跟随，往回翻历史不会被硬拽回来
    function follow() { scrollChatToBottom(msgEl, { instant: true, onlyIfNearBottom: true }); }

    function finishNode() {
      if (!current) return;
      current.timeEl.textContent = fmtDuration(elapsed(current.startedAt));
      current.titleEl.textContent = current.doneTitle;
      current.el.classList.remove('is-running');
      current = null;
    }

    const api = {
      el: box,
      startNode(cfg) {
        finishNode();
        const c = cfg || {};
        const node = document.createElement('div');
        node.className = 'wzh-chat-think-node is-running';
        node.dataset.kind = c.kind === 'usetool' ? 'usetool' : 'thinking';
        node.innerHTML =
          '<span class="wzh-chat-think-dot"></span>' +
          '<div class="wzh-chat-think-node-head">' +
            '<span class="wzh-chat-think-node-title"></span>' +
            '<span class="wzh-chat-think-node-time">0s</span>' +
          '</div>' +
          '<div class="wzh-chat-think-node-text"></div>';
        const titleEl = node.querySelector('.wzh-chat-think-node-title');
        titleEl.textContent = c.title || (c.kind === 'usetool' ? '调用工具' : '思考中');
        bodyEl.appendChild(node);
        current = {
          el: node,
          titleEl,
          timeEl: node.querySelector('.wzh-chat-think-node-time'),
          textEl: node.querySelector('.wzh-chat-think-node-text'),
          doneTitle: c.doneTitle || (c.kind === 'usetool' ? (c.title || '调用工具') : '思考完成'),
          startedAt: Date.now(),
        };
        tick();
        follow();
        return {
          setText(t) { current && (current.textEl.innerHTML = renderThinkText(t)); follow(); },
        };
      },
      // 流式写入当前节点（打字机），返回 Promise 便于把脚本串成时间线
      // 与回答区的 typeMarkdownInto 共用同一档节奏参数，两段的手感才一致
      typeText(text, msPerChunk) {
        const target = current && current.textEl;
        if (!target) return Promise.resolve();
        const step = msPerChunk || 16;
        return new Promise((resolve) => {
          let i = 0;
          const timer = setInterval(() => {
            if (chatStopped || runEpoch !== chatEpoch) { clearInterval(timer); resolve(); return; } // 停止或插队中断
            i = Math.min(text.length, i + 2);
            target.innerHTML = renderThinkText(text.slice(0, i));
            follow();
            if (i >= text.length) { clearInterval(timer); resolve(); }
          }, step);
        });
      },
      finishNode,
      // 整轮被丢弃时(「新建对话」打断)的收场:只停表。DOM 马上就要被整块扔掉,不用补
      // 收束节点、也不用改标题;但秒表是 setInterval,不显式停就会挂在游离节点上一直跑。
      dispose() {
        finishNode();
        if (ticker) { clearInterval(ticker); ticker = 0; }
        thinkingActive = false;
        if (activeThink === api) activeThink = null;
      },
      interrupt() {
        if (current) {
          current.timeEl.textContent = fmtDuration(elapsed(current.startedAt));
          current.titleEl.textContent = '思考已停止';
          current.el.classList.remove('is-running');
          current = null;
        }
        if (ticker) { clearInterval(ticker); ticker = 0; }
        headTimeEl.textContent = fmtDuration(elapsed(startedAt));
        headLabelEl.textContent = '思考已停止';
        box.classList.add('is-done', 'is-collapsed');
        headBtn.setAttribute('aria-expanded', 'false');
        thinkingActive = false;
        if (activeThink === api) activeThink = null;
        updateJumpBtn();
      },
      // 正式回答开始：停表、标题改成「思考完成 2m36s」并自动收起
      finish() {
        finishNode();
        if (ticker) { clearInterval(ticker); ticker = 0; }
        // 竖轨末端补一个收束节点,把思考过程和正式回答接上
        const last = document.createElement('div');
        last.className = 'wzh-chat-think-node is-final';
        last.innerHTML =
          '<span class="wzh-chat-think-dot"></span>' +
          '<div class="wzh-chat-think-node-head">' +
            '<span class="wzh-chat-think-node-title">思考完成，开始回答：</span>' +
          '</div>';
        bodyEl.appendChild(last);
        totalMs = elapsed(startedAt);
        headTimeEl.textContent = fmtDuration(totalMs);
        headLabelEl.textContent = '思考完成';
        box.classList.add('is-done', 'is-collapsed');
        headBtn.setAttribute('aria-expanded', 'false');
        thinkingActive = false;
        updateJumpBtn();
        scheduleFadeUpdate(msgEl);
        return totalMs;
      },
    };
    activeThink = api; // 「新建对话」要停掉这块的秒表,见 resetConversation
    return api;
  }

  // 回答区打字机:按 markdown 源码逐段重渲染，而不是逐个 DOM 节点插入——
  // 列表 / 表格这类块级结构只有整段重渲染才能得到正确的中间态。
  function typeMarkdownInto(el, text, msPerTick, charsPerTick, onRender, startAt = 0) {
    el._markdownSource = text;
    const msgEl = $('trainChatMessages');
    const step = msPerTick || 28;
    const chunk = charsPerTick || 2;
    const runEpoch = chatEpoch;
    return new Promise((resolve) => {
      let i = startAt;
      const timer = setInterval(() => {
        if (chatStopped || runEpoch !== chatEpoch) { clearInterval(timer); resolve(); return; } // 停止或插队中断
        i = Math.min(text.length, i + chunk);
        // 可视化卡片是可交互节点。当前段落重绘前先摘下并保留同一批 DOM，
        // 重绘后再由 onRender 放回新位置，避免动画期间按钮每 16ms 被替换一次。
        const retainedCards = new Map(Array.from(el.querySelectorAll('.wzh-chat-viz-card')).map((card) => [
          card.dataset.vizModule,
          card,
        ]));
        el.innerHTML = renderMarkdown(text.slice(0, i));
        el.dataset.typedChars = String(i);
        if (onRender) onRender(retainedCards);
        scrollChatToBottom(msgEl, { instant: true, onlyIfNearBottom: true });
        if (i >= text.length) { clearInterval(timer); resolve(); }
      }, step);
    });
  }

  // 固定诊断回答与 v15 报告模块之间的语义映射。卡片只负责打开现有图表，
  // 数据和绘制逻辑仍全部来自 v15-report-modules-pto.html。
  const ANSWER_VISUALIZATIONS = {
    top1: {
      title: 'Rank 级横向对比',
      desc: '聚焦异常的 Rank 6/7，对齐计算、通信与等待区间',
    },
    top2: {
      title: '计算-通信重叠率',
      desc: '在同一时间轴上查看计算区间与暴露通信',
    },
    top3: {
      title: 'PP 流水线 Bubble',
      desc: '查看 4 个 stage 的 1F1B 调度窗口与空泡分布',
    },
    code: {
      title: '代码变更',
      desc: '2 个文件 · +7 −3',
    },
  };
  const ANSWER_VIZ_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 19V9M10 19V5M16 19v-7M3 21h18"></path></svg>';
  const ANSWER_VIZ_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="m9 6 6 6-6 6"></path></svg>';
  let chatVizState = null;

  function createAnswerVisualizationCard(moduleId) {
    const meta = ANSWER_VISUALIZATIONS[moduleId];
    if (!meta) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wzh-chat-viz-card';
    button.dataset.vizModule = moduleId;
    button.dataset.vizTitle = meta.title;
    button.setAttribute('aria-label', '打开' + meta.title);
    button.innerHTML =
      '<span class="wzh-chat-viz-card-icon">' + ANSWER_VIZ_ICON + '</span>' +
      '<span class="wzh-chat-viz-card-copy">' +
        '<span class="wzh-chat-viz-card-title">' + meta.title + '</span>' +
        '<span class="wzh-chat-viz-card-desc">' + meta.desc + '</span>' +
      '</span>' +
      '<span class="wzh-chat-viz-card-arrow">' + ANSWER_VIZ_ARROW + '</span>';
    return button;
  }

  function nextAnswerBlock(start, wantedTag) {
    let node = start?.nextElementSibling || null;
    while (node && !/^H[23]$/.test(node.tagName)) {
      if (node.tagName === wantedTag) return node;
      node = node.nextElementSibling;
    }
    return null;
  }

  function addProfilingVisualizationCards(answer, retainedCards) {
    if (!answer) return;
    const nodes = Array.from(answer.querySelectorAll('h3, li'));
    const bubblePoint = nodes.find((node) => node.tagName === 'LI' && node.textContent.includes('真正的瓶颈是流水线末级过载'));
    const rankHeading = nodes.find((node) => node.tagName === 'H3' && node.textContent.includes('PP 末级计算过载'));
    const overlapHeading = nodes.find((node) => node.tagName === 'H3' && node.textContent.includes('计算-通信零重叠'));
    const placements = [
      { moduleId: 'top3', target: bubblePoint?.closest('ul') },
      { moduleId: 'top1', target: nextAnswerBlock(rankHeading, 'TABLE') || rankHeading },
      { moduleId: 'top2', target: nextAnswerBlock(overlapHeading, 'UL') || overlapHeading },
    ];
    placements.forEach(({ moduleId, target }) => {
      if (!target || answer.querySelector('.wzh-chat-viz-card[data-viz-module="' + moduleId + '"]')) return;
      const card = retainedCards?.get(moduleId) || createAnswerVisualizationCard(moduleId);
      if (!card) return;
      target.insertAdjacentElement('afterend', card);
      // 当前段落在打字期间会整段重建。若用户已经打开过这张卡，重建后的新按钮
      // 继续接管激活态与焦点回退引用，避免下一帧把选中状态一并抹掉。
      if (chatVizState?.activeModuleId === moduleId) {
        card.classList.add('is-active');
        chatVizState.triggers.set(moduleId, card);
        chatVizState.trigger = card;
      }
    });
  }

  function visualizationFrameSrc(moduleId) {
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    return '../../v15-report-modules-pto.html?embed=chart&module=' + encodeURIComponent(moduleId) + '&size=8&theme=' + theme;
  }

  function activateChatVisualizationTab(moduleId, trigger) {
    const tabs = $('trainChatVizTabs');
    const viewport = $('trainChatVizViewport');
    if (!tabs || !viewport || !chatVizState) return;
    const tab = tabs.querySelector('.wzh-chat-viz-tab[data-viz-module="' + moduleId + '"]');
    const frame = viewport.querySelector('.wzh-chat-viz-frame[data-viz-module="' + moduleId + '"]');
    if (!tab || !frame) return;

    if (trigger) chatVizState.triggers.set(moduleId, trigger);
    chatVizState.activeModuleId = moduleId;
    chatVizState.trigger = chatVizState.triggers.get(moduleId) || null;
    tabs.querySelectorAll('.wzh-chat-viz-tab').forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    viewport.querySelectorAll('.wzh-chat-viz-frame').forEach((item) => { item.hidden = item !== frame; });
    document.querySelectorAll('.wzh-chat-viz-card.is-active').forEach((card) => card.classList.remove('is-active'));
    chatVizState.trigger?.classList.add('is-active');
    // 只滚动标签条；scrollIntoView 会连带滚动正在展开的整个对话面板。
    const tabsRect = tabs.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    if (tabRect.left < tabsRect.left) tabs.scrollLeft -= tabsRect.left - tabRect.left;
    else if (tabRect.right > tabsRect.right) tabs.scrollLeft += tabRect.right - tabsRect.right;
    scheduleFadeUpdate();
  }

  // 代码变更演示与性能诊断结论对应：把一个 Decoder 层从过载的末级移到 stage 2。
  // 工程树是这轮对话的示例工程快照，改动行与左侧统计卡片保持一致。
  const CODE_CHANGE_FILES = {
    'model/config.py': {
      added: 3, removed: 1,
      lines: [
        ['context', 16, '    pipeline_stages: int = 4'],
        ['context', 17, '    num_layers: int = 32'],
        ['removed', 18, '    stage_layer_counts = (8, 8, 8, 8)'],
        ['added', 18, '    stage_layer_counts = (8, 8, 9, 7)'],
        ['added', 19, '    if sum(stage_layer_counts) != num_layers:'],
        ['added', 20, '        raise ValueError("stage layers must match num_layers")'],
        ['context', 21, '    hidden_size: int = 4096'],
      ],
    },
    'model/pipeline.py': {
      added: 4, removed: 2,
      lines: [
        ['context', 38, 'def build_stage_layers(config, stage_id):'],
        ['context', 39, '    """Return the decoder layers assigned to this PP stage."""'],
        ['removed', 40, '    start = stage_id * layers_per_stage'],
        ['added', 40, '    start = sum(config.stage_layer_counts[:stage_id])'],
        ['removed', 41, '    end = start + layers_per_stage'],
        ['added', 41, '    end = start + config.stage_layer_counts[stage_id]'],
        ['added', 42, '    if stage_id == config.pipeline_stages - 1:'],
        ['added', 43, '        assert end == config.num_layers'],
        ['context', 44, '    return [DecoderLayer(config, i) for i in range(start, end)]'],
      ],
    },
  };
  const CODE_PROJECT_TREE = {
    name: 'openpangu-flash', children: [
      { name: 'configs', children: [
        { name: 'pretrain_8npu.yaml' }, { name: 'parallel.yaml' },
      ] },
      { name: 'data', children: [
        { name: '__init__.py' }, { name: 'dataset.py' }, { name: 'tokenizer.py' },
      ] },
      { name: 'model', children: [
        { name: '__init__.py' }, { name: 'attention.py' }, { name: 'config.py', modified: true },
        { name: 'decoder.py' }, { name: 'embedding.py' }, { name: 'moe.py' },
        { name: 'pipeline.py', modified: true }, { name: 'rotary.py' },
      ] },
      { name: 'scripts', children: [
        { name: 'profile.sh' }, { name: 'train.sh' },
      ] },
      { name: 'tests', children: [
        { name: 'test_model.py' }, { name: 'test_pipeline.py' },
      ] },
      { name: '.gitignore' }, { name: 'README.md' }, { name: 'requirements.txt' }, { name: 'train.py' },
    ],
  };

  function createCodeChangeView() {
    const view = document.createElement('div');
    view.className = 'wzh-code-review';
    view.innerHTML =
      '<section class="pto-ide-frame__pane wzh-code-diff-pane" aria-label="代码变更详情">' +
        '<header class="wzh-code-pane-head"><span class="wzh-code-pane-title">变更</span>' +
          '<span class="wzh-code-pane-summary">已编辑 2 个文件 <b>+7</b> <em>−3</em></span></header>' +
        '<div class="pto-ide-frame__pane-body wzh-code-file-list">' +
          '<div class="wzh-code-file-strip" aria-label="已更改的文件"></div>' +
          '<p class="wzh-code-no-change" hidden></p>' +
        '</div>' +
      '</section>' +
      '<section class="pto-ide-frame__pane wzh-code-tree-pane" aria-label="完整代码工程树">' +
        '<header class="wzh-code-pane-head"><span class="wzh-code-pane-title">资源管理器</span></header>' +
        '<label class="wzh-code-search"><span aria-hidden="true">⌕</span>' +
          '<input type="search" placeholder="筛选文件…" aria-label="筛选工程文件"></label>' +
        '<div class="wzh-code-tree-label">OPENPANGU-FLASH <span>2 个已修改</span></div>' +
        '<div class="pto-ide-frame__pane-body wzh-code-tree" role="tree"></div>' +
      '</section>';

    const tree = view.querySelector('.wzh-code-tree');
    const renderNodes = (nodes, parent, prefix = '') => {
      nodes.forEach((node) => {
        const path = prefix ? prefix + '/' + node.name : node.name;
        if (node.children) {
          const folder = document.createElement('div');
          folder.className = 'wzh-code-folder';
          folder.dataset.path = path;
          folder.innerHTML = '<button class="wzh-code-tree-row wzh-code-folder-toggle" type="button" aria-expanded="true">' +
            '<span class="wzh-code-chevron" aria-hidden="true">' + ANSWER_VIZ_ARROW + '</span>' +
            '<span class="wzh-code-tree-name"></span></button><div class="wzh-code-folder-children" role="group"></div>';
          folder.querySelector('.wzh-code-tree-name').textContent = node.name;
          folder.querySelector('.wzh-code-folder-toggle').addEventListener('click', (event) => {
            const button = event.currentTarget;
            button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true'));
          });
          renderNodes(node.children, folder.querySelector('.wzh-code-folder-children'), path);
          if (folder.querySelector('[data-modified="true"]')) folder.classList.add('has-changes');
          parent.appendChild(folder);
        } else {
          const file = document.createElement('button');
          file.type = 'button';
          file.className = 'wzh-code-tree-row wzh-code-tree-file' + (node.modified ? ' is-modified' : '');
          file.dataset.path = path;
          file.dataset.modified = String(Boolean(node.modified));
          file.setAttribute('role', 'treeitem');
          file.innerHTML = '<span class="wzh-code-tree-name"></span>' +
            (node.modified ? '<span class="wzh-code-status" aria-label="已修改">M</span>' : '');
          file.querySelector('.wzh-code-tree-name').textContent = node.name;
          parent.appendChild(file);
        }
      });
    };
    renderNodes(CODE_PROJECT_TREE.children, tree);

    const strip = view.querySelector('.wzh-code-file-strip');
    Object.entries(CODE_CHANGE_FILES).forEach(([path, file]) => {
      const entry = document.createElement('div');
      entry.className = 'wzh-code-file-entry';
      entry.dataset.path = path;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wzh-code-changed-file';
      button.dataset.path = path;
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<img class="wzh-code-file-icon" src="../../src/pic/icon/python.png" alt="">' +
        '<span class="wzh-code-changed-name"></span><span class="wzh-code-line-stats"><b>+' + file.added + '</b> <em>−' + file.removed + '</em></span>' +
        '<span class="wzh-code-expand-icon" aria-hidden="true">' + ANSWER_VIZ_ARROW + '</span>';
      button.querySelector('.wzh-code-changed-name').textContent = path;
      const diff = document.createElement('div');
      diff.className = 'wzh-code-diff-body';
      diff.hidden = true;
      diff.innerHTML = '<div class="wzh-code-hunk">@@ ' +
        (path.endsWith('config.py') ? '-16,4 +16,6' : '-38,4 +38,6') + ' @@</div>' +
        file.lines.map(([kind, line, source]) =>
          '<div class="wzh-code-line is-' + kind + '"><span class="wzh-code-line-num">' + line + '</span>' +
          '<span class="wzh-code-line-mark">' + (kind === 'added' ? '+' : kind === 'removed' ? '−' : ' ') + '</span>' +
          '<code>' + escHtml(source) + '</code></div>').join('');
      entry.append(button, diff);
      strip.appendChild(entry);
    });

    let openPath = null;
    const selectFile = (path, toggle = false) => {
      const file = CODE_CHANGE_FILES[path];
      openPath = toggle && openPath === path ? null : path;
      view.querySelectorAll('.wzh-code-file-entry').forEach((entry) => {
        const expanded = entry.dataset.path === openPath;
        entry.classList.toggle('is-selected', expanded);
        entry.querySelector('.wzh-code-changed-file').setAttribute('aria-expanded', String(expanded));
        entry.querySelector('.wzh-code-diff-body').hidden = !expanded;
      });
      view.querySelectorAll('.wzh-code-tree-file').forEach((node) => {
        node.classList.toggle('is-selected', node.dataset.path === openPath);
      });
      const note = view.querySelector('.wzh-code-no-change');
      if (!file) {
        note.textContent = path + ' 没有本轮代码变更。';
        note.hidden = false;
        return;
      }
      note.hidden = true;
    };
    view.addEventListener('click', (event) => {
      const file = event.target.closest('.wzh-code-tree-file, .wzh-code-changed-file');
      if (file) selectFile(file.dataset.path, file.classList.contains('wzh-code-changed-file'));
    });
    view.querySelector('.wzh-code-search input').addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      tree.querySelectorAll('.wzh-code-tree-file').forEach((file) => {
        file.hidden = Boolean(query && !file.dataset.path.toLowerCase().includes(query));
      });
      Array.from(tree.querySelectorAll('.wzh-code-folder')).reverse().forEach((folder) => {
        folder.hidden = Boolean(query && !folder.querySelector('.wzh-code-tree-file:not([hidden])'));
        if (query && !folder.hidden) folder.querySelector('.wzh-code-folder-toggle').setAttribute('aria-expanded', 'true');
      });
    });
    selectFile('model/pipeline.py');
    return view;
  }

  function createChatVisualizationTab(moduleId, title) {
    const tabs = $('trainChatVizTabs');
    const viewport = $('trainChatVizViewport');
    const meta = ANSWER_VISUALIZATIONS[moduleId];
    if (!tabs || !viewport || !meta) return;

    const tab = document.createElement('div');
    tab.className = 'wzh-chat-viz-tab';
    tab.dataset.vizModule = moduleId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    tab.innerHTML =
      '<span class="wzh-chat-viz-tab-title"></span>' +
      '<button class="wzh-chat-viz-tab-close" type="button" aria-label="关闭此可视化" title="关闭此可视化">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>' +
      '</button>';
    tab.querySelector('.wzh-chat-viz-tab-title').textContent = title || meta.title;
    tab.addEventListener('click', (event) => {
      if (event.target.closest('.wzh-chat-viz-tab-close')) return;
      activateChatVisualizationTab(moduleId);
    });
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateChatVisualizationTab(moduleId);
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const items = Array.from(tabs.querySelectorAll('.wzh-chat-viz-tab'));
      const index = items.indexOf(tab);
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = items[(index + step + items.length) % items.length];
      if (next) {
        activateChatVisualizationTab(next.dataset.vizModule);
        next.focus();
      }
    });
    tab.querySelector('.wzh-chat-viz-tab-close').addEventListener('click', (event) => {
      event.stopPropagation();
      closeChatVisualizationTab(moduleId);
    });
    tabs.appendChild(tab);

    const frame = moduleId === 'code' ? createCodeChangeView() : document.createElement('iframe');
    frame.classList.add('wzh-chat-viz-frame');
    frame.dataset.vizModule = moduleId;
    frame.title = title || meta.title;
    if (moduleId !== 'code') {
      frame.loading = 'lazy';
      frame.src = visualizationFrameSrc(moduleId);
    }
    frame.hidden = true;
    viewport.appendChild(frame);
  }

  function openChatVisualization(moduleId, title, trigger) {
    const panel = $('trainChatPanel');
    const pane = $('trainChatVizPane');
    const tabs = $('trainChatVizTabs');
    if (!panel || !pane || !tabs || !ANSWER_VISUALIZATIONS[moduleId]) return;

    if (!panel.classList.contains('is-visualizing')) {
      const rect = panel.getBoundingClientRect();
      const floating = panel.classList.contains('is-floating') && panel.parentElement?.id === 'msiDesktop';
      const frameRect = (floating ? panel.parentElement :
        panel.closest('.pto-ide-frame__body') || panel.closest('.pto-ide-frame'))?.getBoundingClientRect() ||
        { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth };
      const startWidth = panel.clientWidth;
      const fullWidth = frameRect.width - 16 - (rect.width - startWidth);
      const availableWidth = fullWidth - (floating ? 184 : 8);
      const targetWidth = Math.min(Math.max(startWidth, availableWidth * .25), availableWidth * .75);
      const state = chatVizState = {
        widthValue: panel.style.getPropertyValue('--wzh-chat-w'),
        trigger: trigger || null,
        activeModuleId: null,
        triggers: new Map(),
      };
      panel.style.setProperty('--wzh-chat-w', Math.round(rect.width) + 'px');
      panel.style.setProperty('--wzh-viz-top', floating
        ? Math.max(8, Math.round(rect.top - frameRect.top)) + 'px'
        : '0px');
      panel.style.setProperty('--wzh-viz-bottom', Math.max(8, Math.round(frameRect.bottom - rect.bottom)) + 'px');
      panel.style.setProperty('--wzh-viz-left', Math.max(8, Math.round(rect.left - frameRect.left)) + 'px');
      panel.style.setProperty('--wzh-viz-right', Math.max(8, Math.round(frameRect.right - rect.right)) + 'px');
      panel.style.setProperty('--wzh-viz-chat-w', startWidth + 'px');
      panel.classList.add('is-visualizing', 'is-viz-expanding');
      pane.hidden = false;
      // 先按原位置、原宽度绘制对话；下一帧再向左铺开，右栏随空出的空间露出。
      void panel.offsetWidth;
      state.expandFrame = requestAnimationFrame(() => {
        if (chatVizState !== state) return;
        const nowFloating = panel.classList.contains('is-floating') && panel.parentElement?.id === 'msiDesktop';
        panel.style.setProperty('--wzh-viz-left', nowFloating ? '100px' : '8px');
        panel.style.setProperty('--wzh-viz-right', nowFloating ? '100px' : '8px');
        if (nowFloating) {
          panel.style.setProperty('--wzh-viz-top', '48px');
          panel.style.setProperty('--wzh-viz-bottom', '90px');
        }
        panel.style.setProperty('--wzh-viz-chat-w', targetWidth + 'px');
        const settleDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 340;
        state.expandTimer = setTimeout(() => {
          if (chatVizState !== state) return;
          panel.classList.remove('is-viz-expanding');
          panel.style.removeProperty('--wzh-viz-left');
          panel.style.removeProperty('--wzh-viz-right');
        }, settleDelay);
      });
    }

    if (!tabs.querySelector('.wzh-chat-viz-tab[data-viz-module="' + moduleId + '"]')) {
      createChatVisualizationTab(moduleId, title);
    }
    activateChatVisualizationTab(moduleId, trigger);
  }

  function closeChatVisualizationTab(moduleId) {
    const tabs = $('trainChatVizTabs');
    const viewport = $('trainChatVizViewport');
    if (!tabs || !viewport || !chatVizState) return;
    const tab = tabs.querySelector('.wzh-chat-viz-tab[data-viz-module="' + moduleId + '"]');
    const frame = viewport.querySelector('.wzh-chat-viz-frame[data-viz-module="' + moduleId + '"]');
    if (!tab) return;
    const items = Array.from(tabs.querySelectorAll('.wzh-chat-viz-tab'));
    const index = items.indexOf(tab);
    const wasActive = chatVizState.activeModuleId === moduleId;
    const trigger = chatVizState.triggers.get(moduleId) || null;
    tab.remove();
    frame?.remove();
    chatVizState.triggers.delete(moduleId);

    const remaining = Array.from(tabs.querySelectorAll('.wzh-chat-viz-tab'));
    if (!remaining.length) {
      chatVizState.trigger = trigger;
      closeChatVisualization();
      return;
    }
    if (wasActive) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      activateChatVisualizationTab(next.dataset.vizModule);
      next.focus();
    }
  }

  function closeChatVisualization(opts) {
    const panel = $('trainChatPanel');
    const pane = $('trainChatVizPane');
    if (!panel || !panel.classList.contains('is-visualizing')) return false;
    const trigger = chatVizState?.trigger;
    if (chatVizState?.expandFrame) cancelAnimationFrame(chatVizState.expandFrame);
    if (chatVizState?.expandTimer) clearTimeout(chatVizState.expandTimer);
    panel.classList.remove('is-visualizing', 'is-viz-expanding');
    panel.style.removeProperty('--wzh-viz-top');
    panel.style.removeProperty('--wzh-viz-bottom');
    panel.style.removeProperty('--wzh-viz-left');
    panel.style.removeProperty('--wzh-viz-right');
    panel.style.removeProperty('--wzh-viz-chat-w');
    if (chatVizState?.widthValue) panel.style.setProperty('--wzh-chat-w', chatVizState.widthValue);
    else panel.style.removeProperty('--wzh-chat-w');
    if (pane) pane.hidden = true;
    $('trainChatVizTabs')?.replaceChildren();
    $('trainChatVizViewport')?.replaceChildren();
    document.querySelectorAll('.wzh-chat-viz-card.is-active').forEach((card) => card.classList.remove('is-active'));
    chatVizState = null;
    scheduleFadeUpdate();
    if (opts?.restoreFocus !== false && trigger?.isConnected) trigger.focus();
    return true;
  }

  // 回答尾部的操作栏。赞/踩互斥；复制入口点击后短暂显示对勾。
  function buildAnswerActions() {
    const bar = document.createElement('div');
    bar.className = 'wzh-chat-answer-actions';
    [
      { icon: 'Copy.svg', label: '复制' },
      { icon: 'addtopaper.svg', label: '添加到调优笔记' },
      { icon: 'Like.svg', label: '有帮助', toggle: 'vote' },
      { icon: 'Dislike.svg', label: '没帮助', toggle: 'vote' },
    ].forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wzh-chat-answer-action';
      btn.title = a.label;
      btn.setAttribute('aria-label', a.label);
      btn.innerHTML = '<img src="../../src/pic/icon/' + a.icon + '" alt="">';
      if (a.toggle) {
        btn.addEventListener('click', () => {
          const on = btn.classList.contains('is-active');
          bar.querySelectorAll('.wzh-chat-answer-action.is-active')
            .forEach((b) => b.classList.remove('is-active'));
          btn.classList.toggle('is-active', !on);
        });
      } else if (a.label === '添加到调优笔记') {
        const icon = btn.innerHTML;
        btn.addEventListener('click', () => {
          const message = btn.closest('.wzh-chat-message.ai');
          if (!window.MSI_TUNING_DOCUMENT?.addAnswer(message)) return;
          clearTimeout(btn._copyTimer);
          btn.classList.add('is-copied');
          btn.innerHTML = COPY_DONE_ICON;
          btn.title = '已添加到调优笔记';
          btn.setAttribute('aria-label', '已添加到调优笔记');
          btn._copyTimer = setTimeout(() => {
            btn.classList.remove('is-copied');
            btn.innerHTML = icon;
            btn.title = a.label;
            btn.setAttribute('aria-label', a.label);
          }, 1000);
        });
      } else if (a.label === '复制') {
        btn.addEventListener('click', () => {
          clearTimeout(btn._copyTimer);
          btn.classList.add('is-copied');
          btn.innerHTML = COPY_DONE_ICON;
          btn.title = '已复制';
          btn.setAttribute('aria-label', '已复制');
          btn._copyTimer = setTimeout(() => {
            btn.classList.remove('is-copied');
            btn.innerHTML = '<img src="../../src/pic/icon/Copy.svg" alt="">';
            btn.title = '复制';
            btn.setAttribute('aria-label', '复制');
          }, 1000);
        });
      }
      bar.appendChild(btn);
    });
    return bar;
  }

  // ── 回到底部 ─────────────────────────────────────────────────────────────
  // 只要视线离开了底部就浮出来；思考中换成跳动的三个点，暗示「下面还在长内容」，
  // 而不只是「下面有你没看过的内容」。可见性跟着 updateChatFade 一起在滚动帧里更新。
  function updateJumpBtn() {
    const btn = $('trainChatJumpBtn');
    const msgEl = $('trainChatMessages');
    if (!btn || !msgEl) return;
    btn.classList.toggle('is-visible', !isNearBottom(msgEl));
    btn.classList.toggle('is-thinking', thinkingActive);
    btn.title = thinkingActive ? '思考中，回到最新内容' : '回到底部';
    btn.setAttribute('aria-label', btn.title);
  }

  // ── 输入框待命 ───────────────────────────────────────────────────────────
  // 底部输入框全程保持"随时可以敲"的状态:打开面板、回答结束、新建对话之后都自动拿回焦点,
  // 不用再点一下输入框;面板已打开而焦点落在别处(建议按钮/消息区)时,直接敲可见字符也会
  // 自动落进输入框。回答期间同样不拦截——想到什么随手就能发,新问题排进队列(见 chatQueue)。
  function isChatPanelOpen() {
    const panel = $('trainChatPanel');
    return !!panel && panel.classList.contains('is-open');
  }

  function focusChatInput() {
    if (!isChatPanelOpen()) return;
    const input = $('trainChatInput');
    if (!input || input.disabled) return;
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) { /* 非文本控件时忽略 */ }
  }

  const INPUT_PLACEHOLDER = '输入 # 添加上下文，输入 / 使用指令';
  const CODE_INPUT_PLACEHOLDER = '输入 # 添加上下文，输入 / 使用指令，输入 @ 引用项目目录文件';
  function isCodeDirectoryBound() {
    return !!$('trainChatLocalCodePath')?.value && !$('trainChatCodeChip')?.hidden;
  }
  function syncCodeInputPlaceholder() {
    const input = $('trainChatInput');
    if (!input) return;
    const bound = isCodeDirectoryBound();
    input.placeholder = bound ? CODE_INPUT_PLACEHOLDER : INPUT_PLACEHOLDER;
    if (!bound) codeFilePicker?.close();
    renderInputHighlight();
  }
  const INPUT_MAX_H = 126; // 6 行 × (14px × 1.5)
  let composerChips = [];
  let previousInputValue = '';

  function syncComposerChipPositions(value) {
    const old = previousInputValue;
    if (old === value) return;
    let start = 0;
    while (start < old.length && start < value.length && old[start] === value[start]) start++;
    let oldEnd = old.length;
    let newEnd = value.length;
    while (oldEnd > start && newEnd > start && old[oldEnd - 1] === value[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const shift = newEnd - oldEnd;
    composerChips = composerChips.flatMap((chip) => {
      if (chip.end <= start) return [chip];
      if (chip.start >= oldEnd) return [{ ...chip, start: chip.start + shift, end: chip.end + shift }];
      return [];
    });
    previousInputValue = value;
  }

  window.WZH_ADD_CHAT_OPERATOR_CHIPS = (chips) => {
    syncComposerChipPositions($('trainChatInput')?.value || '');
    composerChips.push(...chips);
  };

  function registerComposerChip(input, start, token) {
    syncComposerChipPositions(input.value);
    composerChips.push({ start, end: start + token.length, token });
  }

  function inputChipPattern() {
    // 列表算子名可能含空格或 #，优先按完整名称匹配，再处理普通的单词标签。
    const names = window.WZH_CHAT_CHIP_NAMES;
    const known = names?.size ? [...names].sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : '';
    return new RegExp((known ? '# ?(?:' + known + ')(?=\\s|$)|' : '') +
      '# ?[^\\s#]+|' + (isCodeDirectoryBound() ? '@[^\\s@#]+|' : '') + '\\/[^\\s\\/#@]+', 'g');
  }

  // 输入框的两件事:高度跟着内容长,以及把 #上下文、@项目文件、/指令画成蓝色标签。
  // 标签是画在高亮层上的——textarea 装不下富文本,所以让它的文字透明,只留光标和选区。
  function renderInputHighlight() {
    const input = $('trainChatInput');
    const hl = $('trainChatInputHl');
    if (!input || !hl) return;
    syncComposerChipPositions(input.value);
    let html = '';
    let cursor = 0;
    for (const match of input.value.matchAll(inputChipPattern())) {
      html += escHtml(input.value.slice(cursor, match.index));
      const chip = composerChips.find((item) => item.start === match.index && item.token === match[0]);
      html += '<span class="wzh-chat-input-chip"' +
        (chip?.title ? ' data-operator-chip-start="' + chip.start + '"' : '') + '>' + escHtml(match[0]) + '</span>';
      cursor = match.index + match[0].length;
    }
    html += escHtml(input.value.slice(cursor));
    // textarea 已有输入时原生 placeholder 不显示；高亮层只在未绑定且末尾刚输入 @ 时补灰字。
    if (!isCodeDirectoryBound() && input.value.endsWith('@')) {
      html += '<span class="wzh-chat-input-hint"> 需先绑定项目目录</span>';
    }
    hl.innerHTML = html.replace(/\n$/, '\n '); // 末尾换行补空格，撑住最后一行高度
    hl.scrollTop = input.scrollTop;
  }

  // 已选中的引用在 textarea 中仍是普通字符；按删除键时用记录的范围一次移除整枚标签。
  // 候选框打开时不接管删除键，用户仍可逐字修改 #、@、/ 后的搜索词。
  function deleteComposerChip(input, event) {
    if (!['Backspace', 'Delete'].includes(event.key) || event.isComposing ||
        event.ctrlKey || event.altKey || event.metaKey ||
        ctxPicker?.isOpen() || codeFilePicker?.isOpen() || commandPicker?.isOpen()) return false;
    syncComposerChipPositions(input.value);
    const value = input.value;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    // 撤销删除或重新编辑排队消息后，蓝色标签可能已恢复但位置信息不在内存中；
    // 完整、独立的可见标签也按同样规则处理。
    const trackedChips = composerChips.filter((chip) => value.slice(chip.start, chip.end) === chip.token);
    const renderedChips = [...value.matchAll(inputChipPattern())]
      .filter((match) => (match.index === 0 || /\s/.test(value[match.index - 1])) &&
        (match.index + match[0].length === value.length || /\s/.test(value[match.index + match[0].length])) &&
        !trackedChips.some((chip) => chip.start === match.index && chip.end === match.index + match[0].length))
      .map((match) => ({ start: match.index, end: match.index + match[0].length, token: match[0] }));
    const chips = trackedChips.concat(renderedChips);
    let removeStart = start;
    let removeEnd = end;

    if (start === end) {
      const chip = chips.find((item) => {
        if (event.key === 'Backspace') {
          if (start > item.start && start <= item.end) return true;
          let after = item.end;
          while (after < start && value[after] === ' ') after++;
          return after === start && start > item.end;
        }
        if (start >= item.start && start < item.end) return true;
        let before = start;
        while (before < item.start && value[before] === ' ') before++;
        return before === item.start && start < item.start;
      });
      if (!chip) return false;
      removeStart = Math.min(start, chip.start);
      removeEnd = chip.end;
      // 选中时自动补在标签后的空格一起删除，按一下 Backspace 就能撤掉整枚标签。
      while (value[removeEnd] === ' ') removeEnd++;
    } else {
      const touched = chips.filter((chip) => chip.start < end && chip.end > start);
      if (!touched.length) return false;
      removeStart = Math.min(start, ...touched.map((chip) => chip.start));
      removeEnd = Math.max(end, ...touched.map((chip) => chip.end));
      if (touched.length === 1 && end <= touched[0].end) {
        while (value[removeEnd] === ' ') removeEnd++;
      }
    }

    // 只扩展选区，交给浏览器原生 Backspace/Delete 执行，保留输入事件和 Ctrl+Z 撤销。
    input.setSelectionRange(removeStart, removeEnd);
    return true;
  }

  // 标签两侧的留白只能由真实空格撑(高亮层要和 textarea 逐字对齐,标签本身不占额外宽度,
  // 见 .wzh-chat-input-chip)。14px 字号下一个空格约 3.9px,三个 ≈ 11.7px:其中 4px 被标签
  // 底色压住当内边距,剩下的 ~8px 就是标签外面看到的间距。
  const CHIP_GAP = '   ';
  // 标签统一写成 "# 名字":# 和名字之间固定留一个空格,和提问卡片里的 .wzh-chat-qref 对齐
  const HASH_SP = '# ';
  const COMMAND_PREFIX = '/';
  // 泳道右键菜单在另一个 IIFE 里,置入对话时要用同一份留白/写法,从这里取
  window.WZH_CHIP_GAP = CHIP_GAP;
  window.WZH_CHIP_HASH = HASH_SP;

  // 刚敲下的这个 # 前面的空格补到 CHIP_GAP 那么多,标签不会和前面的文字黏在一起。
  // 标签后面的间距由用户自己敲的空格 / 选择框插入时带的 CHIP_GAP 产生——空格本来就是 token 的终止符。
  function autoSpaceBeforeHash(input) {
    const v = input.value;
    const pos = input.selectionStart;
    if (pos < 2 || v[pos - 1] !== '#') return false;
    let n = 0; // # 前面已经有几个空格
    while (pos - 2 - n >= 0 && v[pos - 2 - n] === ' ') n++;
    const head = pos - 1 - n;                 // 这串空格之前那个字符的位置
    if (head === 0) return false;             // 整行开头,左边不需要留白
    const before = v[head - 1];
    if (before === '#' || before === '\n') return false;
    const need = CHIP_GAP.length - n;
    if (need <= 0) return false;
    input.value = v.slice(0, pos - 1) + ' '.repeat(need) + v.slice(pos - 1);
    const caret = pos + need;
    try { input.setSelectionRange(caret, caret); } catch (e) { /* 忽略 */ }
    return true;
  }

  // @ 项目文件和 / 指令沿用 # 标签的间距规则。
  function autoSpaceBeforeTrigger(input, trigger) {
    const v = input.value;
    const pos = input.selectionStart;
    if (pos < 2 || v[pos - 1] !== trigger) return false;
    if (trigger === '/' && /@\S*$/.test(v.slice(0, pos - 1))) return false;
    let n = 0;
    while (pos - 2 - n >= 0 && v[pos - 2 - n] === ' ') n++;
    const head = pos - 1 - n;
    if (head === 0) return false;
    const before = v[head - 1];
    if (before === trigger || before === '\n') return false;
    const need = CHIP_GAP.length - n;
    if (need <= 0) return false;
    input.value = v.slice(0, pos - 1) + ' '.repeat(need) + v.slice(pos - 1);
    const caret = pos + need;
    try { input.setSelectionRange(caret, caret); } catch (e) { /* 忽略 */ }
    return true;
  }

  // 高度跟着内容长。空输入是特例:直接清掉行内 height,把高度交回 CSS 里预留的两行
  // (min-height: 44px),不去量 scrollHeight——首屏字体、图标、面板宽度都还没定下来时量到的
  // 值不可靠,而这里是"量到多少就写死成多少",一旦量偏就会开局顶着一个很高的输入框,
  // 且之后不再有任何输入事件把它纠回来(所以表现成"偶尔刷新一下才正常")。
  function autoResizeInput() {
    const input = $('trainChatInput');
    if (!input) return;
    if (!input.value) {
      input.style.height = '';
    } else {
      input.style.height = 'auto';
      input.style.height = Math.min(INPUT_MAX_H, input.scrollHeight) + 'px';
    }
    renderInputHighlight();
  }

  // 右下角按钮按当前轮次和输入内容切换:
  //   1) 回答中 + 输入框为空 → 灰底「停止回答」键,点一下掐断当前这轮;
  //   2) 输入框里有字        → 品牌蓝发送键(回答中按下去是"排队",不是"打断");
  //   3) 当前轮刚被停止 + 输入框为空 → 继续回答;
  //   4) 其他空闲且输入框为空 → 浅蓝置灰不可点。
  function syncSendState() {
    const sendBtn = $('trainChatSendBtn');
    const input = $('trainChatInput');
    if (!sendBtn) return;
    const hasInput = !!(input && input.value);
    const hasText = !!(input && input.value.trim());
    const cleanBtn = $('trainChatCleanBtn');
    const cleanDivider = $('trainChatCleanDivider');
    if (cleanBtn) cleanBtn.hidden = !hasInput;
    if (cleanDivider) cleanDivider.hidden = !hasInput;
    const stopMode = chatStreaming && !chatStopped && !hasInput;
    const resumeMode = !chatStreaming && !!stoppedRound && !hasInput;
    sendBtn.classList.toggle('is-stop', stopMode);
    sendBtn.classList.toggle('is-resume', resumeMode);
    sendBtn.disabled = !stopMode && !resumeMode && !hasText;
    const icon = sendBtn.querySelector('img');
    if (icon) {
      const src = stopMode ? '../../src/pic/icon/stop.svg'
        : resumeMode ? '../../src/pic/icon/play.svg' : '../../src/pic/icon/sent.svg';
      if (!icon.getAttribute('src').endsWith(src)) icon.setAttribute('src', src);
    }
    sendBtn.title = stopMode ? '停止回答' : resumeMode ? '继续回答'
      : (chatStreaming ? '排队发送' : '发送');
    sendBtn.setAttribute('aria-label', sendBtn.title);
    syncInputFlow();
  }

  // 回答期间输入框描边上跑一道流光,提示"它还在写"。一旦用户在框里动了字就撤掉——
  // 这时人已经在组织下一问,描边再动就是在跟输入抢注意力。停掉之后这一轮不再恢复,
  // 下一轮开始时(setChatBusy(true))才重新置位。
  let chatInputTyped = false;
  function syncInputFlow() {
    const bar = document.querySelector('.wzh-chat-input-bar');
    if (!bar) return;
    bar.classList.toggle('is-flowing', chatStreaming && !chatStopped && !chatInputTyped);
  }

  // 按下停止键后，打字机脚本每一拍都会检查停止标志，
  // 所以固定演示的那套回答也能立刻停在半截,不用等它把剩下的字吐完。
  function stopAnswering() {
    if (!chatStreaming || chatStopped) return;
    chatStopped = true;
    syncSendState();
  }

  // 可被停止打断的等待:停下来时不用干等脚本里那几百毫秒的停顿
  function chatSleep(ms) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const runEpoch = chatEpoch;
      const timer = setInterval(() => {
        if (chatStopped || runEpoch !== chatEpoch || Date.now() - t0 >= ms) { clearInterval(timer); resolve(); }
      }, 40);
    });
  }

  // 收尾一轮被打断的回答:思考块停表收起,正文尾部补一行「已停止回答」,状态复位
  function finalizeStoppedRound(think, bodyEl) {
    const msgEl = $('trainChatMessages');
    if (think && thinkingActive) think.interrupt();
    if (bodyEl && !bodyEl.querySelector('.wzh-chat-stopped')) {
      const note = document.createElement('div');
      note.className = 'wzh-chat-stopped';
      note.textContent = '已停止回答';
      bodyEl.appendChild(note);
    }
    chatStreaming = false;
    activeRoundBody = null;
    stoppedRound = chatQueue.length ? null : activeResumeRound;
    activeResumeRound = null;
    setChatBusy(false);
    if (msgEl) scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
  }

  function resumeDemoRound(bodyEl, sections, profiling) {
    if (!bodyEl.isConnected) return;
    bodyEl.querySelector('.wzh-chat-stopped')?.remove();
    stoppedRound = null;
    chatStopped = false;
    chatStreaming = true;
    activeRoundBody = bodyEl;
    const round = { resume: () => resumeDemoRound(bodyEl, sections, profiling) };
    activeResumeRound = round;
    setChatBusy(true);
    const epoch = chatEpoch;
    const msgEl = $('trainChatMessages');
    (async () => {
      let answer = bodyEl.querySelector('.wzh-chat-answer');
      if (!answer) {
        answer = document.createElement('div');
        answer.className = 'wzh-chat-answer';
        bodyEl.appendChild(answer);
      }
      answer._markdownSource = sections.join('\n');
      for (let index = 0; index < sections.length; index++) {
        const md = sections[index];
        let target = answer;
        if (profiling) {
          target = answer.children[index];
          if (!target) {
            target = document.createElement('div');
            answer.appendChild(target);
          }
        }
        const startAt = Number(target.dataset.typedChars || 0);
        if (startAt < md.length) {
          await typeMarkdownInto(target, md, profiling ? 16 : 11, 12,
            profiling ? (cards) => addProfilingVisualizationCards(answer, cards) : null, startAt);
        }
        if (epoch !== chatEpoch) return;
        if (chatStopped) return finalizeStoppedRound(null, bodyEl);
      }
      if (profiling) addProfilingVisualizationCards(answer);
      answer.appendChild(buildAnswerActions());
      chatStreaming = false;
      activeRoundBody = null;
      activeResumeRound = null;
      setChatBusy(false);
      if (msgEl) scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
    })();
  }

  function setChatBusy(busy) {
    if (busy) {
      chatInputTyped = false; // 新一轮开始:流光重新跑起来
      // 回答期间光标继续留在输入框里闪:一来"随时能接着问"这件事得看得见,二来鼠标点
      // 发送键会把焦点带到按钮上,不抢回来就得再点一下输入框才能打字。
      // 只在开跑这一下抢,之后不再干预——用户中途点空白处失焦是他自己的选择。
      // 已经在输入框里就别调 focusChatInput:它会把光标挪到末尾,正编辑到一半的草稿会被打断。
      const inputEl = $('trainChatInput');
      if (inputEl && document.activeElement !== inputEl) focusChatInput();
    }
    const input = $('trainChatInput');
    syncCodeInputPlaceholder(); // 回答期间也照常可输入
    syncSendState();
    if (!busy) {
      resolveStreamingNote(); // 必须赶在 flushChatQueue 之前:排队的下一问就是新模型答的了
      focusChatInput();  // 调用方都是先置 chatStreaming=false 再调本函数,这里能正常拿回焦点
      flushChatQueue();  // 这轮答完 → 自动接上队首那条
    }
  }

  // ── 排队消息 ───────────────────────────────────────────────────────────
  // 回答期间发出的问题不打断当前这轮,先排进队列显示在输入框上方,当前这条答完自动接上。
  // 队列面板左上角箭头可收起,收起后只留"N 条排队消息"那一行。
  const chatQueue = [];   // [{ id, text, scenario, context }]
  let chatQueueSeq = 0;
  let chatQueueCollapsed = false;
  let chatQueueFlushTimer = 0;
  let queuedEditContext = null;
  let activeRoundBody = null;

  function renderQueueText(text) {
    const source = String(text || '');
    let html = '';
    let last = 0;
    source.replace(/# ?[^\s#]+/g, (token, offset) => {
      html += escHtml(source.slice(last, offset));
      html += '<span class="wzh-chat-input-chip">' + escHtml(token) + '</span>';
      last = offset + token.length;
      return token;
    });
    return html + escHtml(source.slice(last));
  }

  function renderChatQueue() {
    const box = $('trainChatQueue');
    const listEl = $('trainChatQueueList');
    const titleEl = $('trainChatQueueTitle');
    if (!box || !listEl || !titleEl) return;
    box.classList.toggle('is-collapsed', chatQueueCollapsed);
    box.classList.toggle('has-multiple', chatQueue.length > 1);
    box.hidden = chatQueue.length === 0; // 队列空了整块撤掉,输入框自然回到贴底
    titleEl.textContent = chatQueue.length + ' 条排队消息';
    listEl.innerHTML = chatQueue.map((item) =>
      '<li class="wzh-chat-queue-item" data-id="' + item.id + '">' +
        '<button class="wzh-chat-queue-dot" type="button" aria-label="拖拽排序" title="拖拽排序"' + (chatQueue.length > 1 ? '' : ' disabled') + '>' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="3" r="1.2"></circle><circle cx="11" cy="3" r="1.2"></circle><circle cx="5" cy="8" r="1.2"></circle><circle cx="11" cy="8" r="1.2"></circle><circle cx="5" cy="13" r="1.2"></circle><circle cx="11" cy="13" r="1.2"></circle></svg>' +
        '</button>' +
        '<span class="wzh-chat-queue-text" title="' + escHtml(item.text).replace(/"/g, '&quot;') + '">' + renderQueueText(item.text) + '</span>' +
        '<button class="wzh-chat-queue-send" type="button" title="立即发送" aria-label="立即发送这条排队消息">' +
          '<img src="../../src/pic/icon/sent.svg" alt="">' +
        '</button>' +
        '<button class="wzh-chat-queue-edit" type="button" title="编辑这条" aria-label="编辑这条排队消息">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5Z"></path></svg>' +
        '</button>' +
        '<button class="wzh-chat-queue-del" type="button" title="删除这条" aria-label="删除这条排队消息">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 3h4l1 4H9l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6"></path></svg>' +
        '</button>' +
      '</li>').join('');
    scheduleFadeUpdate();
  }

  function enqueueChatMessage(text, scenario, context) {
    chatQueue.push({ id: ++chatQueueSeq, text, scenario, context });
    renderChatQueue();
  }

  function removeQueuedMessage(id) {
    const i = chatQueue.findIndex((it) => it.id === id);
    if (i >= 0) chatQueue.splice(i, 1);
    renderChatQueue();
  }

  function editQueuedMessage(id) {
    const i = chatQueue.findIndex((it) => it.id === id);
    const input = $('trainChatInput');
    if (i < 0 || !input) return;
    const [item] = chatQueue.splice(i, 1);
    renderChatQueue();
    pendingGuideScenario = item.scenario || '';
    queuedEditContext = item.context || null;
    input.value = item.text;
    input.scrollTop = 0;
    chatInputTyped = true;
    ctxPicker?.close();
    commandPicker?.close();
    autoResizeInput();
    syncSendState();
    focusChatInput();
  }

  function clearChatQueue() {
    chatQueue.length = 0;
    renderChatQueue();
  }

  function interruptRoundForQueuedMessage() {
    if (!chatStreaming) return;
    chatEpoch++; // 旧打字机的异步回调不能再改写当前会话
    stoppedRound = null;
    activeResumeRound = null;
    chatStopped = true;
    const wasThinking = thinkingActive;
    if (wasThinking && activeThink) activeThink.interrupt();
    else activeThink = null;
    if (!wasThinking && activeRoundBody?.isConnected) {
      const note = document.createElement('div');
      note.className = 'wzh-chat-stopped';
      note.textContent = '已停止回答';
      activeRoundBody.appendChild(note);
    }
    chatStreaming = false;
    activeRoundBody = null;
  }

  function sendQueuedMessageNow(id) {
    const index = chatQueue.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [item] = chatQueue.splice(index, 1);
    renderChatQueue();
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;
    const bubble = document.createElement('div');
    bubble.className = 'wzh-chat-message user wzh-chat-queued-sent';
    bubble.innerHTML = renderQueueText(item.text);
    if (chatStreaming) {
      const parent = activeRoundBody?.isConnected ? activeRoundBody : msgEl;
      interruptRoundForQueuedMessage();
      parent.appendChild(bubble);
    } else msgEl.appendChild(bubble);
    clearTimeout(chatQueueFlushTimer);
    chatQueueFlushTimer = 0;
    sendMessage(item.text, item.scenario, { alreadyDisplayed: true, context: item.context });
    scrollChatToBottom(msgEl);
  }

  // 当前这轮答完 → 隔一小段再把队首那条发出去:紧贴着上一轮结束抛出下一张提问卡片会闪。
  // 这段间隙里用户可能又发了新问题、也可能把这条清掉了,所以到点后重新确认一次再发。
  function flushChatQueue() {
    if (chatStreaming || !chatQueue.length) return;
    clearTimeout(chatQueueFlushTimer);
    chatQueueFlushTimer = setTimeout(() => {
      chatQueueFlushTimer = 0;
      if (chatStreaming) return;
      const next = chatQueue.shift();
      if (!next) return;
      renderChatQueue();
      sendMessage(next.text, next.scenario, { context: next.context });
    }, 320);
  }

  function initChatQueue() {
    const box = $('trainChatQueue');
    const toggle = $('trainChatQueueToggle');
    if (!box || !toggle) return;
    // 收起/展开都放一次 z 轴位移(见 @keyframes wzh-queue-zshift):卡片先往后退、
    // 往下坠一点,底边被输入框盖住,再回到本位——收起后留在版面上的就只有头部那一行。
    // 动画结束把 is-zshift 摘掉,下一次点击才能重新触发。
    let zshiftTimer = 0;
    toggle.addEventListener('click', () => {
      chatQueueCollapsed = !chatQueueCollapsed;
      box.classList.toggle('is-collapsed', chatQueueCollapsed);
      toggle.setAttribute('aria-expanded', String(!chatQueueCollapsed));
      toggle.title = chatQueueCollapsed ? '展开排队消息' : '收起排队消息';
      box.classList.remove('is-zshift');
      void box.offsetWidth;            // 强制重排,同一帧内重新加类才会再播一遍
      box.classList.add('is-zshift');
      clearTimeout(zshiftTimer);
      zshiftTimer = setTimeout(() => box.classList.remove('is-zshift'), 420);
      scheduleFadeUpdate();
    });
    $('trainChatQueueClear')?.addEventListener('click', () => { clearChatQueue(); focusChatInput(); });
    const list = $('trainChatQueueList');
    // 单条操作:事件委托挂在列表上,重渲染后依然生效
    list?.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-queue-del, .wzh-chat-queue-edit, .wzh-chat-queue-send');
      if (!btn) return;
      const li = btn.closest('.wzh-chat-queue-item');
      if (li) {
        if (btn.classList.contains('wzh-chat-queue-send')) sendQueuedMessageNow(Number(li.dataset.id));
        else if (btn.classList.contains('wzh-chat-queue-edit')) editQueuedMessage(Number(li.dataset.id));
        else removeQueuedMessage(Number(li.dataset.id));
      }
      focusChatInput();
    });
    let draggingId = null;
    list?.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest?.('.wzh-chat-queue-dot');
      if (!handle || chatQueue.length < 2) return;
      const item = handle.closest('.wzh-chat-queue-item');
      if (!item) return;
      e.preventDefault();
      draggingId = Number(item.dataset.id);
      box.classList.add('is-sorting');
      item.classList.add('is-dragging');
      const pointerId = e.pointerId;
      const move = (event) => {
        if (event.pointerId !== pointerId || draggingId == null) return;
        event.preventDefault();
        const from = chatQueue.findIndex((entry) => entry.id === draggingId);
        const rows = Array.from(list.querySelectorAll('.wzh-chat-queue-item'));
        const over = rows.findIndex((row) => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
        const to = over < 0 ? rows.length - 1 : over;
        if (from < 0 || from === to) return;
        chatQueue.splice(to, 0, chatQueue.splice(from, 1)[0]);
        const row = rows[from];
        list.insertBefore(row, to > from ? rows[to].nextSibling : rows[to]);
      };
      const end = (event) => {
        if (event.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', end);
        draggingId = null;
        box.classList.remove('is-sorting');
        renderChatQueue();
      };
      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    });
    list?.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const handle = e.target.closest?.('.wzh-chat-queue-dot');
      const row = handle?.closest('.wzh-chat-queue-item');
      if (!row || chatQueue.length < 2) return;
      const from = chatQueue.findIndex((item) => item.id === Number(row.dataset.id));
      const to = Math.max(0, Math.min(chatQueue.length - 1, from + (e.key === 'ArrowUp' ? -1 : 1)));
      if (from === to) return;
      e.preventDefault();
      chatQueue.splice(to, 0, chatQueue.splice(from, 1)[0]);
      renderChatQueue();
      list.querySelector('[data-id="' + row.dataset.id + '"] .wzh-chat-queue-dot')?.focus();
    });
    renderChatQueue();
  }

  // 欢迎屏模板与 HTML 里那份静态结构一致。重置演示时按这份重建，标题文本留空，
  // 由 playWelcomeTypewriter 打字机补上(见 WELCOME_TEXT)。
  const KNOWLEDGE_QUESTION = '帮我统计拆分模型每一层的耗时，MoE模块每个算子耗时，所有层平均下来MoE模块耗时多少';
  let pendingGuideScenario = '';

  const GUIDE_CARDS = [
    {
      icon: 'guidecard1.png', title: '内存优化诊断分析', tag: 'Profiling数据',
      desc: '智能分析复用策略与分块方案',
      prompt: KNOWLEDGE_QUESTION, scenario: 'module-statistic-ready',
    },
    {
      icon: 'guidecard2.png', title: '快慢卡诊断分析', tag: '快慢卡',
      desc: '快速对比通信/计算差异并定位慢卡',
      prompt: '快慢卡诊断分析：对比通信/计算差异并帮我定位慢卡',
    },
    {
      icon: 'guidecard3.png', title: '咨询领域知识，增强RAG的对话', tag: '',
      desc: '输入问题，检索知识库并生成排查步骤',
      prompt: KNOWLEDGE_QUESTION, scenario: 'knowledge',
    },
  ];

  const WELCOME_HTML =
    '<div class="wzh-chat-welcome">' +
      '<div class="wzh-chat-welcome-hero">' +
        '<canvas class="wzh-chat-welcome-dots" aria-hidden="true"></canvas>' +
        '<img class="wzh-chat-welcome-logo" src="../../src/pic/icon/msinsightbotAvatar.png" alt="">' +
        '<div class="wzh-chat-welcome-text"></div>' +
      '</div>' +
      '<div class="wzh-chat-guide-list">' +
        GUIDE_CARDS.map((c) =>
          '<button class="wzh-chat-guide-card" type="button"' + (c.scenario ? ' data-scenario="' + c.scenario + '"' : '') + ' data-prompt="' + c.prompt + '">' +
            '<img class="wzh-chat-guide-icon" src="../../src/pic/icon/' + c.icon + '" alt="">' +
            '<span class="wzh-chat-guide-text">' +
              '<span class="wzh-chat-guide-title">' + c.title + '</span>' +
              '<span class="wzh-chat-guide-sub">' +
                (c.tag ? '<span class="wzh-chat-guide-tag"><img src="../../src/pic/icon/quote.svg" alt="">' + c.tag + '</span>' : '') +
                '<span class="wzh-chat-guide-desc">' + c.desc + '</span>' +
              '</span>' +
            '</span>' +
          '</button>'
        ).join('') +
      '</div>' +
    '</div>';

  // 自动录屏输入和「新建对话」共用这个代次号。新建对话时递增，仍在 await 的旧打字任务
  // 下一拍就会自行退出，避免欢迎页已经重置后旧文字又继续写回输入框。
  let demoInputEpoch = 0;

  // 自动录屏重新开始时，停止当前演示脚本并清空会话。
  function resetConversation() {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;
    restoreChatContext();
    demoInputEpoch++;
    chatEpoch++; // 老的异步收尾靠它认出自己已经过期,不会再往新会话上写东西
    stoppedRound = null;
    activeResumeRound = null;
    if (chatStreaming) {
      chatStopped = true; // 打字机和 chatSleep 每一拍都看这个标志,能立刻停在半截
      chatStreaming = false;
    }
    if (activeThink) { activeThink.dispose(); activeThink = null; }
    clearChatQueue();
    clearTimeout(chatQueueFlushTimer);
    chatQueueFlushTimer = 0;
    activeRoundBody = null;
    chatHistory = [];
    thinkingActive = false;
    msgEl.innerHTML = WELCOME_HTML;
    applyAgentIdentity(); // 欢迎屏刚重建出来,头像还是模板里的默认值
    hideSessionTitle(); // 回到欢迎屏就没有「这次会话」了,主题行一并收掉
    pendingGuideScenario = '';
    queuedEditContext = null;
    pendingModelNote = ''; // 上一轮对话没用上的切换标记,别带到新对话里
    streamingNote = null;
    streamingNoteFrom = '';
    // 欢迎页本身重建前后长得一样；必须同时清空草稿，用户才能明确得到一轮真正的新对话。
    // 这里直接同步高亮层和高度，不派发 input 事件，避免把程序重置误记成用户正在输入。
    ctxPicker?.close();
    commandPicker?.close();
    const input = $('trainChatInput');
    if (input) {
      input.value = '';
      input.style.height = '';
      input.scrollTop = 0;
    }
    chatInputTyped = false;
    autoResizeInput();
    syncSendState();  // 发送键从「停止回答」形态回到常态
    syncInputFlow();  // 描边上的流光跟着停
    playWelcomeTypewriter();
    updateChatFade(msgEl); // 回到欢迎屏后不再有滚动余量,撤掉上下渐隐
    focusChatInput();
  }

  // ── 「性能诊断」场景:固定的演示流程，提问、思考过程、诊断报告全部写死。
  // 输入框里敲什么都只用来触发。演示的是"把一次落盘 profiling 整个交给 Agent 自己查完"这件事:
  // 思考过程按真实排查节奏走「确认数据形态 → 定分析路线 → 跑集群分析 → 交叉验证 → 证伪假设 →
  // 实算指标」,回答则是一份完整的 markdown 诊断报告(结论速览 / 行动清单 / 问题详情 /
  // 已确认无问题 / 数据与方法)。其中三个关键证据点补轻量可视化入口，正文仍可整段复制。──
  const CHAT_TASK_NAME = 'openPanGu2.0flash预训练_v1';
  const PROFILING_DATA_DIR = 'profile_dir';
  let profilingHistoryContext = { directory: PROFILING_DATA_DIR, codePath: '' };
  const PROFILING_SESSION_TITLE = 'profile_dir 单机多卡性能分析';
  const CODE_CHANGE_HISTORY_QUESTION = '请修改 #{model/pipeline.py} 的 PP 分层逻辑，减轻 stage 3 的计算过载；如果相关配置文件也需要调整，请一并修改代码。';
  const CODE_CHANGE_ANSWER_MARKDOWN = 'Profiling 显示 PP 末级计算约 9.26 s/step，明显重于其他 stage。我已调整示例模型的层分配：stage 3 的 Decoder 层数从 8 降到 7，stage 2 从 8 增到 9。`model/pipeline.py` 现在按配置计算每级的层范围，并校验末级边界。实际收益还需要重新采集 Profiling 验证。';
  const CODE_CHANGE_THINK_STEPS = [
    { kind: 'thinking', title: '核对性能瓶颈', doneTitle: '已定位 PP 末级过载',
      text: 'stage 3 计算约 9.26 s/step，其他 stage 约 6.15 s。先调整层分配，减少末级等待。' },
    { kind: 'usetool', title: '检查模型分层代码', doneTitle: '已检查配置与层范围',
      text: '检查 model/config.py 和 model/pipeline.py：保持 32 层总数，并让每级按配置计算起止层。' },
  ];

  function createCodeChangeAnswerCard() {
    const card = createAnswerVisualizationCard('code');
    card.classList.add('wzh-chat-viz-card--code');
    card.querySelector('.wzh-chat-viz-card-desc').innerHTML =
      '2 个文件 · <b>+7</b> <em>−3</em>';
    card.insertAdjacentHTML('beforeend',
      '<span class="wzh-code-card-files">' +
        '<span class="wzh-code-card-file"><span>model/config.py</span><b>+3</b><em>−1</em></span>' +
        '<span class="wzh-code-card-file"><span>model/pipeline.py</span><b>+4</b><em>−2</em></span>' +
      '</span>');
    return card;
  }

  function runCodeChangeScenario(text, opts) {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;
    if (!opts?.alreadyDisplayed) appendQuestionCard(text, {
      context: opts?.context,
      sessionTitle: '流水线末级过载 · 模型代码调整',
    });
    if (!opts?.context?.codePath) {
      const reply = '请先在输入框上方标签处，为本性能文件绑定长期的代码目录。或在输入框直接输入代码目录，作为本轮对话临时使用的上下文';
      const { el, bodyEl } = createAiMessageShell();
      const answer = document.createElement('div');
      answer.className = 'wzh-chat-answer';
      answer._markdownSource = reply;
      answer.innerHTML = renderMarkdown(reply);
      answer.appendChild(buildAnswerActions());
      bodyEl.appendChild(answer);
      msgEl.appendChild(el);
      scrollChatToBottom(msgEl);
      flushChatQueue();
      return;
    }
    const { el, bodyEl } = createAiMessageShell();
    msgEl.appendChild(el);
    activeRoundBody = bodyEl;
    chatStreaming = true;
    chatStopped = false;
    setChatBusy(true);
    const epoch = chatEpoch;
    const think = createThinkBlock(bodyEl, {});
    const markdown = CODE_CHANGE_ANSWER_MARKDOWN;
    scrollChatToBottom(msgEl);

    (async () => {
      for (const step of CODE_CHANGE_THINK_STEPS) {
        think.startNode(step);
        await think.typeText(step.text, 12);
        await chatSleep(180);
        if (epoch !== chatEpoch) return;
        if (chatStopped) return finalizeStoppedRound(think, bodyEl);
      }
      think.finish();
      const answer = document.createElement('div');
      answer.className = 'wzh-chat-answer';
      answer._markdownSource = markdown;
      bodyEl.appendChild(answer);
      await typeMarkdownInto(answer, markdown, 18, 3);
      if (epoch !== chatEpoch) return;
      if (chatStopped) return finalizeStoppedRound(think, bodyEl);

      answer.appendChild(createCodeChangeAnswerCard());
      answer.appendChild(buildAnswerActions());
      chatStreaming = false;
      activeRoundBody = null;
      setChatBusy(false);
      scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
    })();
  }

  // 演示流程一分钟不到就跑完,但计时按真实排查节奏展示(实测墙钟约 10~15 分钟),
  // 否则每个节点都是「2s」,看不出"这活确实花了时间"。
  const PROFILING_DEMO_CLOCK_SCALE = 24;

  // 提问按普通用户的连续输入组织,不手动插入换行；长度控制在当前输入框中自然换行为 4 行。
  // 保留定性、举证、实算、排优先级四个诉求,同时避免长提示词把输入框塞满。
  const PROFILING_QUESTION = '帮我诊断 #{profile_dir}：单步约 10.8 秒，比预期慢近三成。' +
    '看看是慢卡、慢链路，还是并行切分不均，并给出数据依据。' +
    '算一下 cube 利用率、MFU 和性能健康度。' +
    '最后按收益排一份带优先级的优化清单。';

  // 领域知识库问答：先理解统计口径，再检索 module_statistic 指导并核验当前落盘产物。
  const KNOWLEDGE_THINK_SCRIPT = [
    {
      kind: 'thinking', title: '拆解统计诉求', doneTitle: '已拆解统计口径',
      text: '这个问题包含三个口径：模型每一层的 Device Kernel 总耗时、每个 MoE 模块内各框架算子的耗时，' +
        '以及先按层汇总 MoE 耗时、再对所有层求平均。要得到这些结果，数据里必须同时保留 Module 层级、算子与 Kernel 映射及 Kernel 时长。',
      hold: 240,
    },
    {
      kind: 'usetool', title: '检索领域知识库', doneTitle: '已检索 module_statistic 指导',
      text: 'module_statistic 依赖 nn.Module 的 msTX 层级打点；Profiling 必须开启 mstx，' +
        '导出类型包含 Db。分析后，text 模式应生成 module_statistic_{rank_id}.xlsx，包含 parentModule、module、opName、' +
        'kernelList、totalKernelDuration(ns)、avgKernelDuration(ns)、opCount 和 rankID。',
      hold: 280,
    },
    {
      kind: 'usetool', title: '扫描当前落盘目录', doneTitle: '已扫描 Profiling 产物',
      text: '逐 Rank 检查当前性能数据目录及 cluster_analysis_output，查找 module_statistic_*.xlsx，' +
        '并核对是否存在等价的 ModuleStatistic 分析结果。',
      hold: 280,
    },
    {
      kind: 'thinking', title: '校验数据完备性', doneTitle: '确认缺少模型结构统计数据',
      text: '未发现 module_statistic_{rank_id}.xlsx，也没有可替代的 ModuleStatistic 结果。现有 Kernel/算子明细缺少可靠的模型层级边界，' +
        '无法把耗时归属到每一层和 MoE 子模块；继续计算会得到不可验证的伪结果，应明确提示补采。',
      hold: 240,
    },
  ];

  function buildKnowledgeAnswerMarkdown() {
    return [
      '## 检查结论',
      '',
      '当前这份性能数据**无法统计**模型每一层耗时、MoE 模块内每个算子耗时，也无法计算所有层的 MoE 平均耗时。',
      '',
      '我扫描了现有 Profiling 落盘目录与分析产物，没有找到 `module_statistic_{rank_id}.xlsx`，也没有等价的 `ModuleStatistic` 结果。' +
        '这说明本次采集没有保留下完成该统计所需的模型层级 msTX 信息。普通算子或 Kernel 明细只能说明“执行了什么”，' +
        '不能可靠回答“属于模型哪一层、属于哪个 MoE 模块”，因此我不会用现有数据拼一个不可信的统计值。',
      '',
      '## 下次按这 5 步采集',
      '',
      '1. **给模型层级添加 msTX 打点**  ',
      '   重写 `nn.Module.__call__`，在目标 Module 调用前后执行 `torch_npu.npu.mstx.range_start/range_end`。' +
        '复杂模型建议选择性打点：至少覆盖 Transformer Layer、MoE、Experts、Router/Gate 等实际类名，降低采集开销。',
      '',
      '```python',
      'original_call = nn.Module.__call__',
      'module_list = {"DecoderLayer", "MoE", "Experts", "Router"}  # 替换为模型实际类名',
      '',
      'def custom_call(self, *args, **kwargs):',
      '    module_name = self.__class__.__name__',
      '    if module_name not in module_list:',
      '        return original_call(self, *args, **kwargs)',
      '    mstx_id = torch_npu.npu.mstx.range_start(module_name, domain="Module")',
      '    try:',
      '        return original_call(self, *args, **kwargs)',
      '    finally:',
      '        torch_npu.npu.mstx.range_end(mstx_id, domain="Module")',
      '',
      'nn.Module.__call__ = custom_call',
      '```',
      '',
      '2. **开启层级事件采集，并确保导出 DB**  ',
      '   在 `torch_npu.profiler._ExperimentalConfig` 中设置 `mstx=True`（旧版本参数为 `msprof_tx=True`），' +
        '同时让 `export_type` 至少包含 `torch_npu.profiler.ExportType.Db`。',
      '',
      '```python',
      'experimental_config = torch_npu.profiler._ExperimentalConfig(',
      '    mstx=True,',
      '    export_type=[torch_npu.profiler.ExportType.Db],',
      ')',
      '```',
      '',
      '3. **重新采集有效训练步**  ',
      '   使用 `torch_npu.profiler.profile` 同时采集 CPU 与 NPU Activity，通过 `schedule` 覆盖稳定训练阶段，' +
        '并用 `tensorboard_trace_handler("./result")` 落盘。采集结束后确认各 Rank 的 DB 数据完整。',
      '',
      '4. **执行模型结构拆解分析**  ',
      '   对集群性能数据父目录运行：',
      '',
      '```bash',
      'msprof-analyze -m module_statistic -d ./result -o ./module_statistic_output --export_type text',
      '```',
      '',
      '   正常情况下，每张卡会生成一个 `module_statistic_{rank_id}.xlsx`。如果使用 `--export_type db`，' +
        '则应在 `cluster_analysis_output/cluster_analysis.db` 中看到 `ModuleStatistic` 表。',
      '',
      '5. **按统一口径汇总并验算**  ',
      '   - 每层耗时：按 `rankID + parentModule/module` 分组，汇总 `totalKernelDuration(ns)`。',
      '   - MoE 算子耗时：筛选 MoE 层级路径，再按 `opName` 汇总；同时保留 `opCount` 与 `avgKernelDuration(ns)`，避免把调用次数差异误判成单次算子变慢。',
      '   - 所有层 MoE 平均耗时：先计算每个模型层内所有 MoE 算子的耗时之和，再对不同层取算术平均；若各层调用次数不一致，' +
        '先按 `opCount` 归一化到单次调用。纳秒转换为毫秒时除以 `1,000,000`。',
      '',
      '补采后把生成的 `module_statistic_{rank_id}.xlsx` 放回当前任务，我就可以直接输出“逐层耗时、MoE 算子明细、跨层平均值”三张统计表。',
    ].join('\n');
  }

  const MODULE_STATISTIC_READY_THINK_SCRIPT = [
    {
      kind: 'thinking', title: '确认统计口径', doneTitle: '已确认层级与耗时口径',
      text: '需要同时输出三组结果：各 DecoderLayer 的单次调用总耗时、MoE 路径下每个算子的单次耗时，' +
        '以及先按层汇总 MoE、再跨层求平均。DP 副本不能重复相加，所有纳秒字段统一换算为毫秒。',
      hold: 240,
    },
    {
      kind: 'usetool', title: '扫描模型结构统计文件', doneTitle: '已发现 8 份 module_statistic 文件',
      text: '在重新采集的分析产物中发现 module_statistic_0.xlsx 至 module_statistic_7.xlsx。' +
        '表头包含 Parent Module、Module、Op Name、Kernel List、Total/Avg Kernel Duration(ns) 与 Op Count，字段完整，可以恢复层级并归因耗时。',
      hold: 280,
    },
    {
      kind: 'usetool', title: '解析层级与 MoE 路径', doneTitle: '已建立 Layer → Module → Op 映射',
      text: '按 Parent Module 提取 DecoderLayer 编号，沿 Module 路径识别 Router、Dispatch、Experts 与 Combine；' +
        '再用 Op Name 聚合其 Kernel List。选择 rank0、2、4、6 作为一个 DP 副本，rank1、3、5、7 用于交叉校验。',
      hold: 280,
    },
    {
      kind: 'thinking', title: '归一化并验算结果', doneTitle: '已完成跨层汇总',
      text: '用 Avg Kernel Duration 与 Op Count 校验单次调用口径，逐层求和后再计算 MoE 跨层平均。' +
        '两个 DP 副本对应层的偏差均小于 0.8%，汇总结果一致，可输出统计表。',
      hold: 240,
    },
  ];

  function buildModuleStatisticReadyAnswerMarkdown() {
    return [
      '## 统计结果',
      '',
      '已扫描到 `module_statistic_0.xlsx`～`module_statistic_7.xlsx`，字段与知识库定义一致。' +
        '下面按**单次模型层调用**统计，耗时均由 ns 换算为 ms。为避免 DP 重复计数，主表采用 rank0、2、4、6 这一组副本，' +
        '另一组副本仅用于校验，层级对应结果偏差均小于 0.8%。',
      '',
      '### 1. 拆分后每一层耗时',
      '',
      '| PP Stage | 数据 Rank | 模型层 | 层总耗时(ms) | MoE耗时(ms) | MoE占比 |',
      '| --- | ---: | --- | ---: | ---: | ---: |',
      '| stage0 | 0 | DecoderLayer.0 | 43.86 | 19.42 | 44.28% |',
      '| stage0 | 0 | DecoderLayer.1 | 44.12 | 19.76 | 44.79% |',
      '| stage1 | 2 | DecoderLayer.2 | 45.03 | 20.11 | 44.66% |',
      '| stage1 | 2 | DecoderLayer.3 | 44.71 | 19.88 | 44.46% |',
      '| stage2 | 4 | DecoderLayer.4 | 46.18 | 20.36 | 44.09% |',
      '| stage2 | 4 | DecoderLayer.5 | 45.62 | 20.04 | 43.93% |',
      '| stage3 | 6 | DecoderLayer.6 | 46.91 | 20.51 | 43.72% |',
      '| stage3 | 6 | DecoderLayer.7 | 46.54 | 20.48 | 44.01% |',
      '',
      '8 层平均总耗时为 **45.37 ms/层**。末级 `DecoderLayer.6` 最慢，为 46.91 ms；' +
        '它比最快的 `DecoderLayer.0` 高 3.05 ms（6.95%），差异主要来自非 MoE 路径，MoE 本身在各层较稳定。',
      '',
      '### 2. MoE 模块每个算子的平均耗时',
      '',
      '| MoE子模块 | Op Name | 主要Kernel | 跨层平均(ms) | MoE占比 |',
      '| --- | --- | --- | ---: | ---: |',
      '| Router | aclnnMatmul | MatMulCommon / MatMulV2 | 0.82 | 4.09% |',
      '| Router | aclnnSoftmax | SoftmaxV2 | 0.36 | 1.79% |',
      '| Router | aclnnTopk | TopKV2 | 0.28 | 1.40% |',
      '| Dispatch | aclnnGather | GatherV3 | 1.08 | 5.38% |',
      '| Dispatch | aclnnAllToAllV | HcomAllToAllV | 2.22 | 11.06% |',
      '| Experts.w1/w3 | aclnnMatmul | MatMulCommon / MatMulV2 | 6.18 | 30.79% |',
      '| Experts | aclnnSwiGlu | SwiGlu | 1.62 | 8.07% |',
      '| Experts.w2 | aclnnMatmul | MatMulCommon / MatMulV2 | 5.54 | 27.60% |',
      '| Combine | aclnnScatterAdd | ScatterAdd | 1.05 | 5.23% |',
      '| Combine | aclnnAllToAllV | HcomAllToAllV | 0.92 | 4.58% |',
      '',
      'MoE 的主要耗时集中在 Experts 的三组矩阵乘：`w1/w3 + w2` 合计 **11.72 ms**，占 MoE 耗时 **58.40%**；' +
        '两次 AllToAllV 合计 3.14 ms，占 15.65%。如果要继续优化，应先检查 Expert GEMM 的 shape/并行度，再看 token dispatch 的通信重叠。',
      '',
      '### 3. 所有层平均 MoE 耗时',
      '',
      '先在每个 DecoderLayer 内汇总 Router、Dispatch、Experts、Combine 的算子耗时，再对 8 个不同模型层取算术平均：',
      '',
      '`(19.42 + 19.76 + 20.11 + 19.88 + 20.36 + 20.04 + 20.51 + 20.48) / 8 = 20.07 ms`',
      '',
      '因此，**所有层平均下来 MoE 模块耗时为 20.07 ms/层**，占平均层耗时的 **44.24%**。' +
        '层间 MoE 极差为 1.09 ms，波动约 5.43%，没有明显的单层 MoE 异常。',
      '',
      '### 统计口径',
      '',
      '- 使用 `Parent Module + Module` 恢复模型层与 MoE 子模块归属。',
      '- 使用 `Avg Kernel Duration(ns)` 与 `Op Count` 交叉校验单次调用耗时，避免把采集次数差异算成性能差异。',
      '- 同一 Op 下的多个 Kernel 先求和，同一层内的 MoE Op 再求和，最后才跨层求平均。',
      '- `1 ms = 1,000,000 ns`；DP 副本只做一致性检查，不进入最终求和。',
    ].join('\n');
  }

  const PROFILING_THINK_SCRIPT = [
    {
      kind: 'thinking', title: '思考中', doneTitle: '思考完成',
      text: '先别急着找瓶颈——得确认这批数据能支撑什么结论：几个 rank、哪个框架采的、DB 还是纯 CSV。\n' +
        '格式直接决定分析路径：**DB 才能走 msprof-analyze 的集群 recipe**，只有单卡 CSV 就只能做到算子级，' +
        '"是不是并行切分的问题"这类跨卡结论根本无从谈起。',
      hold: 240,
    },
    {
      kind: 'usetool', title: '校验数据完整性与采集配置', doneTitle: '校验数据完整性与采集配置',
      text: '目录下 8 个 `*_ascend_pt`，PyTorch 框架 profiler、DB 格式，8 卡均正常 Stop、交付件齐全。\n' +
        '按 `profiler_info_{rank}.json` 建好映射：ubuntu122 = rank0–3，localhost = rank4–7。\n' +
        '`profiler_metadata.json`：**TP1·PP4·DP2·CP1**、Level1、`record_shapes=false`、`profile_memory=false`。\n' +
        '两条前提先记下：内存维度这次采不到（PHS 内存子项只能记 N/A）；**PP=4 → bubble 是首要嫌疑**。',
      hold: 240,
    },
    {
      kind: 'thinking', title: '思考中', doneTitle: '思考完成',
      text: '单步 10.8 秒偏慢，先立三个互斥假设，再拿数据一个个证伪：**硬件型慢卡 / 慢链路 / 结构性负载不均**。\n' +
        '三者在落盘里的指纹完全不同——慢卡看 stepTime 的离散度，慢链路看带宽达成率，' +
        '负载不均看各 stage 的计算时间与 stage 等待。先把集群 recipe 全跑出来，别凭一张表下结论。',
      hold: 240,
    },
    {
      kind: 'usetool', title: 'msprof-analyze 集群分析 + advisor', doneTitle: 'msprof-analyze 集群分析 + advisor',
      text: '逐项跑 `cluster_time_summary`、`compute_op_sum`、`hccl_sum`、`communication_time_sum`、' +
        '`communication_matrix_sum`、`freq_analysis`、`free_analysis`、`cann_api_sum`，每个 mode 单独 `-o` 到子目录，' +
        '避免互相覆盖；同时后台并行跑 `advisor all`。\n' +
        '全部 `cluster_analysis.db` 已落盘；advisor 命中 Environment Variable / Operator Dynamic Shape / Packet 三类。',
      hold: 240,
    },
    {
      kind: 'usetool', title: '交叉验证集群表', doneTitle: '交叉验证集群表',
      text: '`ClusterTimeSummary`：8 卡 stepTime 10796.6–10800.6 ms，极差 4 ms、**CV≈0.012%**——没有掉队 rank。\n' +
        '但 rank6/7 计算 **9257 ms**，其余 6 卡 **6147 ms**，是 **1.51×**；对应 rank0–5 每步在 P2P recv 上' +
        '空等 `communicationWaitStageTime` 均值 **3.77 s**。\n' +
        '`ClusterCommunicationBandwidth`：跨节点 RDMA 实测 **24.2 GB/s ≈ 理论值的 97%**，包大小 29.36 MB，链路健康。\n' +
        '`free_analysis`：各卡 Free 仅 84–251 ms，host 下发没有饿死 device。',
      hold: 240,
    },
    {
      kind: 'thinking', title: '思考中', doneTitle: '思考完成',
      text: '慢卡、慢链路两个假设都被证伪了，只剩结构性不均——但还欠一句"末级到底多算了什么"，不然还是猜。\n' +
        '`compute_op_sum` 对比给出了答案：`MatMulV2` **只在 rank6/7 出现**，16.0 ms × 64 次 ≈ 1024 ms，' +
        '正是 lm_head / logits 投影；再叠上末级 loss 相关的 vector 算子（比 stage0 重 ~1.6×），' +
        '3110 ms 的差额刚好对得上。四张互相独立的表指向同一个结论，可以定性了。\n' +
        '顺手还捞到第二个 P0：`communicationOverlapComputation` 整列为 0，通信一点都没被计算掩盖。',
      hold: 240,
    },
    {
      kind: 'usetool', title: '实算 cube 利用率 / MFU / PHS', doneTitle: '实算 cube 利用率 / MFU / PHS',
      text: '`kernel_details.csv` 按耗时加权：cube 利用率 **86%–98%（集群 ~92%）**，算子实现本身不背这口锅。\n' +
        'MatMul 聚合达成 **301.7 TFLOP/s**，已超 910B3/B4 理论峰值 → 判定芯片为 **910B1**（BF16 峰值 378.88 TFLOP/s），' +
        'MFU 以此为分母：rank0 ~80%、rank6 ~64%；端到端 step MFU ≈ **40% 出头**。\n' +
        'PHS 按大模型多卡训练权重算：计算 64 · 通信 93 · 调度 71、内存 N/A 归一化 → **75（A 档下沿）**。可以成文了。',
      hold: 240,
    },
  ];

  // 报告分四段吐:结论与行动清单先落地(用户最想先看到的),再是问题详情,然后是已确认无问题 +
  // 数据与方法,最后一句收口。分段不只是排版——每段各自重渲染,长表格不必每个 tick 都把
  // 整篇 markdown 重新解析一遍。
  function buildProfilingOverviewMarkdown() {
    return [
      '## 结论速览',
      '',
      '- **性能健康度 75 / 100（A 档下沿）**，落实下面两条 P0 后预估 **85 / 100** —— 计算 64% · 通信 93% · 调度 71% · 内存 N/A（本次 `profile_memory=false`，采不到）。',
      '- **既不是慢卡，也不是慢链路。** 8 卡 stepTime 落在 10796.6–10800.6 ms，极差 4 ms、CV≈0.012%，没有掉队 rank；跨节点 PP P2P 走 RDMA 实测 **24.2 GB/s（≈ 理论 25 GB/s 的 97%）**，节点内 LOCAL allreduce ~661 GB/s。',
      '- **真正的瓶颈是流水线末级过载。** PP stage3（rank6/7）单步计算 **~9.26 s**，是其余各级（~6.15 s）的 **1.51×**，多算 3.11 s；其余 6 卡因此每步卡在 P2P recv 上空等 **~3.77 s**，bubble 占单步 **~35%**。[[lane:ovl-free::图上看 Free 轨]]',
      '- **收益上限**：把末级负载拉平 + 打开计算-通信重叠，单步可从 10.80 s 压到 **7.5–8.0 s（-26~30%）**，端到端 MFU 从 ~40% 升到 **~55–60%**。',
      '',
      '## 行动清单',
      '',
      '按预期收益从高到低排；同档收益按改动难度从低到高排。',
      '',
      '| # | 优先级 | 问题 | 预期收益 | 改动难度 |',
      '|---|---|---|---|---|',
      '| 1 | **P0** | PP 末级（stage3 / rank6、7）计算过载，制造 ~35% 单步 bubble | -26~30% 单步耗时（~2.8–3.0 s） | 中 |',
      '| 2 | **P0** | 计算-通信零重叠，通信 100% 压在关键路径上 | -10~15% 单步耗时 | 中 |',
      '| 3 | P1 | 缓存 / 显存分配器的三个关键环境变量未设置 | 降 host 下发开销、缓解碎片 | 低 |',
      '| 4 | P1 | 动态 shape 触发算子在线编译 | 低~中 | 低 |',
      '| 5 | P2 | 末级重载卡 AI Core 降频（rank6/7 低至 1200–1350 MHz） | 低 | 中 |',
      '',
    ].join('\n');
  }

  function buildProfilingDetailMarkdown() {
    return [
      '## 问题详情',
      '',
      '### 1 · [P0] PP 末级计算过载，制造 ~35% 单步 bubble',
      '',
      '证据来自 `cluster_time_summary` → `ClusterTimeSummary`（step 4，单位 ms）：',
      '',
      '| rank | 节点 | stage | 计算 | 暴露通信 | 其中 stage 等待 | Free | stepTime | 计算占比 |',
      '|---|---|---|---|---|---|---|---|---|',
      '| 0 | ubuntu122 | s0 | 6325.6 | 4389.6 | 3613.1 | 83.6 | 10799.8 | 58.6% |',
      '| 1 | ubuntu122 | s0 | 6359.1 | 4293.8 | 3515.7 | 143.7 | 10797.7 | 58.9% |',
      '| 2 | ubuntu122 | s1 | 6005.1 | 4626.7 | 3786.7 | 168.4 | 10800.6 | 55.6% |',
      '| 3 | ubuntu122 | s1 | 6003.9 | 4635.5 | 3787.1 | 160.9 | 10799.8 | 55.6% |',
      '| 4 | localhost | s2 | 6174.0 | 4492.1 | 3886.4 | 130.3 | 10796.6 | 57.2% |',
      '| 5 | localhost | s2 | 6011.9 | 4670.0 | 4053.7 | 116.1 | 10798.3 | 55.7% |',
      '| **6** | localhost | **s3** | **9454.0** | 1092.5 | 392.3 | 250.8 | 10798.2 | **87.6%** |',
      '| **7** | localhost | **s3** | **9060.3** | 1554.2 | 848.3 | 182.7 | 10797.9 | **83.9%** |',
      '',
      '- 末级"多出来的活"已经落到具体算子：`MatMulV2`（lm_head / logits 投影，平均 **16.0 ms × 64 次 ≈ 1024 ms**）**只出现在 rank6/7**，rank0–5 一次都没有；再加末级 loss 相关 vector 算子比 stage0 重 ~1.6×，3110 ms 的差额刚好对得上。',
      '- `hccl_sum` 佐证：stage0–2 的 `hcom_batchSendRecv_` 单卡 SumNs 7.4–7.9 s / 2 step，但 Min 只有 1.25 ms、Max 上百 ms —— 这段时间绝大部分是**等**，不是传。',
      '- 影响：全集群每步约 `6 卡 × 3.77 s ≈ 22.6` 卡·秒空耗在 bubble 上，约占集群总算力时间的 26%。',
      '',
      '**改动位置**：训练启动脚本里的 PP 层切分参数（Megatron / MindSpeed）。',
      '',
      '1. 走**非均匀 PP 切分**，把末级 decoder 层数调少（Megatron 的 `--decoder-last-pipeline-num-layers`）。3.11 s 的差额大约对应 0.5 层的等效负载，按实测微调，目标是 stage3 从 ~9.26 s 压到 ~6.4 s。',
      '2. 或者把 lm_head / loss 本身摊薄：当前 TP=1，可以对输出投影做 TP，或换成 vocab-parallel cross-entropy，把 logits GEMM 和 CE 拆到多卡。',
      '3. 复采时提高 `num_microbatches` 并确认走 1F1B，进一步压低固有 bubble。',
      '',
      '**验证方式**：重采后跑 `msprof-analyze -m cluster_time_summary`，确认 stage3 与 stage0–2 的计算极差 < 10%、`communicationWaitStageTime` 从 ~3.77 s 降到 < 1.5 s，单步落到 7.5–8.0 s。',
      '',
      '**举证视图**：算子视图载入 rank6 的 `kernel_details.csv`，按 Type 过滤 `MatMulV2`，对照 rank0 的同名文件应当完全没有这个算子；辅以 rank0 的 `trace_view.json`，在 P2P recv 处能直接看到 ~3.8 s 的 device 空挡。',
      '',
      '### 2 · [P0] 计算-通信零重叠',
      '',
      '- **证据**：8 卡 `step_trace_time.csv` 与 `ClusterTimeSummary` 的 `communicationOverlapComputation` 列**全部为 0.0** —— 没有任何通信被计算掩盖，`Communication(Not Overlapped)` 等于 `Communication`（rank0 step4：4389.6 ms 全部暴露）。DP 的 `hcom_allReduce_` 也没有与反向计算并行。[[lane:ovl-nc::图上看 Not Overlapped 轨]]',
      '- **影响**：暴露通信和 bubble 直接落在关键路径上，链路再健康也掩盖不掉。结合问题 1，stage0–2 那部分暴露通信里约 80% 其实是 stage 等待。',
      '- **怎么改**（改动位置：并行调度与通信流配置）：开启 **interleaved 1F1B（virtual pipeline）**让前反向交错、制造可重叠窗口；开启**梯度 reduce 与反向重叠**（`overlap_grad_reduce` / 独立通信 stream），把 DP allreduce 藏到反向后面；确认 P2P 走独立 stream，别和计算串行化。',
      '- **验证方式**：重采后 `communicationOverlapComputation > 0`，且各卡暴露通信占 step 的比例下降 ≥ 10 个百分点。',
      '',
      '### 3 · [P1] 关键环境变量未设置（缓存 / 显存分配器）',
      '',
      '- **证据**：`profiler_metadata.json` 的 `ENV_VARIABLES` 里 `ACLNN_CACHE_LIMIT`、`HOST_CACHE_CAPACITY`、`PYTORCH_NPU_ALLOC_CONF` 均为空；advisor 的 Environment Variable Issues 也正好点了这三个。',
      '- **影响**：aclnn / host 缓存偏小会抬高算子下发开销；缺 `expandable_segments` 容易让显存分配器碎片化（本次未开 `profile_memory`，碎片量没法量化）。',
      '',
      '改动位置是启动脚本的环境变量段：',
      '',
      '```',
      'export ACLNN_CACHE_LIMIT=100000',
      'export HOST_CACHE_CAPACITY=20',
      'export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True',
      '```',
      '',
      '**验证方式**：重采后 advisor 不再提示 Environment Variable Issues，且 `cann_api_sum` 里 host 侧下发 / Tiling API 总耗时下降。',
      '',
      '### 4 · [P1] 动态 shape 触发算子在线编译',
      '',
      '- **证据**：advisor 的 Operator Dynamic Shape Issues 命中。',
      '- **影响**：走在线编译路径会引入额外的 host 编译与下发开销，放大调度抖动。',
      '',
      '改动位置是训练入口的初始化代码，固定成静态 shape 编译路径：',
      '',
      '```',
      'torch_npu.npu.set_compile_mode(jit_compile=False)',
      'torch_npu.npu.config.allow_internal_format = False',
      '```',
      '',
      '**验证方式**：重采后 advisor 不再提示 Dynamic Shape，`cann_api_sum` 里编译相关 API 耗时下降。',
      '',
      '### 5 · [P2] 末级重载卡 AI Core 降频',
      '',
      '- **证据**：`freq_analysis` → `AbnormalFrequencyRanks`：rank6 出现 1200 / 1250 / 1300 MHz，rank7 出现 1250 / 1300 MHz（额定 1800 MHz）；负载较轻的 rank0 始终在 1700–1800 MHz。降频恰好集中在计算最重的末级两卡。[[lane:freq-c::图上看 Core Frequency 轨]]',
      '- **影响**：末级是 gating 路径，降频会继续拉长单步；但当前幅度温和（没到 800 MHz 全空闲档），优先级排在问题 1、2 之后。',
      '- **怎么改**：先落地问题 1 的负载均衡再复采，观察 rank6/7 是否回到 1800 MHz；若仍降频，再排查 localhost 这个物理节点的散热与功耗墙。',
      '- **验证方式**：重采后 `freq_analysis` 中 rank6/7 不再出现 < 1500 MHz 的样本。',
      '',
    ].join('\n');
  }

  function buildProfilingAppendixMarkdown() {
    return [
      '## 已确认没问题的部分',
      '',
      '- **通信链路健康**：跨节点 PP P2P 走 RDMA，`ClusterCommunicationBandwidth` 实测 ~24.2 GB/s（≈ 理论 25 GB/s 的 97%），各 send/recv 高度一致，包大小 29.36 MB（大包，没有小包和字节对齐问题）；节点内 LOCAL allreduce ~661 GB/s。[[lane:comm-ar::图上看 hcom_allReduce 轨]]',
      '- **没有硬件型快慢卡**：8 卡 stepTime 极差 4 ms、CV≈0.012%，rank 间差异是结构性 PP 负载不均，不是单卡硬件劣化。',
      '- **算子内核效率高**：cube（MAC 流水）利用率按耗时加权 **86%–98%（集群 ~92%）**，主力 GEMM 形状规整、效率接近上限 —— 瓶颈不在单算子实现，而在并行结构。',
      '- **Host 下发没有饿死 device**：各卡 `Free` 仅 84–251 ms（< step 的 2.5%），`free_analysis` 显示空闲多是 device 任务运行中的小间隙（EVENT_RECORD / EVENT_WAIT）。',
      '- **数据采集完整**：8 卡 `profiler_info_{rank}.json` 齐全、采集正常 Stop，DB / CSV / trace 交付件齐备。',
      '',
      '## 数据与方法',
      '',
      '- **数据范围**：8 Rank / 2 节点（ubuntu122 = rank0–3，localhost = rank4–7）× 4 卡；并行 TP1·PP4·DP2·CP1；采集 schedule `skip_first=2, warmup=1, active=2`（有效 step 3、4）；Profiler Level1，`aic_metrics=ACL_AICORE_PIPE_UTILIZATION`；torch_npu 2.7.1 / CANN 8.3.RC1。',
      '- **stage 映射**：stage0={0,1}、stage1={2,3}、stage2={4,5}、stage3={6,7}；DP 对 (0,1)(2,3)(4,5)(6,7)；PP 组 {0,2,4,6} / {1,3,5,7} **跨节点**，P2P 走 RDMA。',
      '- **跑过的分析**：`cluster_time_summary` / `compute_op_sum` / `hccl_sum` / `communication_time_sum` / `communication_matrix_sum` / `freq_analysis` / `free_analysis` / `cann_api_sum`，外加 `advisor all`。',
      '- **PHS 计算**（场景 = 大模型多卡训练，权重 计算 0.40 · 通信 0.30 · 调度 0.20 · 内存 0.10）：计算利用率 ≈ **64%**（device 计算占用率口径；cube 硬件利用率另有 ~92%，说明损耗在并行结构而非算子）、通信效率 ≈ **93%**、调度效率 ≈ **71%**（PP bubble 计入此项）、内存 **N/A**，权重按 `÷(1-0.10)` 归一化 → **PHS ≈ 75**。',
      '- **MFU 实算**：MatMul 聚合达成 **301.7 TFLOP/s**，已超 910B3(294.91) / B4(270) 的理论峰值，据此判定芯片为 **910B1**（BF16 峰值 378.88 TFLOP/s）并以此为分母。算子达成率：rank0（纯 transformer）~**80%**，rank6（含 lm_head + loss）~**64%** —— 被 lm_head 的大 N GEMM `4096×3584×152064` 和 loss 反向的小 M GEMM `224×9504×9504`（514 ms 只跑出 ~3 TFLOP/s）拖低。端到端 step MFU ≈ 算子达成率 × 计算占用率 ≈ **40% 出头**，差的那部分正好是 bubble + 零重叠的暴露通信。',
      '- **一个口径提醒**：`record_shapes=false` 只影响 host 侧 trace，`kernel_details.csv` 里的 Input/Output Shapes 是 device 侧 CANN 落盘的，两者无关，所以 FLOPs-based MFU 照样能算（rank0 的 29350 行算子里 29152 行带 shape）。',
      '- **下次采集建议**：打开 `profile_memory`，把显存占用 / HBM 带宽这一维补齐——当前 PHS 的内存子项是缺的，OOM 风险也评估不了。',
      '',
    ].join('\n');
  }

  function buildProfilingTailMarkdown() {
    return '一句话收口：这次慢**不是硬件的问题**，是 PP 切分把活压在了最后一级。先按行动清单里的 1 和 2 改，' +
      '改完重采一次我再帮你对一遍前后差异；想让我把某一条展开成能直接提交的 patch，说一声就行。';
  }

  function buildProfilingAnswerSections() {
    return [
      buildProfilingOverviewMarkdown(),
      buildProfilingDetailMarkdown(),
      buildProfilingAppendixMarkdown(),
      buildProfilingTailMarkdown(),
    ];
  }
  window.MSI_GET_PROFILING_ANSWER = () => buildProfilingAnswerSections().join('\n');

  // 提问卡片固定用内置的 PROFILING_QUESTION,不回显用户实际敲的那句——这套回答是写死的,
  // 用真实提问做题面只会得到一组对不上的问答。
  function runProfilingDiagnosisScenario(opts) {
    if (chatStreaming) return;
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;

    profilingHistoryContext = opts?.context || captureComposerContext();
    if (!opts?.alreadyDisplayed) appendQuestionCard(PROFILING_QUESTION, {
      context: profilingHistoryContext,
      sessionTitle: PROFILING_SESSION_TITLE,
    });

    const { el: aiDiv, bodyEl } = createAiMessageShell();
    msgEl.appendChild(aiDiv);
    activeRoundBody = bodyEl;
    scrollChatToBottom(msgEl);

    chatStreaming = true;
    chatStopped = false;
    setChatBusy(true);
    const epoch = chatEpoch;
    const sections = buildProfilingAnswerSections();
    activeResumeRound = { resume: () => resumeDemoRound(bodyEl, sections, true) };

    const think = createThinkBlock(bodyEl, { clockScale: PROFILING_DEMO_CLOCK_SCALE });

    (async () => {
      for (const step of PROFILING_THINK_SCRIPT) {
        think.startNode(step);
        await think.typeText(step.text, 9);
        await chatSleep(step.hold || 300);
        if (epoch !== chatEpoch) return;                            // 这轮已被「新建对话」丢弃
        if (chatStopped) return finalizeStoppedRound(think, bodyEl);
      }
      think.finish(); // 正式回答开始 → 思考过程自动收起

      // 一份诊断报告比闲聊长一个量级,打字机按 12 字/tick 走(≈1.3ms/字):再慢下去,
      // 等它吐完就成了折磨,而不是"看着它在生成"。
      const answer = document.createElement('div');
      answer.className = 'wzh-chat-answer';
      answer._markdownSource = sections.join('\n');
      bodyEl.appendChild(answer);

      for (const md of sections) {
        const seg = document.createElement('div');
        answer.appendChild(seg);
        await typeMarkdownInto(seg, md, 16, 12, (retainedCards) => {
          addProfilingVisualizationCards(answer, retainedCards);
        });
        if (epoch !== chatEpoch) return;                            // 这轮已被「新建对话」丢弃
        if (chatStopped) return finalizeStoppedRound(think, bodyEl);
      }

      if (epoch !== chatEpoch) return; // 这轮已被「新建对话」丢弃
      addProfilingVisualizationCards(answer);
      answer.appendChild(buildAnswerActions());

      chatStreaming = false;
      activeRoundBody = null;
      activeResumeRound = null;
      setChatBusy(false);
      scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
    })();
  }

  // 历史记录恢复的是一轮已经完成的问答：直接拼好全部内容，不重播思考与逐字生成动画。
  function restoreProfilingHistory() {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;

    resetConversation();
    appendQuestionCard(PROFILING_QUESTION, {
      context: profilingHistoryContext,
      sessionTitle: PROFILING_SESSION_TITLE,
    });

    const sections = buildProfilingAnswerSections();
    const { el: aiDiv, bodyEl } = createAiMessageShell();
    const answer = document.createElement('div');
    answer.className = 'wzh-chat-answer';
    answer._markdownSource = sections.join('\n');
    sections.forEach((md) => {
      const seg = document.createElement('div');
      seg.innerHTML = renderMarkdown(md);
      answer.appendChild(seg);
    });
    addProfilingVisualizationCards(answer);
    answer.appendChild(buildAnswerActions());
    bodyEl.appendChild(answer);
    msgEl.appendChild(aiDiv);

    chatHistory = [
      { role: 'user', content: PROFILING_QUESTION.replace(/#\{([^}]+)\}/g, '$1') },
      { role: 'assistant', content: sections.join('\n') },
    ];
    chatStopped = false;
    setChatBusy(false);
    stickToBottom = false;
    requestAnimationFrame(() => {
      msgEl.scrollTop = 0;
      updateChatFade(msgEl);
    });
  }

  function restoreCompletedDemoHistory(question, sessionTitle, markdown, options = {}) {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;
    resetConversation();
    appendQuestionCard(question, {
      context: options.context || { directory: PROFILING_DATA_DIR, codePath: '' },
      sessionTitle,
    });
    const { el, bodyEl } = createAiMessageShell();
    if (options.thinkSteps) {
      const think = createThinkBlock(bodyEl, {});
      options.thinkSteps.forEach((step) => {
        think.startNode(step).setText(step.text);
        think.finishNode();
      });
      think.finish();
      // 历史演示没有保存耗时，保留思考内容但不展示即时拼装产生的 0s。
      think.el.querySelectorAll('.wzh-chat-think-head-time, .wzh-chat-think-node-time')
        .forEach((time) => time.remove());
      if (activeThink === think) activeThink = null;
    }
    const answer = document.createElement('div');
    answer.className = 'wzh-chat-answer';
    answer._markdownSource = markdown;
    answer.innerHTML = renderMarkdown(markdown);
    if (options.codeChange) answer.appendChild(createCodeChangeAnswerCard());
    answer.appendChild(buildAnswerActions());
    bodyEl.appendChild(answer);
    msgEl.appendChild(el);
    chatHistory = [
      { role: 'user', content: question },
      { role: 'assistant', content: markdown },
    ];
    stickToBottom = false;
    requestAnimationFrame(() => {
      msgEl.scrollTop = 0;
      updateChatFade(msgEl);
    });
  }

  function restoreConstructedHistory(key) {
    if (key === 'profile') return restoreProfilingHistory();
    if (key === 'code') {
      return restoreCompletedDemoHistory(CODE_CHANGE_HISTORY_QUESTION,
        '流水线末级过载 · 模型代码调整', CODE_CHANGE_ANSWER_MARKDOWN, {
          codeChange: true,
          thinkSteps: CODE_CHANGE_THINK_STEPS,
          context: {
            directory: PROFILING_DATA_DIR,
            codePath: $('trainChatCodePath')?.dataset.fullPath || '',
          },
        });
    }
    if (key === 'statistics') {
      return restoreCompletedDemoHistory(KNOWLEDGE_QUESTION, '耗时拆解统计',
        buildModuleStatisticReadyAnswerMarkdown());
    }
    if (key === 'guidance') {
      return restoreCompletedDemoHistory(KNOWLEDGE_QUESTION, '耗时拆解方法指导',
        buildKnowledgeAnswerMarkdown());
    }
  }

  function runKnowledgeQaScenario(opts) {
    if (chatStreaming) return;
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;

    if (!opts?.alreadyDisplayed) appendQuestionCard(KNOWLEDGE_QUESTION, {
      context: opts?.context,
      sessionTitle: '统计模型层与 MoE 模块耗时',
    });

    const { el: aiDiv, bodyEl } = createAiMessageShell();
    msgEl.appendChild(aiDiv);
    activeRoundBody = bodyEl;
    scrollChatToBottom(msgEl);

    chatStreaming = true;
    chatStopped = false;
    setChatBusy(true);
    const epoch = chatEpoch;
    const markdown = buildKnowledgeAnswerMarkdown();
    activeResumeRound = { resume: () => resumeDemoRound(bodyEl, [markdown], false) };
    const think = createThinkBlock(bodyEl, { clockScale: PROFILING_DEMO_CLOCK_SCALE });

    (async () => {
      for (const step of KNOWLEDGE_THINK_SCRIPT) {
        think.startNode(step);
        await think.typeText(step.text, 15);
        await chatSleep(step.hold || 300);
        if (epoch !== chatEpoch) return;
        if (chatStopped) return finalizeStoppedRound(think, bodyEl);
      }
      think.finish();

      const answer = document.createElement('div');
      answer.className = 'wzh-chat-answer';
      bodyEl.appendChild(answer);
      await typeMarkdownInto(answer, markdown, 11, 12);
      if (epoch !== chatEpoch) return;
      if (chatStopped) return finalizeStoppedRound(think, bodyEl);

      answer.appendChild(buildAnswerActions());
      chatStreaming = false;
      activeRoundBody = null;
      activeResumeRound = null;
      setChatBusy(false);
      scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
    })();
  }

  function runModuleStatisticReadyScenario(opts) {
    if (chatStreaming) return;
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;

    if (!opts?.alreadyDisplayed) appendQuestionCard(KNOWLEDGE_QUESTION, {
      context: opts?.context,
      sessionTitle: '统计模型层与 MoE 模块耗时',
    });

    const { el: aiDiv, bodyEl } = createAiMessageShell();
    msgEl.appendChild(aiDiv);
    activeRoundBody = bodyEl;
    scrollChatToBottom(msgEl);

    chatStreaming = true;
    chatStopped = false;
    setChatBusy(true);
    const epoch = chatEpoch;
    const markdown = buildModuleStatisticReadyAnswerMarkdown();
    activeResumeRound = { resume: () => resumeDemoRound(bodyEl, [markdown], false) };
    const think = createThinkBlock(bodyEl, { clockScale: PROFILING_DEMO_CLOCK_SCALE });

    (async () => {
      for (const step of MODULE_STATISTIC_READY_THINK_SCRIPT) {
        think.startNode(step);
        await think.typeText(step.text, 15);
        await chatSleep(step.hold || 300);
        if (epoch !== chatEpoch) return;
        if (chatStopped) return finalizeStoppedRound(think, bodyEl);
      }
      think.finish();

      const answer = document.createElement('div');
      answer.className = 'wzh-chat-answer';
      bodyEl.appendChild(answer);
      await typeMarkdownInto(answer, markdown, 11, 12);
      if (epoch !== chatEpoch) return;
      if (chatStopped) return finalizeStoppedRound(think, bodyEl);

      answer.appendChild(buildAnswerActions());
      chatStreaming = false;
      activeRoundBody = null;
      activeResumeRound = null;
      setChatBusy(false);
      scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
    })();
  }

  function sendMessage(text, scenario, opts) {
    if (!text) return;
    const sendOpts = { ...opts, context: opts?.context || captureComposerContext() };
    // 回答期间不打断当前这轮:新问题排进队列,等这轮答完自动接上(见 flushChatQueue)
    if (chatStreaming) { enqueueChatMessage(text, scenario, sendOpts.context); return; }
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;
    stoppedRound = null; // 发起新一轮后，之前被停止的回答不再可续
    syncSendState();

    if (document.documentElement.dataset.entryView === 'overview' && text.includes('代码')) {
      runCodeChangeScenario(text, sendOpts);
      return;
    }

    if (scenario === 'module-statistic-ready') {
      runModuleStatisticReadyScenario(sendOpts);
      return;
    }
    if (text.trim() === KNOWLEDGE_QUESTION) {
      runKnowledgeQaScenario(sendOpts);
      return;
    }

    // 其余输入触发本地「性能诊断」演示。
    runProfilingDiagnosisScenario(sendOpts);
  }

  function initPanelToggle() {
    const toggle = $('trainChatToggle');
    const panel = $('trainChatPanel');
    const closeBtn = $('trainChatCloseBtn');
    if (!toggle || !panel) return;

    function setOpen(open) {
      if (!open) closeChatVisualization({ restoreFocus: false });
      panel.classList.toggle('is-open', open);
      panel.setAttribute('aria-hidden', String(!open));
      toggle.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-pressed', String(open));
      toggle.title = open ? '关闭智能对话' : '打开智能对话';
      toggle.setAttribute('aria-label', toggle.title);
      if (open) {
        playWelcomeTypewriter();
        scheduleFadeUpdate(); // 面板收起期间内容高度可能变过,展开时重算一次渐隐
        focusChatInput();     // 展开即待输入,不用再点一下输入框
      } else {
        const input = $('trainChatInput');
        if (input && document.activeElement === input) input.blur(); // 收起后别把焦点留在看不见的输入框里
      }
    }

    toggle.addEventListener('click', () => {
      if (panel.classList.contains('is-floating') && panel.classList.contains('is-open') &&
          $('msiDesktop')?.dataset.activeWindow === 'main') {
        document.dispatchEvent(new Event('msi:focus-chat-window'));
        return;
      }
      setOpen(!panel.classList.contains('is-open'));
    });
    closeBtn?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !panel.classList.contains('is-open')) return;
      // 可视化栏展开时，Esc 只交给内部弹层处理。
      if (!panel.classList.contains('is-visualizing')) setOpen(false);
    });

    setOpen(true); // 默认展开(挤入式,直接把内容区挤窄)
  }

  // 输入 # 可以引用的性能落盘数据:直接取左树(window.MSI_CTX_FILES,见上面的 msi-workbench 脚本)
  // 那一份,左边是落盘出来的文件名,右边是它在采集目录里的路径。两处共用一份数据,
  // 左树里点得到的文件 # 一定引用得到,不会出现「树里有、# 里没有」的错位。
  const CTX_FILES = window.MSI_CTX_FILES || [];
  const CTX_OPERATORS = [
    ['aclnnEmbedding', 'Stream 2'],
    ['aclnnMatmul_MatMulV3Common_MatMulV3', 'Device'],
    ['aclnnFlashAttentionScore_FlashAttentionScore_FlashAttentionScore', 'Stream 2'],
    ['aclnnCast_CastAiCore_Cast', 'Stream 2'],
    ['aclnnNonzeroV2_NonzeroAiCore_NonZero', 'Stream 2'],
    ['HcclBatchSendRecv', 'PyTorch 算子'],
    ['hcom_batchSendRecv', 'PP Communication'],
    ['hcom_batchSendRecv__128_4_1', 'PP Communication'],
    ['hcom_allReduce__170_1_1', 'DP Communication'],
    ['hcom_allGather__097_6_1', 'Embedding Communication'],
  ].map(([name, lane]) => ({ name, path: 'profile_dir / 泳道图 / ' + lane, type: 'operator' }));
  const CTX_ITEMS = CTX_FILES.concat(CTX_OPERATORS);

  const CHAT_FOLDER_ICON = '<svg class="wzh-chat-picker-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h4l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/></svg>';
  const CHAT_CODE_ICON = '<img class="wzh-chat-picker-icon wzh-chat-picker-icon--asset" src="../../src/pic/icon/code.svg" alt="">';
  const CHAT_OPERATOR_ICON = '<img class="wzh-chat-picker-icon wzh-chat-picker-icon--asset" src="../../src/pic/icon/operator.svg" alt="">';

  // 输入框敲 # 后弹出的上下文选择框。键盘事件要抢在"回车发送"前面处理,所以不自己挂
  // keydown,而是暴露 onKeyDown 由 initInput 里那个 handler 先问一遍。
  let ctxPicker = null;
  let codeFilePicker = null;
  let commandPicker = null;

  // 项目目录的演示文件树：三类常见模型工程文件，供绑定目录后的 @ 引用示意。
  const CODE_FILE_GROUPS = [
    { folder: 'model', files: ['pipeline.py', 'transformer.py', 'decoder_layer.py', 'attention.py', 'moe.py', 'router.py', 'layers.py', '__init__.py'] },
    { folder: 'scripts', files: ['train.sh', 'launch_pp.sh', 'launch_tp.sh', 'launch_dp.sh', 'profile.sh', 'eval.sh'] },
    { folder: 'configs', files: ['model_910b.json', 'parallel_config.json', 'train_config.yaml', 'distributed.yaml', 'optimizer.yaml', 'deepspeed_zero.json'] },
  ];
  const CODE_FILE_ITEMS = CODE_FILE_GROUPS.flatMap(({ folder, files }) => [
    { type: 'folder', name: folder, path: folder + '/' },
    ...files.map((name) => ({ type: 'file', name, path: folder + '/' + name })),
  ]);

  function initCtxPicker() {
    const input = $('trainChatInput');
    const pop = $('trainChatCtxPop');
    if (!input || !pop) return null;
    let items = [];        // 当前筛出来的条目
    let active = 0;        // 高亮到第几条
    let tokenStart = -1;   // 正在编辑的那个 # 在 value 里的下标

    const isOpen = () => pop.classList.contains('is-open');
    // 上下文框和模型弹层一样从输入栏往上开,同样会被「回到底部」盖住,共用 .is-pop-open 抬层
    const bar = pop.closest('.wzh-chat-input-bar');

    // 光标左边最近的那个 #;# 到光标之间只要出现空白或第二个 #,说明这个 token 已经敲完了
    function findToken() {
      const pos = input.selectionStart;
      if (pos !== input.selectionEnd) return null;
      const v = input.value;
      const hash = v.lastIndexOf('#', pos - 1);
      if (hash < 0) return null;
      // 从 Timeline 置入的算子标签已有确定来源，不交给落盘文件选择器再次匹配。
      if (composerChips.some((chip) => chip.start === hash && chip.token.startsWith('#'))) return null;
      // "# 名字" 里 # 后面那个空格是标签自带的,不算这个 token 敲完;再多的空白才算
      const query = v.slice(hash + 1, pos).replace(/^ /, '');
      if (/[\s#]/.test(query)) return null;
      return { start: hash, query };
    }

    // 把命中的那段包成 <mark>:先按原串下标切开再各自转义,转义带来的长度变化就影响不到下标
    function mark(text, q) {
      if (!q) return escHtml(text);
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return escHtml(text);
      return markSlice(text, i, q.length);
    }
    function markSlice(seg, from, len) {
      const a = Math.max(from, 0);
      const b = Math.min(from + len, seg.length);
      if (b <= a) return escHtml(seg);
      return escHtml(seg.slice(0, a)) + '<mark>' + escHtml(seg.slice(a, b)) + '</mark>' + escHtml(seg.slice(b));
    }
    // 对象名按最后一个点拆成主干 + 后缀,两段分别渲染(CSS 只让主干收缩,后缀始终露出)。
    // 命中位置在整名上算一次,再按 offset 分派给两段,跨越点号的匹配也能连着高亮。
    function nameCell(name, q) {
      const dot = name.lastIndexOf('.');
      const cut = dot > 0 ? dot : name.length;
      const stem = name.slice(0, cut);
      const ext = name.slice(cut);
      const hit = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
      const from = hit < 0 ? -1 : hit;
      const len = hit < 0 ? 0 : q.length;
      return '<span class="wzh-chat-ctx-name">' +
        '<span class="wzh-chat-ctx-name-stem">' + (hit < 0 ? escHtml(stem) : markSlice(stem, from, len)) + '</span>' +
        (ext ? '<span class="wzh-chat-ctx-name-ext">' + (hit < 0 ? escHtml(ext) : markSlice(ext, from - cut, len)) + '</span>' : '') +
        '</span>';
    }

    function close() {
      pop.classList.remove('is-open');
      if (!codeFilePicker?.isOpen() && !commandPicker?.isOpen()) bar?.classList.remove('is-pop-open');
      pop.innerHTML = '';
      items = [];
      tokenStart = -1;
    }

    function setActive(i) {
      if (!items.length) return;
      active = (i + items.length) % items.length;
      const nodes = pop.querySelectorAll('.wzh-chat-ctx-item');
      nodes.forEach((n, k) => n.classList.toggle('is-active', k === active));
      nodes[active]?.scrollIntoView({ block: 'nearest' });
    }

    // 按当前 # 后面的字重新筛一遍;没有正在编辑的 token 就直接收起来
    function refresh() {
      const t = findToken();
      if (!t) return close();
      codeFilePicker?.close();
      commandPicker?.close();
      tokenStart = t.start;
      const q = t.query.toLowerCase();
      items = q
        ? CTX_ITEMS.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
        : CTX_ITEMS.slice();
      pop.innerHTML = '<p class="wzh-chat-agent-pop-title">选择性能文件对象</p>' + (items.length
        ? items.map((f, i) =>
            '<button class="wzh-chat-ctx-item wzh-chat-picker-item' + (i === 0 ? ' is-active' : '') + '" type="button" role="option" data-i="' + i + '">' +
              (f.type === 'folder' ? CHAT_FOLDER_ICON : f.type === 'operator' ? CHAT_OPERATOR_ICON : CHAT_CODE_ICON) +
              nameCell(f.name, t.query) +
              '<span class="wzh-chat-ctx-path">' + mark(f.path, t.query) + '</span>' +
            '</button>').join('')
        : '<div class="wzh-chat-ctx-empty">没有匹配的性能文件对象或算子</div>');
      active = 0;
      pop.classList.add('is-open');
      bar?.classList.add('is-pop-open'); // 抬到「回到底部」之上,见 .is-pop-open
      pop.scrollTop = 0;
    }

    // 选中:把 #已敲的字 整段换成 "# 文件名" + CHIP_GAP,光标落到间距后面接着打字。
    // # 和名字之间那个空格是标签的统一写法(见 HASH_SP),置入的三条路径都带着它。
    function commit(i) {
      const f = items[i];
      if (!f || tokenStart < 0) return;
      const pos = input.selectionStart;
      const token = HASH_SP + f.name;
      const insert = token + CHIP_GAP;
      input.value = input.value.slice(0, tokenStart) + insert + input.value.slice(pos);
      registerComposerChip(input, tokenStart, token);
      const caret = tokenStart + insert.length;
      close();
      try { input.setSelectionRange(caret, caret); } catch (e) { /* 忽略 */ }
      autoResizeInput();
      syncSendState();
      input.focus();
    }

    // 选择框开着时,上下键选、回车/Tab 确认、Esc 收起 —— 这些键都不该再传给"回车发送"
    // 和面板级的 Esc 关闭,处理掉就返回 true。
    function onKeyDown(e) {
      if (!isOpen()) return false;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (!items.length) { close(); return false; }
        e.preventDefault(); commit(active); return true;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return true; }
      return false;
    }

    // mousedown 阻止默认,点条目时焦点不会从输入框跑掉,commit 后光标还在原地
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    pop.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-ctx-item[data-i]');
      if (btn) commit(Number(btn.dataset.i));
    });
    pop.addEventListener('mousemove', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-ctx-item[data-i]');
      if (btn) setActive(Number(btn.dataset.i));
    });
    // 光标被方向键/点击挪走后重新判一次:挪出 token 范围就自动收起
    input.addEventListener('click', () => { if (isOpen()) refresh(); });
    input.addEventListener('keyup', (e) => {
      if (isOpen() && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) refresh();
    });
    input.addEventListener('blur', () => close());

    return { refresh, close, onKeyDown, isOpen };
  }

  // 绑定项目目录后输入 @：文件夹和代码文件都是同级选项，可按名称或相对路径搜索。
  function initCodeFilePicker() {
    const input = $('trainChatInput');
    const pop = $('trainChatCodeFilePop');
    if (!input || !pop) return null;
    const bar = pop.closest('.wzh-chat-input-bar');
    let items = [];
    let active = 0;
    let tokenStart = -1;
    const isOpen = () => pop.classList.contains('is-open');

    function findToken() {
      if (!$('trainChatLocalCodePath')?.value || $('trainChatCodeChip')?.hidden) return null;
      const pos = input.selectionStart;
      if (pos !== input.selectionEnd) return null;
      const value = input.value;
      const at = value.lastIndexOf('@', pos - 1);
      if (at < 0 || (at > 0 && !/\s/.test(value[at - 1]))) return null;
      const query = value.slice(at + 1, pos);
      if (/[\s@#]/.test(query)) return null;
      return { start: at, query };
    }

    function mark(value, query) {
      const hit = query ? value.toLowerCase().indexOf(query.toLowerCase()) : -1;
      if (hit < 0) return escHtml(value);
      return escHtml(value.slice(0, hit)) + '<mark>' + escHtml(value.slice(hit, hit + query.length)) + '</mark>' + escHtml(value.slice(hit + query.length));
    }

    function close() {
      pop.classList.remove('is-open');
      if (!ctxPicker?.isOpen() && !commandPicker?.isOpen()) bar?.classList.remove('is-pop-open');
      pop.innerHTML = '';
      items = [];
      tokenStart = -1;
    }

    function setActive(index) {
      if (!items.length) return;
      active = (index + items.length) % items.length;
      pop.querySelectorAll('.wzh-chat-code-file-item').forEach((node) => {
        const selected = Number(node.dataset.i) === active;
        node.classList.toggle('is-active', selected);
        node.setAttribute('aria-selected', String(selected));
      });
      pop.querySelector('.wzh-chat-code-file-item[data-i="' + active + '"]')?.scrollIntoView({ block: 'nearest' });
    }

    function refresh() {
      const token = findToken();
      if (!token) return close();
      ctxPicker?.close();
      commandPicker?.close();
      tokenStart = token.start;
      const query = token.query.toLowerCase();
      items = CODE_FILE_ITEMS.filter((item) =>
        !query || item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query));
      pop.innerHTML = '<p class="wzh-chat-agent-pop-title">选择项目目录文件</p>' +
        (items.length ? items.map((item, index) =>
          '<button class="wzh-chat-ctx-item wzh-chat-picker-item wzh-chat-code-file-item" type="button" role="option" data-i="' + index + '" aria-selected="false">' +
            (item.type === 'folder' ? CHAT_FOLDER_ICON : CHAT_CODE_ICON) +
            '<span class="wzh-chat-ctx-name">' + mark(item.name, token.query) + '</span>' +
            '<span class="wzh-chat-ctx-path">' + mark(item.path, token.query) + '</span></button>').join('')
          : '<div class="wzh-chat-ctx-empty">没有匹配的项目文件</div>');
      active = 0;
      if (items.length) setActive(0);
      pop.classList.add('is-open');
      bar?.classList.add('is-pop-open');
      pop.scrollTop = 0;
    }

    function commit(index) {
      const item = items[index];
      if (!item || tokenStart < 0) return;
      const pos = input.selectionStart;
      const token = '@' + item.path;
      const insert = token + CHIP_GAP;
      input.value = input.value.slice(0, tokenStart) + insert + input.value.slice(pos);
      registerComposerChip(input, tokenStart, token);
      const caret = tokenStart + insert.length;
      close();
      input.setSelectionRange(caret, caret);
      autoResizeInput();
      syncSendState();
      input.focus();
    }

    function onKeyDown(event) {
      if (!isOpen()) return false;
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(active + 1); return true; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); return true; }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (items.length) commit(active);
        return true;
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return true; }
      return false;
    }

    pop.addEventListener('mousedown', (event) => event.preventDefault());
    pop.addEventListener('click', (event) => {
      const item = event.target.closest?.('.wzh-chat-code-file-item[data-i]');
      if (item) commit(Number(item.dataset.i));
    });
    pop.addEventListener('mousemove', (event) => {
      const file = event.target.closest?.('.wzh-chat-code-file-item[data-i]');
      if (file) setActive(Number(file.dataset.i));
    });
    input.addEventListener('click', () => { if (isOpen()) refresh(); });
    input.addEventListener('keyup', (event) => {
      if (isOpen() && /^(ArrowLeft|ArrowRight|Home|End)$/.test(event.key)) refresh();
    });
    input.addEventListener('blur', close);
    return { refresh, close, onKeyDown, isOpen };
  }

  // 输入 / 后弹出的指令选择框。筛选、键盘导航与确认行为和 # 上下文选择框保持一致。
  const CHAT_COMMANDS = ['mindstudio-cpu-binding', 'customize-opencode', 'init', 'review'];

  function initCommandPicker() {
    const input = $('trainChatInput');
    const pop = $('trainChatCommandPop');
    if (!input || !pop) return null;
    let items = [];
    let active = 0;
    let tokenStart = -1;

    const isOpen = () => pop.classList.contains('is-open');
    const bar = pop.closest('.wzh-chat-input-bar');

    function findToken() {
      const pos = input.selectionStart;
      if (pos !== input.selectionEnd) return null;
      const v = input.value;
      const slash = v.lastIndexOf('/', pos - 1);
      if (slash < 0 || (slash > 0 && !/\s/.test(v[slash - 1]))) return null;
      const query = v.slice(slash + 1, pos);
      if (/[\s/#@]/.test(query)) return null;
      return { start: slash, query };
    }

    function mark(text, query) {
      if (!query) return escHtml(text);
      const i = text.toLowerCase().indexOf(query.toLowerCase());
      if (i < 0) return escHtml(text);
      return escHtml(text.slice(0, i)) + '<mark>' + escHtml(text.slice(i, i + query.length)) + '</mark>' + escHtml(text.slice(i + query.length));
    }

    function close() {
      pop.classList.remove('is-open');
      if (!ctxPicker?.isOpen() && !codeFilePicker?.isOpen()) bar?.classList.remove('is-pop-open');
      pop.innerHTML = '';
      items = [];
      tokenStart = -1;
    }

    function setActive(i) {
      if (!items.length) return;
      active = (i + items.length) % items.length;
      const nodes = pop.querySelectorAll('.wzh-chat-ctx-item');
      nodes.forEach((node, k) => node.classList.toggle('is-active', k === active));
      nodes[active]?.scrollIntoView({ block: 'nearest' });
    }

    function refresh() {
      const token = findToken();
      if (!token) return close();
      ctxPicker?.close();
      codeFilePicker?.close();
      tokenStart = token.start;
      const query = token.query.toLowerCase();
      items = query
        ? CHAT_COMMANDS.filter((command) => command.toLowerCase().includes(query))
        : CHAT_COMMANDS.slice();
      pop.innerHTML = items.length
        ? items.map((command, i) =>
            '<button class="wzh-chat-ctx-item wzh-chat-command-item' + (i === 0 ? ' is-active' : '') + '" type="button" role="option" data-i="' + i + '">' +
              '<span class="wzh-chat-ctx-name">/' + mark(command, token.query) + '</span>' +
            '</button>').join('')
        : '<div class="wzh-chat-ctx-empty">没有匹配的指令</div>';
      active = 0;
      pop.classList.add('is-open');
      bar?.classList.add('is-pop-open');
      pop.scrollTop = 0;
    }

    function commit(i) {
      const command = items[i];
      if (!command || tokenStart < 0) return;
      const pos = input.selectionStart;
      const token = COMMAND_PREFIX + command;
      const insert = token + CHIP_GAP;
      input.value = input.value.slice(0, tokenStart) + insert + input.value.slice(pos);
      registerComposerChip(input, tokenStart, token);
      const caret = tokenStart + insert.length;
      close();
      try { input.setSelectionRange(caret, caret); } catch (e) { /* 忽略 */ }
      autoResizeInput();
      syncSendState();
      input.focus();
    }

    function onKeyDown(e) {
      if (!isOpen()) return false;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (!items.length) { close(); return false; }
        e.preventDefault(); commit(active); return true;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return true; }
      return false;
    }

    pop.addEventListener('mousedown', (e) => e.preventDefault());
    pop.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-ctx-item[data-i]');
      if (btn) commit(Number(btn.dataset.i));
    });
    pop.addEventListener('mousemove', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-ctx-item[data-i]');
      if (btn) setActive(Number(btn.dataset.i));
    });
    input.addEventListener('click', () => { if (isOpen()) refresh(); });
    input.addEventListener('keyup', (e) => {
      if (isOpen() && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) refresh();
    });
    input.addEventListener('blur', () => close());

    return { refresh, close, onKeyDown, isOpen };
  }

  // 录屏快捷演示：按 Ctrl + Shift + Enter，留出 0.5 秒开录窗口，再用真实输入事件逐字写入问题；
  // 敲到 # 时让真实上下文浮窗打开，
  // 停一拍后用 Enter 选中首项 profile_dir，再继续输入并点击真实发送按钮。
  // 不直接灌最终字符串，这样录到的高亮标签、浮窗、输入框增高和发送状态都是产品本身的行为。
  let recordingDemoActive = false;
  const recordingWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const PROFILING_QUEUE_QUESTIONS = [
    '能把 rank6、rank7 多出来的 MatMulV2 定位到具体模型层吗？',
    '再对比 rank0 的 #{kernel_details.csv} 里的 MatMulV2，确认是否只在末级出现。',
  ];

  function dispatchRecordingInput(input) {
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) { /* 非文本控件时忽略 */ }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function typeRecordingText(input, text, ticket) {
    for (const ch of Array.from(text)) {
      if (ticket !== demoInputEpoch) return false;
      input.value += ch;
      dispatchRecordingInput(input);
      await recordingWait(ch === '\n' ? 75 : 21);
    }
    return ticket === demoInputEpoch;
  }

  // 队列追问里也可以带 #{文件名}：自动输入时真的敲出 #、打开并筛选浮窗、回车选中，
  // 最终由输入框自己的高亮层画成蓝色标签。没有标记的普通问题仍直接逐字输入。
  async function typeRecordingQuestion(input, template, ticket) {
    const match = template.match(/^([\s\S]*?)#\{([^}]+)\}([\s\S]*)$/);
    if (!match) return typeRecordingText(input, template, ticket);

    if (!await typeRecordingText(input, match[1], ticket)) return false;
    if (!await typeRecordingText(input, '#', ticket)) return false;
    await recordingWait(520); // 先让完整的上下文列表在录屏里露一拍
    if (!await typeRecordingText(input, match[2], ticket)) return false;
    await recordingWait(420); // 筛到唯一文件后再确认，让选择动作看得清
    if (ticket !== demoInputEpoch || !ctxPicker?.isOpen()) return false;
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
    }));
    await recordingWait(260);
    return typeRecordingText(input, match[3], ticket);
  }

  async function playProfilingQuestionRecording() {
    if (recordingDemoActive || chatStreaming) return;
    const triggeredAt = performance.now();
    const input = $('trainChatInput');
    const sendBtn = $('trainChatSendBtn');
    const msgEl = $('trainChatMessages');
    if (!input || !sendBtn || !msgEl || !ctxPicker) return;

    recordingDemoActive = true;
    try {
      // 允许从任意空闲画面触发：如果已有对话，先回到一张干净的新欢迎页。
      if (!msgEl.querySelector('.wzh-chat-welcome')) {
        resetConversation();
        await recordingWait(300);
      }
      const toggle = $('trainChatToggle');
      if (!isChatPanelOpen() && toggle) {
        toggle.click();
        await recordingWait(250);
      }

      const match = PROFILING_QUESTION.match(/^([\s\S]*?)#\{([^}]+)\}([\s\S]*)$/);
      if (!match) return;
      const ticket = ++demoInputEpoch;

      ctxPicker.close();
      input.value = '';
      input.style.height = '';
      dispatchRecordingInput(input);
      focusChatInput();

      // 从快捷键按下的时刻算满 0.5 秒，而不是页面复位结束后再额外等待。
      // 这样无论触发前在欢迎页还是已有对话，第一字都会在约第 0.5 秒出现。
      const countdownLeft = Math.max(0, 500 - (performance.now() - triggeredAt));
      await recordingWait(countdownLeft);
      if (ticket !== demoInputEpoch) return;

      if (!await typeRecordingText(input, match[1], ticket)) return;
      if (!await typeRecordingText(input, '#', ticket)) return;

      // 给录屏留足时间看清浮窗；首项就是整个 profile_dir 采集目录。
      await recordingWait(900);
      if (ticket !== demoInputEpoch) return;
      if (!ctxPicker.isOpen()) ctxPicker.refresh();
      if (!ctxPicker.isOpen()) return;
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
      }));

      await recordingWait(320);
      if (!await typeRecordingText(input, match[3], ticket)) return;
      await recordingWait(700);
      if (ticket !== demoInputEpoch) return;
      sendBtn.click();
    } finally {
      recordingDemoActive = false;
    }
  }

  // 主问题仍在思考或回答时，再按一次录屏快捷键：逐字输入两条单行追问，第一条发送后
  // 立刻开始敲第二条。发送走原本的 sendMessage → enqueueChatMessage 路径，因此录到的
  // 队列卡片、计数递增和后续自动消费都是真实产品行为，不是额外伪造的动画。
  async function playProfilingQueueRecording() {
    if (recordingDemoActive || !chatStreaming) return;
    const input = $('trainChatInput');
    const sendBtn = $('trainChatSendBtn');
    if (!input || !sendBtn) return;

    recordingDemoActive = true;
    const ticket = ++demoInputEpoch;
    try {
      ctxPicker?.close();
      input.value = '';
      input.style.height = '';
      dispatchRecordingInput(input);
      focusChatInput();

      for (const question of PROFILING_QUEUE_QUESTIONS) {
        if (!await typeRecordingQuestion(input, question, ticket)) return;
        await recordingWait(180);
        if (ticket !== demoInputEpoch) return;
        sendBtn.click();
        // 第一条落成队列卡片后多停一秒，让队列卡片和计数变化在录屏里被看清。
        await recordingWait(1240);
      }
    } finally {
      recordingDemoActive = false;
    }
  }

  function initInput() {
    const input = $('trainChatInput');
    const sendBtn = $('trainChatSendBtn');
    const cleanBtn = $('trainChatCleanBtn');
    if (!input || !sendBtn) return;
    const inputWrap = input.closest('.wzh-chat-input-wrap');
    let operatorTooltip = $('trainChatOperatorTooltip');
    if (!operatorTooltip && inputWrap) {
      operatorTooltip = document.createElement('div');
      operatorTooltip.id = 'trainChatOperatorTooltip';
      operatorTooltip.className = 'wzh-chat-operator-tooltip';
      operatorTooltip.setAttribute('role', 'tooltip');
      operatorTooltip.hidden = true;
      inputWrap.appendChild(operatorTooltip);
    }
    const inputBar = input.closest('.wzh-chat-input-bar');
    const hideOperatorTooltip = () => {
      if (operatorTooltip) operatorTooltip.hidden = true;
      inputBar?.classList.remove('has-operator-tooltip');
    };
    let lastPointerPressFxAt = -Infinity;
    let sendPressFxTimer = 0;

    function playSendPressFx(clientX, clientY) {
      // 停止回答是另一种语义，保留它原本克制的灰色反馈；只有真正的「发送」播放 AI 渐变。
      if (sendBtn.disabled || sendBtn.classList.contains('is-stop')) return;
      const rect = sendBtn.getBoundingClientRect();
      const hasPoint = Number.isFinite(clientX) && Number.isFinite(clientY) && (clientX || clientY);
      const x = hasPoint ? Math.max(0, Math.min(rect.width, clientX - rect.left)) : rect.width / 2;
      const y = hasPoint ? Math.max(0, Math.min(rect.height, clientY - rect.top)) : rect.height / 2;
      sendBtn.style.setProperty('--wzh-send-press-x', x + 'px');
      sendBtn.style.setProperty('--wzh-send-press-y', y + 'px');
      sendBtn.classList.remove('is-press-fx');
      void sendBtn.offsetWidth; // 连续快速发送时也要从头重播
      sendBtn.classList.add('is-press-fx');
      clearTimeout(sendPressFxTimer);
      sendPressFxTimer = setTimeout(() => sendBtn.classList.remove('is-press-fx'), 500);
    }

    // 鼠标/触控在按下瞬间起波纹；键盘触发和录屏脚本的 .click() 没有坐标，改从圆心扩散。
    sendBtn.addEventListener('pointerdown', (e) => {
      lastPointerPressFxAt = performance.now();
      playSendPressFx(e.clientX, e.clientY);
    });
    cleanBtn?.addEventListener('click', () => {
      ctxPicker?.close();
      codeFilePicker?.close();
      commandPicker?.close();
      pendingGuideScenario = '';
      queuedEditContext = null;
      input.value = '';
      input.style.height = '';
      input.scrollTop = 0;
      autoResizeInput();
      syncSendState();
      input.focus();
    });
    function doSend() {
      const text = input.value.trim();
      if (!text) return;
      const scenario = pendingGuideScenario;
      const context = queuedEditContext || captureComposerContext();
      pendingGuideScenario = '';
      queuedEditContext = null;
      ctxPicker?.close();
      codeFilePicker?.close();
      commandPicker?.close();
      input.value = '';
      input.style.height = '';
      autoResizeInput();
      syncSendState();
      sendMessage(text, scenario, { context });
    }
    sendBtn.addEventListener('click', () => {
      if (performance.now() - lastPointerPressFxAt > 800) playSendPressFx();
      // 空输入时按当前轮状态停止或继续；有输入时发送(回答中发送 = 排队)
      if (sendBtn.classList.contains('is-stop')) { stopAnswering(); return; }
      if (sendBtn.classList.contains('is-resume')) { stoppedRound?.resume(); return; }
      doSend();
    });
    input.addEventListener('keydown', (e) => {
      if (ctxPicker && ctxPicker.onKeyDown(e)) return; // 选择框开着时,上下键/回车/Esc 归它
      if (codeFilePicker && codeFilePicker.onKeyDown(e)) return;
      if (commandPicker && commandPicker.onKeyDown(e)) return;
      if (deleteComposerChip(input, e)) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    input.addEventListener('input', () => {
      hideOperatorTooltip();
      chatInputTyped = true; // 见 syncInputFlow:框里一动字,描边流光就停
      autoSpaceBeforeHash(input);
      if ($('trainChatLocalCodePath')?.value) autoSpaceBeforeTrigger(input, '@');
      autoSpaceBeforeTrigger(input, '/');
      autoResizeInput();
      syncSendState();
      ctxPicker?.refresh();
      codeFilePicker?.refresh();
      commandPicker?.refresh();
    });
    // 超过 6 行后 textarea 内部滚动,高亮层要跟着滚,否则两层立刻错位
    input.addEventListener('scroll', () => {
      hideOperatorTooltip();
      const hl = $('trainChatInputHl');
      if (hl) hl.scrollTop = input.scrollTop;
    }, { passive: true });
    input.addEventListener('mousemove', (event) => {
      const hl = $('trainChatInputHl');
      if (!hl || !operatorTooltip) return;
      let hit = null;
      for (const span of hl.querySelectorAll('[data-operator-chip-start]')) {
        if ([...span.getClientRects()].some((rect) => event.clientX >= rect.left &&
          event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) {
          hit = span;
          break;
        }
      }
      const chip = hit && composerChips.find((item) =>
        item.start === Number(hit.dataset.operatorChipStart));
      if (!chip?.title) { hideOperatorTooltip(); return; }
      operatorTooltip.textContent = chip.title;
      operatorTooltip.hidden = false;
      inputBar?.classList.add('has-operator-tooltip');
      const left = hit.getBoundingClientRect().left - inputWrap.getBoundingClientRect().left;
      operatorTooltip.style.left = Math.max(0, Math.min(left,
        inputWrap.clientWidth - operatorTooltip.offsetWidth)) + 'px';
    });
    input.addEventListener('mouseleave', hideOperatorTooltip);
    ctxPicker = initCtxPicker();
    codeFilePicker = initCodeFilePicker();
    commandPicker = initCommandPicker();
    autoResizeInput();
    syncSendState(); // 初始空输入 => 发送按钮置灰
    document.addEventListener('keydown', (e) => {
      const isRecordingShortcut = e.key === 'Enter' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
      if (!isRecordingShortcut || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      if (chatStreaming) playProfilingQueueRecording();
      else playProfilingQuestionRecording();
    });
    // 首屏补两次校准:图片/样式全部就绪后一次、字体真正换上之后一次。
    // boot 跑在 DOMContentLoaded,那一刻量到的行高不一定是最终值。
    window.addEventListener('load', () => autoResizeInput(), { once: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => autoResizeInput()).catch(() => {});
    }

    // 输入框常驻可输入态(光标一直在闪):面板里点到空白处不让焦点挪走,直接还给输入框。
    // 点按钮/链接/其它输入控件时放行,不影响正常交互。
    const panel = $('trainChatPanel');
    panel?.addEventListener('mousedown', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('button, a, input, textarea, select, [contenteditable]')) return;
      if (t.closest('.wzh-chat-messages')) return; // 消息区放行,答案要能正常选中复制
      e.preventDefault();
      focusChatInput();
    });
    window.addEventListener('focus', () => focusChatInput());

    // 面板开着时,焦点无论落在建议按钮还是消息区,敲可见字符都直接进输入框(回答期间同样放行)。
    // 这里只抢焦点、不 preventDefault——keydown 阶段换焦点后,这个字符本身会落到新的焦点上,
    // 首字母不会丢。功能键(Tab/Esc/方向键,key.length>1)和带修饰键的快捷键一律放行。
    document.addEventListener('keydown', (e) => {
      if (!isChatPanelOpen()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!e.key || e.key.length !== 1) return;
      const t = e.target;
      if (!t || t === input) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      focusChatInput();
    });
  }

  // 悬浮窗按钮:在默认的「挤入式」(占一列,挤窄内容区)和「浮动抽屉」(浮在右侧,不占宽度)之间切换。
  // 只加/去一个 .is-floating 类,开关状态(.is-open)不受影响。
  function initFloatMode() {
    const btn = $('trainChatFloatBtn');
    const panel = $('trainChatPanel');
    if (!btn || !panel) return;
    function apply(floating) {
      panel.classList.toggle('is-floating', floating);
      btn.classList.toggle('is-active', floating);
      btn.setAttribute('aria-pressed', String(floating));
      btn.title = floating ? '退出悬浮窗' : '悬浮窗口';
      btn.setAttribute('aria-label', btn.title);
    }
    apply(false); // 默认挤入式
    btn.addEventListener('click', () => apply(!panel.classList.contains('is-floating')));
  }

  function initHistoryMenu() {
    const wrap = $('trainChatHistoryWrap');
    const btn = $('trainChatHistoryBtn');
    const pop = $('trainChatHistoryPop');
    const panel = $('trainChatPanel');
    if (!wrap || !btn || !pop) return;

    function syncPopWidth() {
      if (!panel) return;
      pop.style.width = Math.max(180, Math.min(300, panel.clientWidth - 24)) + 'px';
    }

    function closePop() {
      if (pop.hidden) return;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    function openPop() {
      syncPopWidth();
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', () => {
      pop.hidden ? openPop() : closePop();
    });
    pop.addEventListener('click', (event) => {
      const item = event.target.closest('.wzh-chat-history-item[data-chat-history]');
      if (!item) return;
      closePop();
      restoreConstructedHistory(item.dataset.chatHistory);
    });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !wrap.contains(e.target)) closePop();
    }, { capture: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) {
        e.preventDefault();
        e.stopPropagation();
        closePop();
        btn.focus();
      }
    });
    if (panel && typeof ResizeObserver === 'function') {
      new ResizeObserver(() => { if (!pop.hidden) syncPopWidth(); }).observe(panel);
    }
  }

  // ── 切换 Agent(还原稿 src/pic/切换.png) ──────────────────────────────────
  // 这里只是原型:切换后同步左上角的头像/名称和底部工具栏的模型名,不真的换后端。
  // 名单和各自默认模型都放在这个数组里,加一个 Agent 就往里加一条。
  // models:该 Agent 底下可选的型号,数组第一条即默认值(切 Agent 时自动落到它上面)。
  // 原型里是写死的名单,真接后端时换成各家的模型列表接口。
  const CHAT_AGENTS = [
    { id: 'insight',  name: 'MS Insight Native', icon: 'msinsightbotAvatar.png',
      models: ['MS Insight Native-v4', 'MS Insight Native-v3.5', 'MS Insight Native-v3', 'MS Insight Native-v2-lite'] },
    { id: 'pangu',    name: 'Pangu',             icon: 'pangu-16.svg',
      models: ['Pangu-5.5', 'Pangu-5.0', 'Pangu-Ultra-MoE', 'Pangu-Pro-MoE-72B', 'Pangu-Embedded-7B'] },
    { id: 'deepseek', name: 'DeepSeek',          icon: 'deepseek-32.svg',
      models: ['DeepSeek-V3.2', 'DeepSeek-V3.1', 'DeepSeek-R1', 'DeepSeek-V3', 'DeepSeek-Coder-V2'] },
    { id: 'glm',      name: 'GLM',               icon: 'glm.svg',
      models: ['GLM-4.7', 'GLM-4.6', 'GLM-4.5-Air', 'GLM-4-Plus', 'GLM-Z1-Air'] },
    { id: 'codex',    name: 'Codex',             icon: 'codex.svg',
      models: ['GPT-5.2', 'GPT-5.1', 'GPT-5', 'o4-mini', 'GPT-4.1'] },
    { id: 'claude',   name: 'Claude',            icon: 'claude-32.svg',
      models: ['Claude-Opus-4.5', 'Claude-Sonnet-4.5', 'Claude-Haiku-4.5', 'Claude-Opus-4.1', 'Claude-Sonnet-3.7'] },
  ];
  let currentAgentId = CHAT_AGENTS[0].id;
  let currentModel = CHAT_AGENTS[0].models[0];

  function currentAgent() {
    return CHAT_AGENTS.find((a) => a.id === currentAgentId) || CHAT_AGENTS[0];
  }
  // 把当前 Agent 的头像/名称刷到面板各处。欢迎屏是 innerHTML 重建出来的(WELCOME_HTML 里
  // 写死的是默认头像),所以 resetConversation 之后要再调一次,别切完 Agent 一开新对话就打回原形。
  function applyAgentIdentity() {
    const cur = currentAgent();
    const src = '../../src/pic/icon/' + cur.icon;
    const logoEl = $('trainChatAgentLogo');
    const nameEl = $('trainChatAgentName');
    if (logoEl) { logoEl.src = src; logoEl.dataset.icon = cur.icon; }
    if (nameEl) nameEl.textContent = cur.name;
    document.querySelectorAll('.wzh-chat-welcome-logo').forEach((el) => { el.src = src; });
    applyModelName();
  }

  // 底部工具栏那颗按钮上显示的型号(图标沿用 model.svg)。切 Agent、切模型都走这里。
  function applyModelName() {
    const modelBtn = $('trainChatModelBtn');
    if (!modelBtn) return;
    const textNode = [...modelBtn.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = currentModel;
    modelBtn.title = '切换模型（当前 ' + currentModel + '）';
  }

  // ── 切换模型 ────────────────────────────────────────────────────────────
  // 底部工具栏那颗模型按钮点开的弹层,列的是当前 Agent 的 models。切完不立刻打断
  // 已经在跑的这一轮,只在对话里划一道波浪线:线以上是旧模型答的,线以下才是新模型。
  let pendingModelNote = '';      // 还停在欢迎屏时先攒着,等第一个问题落地再插
  let streamingNote = null;       // 回答期间切模型留下的那道"预告"标记
  let streamingNoteFrom = '';     // 这一轮正在用的型号:切回它就等于没换,把预告撤掉

  // 波浪线标记本体。插在消息流里当分隔符,不属于任何一轮问答。
  // pending=true 时文案是「回答完后切换模型：X」——这一轮答案还是旧模型出的,
  // 写成「已切换」会让人以为回答途中就换过去了。答完由 resolveStreamingNote 改口。
  function appendModelSwitchNote(model, pending) {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return null;
    const note = document.createElement('div');
    note.className = 'wzh-chat-switch-note';
    note.innerHTML =
      '<span class="wzh-chat-switch-note-wave"></span>' +
      '<span class="wzh-chat-switch-note-text"></span>' +
      '<span class="wzh-chat-switch-note-wave"></span>';
    msgEl.appendChild(note);
    setModelSwitchNoteText(note, model, pending);
    scrollChatToBottom(msgEl, { onlyIfNearBottom: true });
    return note;
  }

  function setModelSwitchNoteText(note, model, pending) {
    note.dataset.model = model;
    note.classList.toggle('is-pending', !!pending);
    note.querySelector('.wzh-chat-switch-note-text').textContent =
      (pending ? '回答完后切换模型：' : '已切换模型：') + model;
  }

  // model 是切过去的型号,from 是切之前那个(用来判断"又切回来了")
  function noteModelSwitch(model, from) {
    const msgEl = $('trainChatMessages');
    if (!msgEl) return;

    // 回答进行中:这一轮不可能中途换模型,只留一条预告,答完再改口成「已切换」
    if (chatStreaming) {
      if (streamingNote && streamingNote.isConnected) {
        // 连着改了几次,复用同一条;要是绕回这一轮正在用的型号,等于没换过,撤掉
        if (model === streamingNoteFrom) {
          streamingNote.remove();
          streamingNote = null;
          streamingNoteFrom = '';
          return;
        }
        setModelSwitchNoteText(streamingNote, model, true);
        return;
      }
      streamingNoteFrom = from;
      streamingNote = appendModelSwitchNote(model, true);
      return;
    }

    // 欢迎屏上还没有任何对话,这时候插分隔线是没头没尾的一道——攒到第一个问题再说
    if (!msgEl.querySelector('.wzh-chat-welcome')) appendModelSwitchNote(model, false);
    else pendingModelNote = model;
  }

  // 这一轮(含被用户中断的)收尾时调用:预告兑现,文案改成「已切换模型」
  function resolveStreamingNote() {
    if (!streamingNote) return;
    if (streamingNote.isConnected) {
      setModelSwitchNoteText(streamingNote, streamingNote.dataset.model || currentModel, false);
    }
    streamingNote = null;
    streamingNoteFrom = '';
  }

  function flushPendingModelNote() {
    if (!pendingModelNote) return;
    const model = pendingModelNote;
    pendingModelNote = '';
    appendModelSwitchNote(model);
  }

  // 模式与模型共用输入栏上方的空间,任何时刻只保留一个浮窗。
  function closeOtherComposerSelect(activePopId) {
    [
      ['trainChatModePop', 'trainChatModeBtn'],
      ['trainChatModelPop', 'trainChatModelBtn'],
    ].forEach(([popId, btnId]) => {
      if (popId === activePopId) return;
      const otherPop = $(popId);
      const otherBtn = $(btnId);
      if (otherPop) otherPop.hidden = true;
      otherBtn?.setAttribute('aria-expanded', 'false');
    });
  }

  function initModelSwitch() {
    const btn = $('trainChatModelBtn');
    const pop = $('trainChatModelPop');
    const list = $('trainChatModelList');
    if (!btn || !pop || !list) return;

    // 每次打开都按当前 Agent 重建:Agent 换了,能选的型号也换了
    function renderModelList() {
      const models = currentAgent().models || [];
      list.innerHTML = models.map(() =>
        '<button class="wzh-chat-agent-item" type="button" role="option">' +
          '<span class="wzh-chat-agent-item-name"></span>' +
          '<svg class="wzh-chat-agent-check" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="m5 12.5 4.5 4.5L19 7.5"></path>' +
          '</svg>' +
        '</button>'
      ).join('');
      models.forEach((m, i) => {
        const item = list.children[i];
        item.dataset.model = m;               // 型号名走 dataset/textContent,不拼进 HTML
        item.title = m;
        item.querySelector('.wzh-chat-agent-item-name').textContent = m;
        const on = m === currentModel;
        item.classList.toggle('is-current', on);
        item.setAttribute('aria-selected', String(on));
      });
    }

    const bar = pop.closest('.wzh-chat-input-bar');
    function closePop() {
      if (pop.hidden) return;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      bar?.classList.remove('is-pop-open');
    }
    function openPop() {
      closeOtherComposerSelect('trainChatModelPop');
      renderModelList();
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      bar?.classList.add('is-pop-open'); // 抬到「回到底部」之上,见 .is-pop-open
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden ? openPop() : closePop();
    });
    list.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('.wzh-chat-agent-item');
      if (!item) return;
      const model = item.dataset.model;
      closePop();
      if (!model || model === currentModel) { focusChatInput(); return; } // 点的还是当前型号:不留标记
      const from = currentModel;
      currentModel = model;
      applyModelName();
      noteModelSwitch(model, from);
      focusChatInput();
    });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target)) closePop();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) { closePop(); btn.focus(); }
    });

    applyModelName();
  }

  // ── 切换模式 ────────────────────────────────────────────────────────────
  // 与模型选择保持相同的弹层、选中态与关闭方式。模式只影响后续对话的工作方式,
  // 原型阶段先维护前端状态,接入后端时可直接读取 currentChatMode。
  const CHAT_MODES = ['Build', 'Plan'];
  let currentChatMode = CHAT_MODES[0];

  function initModeSwitch() {
    const btn = $('trainChatModeBtn');
    const name = $('trainChatModeName');
    const pop = $('trainChatModePop');
    const list = $('trainChatModeList');
    if (!btn || !name || !pop || !list) return;

    function syncModeUI() {
      name.textContent = currentChatMode;
      btn.title = '切换模式（当前 ' + currentChatMode + '）';
      Array.from(list.children).forEach((item) => {
        const on = item.dataset.mode === currentChatMode;
        item.classList.toggle('is-current', on);
        item.setAttribute('aria-selected', String(on));
      });
    }

    list.innerHTML = CHAT_MODES.map((mode) =>
      '<button class="wzh-chat-agent-item" type="button" role="option" data-mode="' + mode + '">' +
        '<span class="wzh-chat-agent-item-name">' + mode + '</span>' +
        '<svg class="wzh-chat-agent-check" viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="m5 12.5 4.5 4.5L19 7.5"></path>' +
        '</svg>' +
      '</button>'
    ).join('');

    const bar = pop.closest('.wzh-chat-input-bar');
    function closePop() {
      if (pop.hidden) return;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      bar?.classList.remove('is-pop-open');
    }
    function openPop() {
      closeOtherComposerSelect('trainChatModePop');
      syncModeUI();
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      bar?.classList.add('is-pop-open');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden ? openPop() : closePop();
    });
    list.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('.wzh-chat-agent-item');
      if (!item) return;
      currentChatMode = item.dataset.mode || currentChatMode;
      syncModeUI();
      closePop();
      focusChatInput();
    });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target)) closePop();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) { closePop(); btn.focus(); }
    });

    syncModeUI();
  }

  function initAgentSwitch() {
    const btn = $('trainChatAgentBtn');
    const pop = $('trainChatAgentPop');
    const list = $('trainChatAgentList');
    if (!btn || !pop || !list) return;

    // 按 CHAT_AGENTS 重建列表。单拎出来是为了「刷新」能复用——原型里名单是写死的,
    // 真接后端时这里换成拉一次 Agent 列表即可,弹层其余逻辑不用动。
    function renderAgentList() {
      list.innerHTML = CHAT_AGENTS.map((a) =>
        '<button class="wzh-chat-agent-item" type="button" role="option" data-agent="' + a.id + '">' +
          '<img src="../../src/pic/icon/' + a.icon + '" data-icon="' + a.icon + '" alt="">' +
          '<span class="wzh-chat-agent-item-name"></span>' +
          '<svg class="wzh-chat-agent-check" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="m5 12.5 4.5 4.5L19 7.5"></path>' +
          '</svg>' +
        '</button>'
      ).join('');
      // 名字走 textContent,不让 CHAT_AGENTS 里的字符串当 HTML 解析
      CHAT_AGENTS.forEach((a, i) => {
        const item = list.children[i];
        item.querySelector('.wzh-chat-agent-item-name').textContent = a.name;
        item.title = a.name;
      });
    }
    renderAgentList();

    function syncAgentUI() {
      applyAgentIdentity();
      Array.from(list.children).forEach((item) => {
        const on = item.dataset.agent === currentAgentId;
        item.classList.toggle('is-current', on);
        item.setAttribute('aria-selected', String(on));
      });
    }

    function closePop() {
      if (pop.hidden) return;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    function openPop() {
      syncAgentUI();
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden ? openPop() : closePop();
    });
    list.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('.wzh-chat-agent-item');
      if (!item) return;
      currentAgentId = item.dataset.agent;
      currentModel = currentAgent().models[0]; // 换了 Agent,型号跟着落回它自己的默认值
      syncAgentUI();
      closePop();
      focusChatInput();
    });
    // 刷新:重新拉一遍 Agent 名单(原型里就是按 CHAT_AGENTS 重建),弹层不关——
    // 用户点刷新是想接着在这张列表里挑,关掉再点开反而多一步。
    const refreshBtn = $('trainChatAgentRefreshBtn');
    refreshBtn?.addEventListener('click', () => {
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      renderAgentList();
      syncAgentUI();
      setTimeout(() => { refreshBtn.disabled = false; }, 400); // 给一点"确实刷过了"的反馈时长
    });
    // 原型里「添加 Agent」还没有落地页,先只把弹层收起来
    $('trainChatAgentAddBtn')?.addEventListener('click', closePop);
    // 点空白 / Esc 关闭;弹层内部的点击在上面已经 stopPropagation 之外由这里放行
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target)) closePop();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) { closePop(); btn.focus(); }
    });

    syncAgentUI();
  }

  function initAnchorChip() {
    const nameEl = $('trainChatAnchorName');
    const contextChips = $('trainChatContextChips');
    const contextGroup = $('trainChatContextGroup');
    const anchorChip = $('trainChatAnchorChip');
    const codeContext = $('trainChatCodeContext');
    const codeAddBtn = $('trainChatCodeAddBtn');
    const codeChip = $('trainChatCodeChip');
    const codePath = $('trainChatCodePath');
    const localCodePath = $('trainChatLocalCodePath');
    const defaultCodePath = codePath?.dataset.fullPath || '';
    const codeBindings = new Map();
    let currentTaskName = window.MSI_ANCHOR_NAME || CHAT_TASK_NAME;
    const syncContextChips = () => {
      const empty = !!anchorChip?.hidden && !!codeContext?.hidden;
      if (contextGroup) contextGroup.hidden = empty;
      if (contextChips) contextChips.hidden = empty;
    };
    const codePopover = document.createElement('div');
    codePopover.className = 'wzh-chat-code-popover';
    codePopover.id = 'trainChatCodePopover';
    codePopover.setAttribute('role', 'group');
    codePopover.setAttribute('aria-label', '已绑定项目目录');
    codePopover.hidden = true;
    const popoverPath = document.createElement('span');
    popoverPath.className = 'wzh-chat-code-popover-path';
    const openDirectory = document.createElement('a');
    openDirectory.className = 'wzh-chat-code-popover-open';
    openDirectory.textContent = '打开目录';
    openDirectory.target = '_blank';
    openDirectory.rel = 'noopener noreferrer';
    codePopover.append(popoverPath, openDirectory);
    document.body.append(codePopover);
    let hideCodePopoverTimer;
    const hideCodePopover = () => { codePopover.hidden = true; };
    const scheduleHideCodePopover = () => {
      clearTimeout(hideCodePopoverTimer);
      hideCodePopoverTimer = setTimeout(hideCodePopover, 120);
    };
    const positionCodePopover = () => {
      if (codePopover.hidden || !codeChip) return;
      const rect = codeChip.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - codePopover.offsetWidth - 8));
      const above = rect.top - codePopover.offsetHeight - 8;
      codePopover.style.left = left + 'px';
      codePopover.style.top = (above >= 8 ? above : rect.bottom + 8) + 'px';
    };
    const showCodePopover = () => {
      if (!codePath || !codeChip || codeChip.hidden) return;
      clearTimeout(hideCodePopoverTimer);
      const fullPath = codePath.dataset.fullPath || '';
      popoverPath.textContent = fullPath;
      openDirectory.href = 'file:///' + fullPath.replace(/\\/g, '/');
      codePopover.hidden = false;
      positionCodePopover();
    };
    codeChip?.addEventListener('mouseenter', showCodePopover);
    codeChip?.addEventListener('mouseleave', scheduleHideCodePopover);
    codeChip?.addEventListener('focusin', showCodePopover);
    codeChip?.addEventListener('focusout', scheduleHideCodePopover);
    $('trainChatInput')?.addEventListener('focus', hideCodePopover);
    codePopover.addEventListener('mouseenter', () => clearTimeout(hideCodePopoverTimer));
    codePopover.addEventListener('mouseleave', scheduleHideCodePopover);
    codePopover.addEventListener('focusin', () => clearTimeout(hideCodePopoverTimer));
    codePopover.addEventListener('focusout', scheduleHideCodePopover);
    window.addEventListener('resize', positionCodePopover);
    window.addEventListener('scroll', positionCodePopover, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideCodePopover();
    });
    const syncCodeBinding = () => {
      const boundPath = codeBindings.get(currentTaskName) || '';
      if (codeAddBtn) codeAddBtn.hidden = !!boundPath;
      if (codeChip) {
        codeChip.hidden = !boundPath;
        if (!boundPath) hideCodePopover();
      }
      if (codePath) {
        codePath.dataset.fullPath = boundPath || defaultCodePath;
        codePath.textContent = boundPath.split(/[\\/]/).filter(Boolean).pop() || '';
      }
      codeContext?.classList.toggle('is-bound', !!boundPath);
      if (localCodePath) localCodePath.value = boundPath;
      syncCodeInputPlaceholder();
    };
    restoreChatContext = (taskName = window.MSI_ANCHOR_NAME || CHAT_TASK_NAME) => {
      currentTaskName = taskName;
      if (nameEl) nameEl.textContent = taskName;
      if (anchorChip) anchorChip.hidden = false;
      if (codeContext) codeContext.hidden = false;
      syncCodeBinding();
      syncContextChips();
    };
    window.addEventListener('msi:task-selected', (event) => restoreChatContext(event.detail?.taskName));
    codeAddBtn?.addEventListener('click', () => {
      codeBindings.set(currentTaskName, defaultCodePath);
      syncCodeBinding();
      syncContextChips();
    });
    // 任务锚点可移除；代码路径关闭后回到添加入口。
    $('trainChatAnchorCloseBtn')?.addEventListener('click', () => {
      if (anchorChip) anchorChip.hidden = true;
      syncContextChips();
      focusChatInput();
    });
    $('trainChatCodeCloseBtn')?.addEventListener('click', () => {
      codeBindings.delete(currentTaskName);
      syncCodeBinding();
      syncContextChips();
      codeAddBtn?.focus({ preventScroll: true });
    });
    restoreChatContext();
  }

  function boot() {
    // 回答进行中时 Esc 优先用于中止回答，避免同一次按键继续冒泡后又关闭面板或弹窗。
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !chatStreaming || chatStopped) return;
      e.preventDefault();
      e.stopPropagation();
      stopAnswering();
    }, { capture: true });
    initPanelToggle();
    initFloatMode();
    initHistoryMenu();
    initInput();
    initChatQueue();
    initAnchorChip();
    initAgentSwitch();
    initModeSwitch();
    initModelSwitch();
    const msgEl = $('trainChatMessages');
    msgEl?.addEventListener('scroll', () => scheduleFadeUpdate(), { passive: true });
    // 只认这几种"确实是用户自己动的"操作,程序化的 scrollTo 不会触发它们,
    // 所以不需要再去区分某次 scroll 事件是谁发起的。
    const syncStickAfterUserScroll = () => {
      requestAnimationFrame(() => {
        if (msgEl && isNearBottom(msgEl)) stickToBottom = true;
      });
    };
    msgEl?.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) stickToBottom = false;
      else if (e.deltaY > 0) syncStickAfterUserScroll();
    }, { passive: true });
    let lastTouchY = null;
    let touchMovedTowardBottom = false;
    msgEl?.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0]?.clientY ?? null;
      touchMovedTowardBottom = false;
    }, { passive: true });
    msgEl?.addEventListener('touchmove', (e) => {
      const y = e.touches[0]?.clientY;
      if (y == null || lastTouchY == null) return;
      if (y > lastTouchY) {
        stickToBottom = false;
        touchMovedTowardBottom = false;
      } else if (y < lastTouchY) {
        touchMovedTowardBottom = true;
        syncStickAfterUserScroll();
      }
      lastTouchY = y;
    }, { passive: true });
    msgEl?.addEventListener('touchend', () => {
      if (touchMovedTowardBottom) syncStickAfterUserScroll();
      lastTouchY = null;
      touchMovedTowardBottom = false;
    }, { passive: true });
    msgEl?.addEventListener('keydown', (e) => {
      if (/^(ArrowUp|PageUp|Home)$/.test(e.key)) stickToBottom = false;
      else if (/^(ArrowDown|PageDown|End)$/.test(e.key)) syncStickAfterUserScroll();
    });
    // 拖滚动条:按下点落在内容宽度之外就是滚动条那一条
    msgEl?.addEventListener('mousedown', (e) => {
      if (e.offsetX <= msgEl.clientWidth) return;
      stickToBottom = false;
      const finishScrollbarDrag = () => {
        syncStickAfterUserScroll();
        window.removeEventListener('mouseup', finishScrollbarDrag);
      };
      window.addEventListener('mouseup', finishScrollbarDrag);
    });
    $('trainChatJumpBtn')?.addEventListener('click', () => {
      stickToBottom = true;
      scrollChatToBottom(msgEl);
    });
    // 引导卡:点一下只是把提问填进输入框并点亮发送键,发不发、要不要改由用户决定。
    // 事件委托挂在消息区上,新建对话重建欢迎屏后依然生效。
    $('trainChatMessages')?.addEventListener('click', (e) => {
      const card = e.target.closest && e.target.closest('.wzh-chat-guide-card[data-prompt]');
      if (!card) return;
      const input = $('trainChatInput');
      if (!input) return;
      // 带场景标记的卡片填入自己的专业问法；其余诊断卡片继续填入 Profiling 演示问题。
      // 输入框里没有 chip 这种富文本,把 #{xxx} 还原成用户自己会敲的 #xxx。
      pendingGuideScenario = card.dataset.scenario || '';
      queuedEditContext = null;
      const prompt = pendingGuideScenario ? card.dataset.prompt : PROFILING_QUESTION;
      input.value = prompt.replace(/#\{([^}]+)\}/g, CHIP_GAP + HASH_SP + '$1' + CHIP_GAP).trim();
      autoResizeInput();
      syncSendState();
      focusChatInput();
    });
    // 回答里的信息可视化卡片 → 面板覆盖展开为双栏，右栏加载 v15 对应模块。
    $('trainChatMessages')?.addEventListener('click', (e) => {
      const card = e.target.closest && e.target.closest('.wzh-chat-viz-card[data-viz-module]');
      if (!card) return;
      openChatVisualization(card.dataset.vizModule, card.dataset.vizTitle, card);
    });
    // 回答里的定位锚点 → 泳道图跳到对应那一行。同样用事件委托:回答是打字机逐段插进来的,
    // 锚点渲染出来的时候这里早就绑好了。
    $('trainChatMessages')?.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-locate[data-lane]');
      if (!btn) return;
      const ok = typeof window.WZH_LOCATE_LANE === 'function' && window.WZH_LOCATE_LANE(btn.dataset.lane);
      if (!ok) return;
      // 图那边闪选中行,锚点这边也闪一下:两处同时亮,才看得出这是一次联动而不是各闪各的
      btn.classList.remove('is-hit');
      void btn.offsetWidth;
      btn.classList.add('is-hit');
    });
    // 代码块右上角的复制键。和上面两处一样走委托:按钮是随回答重渲染反复重建的。
    $('trainChatMessages')?.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.wzh-chat-copy');
      if (!btn) return;
      const code = btn.parentElement && btn.parentElement.querySelector('code');
      if (!code) return;
      copyText(code.textContent).then((ok) => {
        if (!ok) return;
        btn.classList.add('is-done');
        btn.innerHTML = COPY_DONE_ICON;
        btn.title = '已复制';
        clearTimeout(btn._copyTimer);
        btn._copyTimer = setTimeout(() => {
          btn.classList.remove('is-done');
          btn.innerHTML = COPY_ICON;
          btn.title = '复制';
        }, 1600);
      });
    });
    $('trainChatNewBtn')?.addEventListener('click', resetConversation);
    $('trainChatVizCloseBtn')?.addEventListener('click', () => closeChatVisualization());
    initSessionTitle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

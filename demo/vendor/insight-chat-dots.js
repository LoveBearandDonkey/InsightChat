/* Welcome dot animation copied from InsightChat app/assistant.js.
   Theme observer targets the client rather than the outer IDE document. */
(() => {
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
    themeObs.observe(canvas.closest('.agent-client'), { attributes: true, attributeFilter: ['data-theme', 'data-brand'] });

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

window.MS_INSIGHT_CHAT_DOTS=Object.freeze({create:createWelcomeDots});
})();

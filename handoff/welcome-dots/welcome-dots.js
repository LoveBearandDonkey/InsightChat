(function (global) {
  'use strict';

  const DEFAULTS = Object.freeze({
    gap: 10,
    radius: 2,
    rippleDurationMs: 1500,
    rippleBand: 90,
    hoverRadius: 130,
    hoverEase: 0.12,
    ellipseRadiusX: 0.52,
    ellipseRadiusY: 0.42,
    baseColor: [99, 102, 241],
    hotColor: [123, 37, 244],
    alpha: 0.08,
    maxDpr: 2,
  });

  function parseRgbTriplet(raw, fallback) {
    const values = String(raw || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    return values.length >= 3 ? values.slice(0, 3) : fallback;
  }

  function create(canvas, options) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('WelcomeDots.create(canvas): canvas 必须是 HTMLCanvasElement');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前环境不支持 Canvas 2D');

    const config = Object.assign({}, DEFAULTS, options || {});
    const hitArea = config.hitArea || canvas.parentElement;
    const reducedMotionQuery = global.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = global.matchMedia('(hover: hover)');
    const state = {
      dots: [],
      width: 0,
      height: 0,
      maxDistance: 1,
      baseColor: config.baseColor.slice(),
      hotColor: config.hotColor.slice(),
      alpha: config.alpha,
      rippleStart: 0,
      hover: 0,
      hoverTarget: 0,
      pointerX: 0,
      pointerY: 0,
      raf: 0,
      pointerMoved: false,
      destroyed: false,
    };

    function readCssTheme() {
      const style = getComputedStyle(canvas);
      state.baseColor = parseRgbTriplet(
        style.getPropertyValue('--welcome-dots-rgb'),
        config.baseColor
      );
      state.hotColor = parseRgbTriplet(
        style.getPropertyValue('--welcome-dots-hot-rgb'),
        config.hotColor
      );
      const alpha = parseFloat(style.getPropertyValue('--welcome-dots-alpha'));
      state.alpha = Number.isFinite(alpha) ? alpha : config.alpha;
    }

    function build() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (!width || !height) {
        state.dots = [];
        return false;
      }

      const dpr = Math.min(global.devicePixelRatio || 1, config.maxDpr);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.width = width;
      state.height = height;

      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = width * config.ellipseRadiusX;
      const radiusY = height * config.ellipseRadiusY;
      const dots = [];

      for (let y = (height % config.gap) / 2; y < height; y += config.gap) {
        for (let x = (width % config.gap) / 2; x < width; x += config.gap) {
          const nx = (x - centerX) / radiusX;
          const ny = (y - centerY) / radiusY;
          const normalizedDistance = Math.hypot(nx, ny);
          if (normalizedDistance >= 1) continue;

          const edgeFade = Math.pow(1 - normalizedDistance, 2);
          const textureNoise = 0.72 + Math.random() * 0.28;
          dots.push({
            x,
            y,
            baseAlpha: edgeFade * textureNoise,
            centerDistance: Math.hypot(x - centerX, y - centerY),
            light: 0,
          });
        }
      }

      state.dots = dots;
      state.maxDistance = Math.hypot(radiusX, radiusY);
      return true;
    }

    function draw(now) {
      const dots = state.dots;
      ctx.clearRect(0, 0, state.width, state.height);
      if (!dots.length) return;

      let waveRadius = -1;
      let waveFade = 0;
      if (state.rippleStart) {
        const progress = (now - state.rippleStart) / config.rippleDurationMs;
        if (progress >= 1) {
          state.rippleStart = 0;
        } else {
          const easeOutCubic = 1 - Math.pow(1 - progress, 3);
          waveRadius = easeOutCubic * (state.maxDistance + config.rippleBand);
          waveFade = 1 - progress * progress;
        }
      }

      let hotCount = 0;
      for (const dot of dots) {
        let light = 0;

        if (waveRadius >= 0) {
          const distanceToWave = Math.abs(dot.centerDistance - waveRadius);
          if (distanceToWave < config.rippleBand) {
            light = Math.cos(
              (distanceToWave / config.rippleBand) * Math.PI / 2
            ) * waveFade;
          }
        }

        if (state.hover > 0.01) {
          const distanceToPointer = Math.hypot(
            dot.x - state.pointerX,
            dot.y - state.pointerY
          );
          if (distanceToPointer < config.hoverRadius) {
            const proximity = 1 - distanceToPointer / config.hoverRadius;
            light = Math.min(1, light + proximity * proximity * state.hover);
          }
        }

        dot.light = light;
        if (light > 0.01) hotCount += 1;
      }

      const [r, g, b] = state.baseColor;
      const [hotR, hotG, hotB] = state.hotColor;
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      for (const dot of dots) {
        if (dot.light > 0.01) continue;
        const alpha = state.alpha * dot.baseAlpha;
        if (alpha < 0.004) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, config.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (!hotCount) return;

      for (const dot of dots) {
        const light = dot.light;
        if (light <= 0.01) continue;
        const alpha = Math.min(
          0.9,
          state.alpha * dot.baseAlpha * (1 + light * 1.6)
        );
        const rr = Math.round(r + (hotR - r) * light);
        const gg = Math.round(g + (hotG - g) * light);
        const bb = Math.round(b + (hotB - b) * light);
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(
          dot.x,
          dot.y,
          config.radius * (1 + light * 0.4),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    function schedule() {
      if (!state.raf && !state.destroyed) {
        state.raf = requestAnimationFrame(frame);
      }
    }

    function frame(now) {
      state.raf = 0;
      if (state.destroyed) return;
      const moved = state.pointerMoved;
      state.pointerMoved = false;
      state.hover += (state.hoverTarget - state.hover) * config.hoverEase;
      if (Math.abs(state.hoverTarget - state.hover) < 0.005) {
        state.hover = state.hoverTarget;
      }
      draw(now);
      if (state.rippleStart || state.hover !== state.hoverTarget || moved) {
        schedule();
      }
    }

    function redraw() {
      if (!state.dots.length) build();
      draw(performance.now());
    }

    function onPointerMove(event) {
      const rect = canvas.getBoundingClientRect();
      state.pointerX = event.clientX - rect.left;
      state.pointerY = event.clientY - rect.top;
      state.hoverTarget = 1;
      state.pointerMoved = true;
      schedule();
    }

    function onPointerLeave() {
      state.hoverTarget = 0;
      schedule();
    }

    const canHover = hoverQuery.matches && !reducedMotionQuery.matches;
    if (hitArea && canHover) {
      hitArea.addEventListener('pointermove', onPointerMove);
      hitArea.addEventListener('pointerleave', onPointerLeave);
    }

    const resizeObserver = new ResizeObserver(() => {
      build();
      draw(performance.now());
    });
    resizeObserver.observe(canvas);

    readCssTheme();
    build();
    draw(performance.now());

    return {
      ripple() {
        if (state.destroyed) return;
        if (!state.dots.length && !build()) return;
        if (reducedMotionQuery.matches) {
          draw(performance.now());
          return;
        }
        state.rippleStart = performance.now();
        schedule();
      },
      refreshTheme() {
        readCssTheme();
        redraw();
      },
      resize() {
        build();
        draw(performance.now());
      },
      destroy() {
        state.destroyed = true;
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = 0;
        resizeObserver.disconnect();
        if (hitArea && canHover) {
          hitArea.removeEventListener('pointermove', onPointerMove);
          hitArea.removeEventListener('pointerleave', onPointerLeave);
        }
      },
    };
  }

  global.WelcomeDots = Object.freeze({ create, defaults: DEFAULTS });
})(window);

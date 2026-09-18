/**
 * 虚拟时钟 —— 必须在页面任何脚本之前注入（page.evaluateOnNewDocument）。
 *
 * 目标：让页面里的时间完全由我们驱动，从而做到「同样的输入永远抽出同样的帧」。
 * 覆盖范围：
 *   - requestAnimationFrame / cancelAnimationFrame   （three.js、Lottie、手写 rAF 循环）
 *   - setTimeout / setInterval / clearTimeout / clearInterval
 *   - performance.now / Date.now / new Date()
 *   - Web Animations API（CSS animation / transition / element.animate）
 *   - SVG SMIL（<animate> / <animateTransform>）
 *   - <video> / <audio> 的 currentTime
 */
(function () {
  "use strict";

  var EPOCH = 1700000000000; // 固定壁钟起点，保证 new Date() 也可复现
  var virtualNow = 0; // 当前虚拟时间（ms）

  // ---------- requestAnimationFrame ----------
  var rafSeq = 0;
  var rafQueue = new Map();

  window.requestAnimationFrame = function (cb) {
    var id = ++rafSeq;
    rafQueue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    rafQueue.delete(id);
  };

  function flushRaf(timestamp) {
    // 快照当前队列：本帧内新注册的 rAF 留到下一帧，和真实浏览器行为一致
    var batch = Array.from(rafQueue.entries());
    rafQueue.clear();
    for (var i = 0; i < batch.length; i++) {
      try {
        batch[i][1](timestamp);
      } catch (err) {
        console.error("[icon-export] rAF callback threw:", err);
      }
    }
  }

  // ---------- setTimeout / setInterval ----------
  var timerSeq = 0;
  var timers = new Map(); // id -> { due, fn, args, interval }

  window.setTimeout = function (fn, delay, ...args) {
    var id = ++timerSeq;
    timers.set(id, {
      due: virtualNow + Math.max(0, Number(delay) || 0),
      fn: fn,
      args: args,
      interval: null,
    });
    return id;
  };
  window.setInterval = function (fn, delay, ...args) {
    var id = ++timerSeq;
    var period = Math.max(1, Number(delay) || 1);
    timers.set(id, {
      due: virtualNow + period,
      fn: fn,
      args: args,
      interval: period,
    });
    return id;
  };
  window.clearTimeout = function (id) {
    timers.delete(id);
  };
  window.clearInterval = function (id) {
    timers.delete(id);
  };

  function runTimersUntil(target) {
    // 每轮只取最早到期的一个，执行后重新排序 —— 保证回调里新建的定时器也能被正确调度
    var guard = 0;
    for (;;) {
      var next = null;
      timers.forEach(function (t, id) {
        if (t.due <= target && (next === null || t.due < next.t.due)) {
          next = { id: id, t: t };
        }
      });
      if (next === null) return;
      if (++guard > 10000) {
        console.warn("[icon-export] 定时器执行超过 10000 次，疑似死循环，已中断本帧");
        return;
      }
      virtualNow = Math.max(virtualNow, next.t.due);
      if (next.t.interval === null) {
        timers.delete(next.id);
      } else {
        next.t.due = virtualNow + next.t.interval;
      }
      try {
        next.t.fn.apply(null, next.t.args);
      } catch (err) {
        console.error("[icon-export] timer callback threw:", err);
      }
    }
  }

  // ---------- performance.now / Date ----------
  var NativePerfNow = performance.now.bind(performance);
  performance.now = function () {
    return virtualNow;
  };
  // performance.timeOrigin 是只读 getter，尽力覆盖
  try {
    Object.defineProperty(performance, "timeOrigin", { get: function () { return EPOCH; } });
  } catch (e) { /* 某些版本不可配置，忽略 */ }

  var NativeDate = Date;
  function VirtualDate() {
    if (!(this instanceof VirtualDate)) {
      return new NativeDate(EPOCH + virtualNow).toString();
    }
    if (arguments.length === 0) return new NativeDate(EPOCH + virtualNow);
    if (arguments.length === 1) return new NativeDate(arguments[0]);
    return new NativeDate(
      arguments[0], arguments[1], arguments[2] === undefined ? 1 : arguments[2],
      arguments[3] || 0, arguments[4] || 0, arguments[5] || 0, arguments[6] || 0
    );
  }
  VirtualDate.prototype = NativeDate.prototype;
  VirtualDate.now = function () { return EPOCH + virtualNow; };
  VirtualDate.parse = NativeDate.parse;
  VirtualDate.UTC = NativeDate.UTC;
  window.Date = VirtualDate;

  // ---------- 声明式动画：WAAPI / SMIL / 媒体 ----------
  function seekDeclarative(t) {
    // CSS animation / transition / element.animate()
    if (document.getAnimations) {
      var anims = document.getAnimations();
      for (var i = 0; i < anims.length; i++) {
        try {
          anims[i].pause();
          anims[i].currentTime = t;
        } catch (e) { /* 已 finish / 不可 seek 的动画忽略 */ }
      }
    }
    // SVG SMIL
    var svgs = document.querySelectorAll("svg");
    for (var j = 0; j < svgs.length; j++) {
      try {
        if (svgs[j].pauseAnimations) {
          svgs[j].pauseAnimations();
          svgs[j].setCurrentTime(t / 1000);
        }
      } catch (e) { /* 非 SVGSVGElement 忽略 */ }
    }
    // 媒体元素
    var media = document.querySelectorAll("video, audio");
    for (var k = 0; k < media.length; k++) {
      try {
        media[k].pause();
        if (Number.isFinite(media[k].duration)) media[k].currentTime = t / 1000;
      } catch (e) { /* 未就绪忽略 */ }
    }
  }

  // ---------- 对外接口（capture.mjs 通过 page.evaluate 调用）----------
  window.__iconClock = {
    /** 当前虚拟时间，ms */
    now: function () { return virtualNow; },

    /**
     * 把时间推进到 targetMs，并在推进过程中触发 subframes 次 rAF。
     * subframes > 1 时用于让物理/缓动类动画拿到更细的步长，但只在终点截图。
     */
    advanceTo: function (targetMs, subframes) {
      var steps = Math.max(1, subframes | 0);
      var from = virtualNow;
      var span = targetMs - from;
      for (var s = 1; s <= steps; s++) {
        var t = from + (span * s) / steps;
        runTimersUntil(t);
        virtualNow = Math.max(virtualNow, t);
        flushRaf(virtualNow);
      }
      virtualNow = Math.max(virtualNow, targetMs);
      seekDeclarative(virtualNow);
    },

    /** 首帧之前调用：让页面完成挂载副作用（useEffect / 初始 rAF）但时间不前进 */
    settle: function () {
      runTimersUntil(virtualNow);
      flushRaf(virtualNow);
      seekDeclarative(virtualNow);
    },

    _nativePerfNow: NativePerfNow,
  };
})();

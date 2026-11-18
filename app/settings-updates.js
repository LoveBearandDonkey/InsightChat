// Local demo: alternate checks discover a new patch. No remote package is installed.
(function () {
  'use strict';
  function initCapabilityUpdates() {
    const card = document.getElementById('trainChatCapabilityUpdate');
    if (!card) return;
    const storageKey = 'msi-builtin-capability-demo-v2';
    const defaults = () => ({ version: '1.0.8', pending: null, checks: 0, upgraded: false });
    const nextVersion = version => version.replace(/\d+$/, patch => Number(patch) + 1);
    function readModel() {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && /^\d+\.\d+\.\d+$/.test(saved.version)) return {
          version: saved.version, pending: saved.pending === nextVersion(saved.version) ? saved.pending : null,
          checks: saved.checks === 1 ? 1 : 0, upgraded: saved.upgraded === true,
        };
      } catch (_) { /* The page can still show its initial demo state. */ }
      return defaults();
    }
    let model = readModel();
    let state = model.pending ? 'available' : 'ready';
    let timer = 0, celebration = null, medalAnimation = null, scaleAnimation = null, liftAnimation = null, confettiCue = null;
    let presentationEpoch = 0, activeUpgradeEpoch = 0;
    let descriptionStatus = '', descriptionTimer = 0, descriptionAnimation = null;
    const action = document.getElementById('trainChatUpdateAction');
    const title = document.getElementById('trainChatUpdateTitle');
    const description = document.getElementById('trainChatUpdateDescription');
    const progress = document.getElementById('trainChatUpdateProgress');
    const details = document.getElementById('trainChatUpdateDetails');
    const detailsToggle = document.getElementById('trainChatUpdateDetailsToggle');
    const badge = document.getElementById('trainChatUpdateBadge');
    const medal = badge.querySelector('.wzh-update-medal');
    const tilt = badge.querySelector('.wzh-update-tilt');
    const scaleGroup = medal.querySelector('.wzh-update-scale');
    const floatLayer = badge.querySelector('.wzh-update-float');
    const dialog = document.getElementById('trainChatSettingsDialog');
    const trigger = document.getElementById('trainChatKeyBtn');
    const general = document.querySelector('[data-settings-section="general"]');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let flight = null;
    function drawExhaust(ctx, x, y, scale, energy, available) {
      const t = Math.max(0, Math.min(1, (energy - .08) / .92));
      const thrust = t * t * (3 - 2 * t);
      if (thrust < .005 || available < 4) return;
      // A single tapering light band; size and opacity follow the flight speed.
      const length = Math.min(44 * thrust * scale, available);
      const top = 16 * scale * thrust;
      const bottom = top * .48;
      // Continue the same straight trapezoid upward behind the badge.
      // Extrapolate its sides so the visible width and taper stay unchanged.
      const overlap = 20 * scale * thrust;
      const upper = top + (top - bottom) * overlap / length;
      const gradient = ctx.createLinearGradient(x, y, x, y + length);
      gradient.addColorStop(0, `rgba(246, 210, 150, ${thrust * .5})`);
      gradient.addColorStop(.45, `rgba(226, 178, 132, ${thrust * .26})`);
      gradient.addColorStop(1, 'rgba(204, 158, 147, 0)');
      ctx.save();
      ctx.filter = 'blur(1.1px)';
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - upper, y - overlap);
      ctx.lineTo(x + upper, y - overlap);
      ctx.lineTo(x + bottom, y + length);
      ctx.lineTo(x - bottom, y + length);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    function stopFlight() {
      if (flight) {
        cancelAnimationFrame(flight.frame);
        flight.canvas.remove();
        flight = null;
      }
    }
    function startFlight(startTime, releaseTime, duration) {
      stopFlight();
      const canvas = document.createElement('canvas');
      canvas.className = 'wzh-update-flight';
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      card.prepend(canvas);
      const current = { canvas, frame: 0 };
      flight = current;
      const clamp = value => Math.max(0, Math.min(1, value));
      const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
      // Accent colors from the card border, with warm streaks among the cool ones.
      const palette = ['94, 166, 238', '57, 185, 192', '151, 112, 218', '215, 163, 71', '228, 132, 116', '88, 179, 145'];
      const particles = Array.from({ length: 84 }, (_, index) => ({
        x: Math.random(), y: Math.random(), depth: .25 + Math.random() * .75,
        local: index % 3 !== 0, alpha: 0, color: palette[index % palette.length],
      }));
      let previous = startTime, width = 0, height = 0, pixelRatio = 0;
      function tick() {
        current.frame = 0;
        if (flight !== current) return;
        const now = document.timeline.currentTime;
        const elapsed = Math.max(0, now - startTime);
        if (elapsed >= duration || reducedMotion.matches || !card.getClientRects().length) {
          stopFlight();
          return;
        }
        // Resume at the live presentation time; never accumulate a hidden tab's delta.
        const dt = Math.min(40, Math.max(0, now - previous)) / 1000;
        previous = now;
        if (!document.hidden) {
          const rect = card.getBoundingClientRect();
          const dpr = Math.min(devicePixelRatio || 1, 2);
          const w = card.clientWidth, h = card.clientHeight;
          if (w !== width || h !== height || dpr !== pixelRatio) {
            width = w; height = h; pixelRatio = dpr;
            canvas.width = Math.ceil(w * dpr); canvas.height = Math.ceil(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
          ctx.clearRect(0, 0, width, height);
          const acceleration = smooth((elapsed - 240) / 2050);
          const release = smooth((elapsed - releaseTime) / (duration - releaseTime));
          const energy = acceleration * (1 - release);
          const fade = smooth(elapsed / 400) * (1 - smooth((elapsed - releaseTime) / 900));
          // Sample the actual eased scale instead of approximating the badge's release.
          const transform = getComputedStyle(scaleGroup).transform;
          const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
          const scale = matrix ? Math.hypot(matrix.m11, matrix.m12, matrix.m13) : 1;
          const liftTransform = getComputedStyle(tilt).transform;
          const lift = liftTransform === 'none' ? 0 : new DOMMatrixReadOnly(liftTransform).m42;
          const count = (8 + energy * 76) * Math.pow(scale, 1.5);
          const badgeRect = badge.getBoundingClientRect();
          const centerX = badgeRect.left - rect.left + badgeRect.width / 2;
          const centerY = badgeRect.top - rect.top + badgeRect.height / 2;
          const speed = 22 + 640 * energy;
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.alpha += (clamp(count - i) - p.alpha) * Math.min(1, dt * 12);
            p.y += dt * speed * (.35 + p.depth) / height;
            if (p.y > 1.5) { p.y = -.5; p.x = Math.random(); }
            if (p.alpha < .005) continue;
            const x = p.local ? centerX + (p.x - .5) * 205 * scale : p.x * width;
            const y = centerY + (p.y * height - centerY) * scale;
            const length = (5 + energy * 62) * p.depth * scale;
            const drift = (x - centerX) * .035;
            const edgeFade = smooth(y / 18) * smooth((height - y) / 24);
            const textFade = x > centerX + 65 ? .28 : 1;
            const alpha = p.alpha * fade * edgeFade * textFade * (.18 + p.depth * .3);
            if (alpha < .003) continue;
            const gradient = ctx.createLinearGradient(x - drift, y - length, x, y);
            gradient.addColorStop(0, `rgba(${p.color}, 0)`);
            gradient.addColorStop(.7, `rgba(${p.color}, ${alpha * .6})`);
            gradient.addColorStop(1, `rgba(${p.color}, ${alpha})`);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = (.5 + p.depth * 1.1) * scale;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - drift, y - length); ctx.lineTo(x, y); ctx.stroke();
          }
          // The mask's rounded bottom tip is at y=110.75 in its 116-unit viewBox.
          const exhaustY = centerY + lift + badgeRect.height * (52.75 / 116) * scale - 3 * scale;
          drawExhaust(ctx, centerX, exhaustY, scale, energy, height - exhaustY - 6);
        }
        current.frame = requestAnimationFrame(tick);
      }
      tick();
    }
    let shadowVisible = false, shadowFrame = 0, lastShadow = '';
    function updateShadow() {
      const matrix = element => {
        const value = getComputedStyle(element).transform;
        return value === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(value);
      };
      // Sample the live transforms rather than repeating their easing curves.
      const floating = matrix(floatLayer), lifted = matrix(tilt), scaled = matrix(scaleGroup);
      const height = Math.max(0, Math.min(1, -(floating.m42 + lifted.m42) / 12));
      const scale = Math.hypot(scaled.m11, scaled.m12, scaled.m13);
      const x = (scale * (1 + height * .3)).toFixed(3);
      const y = (scale * (1 + height * .45)).toFixed(3);
      const opacity = ((1 - height * .45) * Math.pow(scale, .6)).toFixed(3);
      const blur = (4 + height * 4).toFixed(3) + 'px';
      const signature = [x, y, opacity, blur].join(' ');
      if (signature === lastShadow) return;
      lastShadow = signature;
      badge.style.setProperty('--badge-shadow-x', x);
      badge.style.setProperty('--badge-shadow-y', y);
      badge.style.setProperty('--badge-shadow-opacity', opacity);
      badge.style.setProperty('--badge-shadow-blur', blur);
    }
    function stopShadow() { cancelAnimationFrame(shadowFrame); shadowFrame = 0; }
    function shadowTick() {
      shadowFrame = 0;
      if (!shadowVisible || document.hidden) return;
      updateShadow();
      if (!reducedMotion.matches) shadowFrame = requestAnimationFrame(shadowTick);
    }
    function startShadow() {
      if (shadowFrame || !shadowVisible || document.hidden) return;
      updateShadow();
      if (!reducedMotion.matches) shadowFrame = requestAnimationFrame(shadowTick);
    }
    new IntersectionObserver(entries => {
      shadowVisible = entries[0].isIntersecting;
      if (shadowVisible) startShadow(); else stopShadow();
    }).observe(badge);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopShadow(); else startShadow(); });
    window.addEventListener('pagehide', stopShadow);
    window.addEventListener('pageshow', startShadow);
    const notifications = [trigger, general].filter(Boolean).map(host => {
      const dot = document.createElement('span');
      dot.className = host === general ? 'wzh-update-nav-badge' : 'wzh-update-dot';
      if (host === general) dot.textContent = '有更新';
      else dot.setAttribute('aria-hidden', 'true');
      host.appendChild(dot);
      return dot;
    });
    for (let depth = -3; depth <= 3; depth++) {
      const edge = document.createElement('span');
      edge.className = 'wzh-update-medal-edge';
      edge.setAttribute('aria-hidden', 'true');
      edge.style.transform = `translateZ(${depth}px)`;
      scaleGroup.prepend(edge);
    }
    const getState = () => ({ installed: model.upgraded, release: model.version, availableVersion: model.pending });
    window.MSI_BUILTIN_UPDATES = Object.freeze({ getState });
    function publish() { document.dispatchEvent(new CustomEvent('msi:builtin-update', { detail: getState() })); }
    function save(next) { localStorage.setItem(storageKey, JSON.stringify(next)); model = next; }
    function setProgress(value) {
      progress.setAttribute('aria-valuenow', String(value));
      progress.querySelector('span').style.width = value + '%';
    }
    function paintDescription() {
      const text = descriptionStatus || (model.pending ? `发现 v ${model.pending} · 2 项 Skill 升级，18 篇新知识。`
        : `v${model.version}，通信分析更细，显存排查参考更全。`);
      description.dataset.status = String(!!descriptionStatus);
      description.title = text;
      if (description.textContent === text) return;
      descriptionAnimation?.cancel();
      description.textContent = text;
      if (!reducedMotion.matches) descriptionAnimation = description.animate([
        { opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 180, easing: 'ease-out' });
    }
    function setDescriptionStatus(text, duration = 0) {
      clearTimeout(descriptionTimer);
      descriptionStatus = text;
      paintDescription();
      if (duration) descriptionTimer = setTimeout(() => {
        descriptionStatus = '';
        paintDescription();
      }, duration);
    }
    function resetTilt() {
      badge.style.setProperty('--badge-rx', '0deg');
      badge.style.setProperty('--badge-ry', '0deg');
      badge.style.setProperty('--shine-x', '55%');
    }
    badge.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch' || state === 'updating' || state === 'celebrating') return;
      const rect = badge.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      badge.style.setProperty('--badge-rx', (-y * 3).toFixed(2) + 'deg');
      badge.style.setProperty('--badge-ry', (x * 7).toFixed(2) + 'deg');
      badge.style.setProperty('--shine-x', (55 + x * 30).toFixed(1) + '%');
    });
    badge.addEventListener('pointerleave', resetTilt);
    function clearConfetti() {
      if (!celebration) return;
      celebration.fire.reset();
      celebration.fade?.cancel();
      celebration.canvas.remove();
      celebration = null;
    }
    function stopPresentation() {
      presentationEpoch++;
      stopFlight();
      confettiCue?.cancel();
      confettiCue = null;
      clearConfetti();
      medalAnimation?.cancel();
      medalAnimation = null;
      scaleAnimation?.cancel();
      scaleAnimation = null;
      liftAnimation?.cancel();
      liftAnimation = null;
      card.classList.remove('is-upgrade-motion');
      resetTilt();
      updateShadow();
      if (state === 'celebrating') { state = 'ready'; render(); }
    }
    function startUpgradeMotion() {
      activeUpgradeEpoch = presentationEpoch;
      resetTilt();
      if (reducedMotion.matches || card.getClientRects().length === 0) return;
      card.classList.add('is-upgrade-motion');
      const startTime = document.timeline.currentTime;
      const spinDuration = 3000;
      const releaseOffset = .94;
      medalAnimation = medal.animate([
        { offset: 0, transform: 'rotateY(0deg)' },
        { offset: .64, transform: 'rotateY(0deg)' },
        { offset: 1, transform: 'rotateY(1080deg)' },
      ], { duration: spinDuration, fill: 'forwards' });
      // Begin the 1.1 s landing at 2.5 turns (2820 ms), during the final half-turn.
      const landingStart = spinDuration * releaseOffset;
      const liftDuration = landingStart + 1100;
      liftAnimation = tilt.animate([
        { at: 0, transform: 'translateY(0)', easing: 'ease-out' },
        { at: 360, transform: 'translateY(-5px)', easing: 'ease-in' },
        { at: 720, transform: 'translateY(0)', easing: 'ease-out' },
        { at: 1080, transform: 'translateY(-9px)', easing: 'ease-in' },
        { at: 1440, transform: 'translateY(0)', easing: 'ease-out' },
        { at: 1800, transform: 'translateY(-12px)' },
        { at: landingStart, transform: 'translateY(-12px)', easing: 'cubic-bezier(.16,1,.3,1)' },
        { at: liftDuration, transform: 'translateY(0)' },
      ].map(({ at, ...frame }) => ({ ...frame, offset: at / liftDuration })), { duration: liftDuration, fill: 'forwards' });
      // Keep rotation linear; charge for 2.5 turns, then release over the last half-turn.
      scaleAnimation = scaleGroup.animate([
        { offset: 0, transform: 'scale(1)' },
        { offset: .64, transform: 'scale(1)', easing: 'cubic-bezier(.2,.75,.3,1)' },
        { offset: releaseOffset, transform: 'scale(.72)', easing: 'cubic-bezier(.12,.9,.25,1)' },
        { offset: 1, transform: 'scale(1)' },
      ], { duration: spinDuration, fill: 'forwards' });
      medalAnimation.startTime = startTime;
      scaleAnimation.startTime = startTime;
      liftAnimation.startTime = startTime;
      startFlight(startTime, landingStart, liftDuration);
      medalAnimation.finished.catch(() => {});
      scaleAnimation.finished.catch(() => {});
      liftAnimation.finished.catch(() => {});
      // Start the burst with the final half-turn's scale release and landing.
      const epoch = presentationEpoch;
      const cue = card.animate([], { duration: spinDuration * releaseOffset });
      confettiCue = cue;
      cue.startTime = startTime;
      cue.finished.then(() => {
        if (confettiCue === cue) confettiCue = null;
        if (epoch !== presentationEpoch) return;
        Promise.resolve(celebrate(2200, document.timeline.currentTime)).catch(() => clearConfetti());
      }, () => {});
    }
    function celebrate(duration, startTime) {
      clearConfetti();
      if (reducedMotion.matches || card.getClientRects().length === 0 || typeof window.confetti !== 'function') return;
      const canvas = document.createElement('canvas');
      canvas.className = 'wzh-update-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      card.appendChild(canvas);
      try {
        const fire = window.confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
        const current = { fire, canvas, fade: null };
        celebration = current;
        // Ease the launch with air resistance, then let the downward pull regain speed.
        const options = { particleCount: 40, spread: 65, startVelocity: 17, decay: .92, ticks: 200, gravity: 1.15, scalar: .65, colors: ['#d7bd82', '#549bff', '#a784ed', '#52cdbb'], disableForReducedMotion: true };
        const left = fire({ ...options, angle: 60, origin: { x: .16, y: .8 } });
        const right = fire({ ...options, angle: 120, origin: { x: .84, y: .8 } });
        Promise.all([left, right]).catch(() => {});
        // Confetti keeps its own duration after the badge has landed.
        current.fade = canvas.animate([
          { opacity: 1, offset: 0 }, { opacity: 1, offset: .8 }, { opacity: 0, offset: 1 },
        ], { duration, fill: 'forwards' });
        current.fade.startTime = startTime;
        const cleanup = () => {
          fire.reset();
          current.fade.cancel();
          canvas.remove();
          if (celebration === current) celebration = null;
        };
        return current.fade.finished.then(cleanup, cleanup);
      } catch (_) { clearConfetti(); canvas.remove(); }
    }
    async function finishPresentation(epoch) {
      if (medalAnimation) await medalAnimation.finished.catch(() => {});
      if (epoch !== presentationEpoch) return;
      scaleAnimation?.cancel();
      scaleAnimation = null;
      // The burst and landing have already started with the scale release.
      if (liftAnimation) await liftAnimation.finished.catch(() => {});
      if (epoch !== presentationEpoch) return;
      medalAnimation?.cancel();
      medalAnimation = null;
      liftAnimation?.cancel();
      liftAnimation = null;
      card.classList.remove('is-upgrade-motion');
      state = 'ready';
      render();
    }
    function render() {
      const busy = ['updating', 'checking', 'celebrating'].includes(state);
      const available = !!model.pending;
      card.dataset.state = state;
      card.setAttribute('aria-busy', String(busy));
      action.disabled = busy;
      action.classList.toggle('is-secondary', !available);
      action.classList.toggle('btn', !available);
      action.classList.toggle('btn-compact', !available);
      action.textContent = busy ? ({ checking: '正在检查…', updating: '正在更新…', celebrating: '更新完成' }[state])
        : available ? (state === 'error' ? '重试更新' : '立即更新') : (state === 'error' ? '重新检查' : '检查更新');
      const updating = state === 'updating';
      progress.hidden = !updating;
      detailsToggle.hidden = updating;
      if (updating) {
        details.hidden = true;
        detailsToggle.setAttribute('aria-expanded', 'false');
      }
      notifications.forEach(dot => { dot.hidden = !available; });
      if (trigger) {
        trigger.setAttribute('aria-label', available ? '打开助手设置，有技能与知识更新' : '打开助手设置');
        trigger.title = available ? '助手设置 · 有新本领可更新' : '助手设置';
      }
      title.textContent = available && !updating ? '助手本领可升级啦~' : '我的助手官方技能';
      detailsToggle.querySelector('span').textContent = available && !updating ? '更新详情' : '版本详情';
      paintDescription();
      badge.querySelector('#trainChatUpdateVersion').textContent = 'v ' + model.version;
      badge.querySelector('[data-update-badge-version]').textContent = 'v ' + model.version;
      badge.setAttribute('aria-label', '知识库版本 v ' + model.version);
    }
    detailsToggle.addEventListener('click', () => {
      details.hidden = !details.hidden;
      detailsToggle.setAttribute('aria-expanded', String(!details.hidden));
    });
    card.querySelectorAll('[data-update-section]').forEach(button => button.addEventListener('click', () => {
      document.querySelector(`[data-settings-section="${button.dataset.updateSection}"]`)?.click();
    }));
    const stages = [
      { progress: 16, message: '准备更新…', duration: 650 },
      { progress: 48, message: '学习新技能…', duration: 650 },
      { progress: 82, message: '补充新知识…', duration: 650 },
      { progress: 94, message: '正在完成更新…', duration: 1050 },
    ];
    function updateStep(index) {
      if (index < stages.length) {
        setProgress(stages[index].progress);
        setDescriptionStatus(stages[index].message);
        if (index === stages.length - 1 && medalAnimation) {
          // Swap the version at the final front-facing frame, not on a parallel timer.
          const started = performance.now();
          medalAnimation.finished.then(() => updateStep(index + 1), () => {
            timer = setTimeout(() => updateStep(index + 1), Math.max(0, stages[index].duration - (performance.now() - started)));
          });
        } else timer = setTimeout(() => updateStep(index + 1), stages[index].duration);
        return;
      }
      try { save({ version: model.pending, pending: null, checks: 0, upgraded: true }); }
      catch (_) { stopPresentation(); state = 'error'; setDescriptionStatus('保存失败，请重试', 3000); render(); return; }
      setProgress(100);
      setDescriptionStatus('升级完成', 1600);
      state = activeUpgradeEpoch === presentationEpoch ? 'celebrating' : 'ready';
      render();
      publish();
      if (state === 'celebrating') finishPresentation(activeUpgradeEpoch).catch(() => { stopPresentation(); });
    }
    action.addEventListener('click', () => {
      if (['updating', 'checking', 'celebrating'].includes(state)) return;
      clearTimeout(timer);
      stopPresentation();
      if (model.pending) {
        state = 'updating';
        render();
        startUpgradeMotion();
        updateStep(0);
      } else {
        state = 'checking';
        setDescriptionStatus('正在检查…');
        render();
        timer = setTimeout(() => {
          try {
            const found = model.checks === 1;
            save({ ...model, checks: found ? 0 : 1, pending: found ? nextVersion(model.version) : null });
            state = found ? 'available' : 'ready';
            setDescriptionStatus(found ? '' : '已是最新', found ? 0 : 1600);
            publish();
          } catch (_) { state = 'error'; setDescriptionStatus('检查失败，请重试', 3000); }
          render();
        }, 650);
      }
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) stopPresentation();
      stopShadow();
      startShadow();
    });
    dialog.addEventListener('close', stopPresentation);
    dialog.addEventListener('settings:section-change', event => { if (event.detail.section !== 'general') stopPresentation(); });
    window.addEventListener('pagehide', stopPresentation);
    window.addEventListener('storage', event => {
      if ((event.key !== storageKey && event.key !== null) || ['updating', 'checking', 'celebrating'].includes(state)) return;
      model = readModel(); state = model.pending ? 'available' : 'ready'; setDescriptionStatus('');
      stopPresentation(); render(); publish();
    });
    render(); publish();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCapabilityUpdates, { once: true });
  else initCapabilityUpdates();
})();

/* Legacy artwork overlays the live product. Handoff never replaces its DOM. */
(function () {
  'use strict';

  const HOLD = 1000;
  const EXPLODE_DURATION = 1400;
  const EDGE_PEEK_X = 32;
  const EDGE_PEEK_Y = 20;
  const LIFT_DURATION = 180;
  const PERSPECTIVE = 1800;
  const EXPLODED = HOLD + 400 + EXPLODE_DURATION;
  const GLASS_START = EXPLODED + 400;
  const GLASS_LOW = GLASS_START + 700;
  const GLASS_RESTORE = GLASS_LOW + 350;
  const GLASS_END = GLASS_RESTORE + 1200;
  const RADIUS_PEAK = GLASS_END + 450;
  const RADIUS_END = RADIUS_PEAK + 450;
  const BRAND_PEAK = GLASS_END + 100;
  const BRAND_FOCUS = BRAND_PEAK + 220;
  const BRAND_END = RADIUS_END + 120;
  const COLOR_START = BRAND_END + 100;
  const AVATAR_VISIBLE = COLOR_START + 320;
  const SPIN_FAST = AVATAR_VISIBLE + 900;
  const COLOR_MORPH_START = SPIN_FAST - 120;
  const COLOR_MORPH_END = SPIN_FAST + 240;
  const COLOR_STOP = COLOR_MORPH_END + 900;
  const COLOR_CHARGE = COLOR_STOP + 160;
  const COLOR_CHARGED = COLOR_CHARGE + 340;
  const COLOR_BLOOM = COLOR_CHARGED + 100;
  const COLOR_SETTLED = COLOR_BLOOM + 1760;
  const COLOR_HANDOFF = COLOR_SETTLED + 200;
  const COLOR_END = COLOR_HANDOFF + 20;
  const EDGE_END = COLOR_END + 450;
  const PANE_DURATION = 600;
  const COMPONENT_DELAY = EDGE_END - GLASS_END;
  const LAND = 780;
  const REPLACE = 20;
  const REVEAL_LEAD = 140;
  const HEAD_START = HOLD + 6640 + COMPONENT_DELAY + PANE_DURATION;
  const HEAD_END = HOLD + 7090 + COMPONENT_DELAY + PANE_DURATION;
  const DURATION = HOLD + 11500 + COMPONENT_DELAY + PANE_DURATION;
  const FLIGHT_EASE = [0.22, 0.5, 0.55, 1];
  const FLIGHT_TIMING = `cubic-bezier(${FLIGHT_EASE.join(',')})`;
  const FLIGHT_OPACITY = 0.75;
  const FLIGHT_SHADOW_STRENGTH = 0.5;
  const GROUND_BLURS = [2, 16, 42];
  const CARD_BLURS = [3, 24, 90];
  const PARTS = [
    { id: 1, name: '窗口标题栏', start: 4700, targets: ['.pto-ide-frame__topbar'], direction: 'up', offscreen: true, delay: 0, scale: 1.10 },
    { id: 2, name: '数据管理', start: 5750, targets: ['.msi-sidebar'], direction: 'left', delay: 0, scale: 1.12 },
    { id: 3, name: '分析页签', start: 7170, targets: ['.msi-tabs'], direction: 'up', offscreen: true, delay: 200, scale: 1.10 },
    { id: 4, name: '时间线', start: 8220, targets: ['#msiTimelinePanel > .msi-toolbar', '#msiTimelineSwims'], extra: ['#msiMouseTools'], direction: 'up', delay: 400, scale: 1.12 },
    { id: 6, name: '选中详情', start: 9270, targets: ['#msiSelectionPanel'], extra: ['#msiFootResizer'], direction: 'down', delay: 0, scale: 1.10 },
    { id: 5, name: '智能对话', start: 10320, targets: ['#trainChatPanel'], extra: ['#chatShellResizer'], direction: 'right', delay: 0, scale: 1.12 },
  ].map(part => ({ ...part, start: HOLD + part.start + COMPONENT_DELAY + (part.id === 1 || part.id === 2 ? 0 : PANE_DURATION) }));
  // Move the pane's slot after the explorer has fully replaced its old artwork.
  // The title and later components keep their existing playback times.
  const PANE_START = PARTS.find(part => part.id === 2).start + LAND + REPLACE;
  const PANE_END = PANE_START + PANE_DURATION;
  const CHAT_REVEAL = PARTS[5].start + LAND - REVEAL_LEAD;

  function run(stage, onFinish) {
    const desktop = document.getElementById('msiDesktop');
    const frame = desktop.querySelector('.pto-ide-frame');
    const materialStyle = getComputedStyle(frame);
    const nativeFill = materialStyle.backgroundImage;
    // Keep the neutral shell during earlier demonstrations. The native color
    // gradients return only after their moving counterparts reach the same pose.
    let nesting = 0, lastLayer = 0;
    for (let i = 0; i < nativeFill.length; i++) {
      if (nativeFill[i] === '(') nesting++;
      else if (nativeFill[i] === ')') nesting--;
      else if (nativeFill[i] === ',' && nesting === 0) lastLayer = i + 1;
    }
    const neutralFill = nativeFill.slice(lastLayer).trim();
    const shellOpacity = parseFloat(materialStyle.getPropertyValue('--ide-shell-opacity')) / 100 || 0.92;
    const glassBlur = materialStyle.backdropFilter || 'blur(8px)';
    const frameBorder = materialStyle.borderColor;
    const brandColor = materialStyle.getPropertyValue('--brand-accent').trim() || '#0077ff';
    const highlight = stage.querySelector('.vu-glass-highlight');
    const highlightStyle = getComputedStyle(highlight);
    const edgeColor = highlightStyle.borderColor;
    const edgeShadow = highlightStyle.boxShadow;
    const brandEdgeShadow = `inset 0 0 0 1px ${brandColor}, 0 0 0 1px ${brandColor}, 0 0 22px color-mix(in srgb, ${brandColor} 40%, transparent)`;
    const softBrandColor = `color-mix(in srgb, ${brandColor} 16%, transparent)`;
    const softBrandShadow = `inset 0 0 0 1px ${softBrandColor}, 0 0 0 1px ${softBrandColor}, 0 0 22px color-mix(in srgb, ${brandColor} 8%, transparent)`;
    const corners = document.createElement('div');
    corners.className = 'vu-corner-highlight';
    const sheen = document.createElement('div');
    sheen.className = 'vu-glass-sheen';
    highlight.style.setProperty('--vu-brand-color', brandColor);
    highlight.append(corners, sheen);
    // Keep the outline in the live frame's coordinate system and clipping
    // context. The legacy stage scales independently of the product window.
    frame.append(highlight);
    const prefill = document.createElement('div');
    prefill.className = 'vu-prefill';
    prefill.setAttribute('aria-hidden', 'true');
    const glows = [
      { x: 0, y: 0, extent: 0.28, color: 'left', alpha: 'left' },
      { x: 1, y: 0, extent: 0.30, color: 'right', alpha: 'right' },
      { x: 0.48, y: 0.06, extent: 0.34, color: 'center', alpha: 'center' },
      { x: 0.18, y: 0.86, extent: 0.34, color: 'lower', alpha: 'lower' },
    ].map(spec => {
      const element = document.createElement('div');
      element.className = 'vu-prefill-glow';
      const color = materialStyle.getPropertyValue(`--ide-glow-${spec.color}`).trim();
      const alpha = parseFloat(materialStyle.getPropertyValue(`--ide-gradient-${spec.alpha}-alpha`));
      element.style.background = `radial-gradient(circle closest-side, rgb(${color}) 0%, transparent 100%)`;
      // CSS background images paint the first gradient on top.
      prefill.prepend(element);
      return { ...spec, element, alpha };
    });
    const source = document.createElement('div');
    source.className = 'vu-prefill-source';
    const avatar = document.createElement('img');
    avatar.className = 'vu-prefill-avatar';
    avatar.src = '../../src/pic/icon/msinsightbotAvatar.png';
    avatar.alt = '';
    avatar.draggable = false;
    const blurredAvatar = avatar.cloneNode();
    blurredAvatar.classList.add('vu-prefill-avatar-blur');
    source.append(avatar, blurredAvatar);
    const orbit = document.createElement('div');
    orbit.className = 'vu-color-orbit';
    const orbColors = ['#9652ea', '#269cff', '#2ecbd3', '#fb8f70'];
    const quadrants = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    glows.forEach((glow, index) => {
      const orb = document.createElement('div');
      orb.className = 'vu-color-orb';
      orb.style.setProperty('--vu-orb-color', orbColors[index]);
      orbit.append(orb);
      glow.orb = orb;
      glow.quadrant = quadrants[index];
    });
    prefill.append(source, orbit);
    frame.append(prefill);
    // No child components are visible during this phase. Scale the native 92%
    // shell alpha to 50%, then restore the entire live frame before parts land.
    const lowFrameOpacity = Math.min(1, 0.5 / shellOpacity);
    const legacy = [...stage.querySelectorAll('.vu-legacy-part')];
    const shadowLayer = document.createElement('div');
    shadowLayer.className = 'vu-part-shadows';
    shadowLayer.setAttribute('aria-hidden', 'true');
    function shadowElement(img, className, blurs) {
      const element = document.createElement('div');
      element.className = className;
      element.dataset.part = img.dataset.part;
      element.setAttribute('aria-hidden', 'true');
      for (const key of ['left', 'top', 'width', 'height']) element.style[key] = img.style[key];
      const textures = blurs.map(() => {
        const texture = document.createElement('div');
        texture.className = 'vu-shadow-texture';
        element.append(texture);
        return texture;
      });
      return { element, textures };
    }
    const shadows = new Map(legacy.map(img => {
      const shadow = shadowElement(img, 'vu-part-shadow', GROUND_BLURS);
      shadow.textures.forEach((texture, i) => { texture.style.filter = `blur(${GROUND_BLURS[i]}px)`; });
      shadowLayer.append(shadow.element);
      return [Number(img.dataset.part), shadow];
    }));
    const cardShadows = new Map(legacy.map(img => {
      const shadow = shadowElement(img, 'vu-card-shadow', CARD_BLURS);
      img.before(shadow.element);
      return [Number(img.dataset.part), shadow];
    }));
    stage.querySelector('.vu-legacy-layers').before(shadowLayer);
    const animations = [];
    let scaleX = 1;
    let scaleY = 1;
    let raf = 0;
    let resizeRaf = 0;
    let playing = false;
    let resumeOnVisible = false;
    let initialized = false;
    let handedOff = false;
    let lastStatus = '';
    let previousTime = -1;
    let dismissRequested = false;
    const lifecycle = new AbortController();

    const controls = document.createElement('div');
    controls.className = 'vu-controls';
    controls.innerHTML = '<div class="vu-playback"><button class="vu-play" type="button" disabled>暂停</button></div><button class="vu-close" type="button" aria-label="关闭演示，继续使用产品"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13"/></svg>关闭</button>';
    const playback = controls.querySelector('.vu-playback');
    document.body.append(controls);
    const playButton = playback.querySelector('.vu-play');

    function fit() {
      // Only the old artwork is scaled. The product uses its responsive layout.
      const scale = Math.min(1, Math.max(0.1, (innerWidth - (innerWidth > 720 ? 144 : 32)) / 1775), Math.max(0.1, (innerHeight - 110) / 970));
      const w = 1775 * scale;
      const h = 970 * scale;
      document.dispatchEvent(new CustomEvent('msi:window-geometry', {
        detail: { x: (innerWidth - w) / 2, y: (innerHeight - 42 - h) / 2, w, h },
      }));
      // Match an explicit manual expansion, including at smaller resolutions.
      document.dispatchEvent(new Event('msi:sidebar-expand'));
      const rect = frame.getBoundingClientRect();
      scaleX = rect.width / 1775;
      scaleY = rect.height / 970;
      stage.style.left = rect.left + 'px';
      stage.style.top = rect.top + 'px';
      stage.style.setProperty('--vu-scale-x', scaleX);
      stage.style.setProperty('--vu-scale-y', scaleY);
    }
    fit();
    const finalRadius = getComputedStyle(frame).borderRadius;

    function animate(element, frames) {
      // Keep the first effect as the full-length playback clock. Other effects
      // only run while their values change; completed glass/radius effects must
      // not keep requesting style updates throughout the later card flights.
      const sameValues = (a, b) => {
        const values = ({ at, easing, ...properties }) => JSON.stringify(properties);
        return values(a) === values(b);
      };
      let first = 0, last = frames.length - 1;
      if (animations.length) {
        while (first < last - 1 && sameValues(frames[first], frames[first + 1])) first++;
        while (last > first + 1 && sameValues(frames[last], frames[last - 1])) last--;
      }
      const delay = frames[first].at;
      const duration = Math.max(1, frames[last].at - delay);
      const animation = element.animate(frames.slice(first, last + 1).map(({ at, ...properties }) => ({ offset: (at - delay) / duration, ...properties })), { delay, duration, fill: 'both' });
      animation.pause();
      animation.currentTime = 0;
      animations.push(animation);
    }
    function reveal(element, start, end, easing = 'ease-out') {
      // Live controls stay in their final position throughout the replacement.
      animate(element, [
        { at: 0, opacity: 0 }, { at: start, opacity: 0, easing },
        { at: end, opacity: 1 }, { at: DURATION, opacity: 1 },
      ]);
    }
    function shadowWeights(blur, stops) {
      const weights = stops.map(() => 0);
      const index = Math.max(1, stops.findIndex(stop => stop >= blur));
      const blend = Math.max(0, Math.min(1, (blur - stops[index - 1]) / (stops[index] - stops[index - 1])));
      weights[index - 1] = 1 - blend;
      weights[index] = blend;
      return weights;
    }
    function blendShadows(shadow, stops, frames) {
      // Blur and box-shadow are fixed textures. Only their alpha changes during
      // flight, keeping the large artwork and its shadows off the paint path.
      shadow.textures.forEach((texture, index) => animate(texture, frames.map(({ blur, ...frame }) => ({
        ...frame, opacity: shadowWeights(blur, stops)[index],
      }))));
    }
    function destination(selectors) {
      const rects = selectors.map(selector => desktop.querySelector(selector).getBoundingClientRect());
      const origin = stage.getBoundingClientRect();
      const left = Math.min(...rects.map(rect => rect.left));
      const top = Math.min(...rects.map(rect => rect.top));
      const right = Math.max(...rects.map(rect => rect.right));
      const bottom = Math.max(...rects.map(rect => rect.bottom));
      return { x: (left - origin.left) / scaleX, y: (top - origin.top) / scaleY, w: (right - left) / scaleX, h: (bottom - top) / scaleY };
    }

    function cardTransform(dx, dy, sx, sy, rx = 0, ry = 0) {
      // Translation is outside the perspective projection, so cards keep their
      // cardinal path while their inward-facing planes form a visible trapezoid.
      return `translate3d(${dx}px, ${dy}px, 0px) perspective(${PERSPECTIVE}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sx}, ${sy})`;
    }

    function easedProgress(time, [x1, y1, x2, y2]) {
      if (time <= 0 || time >= 1) return Math.max(0, Math.min(1, time));
      const cubic = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
      let low = 0, high = 1;
      for (let i = 0; i < 18; i++) {
        const mid = (low + high) / 2;
        if (cubic(mid, x1, x2) < time) low = mid;
        else high = mid;
      }
      return cubic((low + high) / 2, y1, y2);
    }

    function flightShadow(state, far, inward) {
      // Scale and tilt supply the apparent elevation (the artwork has no
      // literal translateZ). Project its current footprint onto the glass;
      // elevation adds penumbra and light offset, then both collapse on contact.
      const { dx, dy, sx, sy, rx, ry, elevation } = state;
      const footprint = angle => Math.cos(angle * Math.PI / 180);
      const farSize = 1 + (Math.min(far.scale, 1.2) - 1) * 2;
      const spread = elevation ** 1.25;
      const width = sx * footprint(ry) + (farSize - far.scale * footprint(far.ry)) * spread;
      const height = sy * footprint(rx) + (farSize - far.scale * footprint(far.rx)) * spread;
      const softness = elevation ** 0.8;
      return {
        transform: `translate(${dx + inward[0] * 28 * elevation}px, ${dy + inward[1] * 28 * elevation}px) scale(${width}, ${height})`,
        blur: 2 + 40 * softness,
        cardBlur: 3 + 87 * softness,
        opacity: (0.12 + 0.16 * (1 - elevation) ** 1.4) * FLIGHT_SHADOW_STRENGTH,
      };
    }

    function projectedBounds(w, h, scale, rx, ry) {
      const ax = rx * Math.PI / 180, ay = ry * Math.PI / 180;
      const points = [];
      for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) {
        const px = x * scale * Math.cos(ay);
        const pz = -x * scale * Math.sin(ay);
        const py = y * scale * Math.cos(ax) - pz * Math.sin(ax);
        const z = y * scale * Math.sin(ax) + pz * Math.cos(ax);
        const perspective = 1 / (1 - z / PERSPECTIVE);
        points.push({ x: px * perspective, y: py * perspective });
      }
      return {
        left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
        top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)),
      };
    }

    function explosionPose(part, x, y, w, h) {
      const screen = desktop.getBoundingClientRect();
      const origin = stage.getBoundingClientRect();
      const horizontal = part.direction === 'left' || part.direction === 'right';
      const peek = horizontal ? EDGE_PEEK_X : EDGE_PEEK_Y;
      const angle = h < 40 ? 38 : 54;
      const rx = part.direction === 'up' ? -angle : part.direction === 'down' ? angle : 0;
      const ry = part.direction === 'left' ? angle : part.direction === 'right' ? -angle : 0;
      let scale = part.scale;
      let bounds = projectedBounds(w, h, scale, rx, ry);
      // Retain 32 screen pixels at the sides and 20 at the top/bottom, including
      // after resizing. The two thin upper strips still travel offscreen.
      for (let attempt = 0; attempt < 4 && !part.offscreen; attempt++) {
        const visibleSize = horizontal ? (bounds.right - bounds.left) * scaleX : (bounds.bottom - bounds.top) * scaleY;
        if (visibleSize >= peek + 2) break;
        scale *= (peek + 2) / visibleSize;
        bounds = projectedBounds(w, h, scale, rx, ry);
      }
      let dx = 0, dy = 0;
      if (part.direction === 'left') dx = (screen.left + peek - origin.left) / scaleX - (x + w / 2) - bounds.right;
      if (part.direction === 'right') dx = (screen.right - peek - origin.left) / scaleX - (x + w / 2) - bounds.left;
      if (part.direction === 'up') dy = (screen.top + peek - origin.top) / scaleY - (y + h / 2) - bounds.bottom;
      if (part.direction === 'down') dy = (screen.bottom - peek - origin.top) / scaleY - (y + h / 2) - bounds.top;
      if (part.offscreen) {
        const timeline = legacy.find(img => Number(img.dataset.part) === 4);
        const timelineY = parseFloat(timeline.style.top);
        const timelinePose = explosionPose(PARTS.find(item => item.id === 4), parseFloat(timeline.style.left), timelineY, parseFloat(timeline.style.width), parseFloat(timeline.style.height));
        // Preserve the vertical hierarchy: titlebar travels furthest, then tabs,
        // while only the timeline's lower edge remains visible at the screen top.
        dy = timelinePose.dy - (timelineY - y) - EDGE_PEEK_Y / scaleY;
      }
      return { dx, dy, scale, rx, ry, transform: cardTransform(dx, dy, scale, scale, rx, ry) };
    }

    function buildTimeline(time = 0) {
      animations.forEach(animation => animation.cancel());
      animations.length = 0;
      animate(stage.querySelector('.vu-old-backplate'), [
        { at: 0, opacity: 1 }, { at: GLASS_START, opacity: 1, easing: 'ease-in-out' },
        { at: GLASS_LOW, opacity: 0 }, { at: DURATION, opacity: 0 },
      ]);
      animate(frame, [
        { at: 0, opacity: lowFrameOpacity, backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)' },
        { at: GLASS_RESTORE, opacity: lowFrameOpacity, backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', easing: 'ease-in-out' },
        { at: GLASS_END, opacity: 1, backdropFilter: glassBlur, webkitBackdropFilter: glassBlur },
        { at: DURATION, opacity: 1, backdropFilter: glassBlur, webkitBackdropFilter: glassBlur },
      ]);
      animate(frame, [
        { at: 0, backgroundImage: neutralFill, '--vu-native-aura-opacity': '0' },
        { at: COLOR_HANDOFF - 1, backgroundImage: neutralFill, '--vu-native-aura-opacity': '0', easing: 'steps(1, end)' },
        { at: COLOR_HANDOFF, backgroundImage: nativeFill, '--vu-native-aura-opacity': '1' },
        { at: DURATION, backgroundImage: nativeFill, '--vu-native-aura-opacity': '1' },
      ]);
      animate(prefill, [
        { at: 0, visibility: 'visible' },
        { at: COLOR_HANDOFF - 1, visibility: 'visible', easing: 'steps(1, end)' },
        { at: COLOR_HANDOFF, visibility: 'hidden' }, { at: DURATION, visibility: 'hidden' },
      ]);
      // The icon remains opaque and condenses into the emerging spheres. Two
      // fixed image textures create the blur without animating a filter.
      animate(source, [
        { at: 0, opacity: 0 }, { at: COLOR_START, opacity: 0, easing: 'ease-out' },
        { at: AVATAR_VISIBLE, opacity: 1 }, { at: DURATION, opacity: 1 },
      ]);
      const avatarPose = (angle, scale = 1) => `translate(-50%, -50%) rotate(${angle}deg) scale(${scale})`;
      animate(source, [
        { at: 0, transform: avatarPose(0, 0.82) },
        { at: COLOR_START, transform: avatarPose(0, 0.82), easing: 'ease-out' },
        { at: AVATAR_VISIBLE, transform: avatarPose(0), easing: 'cubic-bezier(.45,0,1,1)' },
        { at: SPIN_FAST, transform: avatarPose(360), easing: 'linear' },
        { at: COLOR_MORPH_END, transform: avatarPose(540, 0) },
        { at: DURATION, transform: avatarPose(540, 0) },
      ]);
      animate(avatar, [
        { at: 0, opacity: 1 }, { at: COLOR_MORPH_START, opacity: 1, easing: 'ease-in-out' },
        { at: SPIN_FAST + 60, opacity: 0 }, { at: DURATION, opacity: 0 },
      ]);
      animate(blurredAvatar, [
        { at: 0, opacity: 0 }, { at: COLOR_MORPH_START, opacity: 0, easing: 'ease-in-out' },
        { at: SPIN_FAST + 60, opacity: 1 }, { at: DURATION, opacity: 1 },
      ]);
      animate(orbit, [
        { at: 0, transform: avatarPose(0) },
        { at: AVATAR_VISIBLE, transform: avatarPose(0), easing: 'cubic-bezier(.45,0,1,1)' },
        { at: SPIN_FAST, transform: avatarPose(360) },
        { at: COLOR_MORPH_END, transform: avatarPose(540), easing: 'cubic-bezier(.18,.7,.3,1)' },
        { at: COLOR_STOP, transform: avatarPose(720) },
        { at: DURATION, transform: avatarPose(720) },
      ]);
      glows.forEach(({ element, orb, quadrant, x, y, extent, alpha }, index) => {
        const w = frame.clientWidth, h = frame.clientHeight;
        const cx = x * w, cy = y * h;
        const radius = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * extent;
        Object.assign(element.style, { left: `${cx - radius}px`, top: `${cy - radius}px`, width: `${radius * 2}px`, height: `${radius * 2}px` });
        const orbitRadius = source.clientWidth * 0.23;
        const ox = quadrant[0] * orbitRadius, oy = quadrant[1] * orbitRadius;
        const chargedX = ox * 0.22, chargedY = oy * 0.22;
        const start = COLOR_BLOOM + index * 30;
        const dissolved = start + 80;
        const end = start + 1550;
        const flightEase = 'cubic-bezier(.18,.78,.32,1)';
        const ballPose = (dx, dy, scale = 1) => `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
        animate(orb, [
          { at: 0, transform: ballPose(ox * 0.5, oy * 0.5, 0.55) },
          { at: COLOR_MORPH_START, transform: ballPose(ox * 0.5, oy * 0.5, 0.55), easing: 'ease-out' },
          { at: COLOR_MORPH_END, transform: ballPose(ox, oy) },
          { at: COLOR_CHARGE, transform: ballPose(ox, oy), easing: 'cubic-bezier(.45,0,.8,1)' },
          { at: COLOR_CHARGED, transform: ballPose(chargedX, chargedY, 0.72) },
          { at: start, transform: ballPose(chargedX, chargedY, 0.72), easing: 'ease-out' },
          { at: dissolved, transform: ballPose(chargedX, chargedY, 1.15) },
          { at: DURATION, transform: ballPose(chargedX, chargedY, 1.15) },
        ]);
        animate(orb, [
          { at: 0, opacity: 0 }, { at: COLOR_MORPH_START, opacity: 0, easing: 'ease-out' },
          { at: COLOR_MORPH_START + 140, opacity: 1 },
          { at: start, opacity: 1, easing: 'ease-in-out' },
          { at: dissolved, opacity: 0 }, { at: DURATION, opacity: 0 },
        ]);
        const origin = `translate3d(${w / 2 + chargedX - cx}px, ${h / 2 + chargedY - cy}px, 0) scale(0.04)`;
        animate(element, [
          // Soften the charged spheres in place, then launch only the diffuse
          // colors. A solid ball must never ride on top of its expanding glow.
          { at: 0, transform: origin }, { at: dissolved, transform: origin, easing: flightEase },
          { at: end, transform: 'translate3d(0, 0, 0) scale(1)' },
          { at: DURATION, transform: 'translate3d(0, 0, 0) scale(1)' },
        ]);
        animate(element, [
          { at: 0, opacity: 0 }, { at: start, opacity: 0, easing: 'ease-in-out' },
          { at: dissolved, opacity: 0.58, easing: 'ease-in-out' },
          { at: start + 520, opacity: 0.36, easing: 'ease-out' },
          { at: end, opacity: alpha }, { at: DURATION, opacity: alpha },
        ]);
      });
      // The brand outline emphasizes both directions of the radius change.
      // It fades after the shape settles, then the white thickness edge appears.
      animate(highlight, [
        { at: 0, opacity: 0 }, { at: GLASS_END, opacity: 0, easing: 'ease-out' },
        { at: BRAND_PEAK, opacity: 1 }, { at: RADIUS_END, opacity: 1, easing: 'ease-in-out' },
        { at: BRAND_END, opacity: 0, easing: 'ease-out' },
        { at: COLOR_END, opacity: 0, easing: 'ease-out' },
        { at: EDGE_END, opacity: 1 }, { at: PARTS[0].start, opacity: 1 },
        { at: PARTS[0].start + LAND, opacity: 0 }, { at: DURATION, opacity: 0 },
      ]);
      animate(frame, [
        { at: 0, borderColor: frameBorder }, { at: GLASS_END, borderColor: frameBorder, easing: 'ease-out' },
        { at: BRAND_PEAK, borderColor: brandColor, easing: 'ease-in-out' },
        { at: BRAND_FOCUS, borderColor: softBrandColor }, { at: RADIUS_END, borderColor: softBrandColor, easing: 'ease-in-out' },
        { at: BRAND_END, borderColor: frameBorder }, { at: DURATION, borderColor: frameBorder },
      ]);
      animate(highlight, [
        { at: 0, borderColor: edgeColor, boxShadow: edgeShadow },
        { at: GLASS_END, borderColor: edgeColor, boxShadow: edgeShadow, easing: 'ease-out' },
        { at: BRAND_PEAK, borderColor: brandColor, boxShadow: brandEdgeShadow, easing: 'ease-in-out' },
        { at: BRAND_FOCUS, borderColor: softBrandColor, boxShadow: softBrandShadow },
        { at: RADIUS_END, borderColor: softBrandColor, boxShadow: softBrandShadow, easing: 'ease-in-out' },
        { at: BRAND_END, borderColor: edgeColor, boxShadow: edgeShadow },
        { at: DURATION, borderColor: edgeColor, boxShadow: edgeShadow },
      ]);
      // Establish the full brand outline first, then concentrate its color at
      // the four corners while the radius expands and returns.
      animate(corners, [
        { at: 0, opacity: 0 }, { at: BRAND_PEAK, opacity: 0, easing: 'ease-in-out' },
        { at: BRAND_FOCUS, opacity: 1 }, { at: RADIUS_END, opacity: 1, easing: 'ease-in-out' },
        { at: BRAND_END, opacity: 0 }, { at: DURATION, opacity: 0 },
      ]);
      animate(sheen, [
        { at: 0, opacity: 0 }, { at: COLOR_END, opacity: 0, easing: 'ease-out' },
        { at: EDGE_END, opacity: 1 }, { at: DURATION, opacity: 1 },
      ]);
      reveal(desktop.querySelector('.chat-shell-pane'), PANE_START, PANE_END, 'ease-in-out');
      reveal(desktop.querySelector('.msi-content-head'), HEAD_START, HEAD_END);
      // One animated contour drives the background, material layers and outline.
      // The child layers inherit it instead of running separate radius effects.
      animate(frame, [
        { at: 0, borderRadius: '8px' }, { at: GLASS_END, borderRadius: '8px', easing: 'ease-in-out' },
        { at: RADIUS_PEAK, borderRadius: '32px', easing: 'ease-in-out' },
        { at: RADIUS_END, borderRadius: finalRadius }, { at: DURATION, borderRadius: finalRadius },
      ]);
      PARTS.forEach(part => {
        const img = legacy.find(image => Number(image.dataset.part) === part.id);
        const target = destination(part.targets);
        const x = parseFloat(img.style.left);
        const y = parseFloat(img.style.top);
        const w = parseFloat(img.style.width);
        const h = parseFloat(img.style.height);
        // Fit the full original image, in its native aspect ratio, into the new
        // region. Exactly one side fills its region; the other stays contained.
        const imageScale = Math.min(target.w * scaleX / img.naturalWidth, target.h * scaleY / img.naturalHeight);
        const fittedWidth = img.naturalWidth * imageScale / scaleX;
        const fittedHeight = img.naturalHeight * imageScale / scaleY;
        const landX = target.x - x + (target.w - w) / 2;
        const landY = target.y - y + (target.h - h) / 2;
        const landed = cardTransform(landX, landY, fittedWidth / w, fittedHeight / h);
        const flat = cardTransform(0, 0, 1, 1);
        const pose = explosionPose(part, x, y, w, h);
        const exploded = pose.transform;
        const explodeStart = HOLD + part.delay;
        const lifted = explodeStart + LIFT_DURATION;
        const explodeEnd = explodeStart + EXPLODE_DURATION;
        const liftScale = 1 + (pose.scale - 1) * 0.3;
        const lift = cardTransform(pose.dx * 0.07, pose.dy * 0.07, liftScale, liftScale, pose.rx * 0.25, pose.ry * 0.25);
        const inward = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] }[part.direction];
        const nearShadow = `${inward[0] * 10}px ${inward[1] * 10}px 24px rgb(16 39 75 / 28%), 0 2px 8px rgb(16 39 75 / 16%)`;
        const farShadow = `${inward[0] * 32}px ${inward[1] * 32}px 90px 6px rgb(16 39 75 / 18%), ${inward[0] * 8}px ${inward[1] * 8}px 20px rgb(16 39 75 / 12%)`;
        // Follow the docked card and cast inward so the screen clip cannot hide
        // its entire shadow. Keep the projection broad at the higher elevation.
        const projection = `translate(${pose.dx + inward[0] * 28}px, ${pose.dy + inward[1] * 28}px) scale(${1 + (Math.min(pose.scale, 1.2) - 1) * 2})`;
        const contact = part.start + LAND;
        // Sample the eased ground projection; the card itself uses the browser's
        // continuous transform curve, independently of all shadow properties.
        const returnTimes = [...new Set([
          ...Array.from({ length: 33 }, (_, i) => i / 32),
          (LAND - REVEAL_LEAD) / LAND,
        ])].sort((a, b) => a - b);
        const returning = returnTimes.map(t => {
          const progress = easedProgress(t, FLIGHT_EASE);
          const elevation = 1 - progress;
          const mix = (from, to) => from + (to - from) * progress;
          const state = {
            dx: mix(pose.dx, landX), dy: mix(pose.dy, landY),
            sx: mix(pose.scale, fittedWidth / w), sy: mix(pose.scale, fittedHeight / h),
            rx: pose.rx * elevation, ry: pose.ry * elevation, elevation,
          };
          const shadow = flightShadow(state, pose, inward);
          const at = part.start + t * LAND;
          const fade = easedProgress((at - (contact - REVEAL_LEAD)) / (REVEAL_LEAD + REPLACE), [0, 0, 0.58, 1]);
          return { at, shadow, visibility: 1 - fade, opacity: shadow.opacity * (1 - fade) };
        });
        const contactShadow = returning.at(-1).shadow;
        const groundShadow = shadows.get(part.id);
        const cardShadow = cardShadows.get(part.id);
        cardShadow.textures[0].style.boxShadow = `${inward[0] * 2}px ${inward[1] * 2}px 3px rgb(16 39 75 / 28%), 0 2px 2px rgb(16 39 75 / 16%)`;
        cardShadow.textures[1].style.boxShadow = nearShadow;
        cardShadow.textures[2].style.boxShadow = farShadow;
        const initialRadius = getComputedStyle(img).borderRadius;
        animate(img, [
          { at: 0, borderRadius: initialRadius },
          { at: explodeStart, borderRadius: initialRadius, easing: 'steps(1, start)' },
          { at: lifted, borderRadius: '8px' },
          { at: DURATION, borderRadius: '8px' },
        ]);
        const motion = [
          { at: 0, transform: flat },
          { at: explodeStart, transform: flat, easing: 'ease-in-out' },
          { at: lifted, transform: lift, easing: 'cubic-bezier(.35,0,.25,1)' },
          { at: explodeEnd, transform: exploded },
          { at: part.start, transform: exploded, easing: FLIGHT_TIMING },
          { at: contact, transform: landed },
          { at: DURATION, transform: landed },
        ];
        animate(img, motion);
        animate(cardShadow.element, motion);
        animate(cardShadow.element, [
          { at: 0, opacity: 0 }, { at: explodeStart, opacity: 0, easing: 'ease-in-out' },
          { at: lifted, opacity: 1 }, { at: part.start - 1, opacity: 1 },
          ...returning.map(({ at, visibility }) => ({ at, opacity: visibility * FLIGHT_SHADOW_STRENGTH })),
          { at: contact + REPLACE, opacity: 0 }, { at: DURATION, opacity: 0 },
        ]);
        blendShadows(cardShadow, CARD_BLURS, [
          { at: 0, blur: 24 }, { at: lifted, blur: 24, easing: 'cubic-bezier(.35,0,.25,1)' },
          { at: explodeEnd, blur: 90 },
          ...returning.map(({ at, shadow }) => ({ at, blur: shadow.cardBlur })),
          { at: DURATION, blur: 3 },
        ]);
        animate(groundShadow.element, [
          { at: 0, transform: 'translate(0, 0) scale(1)' },
          { at: explodeStart, transform: 'translate(0, 0) scale(1)', easing: 'ease-out' },
          { at: lifted, transform: `translate(${inward[0] * 10}px, ${inward[1] * 10}px) scale(1.025)`, easing: 'cubic-bezier(.35,0,.25,1)' },
          { at: explodeEnd, transform: projection },
          ...returning.map(({ at, shadow }) => ({ at, transform: shadow.transform })),
          { at: DURATION, transform: contactShadow.transform },
        ]);
        blendShadows(groundShadow, GROUND_BLURS, [
          { at: 0, blur: 2 }, { at: explodeStart, blur: 2, easing: 'ease-out' },
          { at: lifted, blur: 10, easing: 'cubic-bezier(.35,0,.25,1)' },
          { at: explodeEnd, blur: 42 },
          ...returning.map(({ at, shadow }) => ({ at, blur: shadow.blur })),
          { at: DURATION, blur: 2 },
        ]);
        animate(groundShadow.element, [
          { at: 0, opacity: 0 }, { at: explodeStart, opacity: 0, easing: 'ease-out' },
          { at: lifted, opacity: 0.22, easing: 'cubic-bezier(.35,0,.25,1)' },
          { at: explodeEnd, opacity: 0.12 },
          { at: part.start - 1, opacity: 0.12 },
          ...returning.map(({ at, opacity }) => ({ at, opacity })),
          { at: contact + REPLACE, opacity: 0 }, { at: DURATION, opacity: 0 },
        ]);
        animate(img, [
          { at: 0, opacity: 1 }, { at: part.start - 200, opacity: 1, easing: 'ease-out' },
          { at: part.start, opacity: FLIGHT_OPACITY },
          { at: contact - REVEAL_LEAD, opacity: FLIGHT_OPACITY, easing: 'ease-out' },
          { at: contact + REPLACE, opacity: 0 }, { at: DURATION, opacity: 0 },
        ]);
        [...part.targets, ...(part.extra || [])].forEach(selector => reveal(desktop.querySelector(selector), contact - REVEAL_LEAD, contact + REPLACE));
      });
      for (const ui of [controls]) {
        animate(ui, [
          { at: 0, opacity: 1 }, { at: DURATION - 250, opacity: 1 }, { at: DURATION, opacity: 0 },
        ]);
      }
      animations.forEach(animation => { animation.currentTime = time; });
    }

    function update(time) {
      if (time >= CHAT_REVEAL && previousTime < CHAT_REVEAL) document.dispatchEvent(new Event('msi:assistant-welcome'));
      previousTime = time;
      let state;
      if (time < HOLD) state = 'hold';
      else if (time < GLASS_START) state = 'explode';
      else if (time < GLASS_LOW) state = 'glass-thinning';
      else if (time < GLASS_RESTORE) state = 'glass-clear';
      else if (time < GLASS_END) state = 'glass';
      else if (time < RADIUS_END) state = 'glass-radius';
      else if (time < BRAND_END) state = 'glass-radius-glow';
      else if (time < COLOR_START) state = 'color-intro';
      else if (time < COLOR_MORPH_START) state = 'color-avatar';
      else if (time < COLOR_STOP) state = 'color-morph';
      else if (time < COLOR_BLOOM) state = 'color-charge';
      else if (time < COLOR_END) state = 'color-fill';
      else if (time < EDGE_END) state = 'glass-edge';
      else if (time < PARTS[0].start) state = 'component-intro';
      else if (time >= PANE_START && time < HEAD_START) state = 'pane';
      else if (time >= HEAD_START && time < PARTS[2].start) state = 'content-head';
      else if (time < DURATION) {
        const index = PARTS.findLastIndex(part => time >= part.start);
        state = 'part-' + PARTS[index].id;
      } else state = 'complete';
      document.body.dataset.upgradeState = state;
      if (state === lastStatus) return;
      lastStatus = state;
    }

    const currentTime = () => handedOff ? DURATION : Math.min(DURATION, Math.max(0, animations[0]?.currentTime || 0));
    function finish() {
      if (!initialized || handedOff) return;
      playing = false;
      resumeOnVisible = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      // Keep the same DOM, canvas and listeners, and remove only presentation.
      document.body.classList.remove('is-upgrade-playing');
      animations.forEach(animation => animation.cancel());
      highlight.remove();
      prefill.remove();
      stage.remove();
      controls.remove();
      playback.remove();
      desktop.inert = false;
      handedOff = true;
      lifecycle.abort();
      document.body.dataset.upgradeState = 'complete';
      document.title = 'MindStudio Insight · 时间线';
      onFinish();
    }
    function tick() {
      const time = currentTime();
      update(time);
      if (time >= DURATION) { finish(); return; }
      if (playing) raf = requestAnimationFrame(tick);
    }
    function pause() {
      playing = false;
      animations.forEach(animation => animation.pause());
      cancelAnimationFrame(raf);
      playButton.textContent = '继续';
    }
    function play() {
      if (!initialized || handedOff) return;
      playing = true;
      const origin = document.timeline.currentTime - currentTime();
      animations.forEach(animation => { animation.play(); animation.startTime = origin; });
      playButton.textContent = '暂停';
      playButton.disabled = false;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }
    function seek(time) {
      if (!initialized || handedOff) return;
      pause();
      const value = Math.min(DURATION, Math.max(0, time));
      animations.forEach(animation => { animation.currentTime = value; });
      update(value);
      if (value >= DURATION) finish();
    }
    function replay() { seek(0); play(); }
    playButton.addEventListener('click', () => playing ? pause() : play());
    const dismiss = () => { dismissRequested = true; seek(DURATION); };
    controls.querySelector('.vu-close').addEventListener('click', dismiss);
    document.addEventListener('keydown', event => {
      if (handedOff) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
      } else if (event.code === 'Space' && !event.target.closest('button, a, input, textarea')) {
        event.preventDefault();
        if (playing) pause();
        else play();
      }
    }, { capture: true, signal: lifecycle.signal });
    document.addEventListener('visibilitychange', () => {
      if (handedOff) return;
      if (document.hidden) { resumeOnVisible = playing; if (playing) pause(); }
      else if (resumeOnVisible) { resumeOnVisible = false; play(); }
    }, { signal: lifecycle.signal });
    window.addEventListener('resize', () => {
      if (handedOff || !initialized) return;
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        const time = currentTime();
        const wasPlaying = playing;
        pause();
        fit();
        buildTimeline(time);
        if (wasPlaying) play();
      });
    }, { signal: lifecycle.signal });

    async function prepare() {
      await Promise.all([...legacy, avatar, blurredAvatar].map(img => img.decode()));
      await document.fonts.ready;
      document.querySelector('#msiTree .msi-tree-row[aria-label="profile_dir"]:not([data-rank])')?.click();
      document.querySelector('[data-analysis-tab="timeline"]').click();
      const panel = document.getElementById('trainChatPanel');
      if (panel.classList.contains('is-floating')) document.getElementById('trainChatFloatBtn').click();
      if (!panel.classList.contains('is-open')) document.getElementById('trainChatToggle').click();
      window.WZH_LOCATE_LANE('comm-pp-ops');
      const bar = document.querySelector('#msiSwimBody .msi-bar[data-task-id="comm-pp-b"]');
      if (!bar) throw new Error('The requested hcom_batchSendRecv__128_4_1 timeline event is missing');
      bar.click();
      const selection = document.getElementById('msiSelectionPanel');
      if (selection.classList.contains('is-collapsed')) document.getElementById('msiDetailClose').click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      fit();
      buildTimeline();
      initialized = true;
      playButton.disabled = false;
      window.MSI_VISUAL_UPGRADE = Object.freeze({
        replay, pause, play, seek, duration: DURATION,
        parts: PARTS.map(({ id, start, targets, direction, offscreen, delay }) => Object.freeze({ id, start, contact: start + LAND, reveal: start + LAND - REVEAL_LEAD, end: start + LAND + REPLACE, targets: [...targets], direction, offscreen: !!offscreen, explodeStart: HOLD + delay, explodeEnd: HOLD + delay + EXPLODE_DURATION })),
        head: Object.freeze({ start: HEAD_START, end: HEAD_END }),
        color: Object.freeze({ start: COLOR_START, visible: AVATAR_VISIBLE, fast: SPIN_FAST, morphStart: COLOR_MORPH_START, morphed: COLOR_MORPH_END, stopped: COLOR_STOP, charge: COLOR_CHARGE, charged: COLOR_CHARGED, spun: COLOR_STOP, bloom: COLOR_BLOOM, settled: COLOR_SETTLED, handoff: COLOR_HANDOFF, end: COLOR_END, turns: 2 }),
        material: Object.freeze({ start: GLASS_START, low: GLASS_LOW, restore: GLASS_RESTORE, end: GLASS_END, opacity: shellOpacity, blur: glassBlur, radiusPeak: RADIUS_PEAK, radiusEnd: RADIUS_END, radius: finalRadius, edgeEnd: EDGE_END, brandStart: GLASS_END, brandPeak: BRAND_PEAK, brandFocus: BRAND_FOCUS, brandEnd: BRAND_END, brand: brandColor, paneStart: PANE_START, paneEnd: PANE_END }),
        explosion: Object.freeze({ start: HOLD, complete: EXPLODED, peek: EDGE_PEEK_Y, peekX: EDGE_PEEK_X, peekY: EDGE_PEEK_Y, lift: LIFT_DURATION, perspective: PERSPECTIVE }),
      });
      if (dismissRequested || matchMedia('(prefers-reduced-motion: reduce)').matches) seek(DURATION);
      else replay();
    }
    prepare().catch(error => {
      console.error('Unable to prepare visual upgrade:', error);
      initialized = true;
      finish();
      document.body.dataset.upgradeState = 'error';
    });
    window.addEventListener('pagehide', event => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      if (event.persisted) { if (playing) { pause(); resumeOnVisible = true; } return; }
      animations.forEach(animation => animation.cancel());
    }, { signal: lifecycle.signal });
    window.addEventListener('pageshow', event => {
      if (event.persisted && resumeOnVisible && !handedOff) { resumeOnVisible = false; play(); }
    }, { signal: lifecycle.signal });
  }

  function initHost() {
    const entry = document.querySelector('.msi-visual-upgrade-entry');
    if (!entry) return;
    let active = false;
    function loadStyles() {
      if (document.getElementById('visualUpgradeStyles')) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.id = 'visualUpgradeStyles';
        link.rel = 'stylesheet';
        link.href = '../visual-upgrade.css';
        link.onload = resolve;
        link.onerror = () => { link.remove(); reject(new Error('Unable to load visual upgrade styles')); };
        document.head.append(link);
      });
    }
    function loadLayer() {
      return new Promise((resolve, reject) => {
        // postMessage also supports direct-open file: pages with opaque origins.
        const loader = document.createElement('iframe');
        loader.hidden = true;
        loader.tabIndex = -1;
        loader.setAttribute('aria-hidden', 'true');
        const clean = () => { clearTimeout(timer); window.removeEventListener('message', receive); loader.remove(); };
        const receive = event => {
          if (event.source !== loader.contentWindow || event.data?.type !== 'msi:visual-upgrade-layer' || typeof event.data.markup !== 'string') return;
          const parsed = new DOMParser().parseFromString(event.data.markup, 'text/html');
          const stage = parsed.querySelector('.vu-stage');
          clean();
          if (stage) resolve(document.importNode(stage, true));
          else reject(new Error('Visual upgrade layer is missing'));
        };
        const timer = setTimeout(() => { clean(); reject(new Error('Visual upgrade layer timed out')); }, 12000);
        window.addEventListener('message', receive);
        loader.src = entry.href;
        document.body.append(loader);
      });
    }
    async function launch() {
      if (active) return;
      active = true;
      entry.setAttribute('aria-busy', 'true');
      delete window.MSI_VISUAL_UPGRADE;
      try {
        await loadStyles();
        const stage = await loadLayer();
        const desktop = document.getElementById('msiDesktop');
        desktop.append(stage);
        desktop.inert = true;
        document.body.classList.add('visual-upgrade-page', 'is-upgrade-playing');
        document.body.dataset.upgradeState = 'loading';
        run(stage, () => { active = false; entry.removeAttribute('aria-busy'); });
      } catch (error) {
        active = false;
        entry.removeAttribute('aria-busy');
        console.error('Unable to open visual upgrade:', error);
      }
    }
    entry.addEventListener('click', event => { event.preventDefault(); launch(); });
    const address = new URL(location.href);
    if (address.searchParams.has('visual-upgrade')) {
      address.searchParams.delete('visual-upgrade');
      history.replaceState(history.state, '', address.href);
      launch();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHost, { once: true });
  else initHost();
})();

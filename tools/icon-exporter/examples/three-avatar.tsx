/**
 * 示例 3：three.js WebGL
 * 验证 WebGL + 透明底 + rAF 驱动的完整链路。
 *
 * 三个关键点（你们组件库里的 three 图标也必须满足，否则导出会是黑底）：
 *   1. WebGLRenderer 传 alpha: true
 *   2. setClearColor(色值, 0) —— 第二个参数是 clearAlpha，必须是 0
 *   3. 动画进度从 rAF 的 timestamp 推导，不要用 Date.now() 或自增计数器
 */
import * as THREE from "three";

export function mount(el: HTMLElement, props: { size?: number } = {}) {
  const size = props.size ?? 200;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,          // ① 允许透明
    antialias: true,
    preserveDrawingBuffer: true, // 截图前不丢弃 buffer，headless 抽帧必须开
  });
  renderer.setPixelRatio(1); // 导出倍率由 --scale 控制，这里固定 1 免得叠加
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0); // ② clearAlpha = 0
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene(); // 注意不要设 scene.background
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5);

  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.IcosahedronGeometry(1.15, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4f7dff, roughness: 0.25, metalness: 0.55, flatShading: true,
  });
  group.add(new THREE.Mesh(geo, mat));

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0xa9c4ff, transparent: true, opacity: 0.9 })
  );
  group.add(wire);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.6);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const PERIOD = 3000; // 一个完整循环 3 秒 —— 导出时长设成 3s 就能无缝循环

  function frame(t: number) {
    // ③ 进度完全由 t 决定，同一个 t 永远画出同一帧
    const phase = ((t % PERIOD) / PERIOD) * Math.PI * 2;
    group.rotation.y = phase;
    group.rotation.x = Math.sin(phase) * 0.35;
    group.scale.setScalar(1 + Math.sin(phase * 2) * 0.06);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

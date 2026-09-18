// 配置文件用法演示：node bin/icon-export.mjs --config examples/icon-export.config.demo.mjs
// 用零依赖的原生 WebGL 示例，拿到文件夹就能直接跑通。
export default {
  entry: "./webgl-raw.tsx",
  width: 128,
  height: 128,
  fps: 20,
  duration: 2,          // webgl-raw 的动画周期正好 2 秒，循环无缝
  out: "../out/from-config",
  formats: ["webp", "gif"],
  props: { size: 128 },
  gif: { alphaThreshold: 110 },
  webp: { lossless: false, quality: 88 },
};

/**
 * 配置文件示例。
 *
 * 用法：把它复制到你的组件库项目根目录，改名 icon-export.config.mjs，
 * 然后在该目录下执行 `node <本工具路径>/bin/icon-export.mjs`。
 *
 * 优先级：默认值 < 本文件 < 命令行参数
 * 注意：entry / publicDir 里的相对路径，是相对本配置文件所在目录解析的。
 */
export default {
  // ---- 输入 ----
  entry: "./src/icons/AvatarLive.tsx",
  framework: "auto",      // auto | react | vanilla
  export: null,           // 指定具名导出，比如 "AvatarLive"；null 则取 default
  props: {                // 传给组件的 props
    size: 200,
    theme: "brand",
  },
  publicDir: null,        // 组件运行时 fetch 的贴图/字体目录，会被挂到 http:// 根路径

  // ---- 画面 ----
  width: 200,
  height: 200,
  scale: 2,               // 导 2x 图；最终像素是 400×400
  background: "transparent", // 填 CSS 颜色则导出不透明版本

  // ---- 时间 ----
  fps: 25,                // GIF 建议 50/25/20/10，其它值会被 GIF 的 10ms 粒度取整
  duration: 2,            // 秒
  frames: null,           // 直接指定帧数，优先于 duration
  warmup: 0,              // 开录前先空跑几秒，用来跳过入场动画只录循环段
  subframes: 1,           // 每输出帧之间跑几次 rAF；物理/弹簧动画调到 2~4 更准

  // ---- 输出 ----
  out: "./dist/icons/avatar-live",
  formats: ["apng", "webp", "gif"],  // apng | webp | gif | png

  gif: {
    colors: 255,          // 可见色数上限（另有 1 个色号留给透明）
    alphaThreshold: 128,  // alpha 低于此值判为全透明；边缘发虚就调低，发毛刺就调高
    palette: "global",    // global 更稳、体积更小；per-frame 每帧配色更准但会闪
    matte: null,          // 传 [255,255,255] 则放弃透明，直接合成到白底
    loops: 0,             // 0 = 无限循环
  },
  webp: {
    lossless: true,       // 扁平色块图标用无损通常更小；有渐变/发光改成 false
    quality: 90,          // lossless: false 时生效
    method: 4,            // 0~6，越大压得越狠也越慢
    loops: 0,
  },
  apng: {
    colors: 0,            // 0 = 无损 32 位；填 2~256 走调色板量化，体积能小一大截
    loops: 0,
  },

  // ---- 环境 ----
  chrome: null,           // 指定 Chrome 路径；也可用环境变量 CHROME_PATH
  gpu: false,             // true 用真实 GPU；默认软件渲染（SwiftShader），跨机器结果更一致
  verbose: false,
};

# icon-exporter

把**用代码写的动效图标**（React 组件 / CSS 动画 / Canvas / three.js / SVG）渲染成**透明底的动图**，供其它工程直接以 `<img>` 引用。

输出 **APNG / 动画 WebP / GIF / PNG 序列**，四种都带透明通道。

---

## 交付形态

**这是一个自带依赖、拷走即用的文件夹。**

- `node_modules/` 已随包提供（58 MB / 86 个包），**不含任何平台相关的原生二进制**——依赖全部是纯 JS 或 WASM，Windows / macOS / Linux 通用，拷过去不用重装。
- 唯一的外部要求：目标机器上有 **Node ≥ 18** 和 **Chrome 或 Edge**（浏览器无法打包进来，见下）。

> 打包 esbuild 用的是 `esbuild-wasm` 而不是原生 `esbuild`，就是为了这一点：原生版每个平台一个二进制，文件夹就没法跨机器拷贝了。代价是打包慢约 1 秒，可忽略。

---

## 给接手 Agent 的快速上手

```bash
# 1. 进入本目录
cd icon-exporter

# 2. 自检（务必先跑这个）
npm run doctor

# 3. 全绿之后，导出你的图标
node bin/icon-export.mjs <入口文件> -o <输出前缀> -f apng,webp,gif
```

`npm run doctor` 会依次验证：Node 版本 → 依赖完整性 → Chrome → 打包 → 抽帧 → 透明通道 → 动画是否在动 → 三个编码器 → 确定性。**全部打勾才能开始正式工作**，否则先按下面的排查表解决。

正常输出长这样：

```
icon-exporter 环境自检
────────────────────────────────────────────────────
  ✓ Node 版本                v24.14.0 win32/x64
  ✓ 依赖完整性                  5 个包齐全
  ✓ Chrome                 C:\...\chrome.exe
  ✓ 打包 + 抽帧                10 帧 / 3.2s（含 WebGL 渲染）
  ✓ 透明通道                   全透明 75% / 不透明 24%
  ✓ 动画是否在动                 首帧与中间帧差异 22.8%
  ✓ APNG 编码                25.5 KB
  ✓ WebP 编码                24.0 KB
  ✓ GIF 编码                 27.7 KB
  ✓ 确定性                    两次运行完全一致 (944c9ad5fb97)
────────────────────────────────────────────────────
```

---

## 环境要求与安装

### Node ≥ 18

`node -v` 检查。用到了 `??=`、顶层 await 等特性。

### Chrome 或 Edge（唯一必须在目标机器上准备的东西）

浏览器有 150 MB+ 且强平台相关，**无法随文件夹分发**。工具会按这个顺序自动查找：

1. `--chrome <路径>` 参数
2. 环境变量 `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH`
3. 系统安装位置（Windows 的 Program Files / LocalAppData，macOS 的 /Applications，Linux 的 /usr/bin）
4. puppeteer 自己的缓存目录 `~/.cache/puppeteer`

都找不到时会把尝试过的路径打出来。Linux 服务器上装一个：

```bash
apt-get install -y chromium            # Debian/Ubuntu
# 或者
npx @puppeteer/browsers install chrome@stable
```

无 root 的 Linux 环境可能还需要 `--no-sandbox`，见下方常见问题。

### 依赖

正常情况下**什么都不用装**，`node_modules/` 已经在文件夹里了。

只有当 `npm run doctor` 报「依赖完整性 ✗」时才需要恢复：

```bash
npm ci          # 按 package-lock.json 精确还原，推荐
npm install     # 没有 lock 文件时的退路
```

依赖清单（5 个，全部纯 JS / WASM）：

| 包 | 用途 |
|---|---|
| `esbuild-wasm` | 打包用户组件（TS/JSX/CSS） |
| `puppeteer-core` | 驱动无头 Chrome，**不下载浏览器** |
| `upng-js` | PNG 解码 + APNG 编码 |
| `gifenc` | GIF 编码 |
| `node-webpmux` | 动画 WebP 编码（内置 libwebp.wasm） |

---

## 制作流程（SOP）

### 第 1 步：写一个适配入口

**不要改组件库源码。** 在目标项目里新建一个几行的入口文件，把要导出的图标以固定 props 渲染出来：

```tsx
// export-entries/avatar-live.tsx
import "@company/ui/dist/style.css";
import { AvatarLive } from "@company/ui";

export default () => <AvatarLive size={200} status="speaking" />;
```

这个文件放在**目标项目里**（不是放在 icon-exporter 里），因为依赖是按入口文件所在位置逐级向上解析的——`@company/ui`、`react`、`three` 都从那个项目的 `node_modules` 找。icon-exporter 自己不需要装这些。

### 第 2 步：确认动画周期，定时长

看组件的动画周期，让**导出时长 = 周期的整数倍**，循环才无缝。
比如 `animation: spin 2s linear infinite` → 用 `-d 2`。

有入场动画、只想录稳定循环段的，用 `--warmup` 先空跑掉：`--warmup 1.5 -d 2`。

### 第 3 步：先出一版小尺寸的看效果

```bash
node bin/icon-export.mjs ../../export-entries/avatar-live.tsx \
  -o out/preview -f apng -s 120 -d 2 --fps 12
```

打开 `out/preview.png` 目视确认：内容对不对、背景是不是透明、循环顺不顺。

### 第 4 步：确认无误后出正式产物

```bash
node bin/icon-export.mjs ../../export-entries/avatar-live.tsx \
  -o dist/avatar-live -f apng,webp,gif -s 200 --scale 2 --fps 25 -d 2
```

批量导多个图标时用配置文件，见 [icon-export.config.example.mjs](icon-export.config.example.mjs)，然后 `node bin/icon-export.mjs --config <路径>`。

### 第 5 步：验收

- 尺寸符合预期（`--scale 2` 时实际像素是 `-s` 的两倍）
- APNG/WebP 用浏览器打开确认透明和循环
- GIF 单独检查边缘（1bit 透明，见下）
- 需要进 CI 的话，同样输入会产出**逐字节相同**的文件，可以直接做产物 diff

---

## 入口文件的两种写法

工具**自动识别**，不用指定。

### 形态一：React 组件（默认导出）

```tsx
export default function AvatarLive({ size = 200 }) {
  return <div style={{ width: size, height: size }}>…</div>;
}
```

具名导出用 `--export AvatarLive` 指定。

### 形态二：`mount` 函数（three.js / Canvas / 原生 DOM）

```ts
export function mount(el: HTMLElement, props: { size?: number }) {
  // 把你的东西塞进 el
  // 返回 Promise 的话，工具会等它 resolve 再开始抽帧
}
```

入口导出了名为 `mount` 的函数就走这条路，此时 React 完全不会被打进包。

`props` 通过 `--props '{"size":200}'` 或配置文件传入。

---

## 组件必须满足的三条约定

导出结果不对，九成是踩了这里。

### 1. 别自己画背景

组件根节点不要设不透明的 `background`。舞台默认透明，画上什么就导出什么。

### 2. 动画进度必须从「时间」推导，不能用自增计数器

```js
// ✅ 对：t 是 rAF 传进来的时间戳，同一个 t 永远画出同一帧
function frame(t) { obj.rotation.y = (t / 3000) * Math.PI * 2; requestAnimationFrame(frame); }

// ❌ 错：帧计数器和虚拟时钟对不上，--subframes / --warmup 一用就错位
let i = 0;
function frame() { obj.rotation.y = (i++ / 90) * Math.PI * 2; requestAnimationFrame(frame); }
```

CSS `@keyframes`、`element.animate()`、SVG `<animate>` 由工具直接 seek，无需改动。

### 3. WebGL（three.js / 原生）必须开 alpha

```js
const renderer = new THREE.WebGLRenderer({
  alpha: true,                 // ① 允许透明
  preserveDrawingBuffer: true, // ② 无头截图必须开，否则截出空白
});
renderer.setClearColor(0x000000, 0);  // ③ clearAlpha = 0
renderer.setPixelRatio(1);            // 导出倍率交给 --scale，否则会叠加
// 另外：不要设 scene.background
```

参照 [examples/webgl-raw.tsx](examples/webgl-raw.tsx)（零依赖，doctor 就是跑的它）和 [examples/three-avatar.tsx](examples/three-avatar.tsx)。

---

## 内置示例

```bash
node bin/icon-export.mjs examples/webgl-raw.tsx        -o out/d1 -f apng  # 原生 WebGL，零依赖
node bin/icon-export.mjs examples/vanilla-canvas.tsx   -o out/d2 -f gif   # Canvas 2D + rAF
node bin/icon-export.mjs examples/react-css-avatar.tsx -o out/d3 -f apng  # React + CSS 动画（需宿主项目有 react）
node bin/icon-export.mjs examples/three-avatar.tsx     -o out/d4 -f webp  # three.js（需先 npm i three）
```

`react-css-avatar.tsx` 和 `three-avatar.tsx` 依赖宿主项目提供 `react` / `three`——它们是**写法参考**，不是自检用例。自检请用 `npm run doctor`。

---

## 选哪个格式

| 格式 | 透明度 | 体积 | 兼容性 | 建议 |
|---|---|---|---|---|
| **APNG** | 完整 8bit | 大 | Chrome/Safari/Firefox/Edge 全支持；不支持的环境退化成显示第一帧 | **默认选它**，`<img src="x.png">` 直接用 |
| **WebP** | 完整 8bit | 最小（约 APNG 的 1/3～1/2） | iOS 14+ / Chrome 32+；IE 不支持 | 在意体积、不用管老浏览器时用 |
| **GIF** | 只有 1bit | 中 | 全世界都支持 | 只在对方**只认 GIF** 时用 |
| **PNG 序列** | 完整 8bit | — | — | 交给设计二次加工，或喂 ffmpeg / AE |

### GIF 的两个硬伤

1. **每帧最多 256 色** —— 渐变、发光会有色带
2. **透明度只有 1 bit** —— 没有半透明，抗锯齿边缘会变成硬锯齿

柔光、阴影、羽化边缘的图标导 GIF 一定掉质量，这是格式限制不是工具问题。

必须用 GIF 时：

- `--gif-alpha 96` —— 阈值调低，边缘更实（但可能带一圈底色）
- `--gif-alpha 170` —— 阈值调高，边缘更干净但更瘦
- `--gif-matte "#ffffff"` —— **放弃透明**直接合成到白底。已知会放在白底上时，效果远好于 1bit 透明
- `--gif-palette per-frame` —— 每帧独立配色，颜色更准但帧间可能轻微闪烁

**GIF 帧率必须用 50 / 25 / 20 / 10 fps**。GIF 帧延迟以 10ms 为单位，其它值会被取整导致实际速度对不上（工具会提醒）。超过 50fps 时多数浏览器还会强制把延迟拉到 100ms，反而更慢。

---

## 参数

```
用法: node bin/icon-export.mjs <入口文件> [选项]
      node bin/icon-export.mjs --config icon-export.config.mjs

  -o, --out <前缀>        输出路径前缀，默认 out/icon
  -f, --format <列表>     apng,webp,gif,png（逗号分隔，默认 apng）
  -s, --size <W[xH]>      画布尺寸，默认 256x256
      --fps <n>           帧率，默认 30
  -d, --duration <秒>     时长，默认 2
      --frames <n>        直接指定帧数（优先于 duration）
      --scale <n>         导出倍率，2 = 2x 图
      --warmup <秒>       开录前先空跑一段（跳过入场动画只录循环段）
      --subframes <n>     每输出帧之间跑几次 rAF，物理/弹簧动画调大更准
      --background <css>  默认 transparent；给了颜色就是不透明导出
      --framework <名>    auto | react | vanilla
      --export <名字>     指定具名导出（默认取 default）
      --props <json>      传给组件的 props
      --public <目录>     静态资源目录（组件里 fetch 的贴图/字体放这）
      --chrome <路径>     指定 Chrome，也可用环境变量 CHROME_PATH
      --gpu               用真实 GPU 而非 SwiftShader
  -v, --verbose           打印页面 console
  -h, --help

GIF 专属:
      --gif-colors <n>        可见色数上限，默认 255
      --gif-alpha <0-255>     透明判定阈值，默认 128
      --gif-palette <模式>    global | per-frame，默认 global
      --gif-matte <#rrggbb>   放弃透明，直接合成到该底色

WebP 专属:
      --webp-lossy            改用有损压缩
      --webp-quality <0-100>  有损质量，默认 90

APNG 专属:
      --apng-colors <n>       0=无损32位（默认），2-256 走调色板量化压体积
```

---

## 排查表

| 现象 | 原因与处理 |
|---|---|
| doctor 报「依赖完整性 ✗」 | `node_modules` 没跟着拷过来或损坏。在本目录执行 `npm ci` |
| doctor 报「Chrome ✗」 | 目标机器没装浏览器。装 Chrome/Edge，或 `export CHROME_PATH=/path/to/chrome` |
| doctor 报「透明通道 ✗」 | 几乎没有透明像素 → alpha 没生效；几乎没有内容 → WebGL 没画出东西。多半是显卡/驱动问题，试 `--gpu` 或换机器 |
| Linux 上 Chrome 起不来 | 无 root 容器需要 `--no-sandbox`。在 [src/capture.mjs](src/capture.mjs) 的 `args` 数组里加上这一项 |
| 导出来是黑底 / 白底 | WebGL 没开 `alpha: true` 或漏了 `setClearColor(x, 0)`；或组件根节点自己设了 background；或你传了 `--background` |
| 导出来是空白 | WebGL 少了 `preserveDrawingBuffer: true` |
| 动画不动，每帧一样 | 组件用了自增计数器而非 rAF 时间戳（见约定 2）；或动画由 `IntersectionObserver` / `:hover` 触发——工具页面里不会发生这些事件，需在入口里手动置为激活态 |
| `Could not resolve "xxx"` | 入口文件所在项目没装这个依赖。依赖是按**入口文件位置**解析的，不是按 icon-exporter 的位置 |
| GIF 边缘毛刺 / 一圈杂色 | 1bit 透明的固有问题。调 `--gif-alpha`，或 `--gif-matte` 指定实际底色，或换 APNG |
| APNG 体积太大 | 先试 `--apng-colors 128`，通常压到 1/3 且肉眼无差；再不行降 `--fps` 或缩短 `-d` |
| 字体和浏览器里不一样 | 系统字体在无头 Chrome 里可能缺失。用 `@font-face` + `--public` 提供字体文件，或直接 `import` 字体（会转成 data URI 打进包） |
| Tailwind class 不生效 | esbuild 不跑 Tailwind。在入口里 `import` 已编译好的 CSS 产物，或改用内联 style |

---

## 原理

不是录屏，是**逐帧确定性渲染**：

1. **打包** —— `esbuild-wasm` 把入口文件（含 TS/JSX/CSS/依赖）打成一个 IIFE。依赖从**入口文件所在项目**的 `node_modules` 解析。
2. **接管时间** —— [src/harness/clock.js](src/harness/clock.js) 在页面任何脚本执行前注入，劫持 `requestAnimationFrame`、`setTimeout`、`setInterval`、`performance.now`、`Date`，并逐帧 seek Web Animations（CSS 动画）和 SVG SMIL。
3. **抽帧** —— 无头 Chrome 里每推进一帧截一张透明 PNG（`omitBackground`）。
4. **编码** —— 纯 JS/WASM 编码器出 APNG / WebP / GIF，**不依赖 ffmpeg**。

因为时间完全由工具驱动，同样的输入永远产出逐字节相同的文件。

---

## 已知限制

- 不导出音频（图标用不上）。
- 需要网络请求的组件：请求会真实发出，但虚拟时钟不会等它。把资源放进 `--public` 目录用相对路径引用最稳。
- 由 `IntersectionObserver`、滚动、鼠标事件触发的动画不会自动开始，需在入口里手动置为激活态。
- 默认走 SwiftShader 软件渲染 WebGL（跨机器结果一致）。复杂着色器可能较慢，可用 `--gpu` 切真实 GPU，但不同显卡输出可能有细微差异。

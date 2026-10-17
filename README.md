## 在线体验

[点击在线访问 InsightChat](https://lovebearanddonkey.github.io/InsightChat/app/pages/chat.html)

# InsightChat

InsightChat 是一个面向性能分析场景的智能对话与数据洞察体验项目。仓库目前同时包含可直接在浏览器中运行的交互原型、报告与数据可视化方案，以及使用 Remotion 构建的产品演示视频。

## 项目内容

- **交互原型**：`chat.html` 提供完整的智能对话工作台演示，包含会话、上下文、模式与模型选择、引导卡片等界面和交互。
- **数据可视化**：包含性能报告模块、Rank 横向对比等可视化页面与设计探索。
- **产品演示视频**：使用 React、TypeScript 和 Remotion 制作，可按完整视频或单个镜头预览、调试和渲染。
- **设计资料**：仓库内保留产品规划、竞品分析、主题规范及报告可视化模块清单，便于继续迭代。

## 快速开始

### 浏览交互原型

直接打开 `app/pages/chat.html`，或使用上方的在线体验地址。`app/pages/timeline.html` 和 `app/pages/compare.html` 分别以时间线、对比模式作为初始视图；三个入口共用同一套外壳与功能代码。对比页默认只勾选基线任务，可用 `?compare=任务名` 指定第二个任务。

页面依赖 `app/` 中的样式与脚本，以及 `src/pic/icon/` 中的图片。移动页面时需保留这些相对目录；如需交付单个 HTML 文件，运行 `npm run build:standalone`，到 `dist/` 中取生成文件。

修改原型时编辑 `app/shell.html`、`app/pages/` 中的视图片段、`app/chat.css` 或 `app/*.js`，然后运行 `npm run build:chat`。`app/pages/` 中的三个入口 HTML 是生成文件，不应直接编辑。

概览和时间线在源码中各占一个视图片段；入口页只决定首次显示哪个视图。页签仍在当前页面内切换，以保留聊天会话和工作台状态。`overview.js` 在时间线、对比入口中等到首次打开概览时才加载。新增视图时，在 `app/pages/` 添加片段，并在 `app/shell.html` 与 `tools/build-chat-pages.cjs` 注册入口。

“内存”页签使用仓库内预置的 PyTorch 示例快照。两张图的外层布局在 `app/chat.css`，图内样式在 `app/memory-viz/host.css`；可视化源码及固定版本在 `app/memory-viz/vendor/`，示例快照原件压缩存放于 `app/memory-viz/snapshot.pickle.gz`。`npm run build:memory-viz` 会将 PyTorch MemoryViz 与 D3 打包为本地脚本，并生成浏览器可直接读取的压缩数据；`build:chat` 和 `build:standalone` 也会自动执行这一步。浏览器运行时不依赖 PyTorch 网站或 CDN，内存资源只在打开页签后加载。示例快照不代表左侧任务的实测数据。

### 运行 Remotion 项目

环境要求：Node.js 和 npm。

```console
npm install
npm run dev
```

启动后，在 Remotion Studio 中可以预览完整的 `Launch` 视频、各个独立镜头以及数据可视化示例。

## 常用命令

```console
# 启动 Remotion Studio
npm run dev

# 检查 ESLint 与 TypeScript
npm run lint

# 构建 Remotion Bundle
npm run build

# 生成原型的三个 HTML 入口
npm run build:chat

# 生成可单独交付的 chat.html 单文件版
npm run build:standalone

# 渲染完整演示视频
npx remotion render Launch out/InsightChat.mp4

# 升级 Remotion 相关依赖
npm run upgrade
```

## 目录结构

```text
InsightChat/
├── app/                       # 原型源码：公共外壳、视图、样式和功能脚本
│   ├── shell.html             # 三个页面共用的 HTML 外壳
│   ├── pages/                 # 三个生成入口和概览、时间线、内存视图片段
│   │   ├── chat.html          # 生成的默认入口
│   │   ├── timeline.html      # 生成的时间线入口
│   │   ├── compare.html       # 生成的对比入口
│   │   ├── overview.html      # 概览视图片段
│   │   ├── timeline-view.html # 时间线视图片段
│   │   └── memory.html        # 内存视图片段
│   ├── chat.css               # 公共样式和视图样式
│   ├── workbench.js           # 工程树、时间线和对比逻辑
│   ├── overview.js            # 概览页数据和交互，按需加载
│   ├── assistant.js           # 智能对话逻辑
│   ├── theme.js               # 主题切换
│   └── resizers.js            # 面板尺寸控制
├── src/
│   ├── components/            # 视频与界面通用组件
│   ├── scenes/                # Remotion 分镜场景
│   ├── pic/                   # 原型及视频使用的图片、图标
│   ├── Root.tsx               # Remotion Composition 注册入口
│   └── Video.tsx              # 完整演示视频编排
├── public/                    # Remotion 使用的公开静态资源
├── handoff/                   # 可独立复用的交互动效交付物
├── v15-report-modules-pto.html
├── v15-report-modules-pto.css # 报告可视化原型
├── tools/build-chat-pages.cjs # 根据公共外壳和视图生成页面
└── PLAN.md                    # 项目规划与实现记录
```

## 技术栈

- HTML、CSS、JavaScript
- React 19
- TypeScript
- Remotion 4
- Tailwind CSS 4

## GitHub Pages

在线原型通过 GitHub Pages 发布。发布源应设置为 `main` 分支的 `/(root)` 目录，对应地址：

<https://lovebearanddonkey.github.io/InsightChat/app/pages/chat.html>

## 许可

本项目当前未声明开源许可证。

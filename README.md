## 在线体验

[点击在线访问 InsightChat](https://lovebearanddonkey.github.io/InsightChat/chat.html)

# InsightChat

InsightChat 是一个面向性能分析场景的智能对话与数据洞察体验项目。仓库目前同时包含可直接在浏览器中运行的交互原型、报告与数据可视化方案，以及使用 Remotion 构建的产品演示视频。

## 项目内容

- **交互原型**：`chat.html` 提供完整的智能对话工作台演示，包含会话、上下文、模式与模型选择、引导卡片等界面和交互。
- **数据可视化**：包含性能报告模块、Rank 横向对比等可视化页面与设计探索。
- **产品演示视频**：使用 React、TypeScript 和 Remotion 制作，可按完整视频或单个镜头预览、调试和渲染。
- **设计资料**：仓库内保留产品规划、竞品分析、主题规范及报告可视化模块清单，便于继续迭代。

## 快速开始

### 浏览交互原型

直接打开仓库根目录下的 `chat.html`，或使用上方的在线体验地址。

页面依赖的图片与图标位于 `src/pic/icon/`，移动或单独复制页面时需要保留相同的相对目录结构。

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

# 渲染完整演示视频
npx remotion render Launch out/InsightChat.mp4

# 升级 Remotion 相关依赖
npm run upgrade
```

## 目录结构

```text
InsightChat/
├── chat.html                  # 智能对话工作台交互原型
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

<https://lovebearanddonkey.github.io/InsightChat/chat.html>

## 许可

本项目当前未声明开源许可证。

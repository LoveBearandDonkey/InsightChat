# 智能对话欢迎页点阵动效 · 开发交付说明

这份目录不是另一份设计稿，而是从 `chat.html` 拆出的最小可运行参考。开发应先用浏览器打开 `demo.html` 对齐观感，再按本文公式移植到客户端的绘图层。

## 交付物

- `demo.html`：零构建、双击可运行的视觉基准，可重播初始波纹、切换明暗主题。
- `welcome-dots.js`：与业务无关的 Web Canvas 参考实现，公开 `create / ripple / refreshTheme / resize / destroy` 五个接口。
- 本文：平台无关的算法、生命周期、验收要求。

不要把整个 `chat.html` 发给客户端让其自行寻找。原页面超过一万行，点阵真正依赖的只有尺寸、参数、绘制公式、输入事件和生命周期。

## 设计目标

底纹是一块从中心向四周淡出的椭圆点阵，不是铺满容器的规则网格。它有两类响应：

1. 欢迎页首次出现、重新打开或“新建对话”后，从中心向外播放一次亮环。
2. 支持鼠标悬停的设备上，指针附近出现柔和亮斑；离开区域后平滑衰减。

静止时不持续刷新。系统启用“减少动态效果”时，只画静态点阵。

## 固定参数（以 CSS 像素/逻辑像素为单位）

| 参数 | 值 | 含义 |
| --- | ---: | --- |
| 参考画布 | 560 × 602 | 与当前设计稿比例一致 |
| `gap` | 10 | 点中心间距 |
| `radius` | 2.0 | 普通点半径 |
| `ellipseRadiusX` | 画布宽 × 0.52 | 椭圆横向半径 |
| `ellipseRadiusY` | 画布高 × 0.42 | 椭圆纵向半径 |
| `rippleDuration` | 1500 ms | 初始波纹时长 |
| `rippleBand` | 90 | 波峰半宽 |
| `hoverRadius` | 130 | 指针影响半径 |
| `hoverEase` | 0.12 / 帧 | 悬浮强度追帧系数 |
| 基础色 | RGB(99, 102, 241) | 蓝紫色 |
| 高亮色 | RGB(123, 37, 244) | 高亮时偏紫 |
| 浅色透明度 | 0.08 | 全局基础透明度 |
| 深色透明度 | 0.22 | 暗色背景需提高浓度 |

高 DPI 屏按设备像素比绘制，但 DPR 上限为 2；所有几何仍使用逻辑像素。

## 平台无关算法

### 1. 生成椭圆点阵

以画布中心 `(cx, cy)` 为原点。对每个网格点 `(x, y)`：

```text
nx = (x - cx) / ellipseRadiusX
ny = (y - cy) / ellipseRadiusY
d  = sqrt(nx² + ny²)
```

当 `d >= 1` 时不创建该点。其余点的基础权重为：

```text
baseAlpha = (1 - d)² × random(0.72, 1.00)
```

平方项让点阵在边缘自然淡出，轻微随机项用于消除规整的椭圆边界。随机值只在点阵重建时生成，不要每帧变化。

### 2. 初始波纹

动画进度 `t = clamp((now - start) / 1500ms, 0, 1)`：

```text
easeOutCubic = 1 - (1 - t)³
waveRadius   = easeOutCubic × (maxDistance + rippleBand)
waveFade     = 1 - t²
distance     = abs(dot.centerDistance - waveRadius)

if distance < rippleBand:
    waveLight = cos(distance / rippleBand × π/2) × waveFade
else:
    waveLight = 0
```

`maxDistance = sqrt(ellipseRadiusX² + ellipseRadiusY²)`。

### 3. 指针悬浮

每帧先更新整体悬浮强度：

```text
hover = hover + (hoverTarget - hover) × 0.12
```

指针进入/移动时 `hoverTarget = 1`，离开时 `hoverTarget = 0`。对半径 130 内的点：

```text
proximity  = 1 - distanceToPointer / 130
hoverLight = proximity² × hover
```

两种效果同时发生时：

```text
light = min(1, waveLight + hoverLight)
```

### 4. 绘制高亮点

普通点：

```text
alpha  = themeAlpha × baseAlpha
radius = 2.0
color  = baseColor
```

高亮点：

```text
alpha  = min(0.9, themeAlpha × baseAlpha × (1 + light × 1.6))
radius = 2.0 × (1 + light × 0.4)
color  = lerp(baseColor, hotColor, light)
```

所以高亮不是只改透明度，而是同时“变浓、变大、偏紫”。少其中一项，质感都会明显不同。

## 生命周期接口

客户端组件建议暴露同等语义的接口：

```text
mount / create     创建点阵、绑定尺寸与指针事件、画静态首帧
playIntro/ripple   欢迎页出现时播放一次中心扩散
resize             尺寸变化后重建点阵并重画
setTheme           更新颜色/透明度并重画
dispose/destroy    取消动画帧、解绑事件、释放绘图资源
```

业务层调用约定：

- 欢迎页进入可见状态：`playIntro()`。
- 欢迎页已存在但抽屉再次展开：再次 `playIntro()`。
- 第一条消息发出、欢迎页被移除：立即 `dispose()`。
- 新建对话重新创建欢迎页：重新 `mount()` 后调用 `playIntro()`。

## 输入与性能要求

- 指针坐标必须换算到画布局部坐标，不能直接使用窗口坐标。
- 事件绑定到整个欢迎区；点阵画布本身不拦截点击。
- 触屏设备不要启用悬浮响应，否则一次点击可能留下永久亮斑。
- 动画帧只在波纹播放、悬浮强度渐变或指针移动时请求；完全静止后必须停止刷新。
- 尺寸变化时重建点阵；主题变化只需更新颜色并重画。
- 避免逐点创建 UI 控件。应使用单个 Canvas、Skia、Metal/OpenGL 视图或等价的批量绘制层。

## 各客户端技术栈对应关系

| Web 参考 | Qt/QML | Flutter | Windows 原生 |
| --- | --- | --- | --- |
| Canvas 2D | `QQuickPaintedItem` 或 Scene Graph | `CustomPainter` | Win2D / Direct2D |
| `requestAnimationFrame` | `QQuickWindow::beforeRendering` / 动画驱动 | `Ticker` | CompositionTarget / DispatcherQueue timer |
| `ResizeObserver` | `geometryChanged` | `LayoutBuilder` / size change | `SizeChanged` |
| `pointermove` | hover/mouse move event | `MouseRegion.onHover` | `PointerMoved` |
| `prefers-reduced-motion` | 系统辅助功能设置 | `disableAnimations` | UI Settings / animations enabled |

不建议用 GIF、视频或序列帧替代：它们无法响应实时指针，也难以同时适配尺寸、主题和高 DPI。

## 验收清单

- [ ] 点阵整体是椭圆淡出，边缘没有清晰轮廓线。
- [ ] 欢迎页出现时只播放一圈 1.5 秒的中心扩散，不循环。
- [ ] 波纹开始快、结束慢，外圈自然衰减而非突然消失。
- [ ] 鼠标附近约 130 逻辑像素内的点变大、变浓并偏紫。
- [ ] 鼠标离开后亮斑平滑消失；触摸点击不会卡住亮斑。
- [ ] 深浅主题下均可见，深色使用更高基础透明度。
- [ ] 缩放窗口或改变 DPI 后保持清晰且居中。
- [ ] 欢迎页关闭后无持续动画帧、无遗留事件监听。
- [ ] 开启“减少动态效果”后只有静态底纹。

## Web 接入示例

```html
<div class="welcome-hero" id="welcomeHero">
  <canvas class="welcome-dots" id="welcomeDots" aria-hidden="true"></canvas>
  <div class="welcome-content">...</div>
</div>
<script src="welcome-dots.js"></script>
<script>
  const dots = WelcomeDots.create(document.querySelector('#welcomeDots'), {
    hitArea: document.querySelector('#welcomeHero'),
  });
  dots.ripple();

  // 欢迎页卸载时必须执行：
  // dots.destroy();
</script>
```

建议让客户端开发提交一段包含以下四幕的录屏用于验收：首次出现、鼠标缓慢划过、快速移出、深浅主题切换。这样比用“感觉差不多”对齐更快。

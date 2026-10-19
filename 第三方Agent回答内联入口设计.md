# 第三方 Agent 回答内联入口设计

本文记录 InsightChat 接入第三方 Agent 时，在回答中提供网页、报告或文件内联入口的控制边界与推荐实现。

核心结论：能否在回答中插入 inline 网页或文件入口，决定因素不是 Agent 是否自研，而是聊天界面和消息渲染器由谁控制。

如果第三方 Agent 通过 API 被 InsightChat 调用，最终消息由 InsightChat 渲染，就可以在编排层为回答增加卡片、按钮、网页预览和文件查看器。这不是修改第三方 Agent 本身，而是对其回答进行产品层组合。

如果回答显示在 ChatGPT、VS Code、Claude 等第三方宿主中，则不能直接向其消息 DOM 注入 HTML，只能使用宿主支持的 MCP Apps、插件、扩展或普通链接。

## 一、三种不同控制场景

| 场景 | 能否插入 inline 入口 | 控制方 |
| --- | --- | --- |
| 第三方 Agent API → InsightChat 自己渲染 | 可以 | InsightChat 前端和编排层 |
| 自建 Agent Runtime，并注册自己的工具 | 可以 | Agent Runtime 和 InsightChat |
| Agent 运行在 ChatGPT、VS Code 等宿主中 | 有条件可以 | 必须由宿主通过 MCP Apps 等受支持机制渲染 |
| Agent 运行在完全封闭的第三方网页中 | 通常不可以 | 除非对方提供插件、MCP 或扩展能力 |

因此，并不是只有自己的 Agent 才可以控制。要实现 inline 入口，至少需要控制以下三层中的一层：

1. Agent Runtime：可以注册工具、规定结构化输出或控制调用流程。
2. 外层消息编排器：可以在第三方 Agent 的回答之外附加 UI 元数据。
3. 最终 UI 宿主：可以决定回答如何渲染以及点击入口后的展示方式。

即使是自研 Agent，如果运行在别人的聊天宿主中，也不能任意注入 HTML。反过来，即使是第三方 Agent，只要它通过 API 把结果返回给 InsightChat，InsightChat 就可以在自己的界面中补充 inline 组件。

## 二、InsightChat 推荐落地架构

不应让第三方 Agent 直接输出并执行 HTML。InsightChat 应定义统一的“回答块协议”，将文本内容与可交互入口分开处理：

```text
第三方 Agent
     │ 文本流/工具结果
     ▼
Agent Adapter
     │ 统一格式
     ▼
InsightChat 编排层 ────── Artifact 文件/报告服务
     │
     ├── answer_delta
     ├── artifact_card
     ├── file_card
     └── open_url
     ▼
chat.html 消息渲染器
     │
     ├── 普通回答文本
     ├── inline 入口卡片
     └── wzh-chat-viz-pane 预览
```

编排层可以通过 SSE 或 WebSocket 返回统一事件。例如：

```json
{
  "type": "artifact_card",
  "artifact": {
    "id": "report-20261016-001",
    "title": "多机多卡训练性能诊断报告",
    "kind": "web_report",
    "url": "/artifacts/report-20261016-001/view",
    "openMode": "side-pane"
  }
}
```

InsightChat 前端收到事件后渲染入口：

```html
<button class="artifact-entry" data-artifact-id="report-20261016-001">
  打开性能诊断报告
</button>
```

用户点击后，在现有的 `wzh-chat-viz-pane` 中打开内容：

```js
function openArtifact(artifact) {
  vizPane.hidden = false;
  vizIframe.src = artifact.url;
}
```

这条实现路径与第三方 Agent 是否原生支持 UI 无关，因为 inline 入口由 InsightChat 编排层附加，由 InsightChat 前端渲染。

## 三、回答中入口的生成方式

### 1. 根据工具结果生成

这是推荐且最可靠的方式。

例如第三方 Agent 调用了性能分析工具，工具返回：

```json
{
  "summary": "检测到通信等待偏高",
  "artifactId": "report-001"
}
```

编排器检测到 `artifactId` 后，自动在回答中插入报告入口。入口的生成不依赖模型是否记得输出某种特殊格式，适合生产环境。

### 2. 使用结构化输出

如果第三方 Agent API 支持 JSON Schema，可以要求其返回文本与附件描述：

```json
{
  "answer": "分析已经完成。",
  "attachments": [
    {
      "type": "report",
      "artifactId": "report-001"
    }
  ]
}
```

InsightChat 只根据结构化数据渲染受控组件，不执行 Agent 返回的任意 HTML。

### 3. 解析回答中的特殊标记

例如约定模型输出：

```text
分析已经完成。

[[open-report:report-001]]
```

前端或编排器再把标记替换为入口卡片。

这种方式可能因模型改写、遗漏、转义或把标记放入代码块而失效，不建议作为主要生产方案，只适合兼容不支持工具结果或结构化输出的 Agent。

## 四、网页和文件的打开方式

### 1. 网页报告

公开网页可以在 iframe 中打开，但必须处理：

- `Content-Security-Policy`。
- `X-Frame-Options`。
- iframe `sandbox` 权限。
- 可加载域名白名单。
- 登录态和跨域 Cookie。
- 外部链接跳转与下载限制。

如果报告由 InsightChat 生成，最好通过同源地址提供：

```text
https://insightchat.example.com/artifacts/{id}/view
```

不要直接信任第三方 Agent 返回的任意 URL 并将其放入 iframe。服务端应校验 URL、协议和来源域名，前端也应使用受限的 iframe sandbox。

### 2. 文件

生产环境不应在消息中直接返回本地绝对路径，例如：

```text
D:\reports\result.html
```

远程浏览器无法访问用户机器上的该路径。文件应先登记为 Artifact，并通过受控接口提供：

```text
GET /api/artifacts/{id}/metadata
GET /api/artifacts/{id}/content
GET /api/artifacts/{id}/download
GET /artifacts/{id}/view
```

消息中只传递 `artifactId`。服务端负责鉴权、文件类型判断、预览转换、Range 下载、有效期和访问审计。

不同类型文件可以使用不同查看方式：

| 文件类型 | 推荐展示方式 |
| --- | --- |
| HTML | sandbox iframe |
| PDF | 浏览器 PDF Viewer 或 PDF.js |
| 图片 | 图片查看器 |
| JSON、日志、代码 | Monaco Editor 或只读文本查看器 |
| 不支持预览的格式 | 文件信息卡片和下载按钮 |

如果文件只存在于本机工作区，需要本地 MCP Server、桌面端或 VS Code 扩展充当本地文件代理。纯 GitHub Pages 无法安全读取用户本地磁盘，也不应在前端保存第三方 Agent 的密钥。

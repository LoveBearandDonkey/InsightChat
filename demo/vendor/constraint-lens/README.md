# Constraint Lens 跨项目资源

来源：`mindspeed-config-mcp/apps/web/prototypes/constraint-lens.html`。
`index.html` 是完整源文件快照，禁止手工修改；`history.js` 从源页签顺序、名称、原始问句生成。
`manifest.json` 记录来源版本、内容 SHA-256、五轮映射和执行模式。实际内容以哈希为准，Git revision 用于追溯基线。

源仓库更新后，按需先运行 `node apps/web/prototypes/build-constraint-lens.mjs` 更新内嵌计算包，再在 InsightChat 根目录运行：

```powershell
npm run sync:constraint-lens
npm run verify:constraint-lens
```

默认寻找同级 `../mindspeed-config-mcp`；其他位置通过 `MINDSPEED_CONFIG_MCP_ROOT` 指定。路径仅用于构建阶段。发布 demo 时携带本目录，无需源仓库、符号链接、跨域访问或额外服务。

宿主使用 `index.html?embed=inline&case=<id>` 按轮嵌入。inline 模式保留原渲染和交互，隐藏页签导航、重复问句、原输入框及说明目录。独立页面默认模式不变。
通信通道为 `mindspeed-constraint-lens/v1`：`resize` 上报高度，`draft` 将“方案置入对话”的文本传给宿主输入框。宿主核对来源窗口、origin、case 和载荷范围，不接收执行指令。

这是构造历史，卡片运行原型本地交互，没有发起 MCP 协议调用。容量仍为 theoretical。业务渲染与计算由源页面及内嵌 config-core 拥有，InsightChat 仅负责历史容器与消息通信。

???????? `theme=light|dark`?????????? storage ??????????`theme` ???? `light` ? `dark`??????????????????

五轮历史默认以 `theme=dark` 加载；外框从首帧使用追光暗色，独立打开链接也携带暗色参数。此默认只作用于这段历史，不改写浏览器的全局主题偏好。

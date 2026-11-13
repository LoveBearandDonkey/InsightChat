# Demo 的两个上游页面如何保持同步

唯一来源是 `mindspeed-config-mcp`，Demo 不单独维护页面实现：

| 上游来源 | Demo 同源快照 |
| --- | --- |
| `apps/web/prototypes/constraint-lens.html` | `demo/vendor/constraint-lens/index.html`，以及自动生成的五轮映射 |
| 基线 `config-relation-plane-mindspeed-config-mcp.html`、MCP UI 适配器、计算核心、契约与构建文件 | `demo/vendor/mindspeed/index.html`，使用浏览器本地计算版完整包 |

工作台不能直接复制基线 HTML：真正嵌入的是经过适配、打包的自包含页面。源指纹覆盖基线目录、UI 适配器、config-core、contracts、构建配置和依赖锁文件。修改其中任意文件后，旧的工作台包即使自身 SHA-256 正确，也会被判为过期。

## 本地使用

在 InsightChat 根目录运行 `npm run preview:demo`：启动前同步两个资源，随后每 1.5 秒检测源文件和目标快照。工作台过期时自动调用上游 `package-github-pages.ps1`，打包后恢复正常 MCP App 资源，再同步 Demo；本预览服务器持有的旧 MCP stdio 连接也会关闭，下次请求从新源码启动，避免页面更新而计算进程仍是旧版本。约束卡片变化只复制该快照，不重建工作台。修改后刷新已打开的 Demo，即可使用最新资源。

继续使用 VS Code Live Server 时，在终端保持 `npm run watch:demo-assets` 运行。Live Server 本身不执行 Node 同步脚本；没有运行监听器时，刷新页面不能保证同步。

也可手动执行：

```powershell
npm run sync:demo-assets
npm run verify:demo-assets
```

默认上游目录为同级 `../mindspeed-config-mcp`；不同路径设置 `MINDSPEED_CONFIG_MCP_ROOT`。需要上游依赖已安装。工作台自动重建沿用现有 Windows PowerShell 打包器；无源仓库、依赖缺失、构建失败都返回错误，不把旧文件报告为最新。已发布的静态 Demo 运行时不需要这些构建依赖。

## 发布检查

`npm run package:demo` 先检查两个快照的内容与上游源码，任何过期、缺失或内容损坏都返回非零退出码，并保留上一次有效输出。检查通过后生成 `dist/demo-pages/`，包含 `/demo/index.html`、同源 iframe 资源和图标；用该目录作为静态站点发布根目录。

`.github/workflows/demo-assets.yml` 在 main 推送、PR、手动执行和每日定时检查时，检出上游 main 并执行同一发布检查，仅在成功时上传 `verified-demo-pages` 产物。两仓修改应先推送上游，再推送已同步的 InsightChat；未推送的本地源修改不会出现在 CI 的上游 main 中。

默认只检查和制备产物，不自动部署。需要发布时，在 Actions 手动运行此工作流并勾选 `publish`：部署 job 必须等待检查成功，只消费验证后的产物。仓库 Settings → Pages → Source 需使用 GitHub Actions；此代码修改不会擅自更改线上设置。若继续使用 GitHub 的“从分支部署”，它不会等待这个自定义检查，不能宣称已强制拦截旧的分支发布流程。

Pages 的本地校验回退默认使用 Demo 随附的同源工作台包；不再自动优先打开另一仓库的线上页面。显式 `MINDSPEED_DEMO_WORKBENCH_URL` 覆盖仍保留。连接真实 MCP 时使用本地 bridge 或远程服务，腾讯云服务版本仍需单独部署。

不要手改两个 vendor 目录中的生成文件。Git 属性按原始字节保存快照，避免换行转换使 SHA-256 失效。source_revision 用于追溯，是否同步以内容指纹为准。

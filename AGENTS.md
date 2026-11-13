# Demo 上游页面同步

- `demo/vendor/constraint-lens/` 与 `demo/vendor/mindspeed/` 为生成资源，不手工维护界面代码。
- 修改两个上游页面、工作台 UI 适配器或计算依赖后，在 InsightChat 执行 `npm run sync:demo-assets` 和 `npm run verify:demo-assets`。
- 本地 Demo 使用 `npm run preview:demo`，会同步并监听；使用 Live Server 时保持 `npm run watch:demo-assets` 运行。
- 发布包只能通过 `npm run package:demo` 生成，检查失败时修复并重新同步，不能绕过源码指纹检查。
- 上游缺失、构建或校验失败须明确报告，不能把旧快照称为最新；线上服务与静态快照分别发布。

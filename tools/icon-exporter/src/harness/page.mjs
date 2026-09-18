/**
 * 生成承载组件的 HTML。
 * 背景必须完全透明 —— 后面 screenshot 的 omitBackground 才能拿到 alpha。
 */
export function buildHarnessHtml({ width, height, js, css, background }) {
  const bg = background && background !== "transparent" ? background : "transparent";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    /* 关掉平滑，避免不同机器上的亚像素抗锯齿差异 */
    -webkit-font-smoothing: antialiased;
  }
  #icon-stage {
    position: fixed;
    top: 0;
    left: 0;
    width: ${width}px;
    height: ${height}px;
    background: ${bg};
    overflow: hidden;
  }
  #icon-root {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
<style id="component-css">${css || ""}</style>
</head>
<body>
  <div id="icon-stage"><div id="icon-root"></div></div>
  <script>
  // 捕获挂载期的报错，让 CLI 能给出有意义的提示而不是干等超时
  window.__iconError = null;
  window.addEventListener("error", (e) => { window.__iconError = String(e.error && e.error.stack || e.message); });
  window.addEventListener("unhandledrejection", (e) => { window.__iconError = String(e.reason && e.reason.stack || e.reason); });
  </script>
  <script>${js}</script>
</body>
</html>`;
}

/** Build a shareable timeline + intelligent-chat HTML from the editable shell. */
const fs = require('fs');
const path = require('path');
const { renderPage } = require('./build-chat-pages.cjs');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const ICON_DIR = path.join(ROOT, 'src', 'pic', 'icon');
const VIZ_SRC = path.join(ROOT, 'v15-report-modules-pto.html');

const stamp = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
})();
const OUT = path.join(OUT_DIR, 'timeline-chat.standalone.' + stamp + '.html');

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };
const EXT = '(?:svg|png|jpe?g|webp|gif|ico)';

const dataUri = (file) => {
  const buf = fs.readFileSync(path.join(ICON_DIR, file));
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error('未知图片类型: ' + file);
  return 'data:' + mime + ';base64,' + buf.toString('base64');
};

const countOf = (text, needle) => text.split(needle).length - 1;

const inlineCssImports = (file, stack = []) => {
  const resolved = path.resolve(file);
  if (stack.includes(resolved)) throw new Error('CSS @import 循环引用: ' + [...stack, resolved].join(' -> '));
  return fs.readFileSync(resolved, 'utf8').replace(
    /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g,
    (_, ref) => {
      if (/^(?:data:|https?:|\/\/)/i.test(ref)) throw new Error('嵌入页 CSS 仍依赖外部 @import: ' + ref);
      return inlineCssImports(path.resolve(path.dirname(resolved), ref), [...stack, resolved]);
    },
  );
};

const buildVisualizationFrame = () => {
  let doc = fs.readFileSync(VIZ_SRC, 'utf8');
  let styleCount = 0;
  let scriptCount = 0;

  doc = doc.replace(/<link\s+rel="stylesheet"\s+href="(\.\/[^"?]+\.css)"\s*\/>/g, (_, ref) => {
    const file = path.resolve(ROOT, ref.slice(2));
    if (!fs.existsSync(file)) throw new Error('找不到嵌入页样式: ' + ref);
    styleCount++;
    return '<style data-wzh-source="' + ref + '">\n' + inlineCssImports(file) + '\n</style>';
  });

  doc = doc.replace(/<script\s+src="(\.\/[^"?]+\.js)"\s*><\/script>/g, (_, ref) => {
    const file = path.resolve(ROOT, ref.slice(2));
    if (!fs.existsSync(file)) throw new Error('找不到嵌入页脚本: ' + ref);
    const source = fs.readFileSync(file, 'utf8');
    if (/<\/script/i.test(source)) throw new Error('嵌入页脚本包含 </script>,无法安全内联: ' + ref);
    scriptCount++;
    return '<script data-wzh-source="' + ref + '">\n' + source + '\n</script>';
  });

  // data: iframe 用 URL hash 传模块、尺寸和主题；query 会被视为 data payload 的一部分。
  const queryExpr = 'new URLSearchParams(window.location.search)';
  const queryCount = countOf(doc, queryExpr);
  if (queryCount !== 2) throw new Error('嵌入页查询参数入口数量异常,预期 2,实际 ' + queryCount);
  doc = doc.split(queryExpr).join('new URLSearchParams(window.location.hash.slice(1))');

  const unresolved = [...doc.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)].map((m) => m[1]);
  if (unresolved.length) throw new Error('嵌入页还有未内联资源:\n' + unresolved.join('\n'));

  return {
    uri: 'data:text/html;base64,' + Buffer.from(doc, 'utf8').toString('base64'),
    styleCount,
    scriptCount,
  };
};

function removeElement(html, tag, id) {
  const start = new RegExp('<' + tag + '\\b[^>]*\\bid="' + id + '"[^>]*>', 'i').exec(html);
  if (!start) throw new Error('找不到待移除的页面元素: ' + id);
  let depth = 0;
  for (const match of html.slice(start.index).matchAll(new RegExp('<\\/?' + tag + '\\b[^>]*>', 'gi'))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      const end = start.index + match.index + match[0].length;
      return html.slice(0, start.index) + html.slice(end);
    }
  }
  throw new Error('页面元素没有闭合: ' + id);
}

let html = renderPage('timeline');
html = removeElement(html, 'main', 'msiOverviewPanel');
for (const id of ['msiMemoryPanel', 'msiOperatorPanel', 'msiTuningDocumentPanel'])
  html = removeElement(html, 'section', id);
html = removeElement(html, 'dialog', 'trainChatSettingsDialog');
for (const id of ['trainChatKeyBtn', 'trainChatAgentAddBtn']) html = removeElement(html, 'button', id);
const documentTab = 'aria-controls="msiTuningDocumentPanel">文档</button>';
if (countOf(html, documentTab) !== 1) throw new Error('找不到文档页签');
html = html.replace('class="msi-tab msi-tab--normal-only is-active" data-analysis-tab="overview"',
  'class="msi-tab msi-tab--normal-only" data-analysis-tab="overview"');
html = html.replace('class="msi-tab" data-analysis-tab="timeline" type="button" role="tab" aria-selected="false"',
  'class="msi-tab is-active" data-analysis-tab="timeline" type="button" role="tab" aria-selected="true"');
html = html.replace('id="msiTimelinePanel" role="tabpanel" aria-label="时间线" hidden',
  'id="msiTimelinePanel" role="tabpanel" aria-label="时间线"');
html = html.replace('data-analysis-tab="overview" type="button" role="tab" aria-selected="true"',
  'data-analysis-tab="overview" type="button" role="tab" aria-selected="false"');
html = html.replace(/(<button class="wzh-chat-local-code-add"[^>]*>)[\s\S]*?(<\/button>)/,
  '$1<span class="wzh-chat-local-code-add-icon" aria-hidden="true"></span>项目目录$2');
html = html.replace('title="绑定当前工程的代码目录"', 'title="绑定当前工程的项目目录"')
  .replace('title="移除代码目录"', 'title="移除项目目录"')
  .replace('aria-label="移除代码目录"', 'aria-label="移除项目目录"')
  .replace('class="wzh-chat-code-icon" src="../../src/pic/icon/code.svg"',
    'class="wzh-chat-code-icon" src="../../src/pic/icon/localfile.svg"');
html = html.replace(/<button class="msi-taskbar-start" id="msiTaskbarStart"[^>]*>([\s\S]*?)<\/button>/,
  '<span class="msi-taskbar-start" aria-hidden="true">$1</span>');
html = html.replace('</head>', `<style>
  html[data-entry-view="timeline"] .wzh-chat-local-code-add-icon,
  html[data-entry-view="timeline"] .wzh-chat-code-icon {
    width: 14px; height: 14px; flex-shrink: 0; display: block;
  }
  html[data-entry-view="timeline"] .wzh-chat-local-code-add-icon {
    background: currentColor;
    mask: url('src/pic/icon/addfile.svg') center / contain no-repeat;
  }
  html[data-entry-view="timeline"] .wzh-chat-local-code-add { white-space: nowrap; line-height: 1.5; }
  html[data-entry-view="timeline"] .wzh-chat-anchor-chip { align-items: center; }
  .msi-taskbar-start { cursor: default; }
</style></head>`);
html = html.replaceAll('href="chat.html"', 'href=""');
for (const file of ['settings-dialog.css', 'settings-skills.css']) {
  html = html.replace('<link rel="stylesheet" href="../' + file + '">', '');
}
for (const file of ['settings-dialog.js', 'settings-skills.js', 'settings-skills-upload.js',
  'settings-mcp.js', 'settings-knowledge.js', 'tuning-document.js']) {
  html = html.replace('<script defer src="../' + file + '"></script>', '');
}
// Normalize the entry's paths before inlining resources.
html = html.replaceAll('../../src/pic/icon/', 'src/pic/icon/')
  .replace(/(?:\.\.\/)([\w.-]+\.(?:css|js))/g, 'app/$1')
  .replaceAll('../../v15-report-modules-pto.html', 'v15-report-modules-pto.html');
html = html.replace(/<link rel="stylesheet" href="(app\/[\w.-]+\.css)">/g, (_, ref) => {
  let css = fs.readFileSync(path.join(ROOT, ref), 'utf8');
  if (ref === 'app/desktop.css') {
    css = css.replace("url('../src/pic/wallpaper.jpg')", "url('../src/pic/wallpaper-light.jpg')")
      .replace(/^\.msi-desktop\.is-light-wallpaper[^\n]*\n/m, '')
      .replace(/^\.msi-desktop\.is-purple-wallpaper[^\n]*\n/m, '');
  }
  css = css
    .replaceAll("url('../src/pic/icon/", "url('src/pic/icon/")
    .replaceAll("url('../src/pic/wallpaper-light.jpg')",
      "url('data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, 'src', 'pic', 'wallpaper-light.jpg')).toString('base64') + "')");
  return '<style>\n' + css + '\n</style>';
});
html = html.replace(/<script defer src="(app\/[\w.-]+\.js)"><\/script>/g, (_, ref) => {
  let js = fs.readFileSync(path.join(ROOT, ref), 'utf8');
  if (ref === 'app/desktop.js') {
    const start = js.indexOf('  const WALLPAPER_KEY =');
    const end = js.indexOf('  function render() {', start);
    if (start < 0 || end < 0) throw new Error('桌面壁纸逻辑结构变了');
    js = js.slice(0, start) + "  desktop.classList.add('is-light-wallpaper');\n\n" + js.slice(end);
  }
  if (ref === 'app/workbench.js') {
    const guard = "if (!['overview', 'timeline', 'memory', 'operator', 'tuning-document'].includes(name)) return false;";
    if (countOf(js, guard) !== 1) throw new Error('页签切换逻辑结构变了');
    js = js.replace(guard, "if (name !== 'timeline') return false;");
  }
  if (/<\/script/i.test(js)) throw new Error('外部脚本不能安全内联: ' + ref);
  return '<script>\n' + js + '\n</script>';
});
// Scripts are read from app/ after the first normalization pass.
html = html.replaceAll('../../src/pic/icon/', 'src/pic/icon/')
  .replaceAll('../../v15-report-modules-pto.html', 'v15-report-modules-pto.html');
if (/<(?:link|script)\b[^>]*(?:href|src)="app\//.test(html)) {
  throw new Error('仍有未内联的 app 资源');
}
const visualization = buildVisualizationFrame();

// 只处理真正被引用到的图标,没用上的不进包
const used = new Set();
for (const m of html.matchAll(new RegExp('src/pic/icon/([\\w.-]+\\.' + EXT + ')', 'g'))) used.add(m[1]);
// JS 里靠变量拼的:从 icon: 'xxx' 字面量里收
for (const m of html.matchAll(new RegExp("icon:\\s*'([\\w.-]+\\." + EXT + ")'", 'g'))) used.add(m[1]);

const icons = {};
for (const f of [...used].sort()) icons[f] = dataUri(f);

// 1) JS 里 'src/pic/icon/' + 变量 的拼接,换成查表
const dynamic = [
  [`'<img src="src/pic/icon/' + a.icon + '" data-icon="' + a.icon + '" alt="">'`, `'<img src="' + WZH_ICON[a.icon] + '" data-icon="' + a.icon + '" alt="">'`],
  [`'<img src="src/pic/icon/' + a.icon + '" alt="">'`, `'<img src="' + WZH_ICON[a.icon] + '" alt="">'`],
  [`'<img class="wzh-chat-guide-icon" src="src/pic/icon/' + c.icon + '" alt="">'`, `'<img class="wzh-chat-guide-icon" src="' + WZH_ICON[c.icon] + '" alt="">'`],
  [`const src = 'src/pic/icon/' + cur.icon;`, `const src = WZH_ICON[cur.icon];`],
  [`const src = stopMode ? 'src/pic/icon/stop.svg'\n        : resumeMode ? 'src/pic/icon/play.svg' : 'src/pic/icon/sent.svg';`,
    `const src = stopMode ? WZH_ICON['stop.svg']\n        : resumeMode ? WZH_ICON['play.svg'] : WZH_ICON['sent.svg'];`],
  [`icon.src = 'src/pic/icon/folder.svg';`, `icon.src = WZH_ICON['folder.svg'];`],
];
for (const [a, b] of dynamic) {
  const n = html.split(a).length - 1;
  if (n === 0) throw new Error('没匹配到动态引用(页面结构变了?): ' + a);
  html = html.split(a).join(b);
}

// 可视化 iframe 改用内联 data: 页面,hash 参数由子页读取。
const vizFrameRef = `return 'v15-report-modules-pto.html?embed=chart&module=' + encodeURIComponent(moduleId) + '&size=8&theme=' + theme;`;
if (countOf(html, vizFrameRef) !== 1) throw new Error('没匹配到可视化 iframe 引用(页面结构变了?)');
html = html.replace(
  vizFrameRef,
  `return WZH_VIZ_FRAME + '#embed=chart&module=' + encodeURIComponent(moduleId) + '&size=8&theme=' + theme;`,
);

// 2) 剩下写死的 src="src/pic/icon/xxx":不把 data URI 原地展开(同一图标被引用 N 处就会
//    膨胀 N 倍),改成 src="" data-wzh-icon="xxx",由第 3 步注入的小段运行时从表里回填。
//    留一个空 src 是为了让 getAttribute('src') 永远不返回 null。
//    这条规则对 HTML 标记和 JS 里拼 HTML 的字符串都有效——两种写法里属性都是双引号。
for (const f of Object.keys(icons)) {
  html = html.split('src="src/pic/icon/' + f + '"').join('src="" data-wzh-icon="' + f + '"');
  // CSS 里的 url('src/pic/icon/xxx')(mask / background)没法运行时回填,只能原地展开;
  // 这类引用一处最多一两次,不会成倍膨胀。
  html = html.split("url('src/pic/icon/" + f + "')").join("url('" + icons[f] + "')");
}

// 3) 注入映射表 + 回填运行时 —— 放在第一个 <script> 开头,晚于任何用到它的代码之前。
//    MutationObserver 负责之后由 JS 插进来的节点;DOMContentLoaded 再兜底扫一遍。
const table = '\n  // 内联图标映射表\n  const WZH_ICON = ' +
  JSON.stringify(icons, null, 0) + ';\n' +
  '  // 聊天可视化 iframe 的完整内联页面\n' +
  '  const WZH_VIZ_FRAME = ' + JSON.stringify(visualization.uri) + ';\n' +
  '  (function () {\n' +
  '    const fill = (el) => { if (!el.getAttribute("src")) el.src = WZH_ICON[el.dataset.wzhIcon] || ""; };\n' +
  '    const scan = (root) => {\n' +
  '      if (root.nodeType !== 1) return;\n' +
  '      if (root.matches("img[data-wzh-icon]")) fill(root);\n' +
  '      root.querySelectorAll("img[data-wzh-icon]").forEach(fill);\n' +
  '    };\n' +
  '    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true });\n' +
  '    document.addEventListener("DOMContentLoaded", () => scan(document.documentElement));\n' +
  '  })();\n';
const anchor = html.indexOf('<script>');
if (anchor < 0) throw new Error('找不到 <script> 注入点');
html = html.slice(0, anchor + '<script>'.length) + table + html.slice(anchor + '<script>'.length);

// 4) 兜底自检:成品里不该再出现相对资源路径
const left = html.match(/src\/pic\//g);
if (left) {
  const ctx = [...html.matchAll(/.{0,60}src\/pic\/.{0,40}/g)].map((m) => m[0]);
  const real = ctx.filter((c) => /src=["']src\/pic\//.test(c) || /'src\/pic\//.test(c));
  if (real.length) throw new Error('还有没内联的引用:\n' + real.join('\n'));
}
if (html.includes('v15-report-modules-pto.html?embed=')) {
  throw new Error('可视化 iframe 仍引用外部 HTML');
}
for (const id of ['msiOverviewPanel', 'msiMemoryPanel', 'msiOperatorPanel',
  'msiTuningDocumentPanel', 'trainChatSettingsDialog', 'trainChatKeyBtn']) {
  if (html.includes('id="' + id + '"')) throw new Error('成品中仍有非目标内容: ' + id);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('已生成 dist/' + path.basename(OUT));
console.log('内联图标 ' + Object.keys(icons).length + ' 个,成品 ' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
console.log('内联可视化 1 页（CSS ' + visualization.styleCount + ' 个，JS ' + visualization.scriptCount + ' 个）');

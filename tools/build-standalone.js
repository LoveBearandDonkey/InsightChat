/**
 * 把 chat.html 打包成不依赖外部文件的单文件版,输出到
 * dist/chat.standalone.<YYYYMMDD-HHmm>.html —— 带时间戳,每次打包各留一份,
 * 发出去的是哪一版一目了然。
 *
 * 做三件事:
 *   1) 把 src/pic/icon/ 下所有被引用的图标转成 base64 data URI;
 *   2) HTML 里写死的路径直接替换,JS 里靠变量拼出来的路径(a.icon / c.icon)
 *      改走注入的 WZH_ICON 映射表。
 *   3) 把聊天面板可视化 iframe 使用的 v15 报告页及其 CSS/JS 一并内联。
 *
 * 用法: node tools/build-standalone.js
 * 改完 chat.html 或换了图标,重跑一次即可。
 */
const fs = require('fs');
const path = require('path');
const { buildAll } = require('./build-chat-pages.cjs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'app', 'pages', 'chat.html');
const OUT_DIR = path.join(ROOT, 'dist');
const ICON_DIR = path.join(ROOT, 'src', 'pic', 'icon');
const VIZ_SRC = path.join(ROOT, 'v15-report-modules-pto.html');

const stamp = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
})();
const OUT = path.join(OUT_DIR, 'chat.standalone.' + stamp + '.html');

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

buildAll();
let html = fs.readFileSync(SRC, 'utf8');
// Inline the page using the former root-relative spellings expected below.
// The generated entry now lives two directories below the repository root.
html = html.replaceAll('../../src/pic/icon/', 'src/pic/icon/')
  .replace(/(?:\.\.\/)([\w.-]+\.(?:css|js))/g, 'app/$1')
  .replaceAll('../memory-viz.html', 'app/memory-viz.html')
  .replaceAll('../../v15-report-modules-pto.html', 'v15-report-modules-pto.html');
html = html.replace('href="chat.html"', 'href=""');
for (const view of ['timeline', 'allocator']) {
  if (countOf(html, 'data-src="app/memory-viz.html#' + view + '"') !== 1) {
    throw new Error('内存快照 iframe 引用数量异常: ' + view);
  }
}
let memoryFrameDoc = fs.readFileSync(path.join(ROOT, 'app', 'memory-viz.html'), 'utf8');
memoryFrameDoc = memoryFrameDoc.replace('<link rel="stylesheet" href="memory-viz/host.css">',
  '<style>\n' + fs.readFileSync(path.join(ROOT, 'app', 'memory-viz', 'host.css'), 'utf8') + '\n</style>');
for (const file of ['MemoryViz.bundle.js', 'snapshot-data.js', 'host.js']) {
  const ref = '<script src="memory-viz/' + file + '"></script>';
  if (countOf(memoryFrameDoc, ref) !== 1) throw new Error('内存快照资源引用数量异常: ' + file);
  const source = fs.readFileSync(path.join(ROOT, 'app', 'memory-viz', file), 'utf8');
  if (/<\/script/i.test(source)) throw new Error('内存快照脚本不能安全内联: ' + file);
  memoryFrameDoc = memoryFrameDoc.replace(ref, () => '<script>\n' + source + '\n</script>');
}
const unresolvedMemoryRefs = memoryFrameDoc.match(/(?:src|href)="memory-viz\/[^"\s]+/g);
if (unresolvedMemoryRefs) throw new Error('内存快照仍引用外部资源: ' + unresolvedMemoryRefs.slice(0, 3).join(', '));
const memoryFrame = 'data:text/html;base64,' + Buffer.from(memoryFrameDoc, 'utf8').toString('base64');
html = html.replace(/<link rel="stylesheet" href="(app\/[\w.-]+\.css)">/g, (_, ref) => {
  const css = fs.readFileSync(path.join(ROOT, ref), 'utf8')
    .replaceAll("url('../src/pic/icon/", "url('src/pic/icon/");
  return '<style>\n' + css + '\n</style>';
});
html = html.replace(/<script defer src="(app\/[\w.-]+\.js)"><\/script>/g, (_, ref) => {
  const js = fs.readFileSync(path.join(ROOT, ref), 'utf8');
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
  [`const src = stopMode ? 'src/pic/icon/stop.svg' : 'src/pic/icon/sent.svg';`, `const src = stopMode ? WZH_ICON['stop.svg'] : WZH_ICON['sent.svg'];`],
];
for (const [a, b] of dynamic) {
  const n = html.split(a).length - 1;
  if (n === 0) throw new Error('没匹配到动态引用(chat.html 结构变了?): ' + a);
  html = html.split(a).join(b);
}

// 可视化 iframe 改用内联 data: 页面,hash 参数由子页读取。
const vizFrameRef = `return 'v15-report-modules-pto.html?embed=chart&module=' + encodeURIComponent(moduleId) + '&size=8&theme=' + theme;`;
if (countOf(html, vizFrameRef) !== 1) throw new Error('没匹配到可视化 iframe 引用(chat.html 结构变了?)');
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
const table = '\n  // 图标 base64 映射表(由 tools/build-standalone.js 生成)\n  const WZH_ICON = ' +
  JSON.stringify(icons, null, 0) + ';\n' +
  '  // 聊天可视化 iframe 的完整内联页面\n' +
  '  const WZH_VIZ_FRAME = ' + JSON.stringify(visualization.uri) + ';\n' +
  '  window.MSI_MEMORY_FRAME = ' + JSON.stringify(memoryFrame) + ';\n' +
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

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('已生成 dist/' + path.basename(OUT));
console.log('内联图标 ' + Object.keys(icons).length + ' 个,成品 ' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
console.log('内联可视化 1 页（CSS ' + visualization.styleCount + ' 个，JS ' + visualization.scriptCount + ' 个）');

/**
 * 把 chat.html 打包成不依赖外部文件的单文件版,输出到
 * dist/chat.standalone.<YYYYMMDD-HHmm>.html —— 带时间戳,每次打包各留一份,
 * 发出去的是哪一版一目了然。
 *
 * 做两件事:
 *   1) 把 src/pic/icon/ 下所有被引用的图标转成 base64 data URI;
 *   2) HTML 里写死的路径直接替换,JS 里靠变量拼出来的路径(a.icon / c.icon)
 *      改走注入的 WZH_ICON 映射表。
 *
 * 用法: node tools/build-standalone.js
 * 改完 chat.html 或换了图标,重跑一次即可。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'chat.html');
const OUT_DIR = path.join(ROOT, 'dist');
const ICON_DIR = path.join(ROOT, 'src', 'pic', 'icon');

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

let html = fs.readFileSync(SRC, 'utf8');

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

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('已生成 dist/' + path.basename(OUT));
console.log('内联图标 ' + Object.keys(icons).length + ' 个,成品 ' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');

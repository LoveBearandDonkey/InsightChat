/** Build the editable shared shell and view fragments into direct-open HTML entries. */
const fs = require('node:fs');
const path = require('node:path');
const {buildMemoryViz} = require('./build-memory-viz.cjs');
const {buildVisualIcon} = require('./build-visual-icon.cjs');

const root = path.resolve(__dirname, '..');
const app = path.join(root, 'app');
const pages = path.join(app, 'pages');
const entries = { 'chat.html': 'overview', 'timeline.html': 'timeline', 'compare.html': 'compare' };
const titles = { overview: '智能对话 · 空白工作台', timeline: '时间线 · 智能对话工作台', compare: '任务对比 · 智能对话工作台' };

function renderPage(view) {
  let html = fs.readFileSync(path.join(app, 'shell.html'), 'utf8');
  html = html.replace('__ENTRY_VIEW__', view);
  html = html.replace('<title>智能对话 · 空白工作台</title>', '<title>' + titles[view] + '</title>');
  html = html.replace(/<!-- @include pages\/([\w-]+\.html) -->/g, (_, file) =>
    fs.readFileSync(path.join(pages, file), 'utf8').trimEnd());
  // 概览页已有两处专属外观；生成时保留它们，其余结构仍共用 shell 和视图片段。
  const overview = view === 'overview';
  html = html.replace('        <!-- @visual-upgrade-entry -->\n', overview
    ? '        <a class="msi-visual-upgrade-entry" href="visual-upgrade.html" title="查看视觉 2.0 升级演示"><img class="msi-visual-upgrade-icon" src="../../src/pic/icon/visual-3s.gif" width="18" height="18" alt="" aria-hidden="true"><span>视觉 2.0</span></a>\n'
    : '');
  const variants = {
    __COMPARE_ICON__: overview
      ? '<span class="msi-compare-icon" aria-hidden="true"></span>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="1.5"></rect><path d="M14 4h7v16h-7z"></path><path d="M14 9h7M14 15h7"></path></svg>',
    __CODE_DIR_LABEL__: overview ? '项目' : '代码',
    __CODE_DIR_ADD_ICON__: overview
      ? '<span class="wzh-chat-local-code-add-icon" aria-hidden="true"></span>'
      : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>',
    __CODE_DIR_ICON__: overview ? 'localfile.svg' : 'code.svg',
  };
  for (const [marker, value] of Object.entries(variants)) html = html.replaceAll(marker, value);
  html = html.replace('  <!-- @overview-script -->', view === 'overview'
    ? '  <script defer src="../overview.js"></script>' : '');
  if (overview) html = html.replace('</body>', '  <script defer src="../visual-upgrade.js"></script>\n</body>');
  if (html.includes('<!-- @include') || html.includes('<!-- @overview-script') ||
      /__[A-Z_]+__/.test(html)) {
    throw new Error('Unresolved chat page template marker');
  }
  return html;
}

function renderVisualUpgrade() {
  // Independent layer markup; the live product remains in chat.html throughout.
  const stage = fs.readFileSync(path.join(app, 'visual-upgrade-stage.html'), 'utf8').trimEnd();
  return '<!DOCTYPE html>\n<!-- Generated from app/visual-upgrade-stage.html by npm run build:chat. -->\n' +
    '<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>视觉升级 · MindStudio Insight</title><link rel="icon" type="image/x-icon" href="../../src/pic/icon/MSInsight.ico"><style>body{display:none}</style></head><body>\n' +
    '<div class="vu-stage" aria-label="视觉升级拆解演示">\n' + stage + '\n</div>\n' +
    '<script src="../visual-upgrade-layer.js"></script>\n</body></html>\n';
}

function buildAll() {
  buildVisualIcon();
  buildMemoryViz();
  for (const [file, view] of Object.entries(entries)) {
    fs.writeFileSync(path.join(pages, file), renderPage(view));
  }
  fs.writeFileSync(path.join(pages, 'visual-upgrade.html'), renderVisualUpgrade());
  console.log('Built ' + Object.keys(entries).concat('visual-upgrade.html').join(', '));
}

if (require.main === module) buildAll();
module.exports = { renderPage, renderVisualUpgrade, buildAll };

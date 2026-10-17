/** Build the editable shared shell and view fragments into direct-open HTML entries. */
const fs = require('node:fs');
const path = require('node:path');
const {buildMemoryViz} = require('./build-memory-viz.cjs');

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
  html = html.replace('  <!-- @overview-script -->', view === 'overview'
    ? '  <script defer src="../overview.js"></script>' : '');
  if (html.includes('<!-- @include') || html.includes('<!-- @overview-script') ||
      html.includes('__ENTRY_VIEW__')) {
    throw new Error('Unresolved chat page template marker');
  }
  return html;
}

function buildAll() {
  buildMemoryViz();
  for (const [file, view] of Object.entries(entries)) {
    fs.writeFileSync(path.join(pages, file), renderPage(view));
  }
  console.log('Built ' + Object.keys(entries).join(', '));
}

if (require.main === module) buildAll();
module.exports = { renderPage, buildAll };

/** Bundle the pinned PyTorch MemoryViz and D3 sources for offline use. */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'app', 'memory-viz');
const output = path.join(sourceDir, 'MemoryViz.bundle.js');

function packageRoot(input) {
  const parts = input.replaceAll('\\', '/').split('/');
  const index = parts.lastIndexOf('node_modules');
  if (index < 0) return null;
  const name = parts[index + 1]?.startsWith('@')
    ? parts.slice(index + 1, index + 3).join('/')
    : parts[index + 1];
  return name ? path.join(root, 'node_modules', name) : null;
}

function buildMemoryViz() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(sourceDir, 'vendor', 'MemoryViz.js')],
    bundle: true,
    format: 'iife',
    globalName: 'MSI_MEMORY_VIZ',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    legalComments: 'none',
    metafile: true,
    write: false,
    outfile: output,
  });
  const packages = [...new Set(Object.keys(result.metafile.inputs).map(packageRoot).filter(Boolean))].sort();
  const notices = [
    'PyTorch MemoryViz, commit 8f8b39bb1167ce03ba76f64ece12dddabb844ac8',
    fs.readFileSync(path.join(sourceDir, 'vendor', 'PYTORCH-LICENSE.txt'), 'utf8').trim(),
  ];
  for (const dir of packages) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const licenseFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map(name => path.join(dir, name)).find(fs.existsSync);
    if (!licenseFile) throw new Error('Missing license for ' + manifest.name);
    notices.push(manifest.name + '@' + manifest.version + '\n' + fs.readFileSync(licenseFile, 'utf8').trim());
  }
  const legalText = notices.join('\n\n---\n\n');
  if (legalText.includes('*/')) throw new Error('License text cannot be embedded in a JS comment');
  fs.writeFileSync(path.join(sourceDir, 'THIRD_PARTY_LICENSES.txt'), legalText + '\n');
  const bundle = result.outputFiles.find(file => file.path.endsWith('.js'));
  if (!bundle) throw new Error('MemoryViz bundle missing');
  fs.writeFileSync(output, '/*!\n' + legalText + '\n*/\n' + bundle.text);
  const compressedSnapshot = fs.readFileSync(path.join(sourceDir, 'snapshot.pickle.gz'));
  fs.writeFileSync(path.join(sourceDir, 'snapshot-data.js'),
    'window.MSI_MEMORY_SNAPSHOT_GZIP_BASE64 = ' + JSON.stringify(compressedSnapshot.toString('base64')) + ';\n');
  console.log('Built local MemoryViz bundle (' + (fs.statSync(output).size / 1024).toFixed(0) + ' KiB) and snapshot (' + (compressedSnapshot.length / 1024).toFixed(0) + ' KiB gzip)');
}

if (require.main === module) buildMemoryViz();
module.exports = {buildMemoryViz};

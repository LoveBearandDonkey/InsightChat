/* Copy only a verified package built from the current workbench source inputs. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {root,upstream,hash,json,sourceFingerprint}=require('./demo-assets-common.cjs');
const source=path.join(upstream,'deploy/github-pages');
const target=path.join(root,'demo/vendor/mindspeed');
const files=['index.html','manifest.json','README.md','SHA256SUMS','.nojekyll'];
function verifyPackage(directory,expected=sourceFingerprint()){
  const manifest=json(path.join(directory,'manifest.json'));
  const html=fs.readFileSync(path.join(directory,'index.html'));
  assert.equal(manifest.execution_mode,'browser-local-config-core');
  assert.equal(manifest.mcp_protocol_endpoint,false);
  assert.equal(manifest.sha256.toLowerCase(),hash(html),'Workbench HTML checksum mismatch');
  assert.ok(html.includes('mindspeed-config-demo/v1'),'Workbench message bridge missing');
  assert.equal(manifest.source_snapshot?.sha256,expected.sha256,
    'Workbench package is stale or has no source fingerprint; run npm run sync:demo-assets');
  assert.equal(fs.readFileSync(path.join(directory,'SHA256SUMS'),'utf8').trim(),hash(html)+'  index.html');
  for(const name of files) assert.ok(fs.existsSync(path.join(directory,name)),`Missing workbench asset: ${name}`);
  return manifest;
}
function sync(){
  const manifest=verifyPackage(source);
  fs.mkdirSync(target,{recursive:true});
  for(const name of files) fs.copyFileSync(path.join(source,name),path.join(target,name));
  verifyPackage(target);
  console.log('Synced browser-local workbench; source '+manifest.source_snapshot.sha256);
}
module.exports={verifyPackage,sync,files};
if(require.main===module){
  if(process.argv.includes('--check')){
    verifyPackage(target);
    console.log('Workbench snapshot matches current source inputs.');
  } else sync();
}

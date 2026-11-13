const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {hash,upstream}=require('./demo-assets-common.cjs');
const {verifyPackage}=require('./sync-mindspeed-pages.cjs');
const {fingerprint,WORKBENCH_INPUTS}=require(path.join(upstream,'tools/demo-source-fingerprint.cjs'));
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'insight-demo-assets-'));
  t.after(()=>{
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'insight-demo-assets-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const source=path.join(root,'mindspeed-config-mcp'),project=path.join(root,'InsightChat');
  const put=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  for(const input of WORKBENCH_INPUTS){
    if(path.extname(input))put(path.join(source,input),'source\n');
    else put(path.join(source,input,'source.js'),'source\n');
  }
  fs.copyFileSync(path.join(upstream,'tools/demo-source-fingerprint.cjs'),path.join(source,'tools/demo-source-fingerprint.cjs'));
  for(const file of ['demo-assets-common.cjs','demo-assets.cjs','sync-constraint-lens.cjs','sync-mindspeed-pages.cjs','package-demo.cjs']){
    put(path.join(project,'tools',file),fs.readFileSync(path.join(__dirname,file)));
  }
  const tabs=['worldsize-v2','heads','layers','compatibility','capacity'];
  const lens='mindspeed-constraint-lens/v1\n'+tabs.map(id=>`<button role="tab" data-case="${id}">${id}</button>\n'${id}':{question:'test question'}\n`).join('');
  put(path.join(source,'apps/web/prototypes/constraint-lens.html'),lens);
  const directory=path.join(project,'demo/vendor/mindspeed');
  const html='<!doctype html><p>mindspeed-config-demo/v1</p>\n';
  put(path.join(directory,'index.html'),html);
  put(path.join(directory,'manifest.json'),JSON.stringify({execution_mode:'browser-local-config-core',mcp_protocol_endpoint:false,
    sha256:hash(html),source_snapshot:fingerprint(source)}));
  put(path.join(directory,'SHA256SUMS'),hash(html)+'  index.html\n');
  put(path.join(directory,'README.md'),'fixture');put(path.join(directory,'.nojekyll'),'');
  put(path.join(project,'src/pic/icon/demo.svg'),'<svg/>');
  const run=(script,...args)=>spawnSync(process.execPath,[path.join(project,'tools',script),...args],{
    cwd:project,env:{...process.env,MINDSPEED_CONFIG_MCP_ROOT:source},encoding:'utf8'});
  assert.equal(run('sync-constraint-lens.cjs').status,0);
  return {source,project,directory,put,run};
}
test('source fingerprint follows edits, additions, deletions and ignores checkout newlines',t=>{
  const f=fixture(t),before=fingerprint(f.source).sha256;
  const file=path.join(f.source,'apps/mcp-server/ui/src/source.js');
  fs.writeFileSync(file,'source\r\n');assert.equal(fingerprint(f.source).sha256,before);
  fs.writeFileSync(file,'edited\n');assert.notEqual(fingerprint(f.source).sha256,before);
  fs.writeFileSync(file,'source\n');assert.equal(fingerprint(f.source).sha256,before);
  fs.writeFileSync(path.join(path.dirname(file),'new.js'),'new');assert.notEqual(fingerprint(f.source).sha256,before);
  fs.unlinkSync(file);assert.notEqual(fingerprint(f.source).sha256,before);
});
test('self-consistent old package is still rejected after source changes',t=>{
  const f=fixture(t);verifyPackage(f.directory,fingerprint(f.source));
  fs.appendFileSync(path.join(f.source,'apps/mcp-server/ui/src/source.js'),'new UI');
  assert.throws(()=>verifyPackage(f.directory,fingerprint(f.source)),/stale/);
});
test('corrupted HTML and missing assets cannot pass verification',t=>{
  const f=fixture(t);
  fs.appendFileSync(path.join(f.directory,'index.html'),'tampered');
  assert.throws(()=>verifyPackage(f.directory,fingerprint(f.source)),/checksum/);
  assert.notEqual(f.run('demo-assets.cjs','--check').status,0);
  fs.writeFileSync(path.join(f.directory,'index.html'),'<!doctype html><p>mindspeed-config-demo/v1</p>\n');
  fs.unlinkSync(path.join(f.directory,'README.md'));
  assert.throws(()=>verifyPackage(f.directory,fingerprint(f.source)),/Missing workbench asset/);
});
test('publish gate accepts fresh snapshots and refuses both kinds of stale input without overwriting output',t=>{
  const f=fixture(t);
  assert.equal(f.run('demo-assets.cjs','--check').status,0);
  const packageResult=f.run('package-demo.cjs');assert.equal(packageResult.status,0,packageResult.stderr);
  const output=path.join(f.project,'dist/demo-pages/index.html');
  fs.writeFileSync(output,'previous valid package');
  fs.appendFileSync(path.join(f.source,'apps/web/prototypes/constraint-lens.html'),'\nchanged lens');
  assert.notEqual(f.run('package-demo.cjs').status,0);
  assert.equal(fs.readFileSync(output,'utf8'),'previous valid package');
  assert.equal(f.run('sync-constraint-lens.cjs').status,0);
  fs.appendFileSync(path.join(f.source,'packages/config-core/src/source.js'),'changed core');
  assert.notEqual(f.run('package-demo.cjs').status,0);
  assert.equal(fs.readFileSync(output,'utf8'),'previous valid package');
});
test('missing upstream cannot be mistaken for an up-to-date snapshot',t=>{
  const f=fixture(t);
  fs.renameSync(path.join(f.source,'apps/mcp-server/ui/src'),path.join(f.source,'apps/mcp-server/ui/missing'));
  assert.notEqual(f.run('demo-assets.cjs','--check').status,0);
});
test('constraint snapshot remains valid across Windows and Linux source checkouts',t=>{
  const f=fixture(t),file=path.join(f.source,'apps/web/prototypes/constraint-lens.html');
  const original=fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,original.replace(/\n/g,'\r\n'));
  assert.equal(f.run('sync-constraint-lens.cjs').status,0);
  fs.writeFileSync(file,original);
  const check=f.run('sync-constraint-lens.cjs','--check');
  assert.equal(check.status,0,check.stderr);
});
test('parallel sync commands serialize and leave verified snapshots',async t=>{
  const f=fixture(t),{spawn}=require('node:child_process');
  const start=()=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(f.project,'tools/demo-assets.cjs')],{
      cwd:f.project,env:{...process.env,MINDSPEED_CONFIG_MCP_ROOT:f.source},stdio:'ignore'});
    child.on('error',reject);child.on('exit',resolve);
  });
  assert.deepEqual(await Promise.all([start(),start()]),[0,0]);
  assert.equal(f.run('demo-assets.cjs','--check').status,0);
});
test('watcher updates a changed source page and repairs modified target HTML',async t=>{
  const f=fixture(t),{spawn}=require('node:child_process');
  const child=spawn(process.execPath,[path.join(f.project,'tools/demo-assets.cjs'),'--watch'],{
    cwd:f.project,env:{...process.env,MINDSPEED_CONFIG_MCP_ROOT:f.source},stdio:['pipe','pipe','pipe']});
  t.after(()=>{child.stdin.end();child.kill();});
  let log='';child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});
  const until=async predicate=>{
    const deadline=Date.now()+12000;
    while(!predicate()){
      assert.ok(Date.now()<deadline,log);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  };
  await until(()=>log.includes('Watching both upstream pages'));
  const source=path.join(f.source,'apps/web/prototypes/constraint-lens.html');
  const target=path.join(f.project,'demo/vendor/constraint-lens/index.html');
  fs.appendFileSync(source,'\nnew upstream styling');
  await until(()=>fs.readFileSync(target,'utf8').endsWith('new upstream styling'));
  fs.appendFileSync(target,'\nmanual edit');
  await until(()=>fs.readFileSync(target,'utf8')===fs.readFileSync(source,'utf8'));
  child.stdin.end();child.kill();
  await new Promise(resolve=>child.once('exit',resolve));
});

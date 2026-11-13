/* One source-sync entry point for both iframe dependencies. */
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {root,upstream,sourceFingerprint,normalizedHash,hash}=require('./demo-assets-common.cjs');
const {verifyPackage,sync:syncWorkbench,files:workbenchFiles}=require('./sync-mindspeed-pages.cjs');
function run(command,args,cwd=root){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,stdio:'inherit',windowsHide:true});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited with code ${code}`)));
  });
}
let pending;
function sync(){
  if(!pending)pending=withSyncLock(syncNow).finally(()=>{pending=null;});
  return pending;
}
async function withSyncLock(task){
  const lock=path.join(root,'tmp/demo-assets-sync.lock');
  fs.mkdirSync(path.dirname(lock),{recursive:true});
  const owner=JSON.stringify({pid:process.pid,id:randomUUID()});
  const deadline=Date.now()+120000;
  for(;;){
    try {fs.writeFileSync(lock,owner,{flag:'wx'});break;}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      try {
        const existing=JSON.parse(fs.readFileSync(lock,'utf8'));
        if(!Number.isInteger(existing.pid)||existing.pid<=0)throw new Error('Invalid sync lock');
        try {process.kill(existing.pid,0);}catch(e){if(e.code==='ESRCH'){fs.unlinkSync(lock);continue;}throw e;}
      } catch(e){
        if(e.code==='ENOENT')continue;
        // Incomplete writes are retried. A malformed old lock must be inspected.
      }
      if(Date.now()>deadline)throw new Error('Another demo sync is still running; retry after it finishes. Lock: '+lock);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
  try {return await task();}
  finally {if(fs.existsSync(lock)&&fs.readFileSync(lock,'utf8')===owner)fs.unlinkSync(lock);}
}
async function syncNow(){
  const inputs=sourceFingerprint(); // Missing source is an error, never a fresh result.
  let workbenchChanged=true;
  try {workbenchChanged=require('./demo-assets-common.cjs').json(path.join(root,'demo/vendor/mindspeed/manifest.json')).source_snapshot?.sha256!==inputs.sha256;} catch {}
  try { verifyPackage(path.join(root,'demo/vendor/mindspeed'),inputs); }
  catch {
    try { verifyPackage(path.join(upstream,'deploy/github-pages'),inputs); }
    catch {
      if(process.platform!=='win32')throw new Error('Workbench needs rebuilding. Run sync:demo-assets on Windows with PowerShell, then commit both snapshots.');
      await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(upstream,'tools/package-github-pages.ps1'),'-ProjectRoot',upstream],upstream);
    }
    syncWorkbench();
  }
  await run(process.execPath,[path.join(__dirname,'sync-constraint-lens.cjs')]);
  await verify();
  return {workbenchChanged};
}
async function verify(){
  verifyPackage(path.join(root,'demo/vendor/mindspeed'));
  await run(process.execPath,[path.join(__dirname,'sync-constraint-lens.cjs'),'--check']);
  console.log('Both demo iframe dependencies match current upstream sources.');
}
function currentSignature(){
  const files=[...workbenchFiles.map(name=>'mindspeed/'+name),
    ...['index.html','manifest.json','history.js'].map(name=>'constraint-lens/'+name)];
  return hash(JSON.stringify([sourceFingerprint().sha256,
    normalizedHash(fs.readFileSync(path.join(upstream,'apps/web/prototypes/constraint-lens.html'))),
    ...files.map(name=>{try{return hash(fs.readFileSync(path.join(root,'demo/vendor',name)));}catch{return null;}})]));
}
function watch({interval=1500,onWorkbenchChanged=async()=>{},onError=error=>console.error('[demo-assets] '+error.message)}={}){
  let stopped=false,lastSignature=null,running=false,lastError=null;
  async function tick(){
    if(stopped||running)return;
    running=true;
    try {
      const signature=currentSignature();
      if(signature!==lastSignature){
        const result=await sync();
        if(result.workbenchChanged)await onWorkbenchChanged();
        // Keep the state observed before syncing. Changes during a build must
        // trigger another pass, rather than being accepted without verification.
        lastSignature=signature;
        console.log('[demo-assets] Both snapshots are current. Refresh open demo tabs to load them.');
      }
      lastError=null;
    } catch(error){if(error.message!==lastError)onError(error);lastError=error.message;}
    finally{running=false;}
  }
  const timer=setInterval(tick,interval);timer.unref();
  return ()=>{stopped=true;clearInterval(timer);};
}
module.exports={sync,verify,watch,currentSignature};
if(require.main===module){
  const check=process.argv.includes('--check'),watchMode=process.argv.includes('--watch');
  (check?verify():sync()).then(()=>{
    if(watchMode){watch();process.stdin.resume();console.log('Watching both upstream pages; refresh the demo after changes.');}
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}

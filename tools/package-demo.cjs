/* Publishing is deliberately read-only with respect to the snapshots. */
const fs=require('node:fs');
const path=require('node:path');
const {root}=require('./demo-assets-common.cjs');
const {verify}=require('./demo-assets.cjs');
async function pack(){
  await verify(); // Fail before touching the output if either dependency is stale.
  const output=path.join(root,'dist/demo-pages');
  if(fs.existsSync(output)){
    // A fixed, checked path: never remove user-selected output directories.
    if(path.resolve(output)!==path.resolve(root,'dist/demo-pages'))throw new Error('Invalid output path');
    fs.rmSync(output,{recursive:true,force:true});
  }
  fs.mkdirSync(output,{recursive:true});
  fs.cpSync(path.join(root,'demo'),path.join(output,'demo'),{recursive:true,
    filter:file=>!fs.statSync(file).isFile()||!file.endsWith('.cjs')});
  fs.cpSync(path.join(root,'src/pic/icon'),path.join(output,'src/pic/icon'),{recursive:true});
  fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=demo/"><a href="demo/">Open demo</a>\n');
  fs.writeFileSync(path.join(output,'.nojekyll'),'');
  console.log('Verified static demo package: '+output);
  return output;
}
module.exports={pack};
if(require.main===module)pack().catch(error=>{console.error(error.message);process.exitCode=1;});

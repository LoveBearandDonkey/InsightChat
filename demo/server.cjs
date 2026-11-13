/* Dependency-free local preview. Run: node demo/server.cjs [port] */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const mindspeed=require('./mindspeed-bridge.cjs');
const demoAssets=require('../tools/demo-assets.cjs');
const root=path.resolve(__dirname,'..');
const port=Number(process.argv[2]||2027);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  if(await mindspeed.handle(req,res,new URL(req.url,'http://localhost')))return;
  let file;
  try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/demo/index.html';else if(pathname.endsWith('/'))pathname+='index.html';file=path.resolve(root,'.'+pathname);}catch(_){res.writeHead(400);return res.end('Bad request');}
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});
});
async function start(){
  await demoAssets.sync();
  const stopWatching=demoAssets.watch({onWorkbenchChanged:()=>mindspeed.close()});
  server.on('close',stopWatching);
  server.listen(port,'127.0.0.1',()=>console.log(`MindStudio demo (source sync enabled): http://127.0.0.1:${port}/demo/`));
}
start().catch(error=>{console.error('[demo-assets] Preview refused: '+error.message);process.exitCode=1;});

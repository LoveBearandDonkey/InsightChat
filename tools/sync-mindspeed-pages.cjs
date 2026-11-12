/* Refresh the self-contained Pages fallback from the sibling MCP repository. */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const project=path.resolve(__dirname,'..');
const source=path.join(path.resolve(process.env.MINDSPEED_CONFIG_MCP_ROOT||path.join(project,'../mindspeed-config-mcp')),'deploy/github-pages');
const target=path.join(project,'demo/vendor/mindspeed');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8').replace(/^\uFEFF/,''));
const html=fs.readFileSync(path.join(source,'index.html'));
const hash=createHash('sha256').update(html).digest('hex');
if(manifest.execution_mode!=='browser-local-config-core' || manifest.mcp_protocol_endpoint!==false
  || manifest.sha256.toLowerCase()!==hash || !html.includes('mindspeed-config-demo/v1'))throw new Error('请先在 MCP 仓库运行 npm run package:github-pages，生成带页面通信入口且哈希一致的静态包');
fs.mkdirSync(target,{recursive:true});
for(const name of ['index.html','manifest.json','README.md','SHA256SUMS','.nojekyll'])fs.copyFileSync(path.join(source,name),path.join(target,name));
console.log('Synced browser-local workbench to demo/vendor/mindspeed; SHA256 '+hash);

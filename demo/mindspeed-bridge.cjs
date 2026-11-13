/* Local demo adapter: every calculation crosses a real MCP stdio connection. */
const path = require('node:path');
const {createRequire} = require('node:module');
const {randomUUID} = require('node:crypto');
const mcpRoot = path.resolve(process.env.MINDSPEED_CONFIG_MCP_ROOT || path.join(__dirname, '../../mindspeed-config-mcp'));
const allowed = new Set(['parse_training_config','validate_parallel_config','compute_rank_topology','estimate_training_capacity','suggest_config_fixes','plan_training_config','compose_analysis_report','review_config_change','analyze_performance_evidence']);
let connection;
const handoffs = new Map();
async function client() {
  if (!connection) connection = (async () => {
    const load = createRequire(path.join(mcpRoot, 'package.json'));
    const {Client} = load('@modelcontextprotocol/client');
    const {StdioClientTransport} = load('@modelcontextprotocol/client/stdio');
    const instance = new Client({name:'insightchat-live-config-demo',version:'1.0.0'});
    await instance.connect(new StdioClientTransport({command:process.execPath,args:[path.join(mcpRoot,'apps/mcp-server/src/index.js')],cwd:mcpRoot,stderr:'inherit'}));
    return instance;
  })().catch(error => {connection = null; throw error;});
  return connection;
}
async function callTool(name, args) {
  if (!allowed.has(name)) throw new Error('不支持的计算工具');
  const response = await (await client()).callTool({name,arguments:args});
  if (response.isError || !response.structuredContent) throw new Error(response.content?.find(item=>item.type==='text')?.text || 'MCP 未返回结构化结果');
  return response;
}
function source(file) {
  return {name:file.path,format:/\.(sh|ssh)$/i.test(file.path)?'shell':/\.json$/i.test(file.path)?'json':'yaml',content:file.content};
}
async function check({active,files}) {
  if (!Array.isArray(files) || !files.length || files.length>20 || !files.every(f=>typeof f.path==='string' && typeof f.content==='string')) throw new Error('请先打开一份配置文件');
  const folder = active.slice(0,active.lastIndexOf('/')+1);
  if (!files.some(f=>f.path===active) || files.some(f=>f.path.slice(0,f.path.lastIndexOf('/')+1)!==folder)) throw new Error('仅接收当前文件及同目录的配置');
  const ordered = [...files].sort((a,b)=>a.path.localeCompare(b.path));
  const training = ordered.find(f=>/\.(sh|ssh|ya?ml)$/i.test(f.path)) || ordered.find(f=>!/model_config\.json$/i.test(f.path)) || ordered[0];
  const models = ordered.filter(f=>f!==training && /\.json$/i.test(f.path));
  // Two-source MCP contract: never silently ignore extra ambiguous configuration files.
  if (ordered.length>2 || models.length>1 || ordered.length!==1+models.length) throw new Error('当前目录有多份配套配置，请保留一份训练配置与一份模型结构后再检查');
  const input = {schema_version:'1.0',rule_profile:{framework:'mindspeed-llm-mcore',version:'0.12.1'},source:source(training),...(models[0]?{model_source:source(models[0])}:{})};
  const parse = (await callTool('parse_training_config',input)).structuredContent;
  if (!parse.data?.mcp_invocation || !parse.data?.source_snapshot) throw new Error('MCP 解析结果缺少调用或来源凭据');
  const ready = parse.data.tool_readiness;
  const config = parse.data.normalized_config;
  const calls = ['parse_training_config'];
  let validation = null;
  if (ready?.validate_parallel_config?.ready === true) {
    validation = (await callTool('validate_parallel_config',config)).structuredContent;
    calls.push('validate_parallel_config');
  }
  const id = randomUUID();
  const result = {id,active,files:ordered.map(f=>f.path),parse,validation,calls,url:'/demo/mindspeed/workbench.html#handoff='+id};
  handoffs.set(id,{time:Date.now(),data:{source:{name:training.path,content:training.content,model_source:models[0]?{name:models[0].path,content:models[0].content}:null},target_tool:'parse_training_config',objective:'校验当前打开的配置文件',demo_config:config,demo_ready:!!validation}});
  for(const [key,value] of handoffs) if(Date.now()-value.time>86400000) handoffs.delete(key);
  return result;
}
async function html() {
  const resource = await (await client()).readResource({uri:'ui://mindspeed-config/result-view.html'});
  const text = resource.contents.find(item=>item.text)?.text;
  if(!text) throw new Error('MCP 页面资源为空，请先构建 UI');
  return text.replace('<head>',`<head><link rel="stylesheet" href="/demo/mindspeed-embed.css" data-mindspeed-embed><script>window.__MINDSPEED_WEB_SERVICE__={apiBase:'/demo/mindspeed/api'};</script><style>.pto-ide-frame__topbar.pto-ide-frame__standalone-chrome{display:none!important}html,body{height:100%;margin:0}.pto-ide-frame{width:100%!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;aspect-ratio:auto!important}</style><script>document.addEventListener('mcp:workbench-handoff',event=>{const handoff=event.detail;if(!handoff.demo_ready)return;setTimeout(()=>{document.dispatchEvent(new CustomEvent('mcp:restore-snapshot-request',{detail:{snapshot:{config:handoff.demo_config,source:{name:handoff.source.name,version_kind:'unsaved'}}}}));document.getElementById('croImportClose')?.click();},0);});</script>`);
}
async function body(req) {
  let text='';
  for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2000000)throw new Error('配置内容过大');}
  return JSON.parse(text||'{}');
}
async function handle(req,res,url) {
  if(!url.pathname.startsWith('/demo/mindspeed/')) return false;
  const json = (status,value) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const origin=req.headers.origin;
  let localOrigin=false;
  try {const parsed=new URL(origin);localOrigin=parsed.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(parsed.hostname);} catch {}
  if(origin && origin!==`http://${req.headers.host}` && !localOrigin){json(403,{message:'仅允许同源或本机 Live Server 请求'});return true;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return true;}
  try {
    if(req.method==='GET' && url.pathname==='/demo/mindspeed/workbench.html') {const page=await html();res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page);}
    else if(req.method==='GET' && url.pathname==='/demo/mindspeed/api/session') json(200,{authenticated:true,service:'insightchat-mindspeed-bridge'});
    else if(req.method==='POST' && url.pathname==='/demo/mindspeed/api/check') json(200,await check(await body(req)));
    else if(req.method==='POST' && url.pathname==='/demo/mindspeed/api/handoff') {const {token}=await body(req);const item=handoffs.get(token);json(item?200:404,item?{handoff:item.data}:{message:'请重新发送配置检查问题'});}
    else if(req.method==='POST' && url.pathname.startsWith('/demo/mindspeed/api/tools/')) json(200,await callTool(url.pathname.split('/').pop(),await body(req)));
    else json(404,{message:'未找到接口'});
  } catch(error) {json(502,{message:error.message});}
  return true;
}
async function close(){const previous=connection;connection=null;if(previous)await (await previous).close();}
module.exports={handle,check,close};

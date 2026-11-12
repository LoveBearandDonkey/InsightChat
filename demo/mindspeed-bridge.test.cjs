const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=require('./mindspeed-bridge.cjs');
const directory=path.join(__dirname,'training-configs/07_mindspeed_128rank_experiment');
const files=()=>fs.readdirSync(directory).map(name=>({path:'ConfigTest/07_mindspeed_128rank_experiment/'+name,content:fs.readFileSync(path.join(directory,name),'utf8')}));
test.after(()=>bridge.close());
test('07 training and model both resolve to the complete, valid 128 Rank input via MCP',async()=>{
  const sources=files();
  for(const active of sources.map(file=>file.path)){
    const result=await bridge.check({active,files:sources});
    assert.equal(result.active,active);
    assert.deepEqual(result.calls,['parse_training_config','validate_parallel_config']);
    assert.equal(result.parse.data.mcp_invocation.tool,'parse_training_config');
    assert.deepEqual(result.parse.data.missing_required_fields,[]);
    assert.deepEqual(result.parse.data.source_conflicts,[]);
    assert.deepEqual(result.validation.errors,[]);
    assert.deepEqual(result.validation.warnings,[]);
    assert.equal(result.parse.data.normalized_config.cluster.total_ranks,128);
  }
});
test('unsaved invalid parallel values are sent to MCP instead of reusing the valid result',async()=>{
  const sources=files();const training=sources.find(file=>file.path.includes('training.json'));
  const config=JSON.parse(training.content);config.parallel.ep=7;training.content=JSON.stringify(config);
  const result=await bridge.check({active:training.path,files:sources});
  assert.equal(result.parse.data.normalized_config.parallel.ep,7);
  assert.ok(result.validation.errors.length>0);
});
test('missing fields do not cause a successful parse to be reported as complete validation',async()=>{
  const result=await bridge.check({active:'incomplete/train.sh',files:[{path:'incomplete/train.sh',content:'python train.py --num-layers 32'}]});
  assert.deepEqual(result.calls,['parse_training_config']);
  assert.equal(result.validation,null);
  assert.ok(result.parse.data.missing_required_fields.length>0);
});

test('01 preserves negative Dense-layer source evidence as a review gap through actual MCP',async()=>{
  const sample=path.join(__dirname,'training-configs/01_mindspeed_deepseek_v4_flash');
  const sources=fs.readdirSync(sample).map(name=>({path:'ConfigTest/01_mindspeed_deepseek_v4_flash/'+name,content:fs.readFileSync(path.join(sample,name),'utf8')}));
  const result=await bridge.check({active:sources.find(file=>file.path.endsWith('.sh')).path,files:sources});
  assert.equal(result.parse.data.mcp_invocation.tool,'parse_training_config');
  assert.equal(result.parse.data.normalized_config.model.first_k_dense_layers,undefined);
  assert.ok(result.parse.data.missing_required_fields.includes('model.first_k_dense_layers'));
  assert.ok(result.parse.warnings.some(warning=>warning.code==='PARSE_DENSE_LAYER_COUNT_UNRESOLVED'));
  assert.ok(result.parse.data.unmapped_fields.some(field=>field.source_key==='first-k-dense-replace'&&field.value==='-1'));
  assert.equal(result.validation,null);
});
test('rejects unrelated directories and ambiguous multiple companion files',async()=>{
  await assert.rejects(()=>bridge.check({active:'a/config.json',files:[{path:'b/config.json',content:'{}'}]}));
  await assert.rejects(()=>bridge.check({active:'a/config.json',files:['config.json','other.json','third.json'].map(name=>({path:'a/'+name,content:'{}'}))}));
});

test('Live Server can discover the backend and preflight requests; public origins are rejected',async()=>{
  const http=require('node:http');
  const server=http.createServer((req,res)=>bridge.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/demo/mindspeed/api/session',{headers:{Origin:'http://127.0.0.1:5501'}});
    assert.equal(response.headers.get('access-control-allow-origin'),'http://127.0.0.1:5501');
    assert.equal((await response.json()).service,'insightchat-mindspeed-bridge');
    const preflight=await fetch(base+'/demo/mindspeed/api/check',{method:'OPTIONS',headers:{Origin:'http://localhost:5501','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
    assert.equal(preflight.status,204);
    const denied=await fetch(base+'/demo/mindspeed/api/session',{headers:{Origin:'https://example.com'}});
    assert.equal(denied.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

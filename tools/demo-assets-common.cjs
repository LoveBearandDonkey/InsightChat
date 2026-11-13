const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const upstream=path.resolve(process.env.MINDSPEED_CONFIG_MCP_ROOT||path.join(root,'../mindspeed-config-mcp'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const normalizedHash=value=>hash(value.toString('utf8').replace(/\r\n/g,'\n'));
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function sourceFingerprint(){
  const helper=path.join(upstream,'tools/demo-source-fingerprint.cjs');
  delete require.cache[require.resolve(helper)];
  const {fingerprint}=require(helper);
  return fingerprint(upstream);
}
module.exports={root,upstream,hash,normalizedHash,json,sourceFingerprint};

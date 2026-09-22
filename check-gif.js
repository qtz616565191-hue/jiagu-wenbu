// check-gif.js — render a lishu-src GIF as cut-140 binary preview
// usage: node check-gif.js <ch> <NN>
const http = require('http'), fs = require('fs');
function getJson(url) {
  return new Promise((res, rej) => { http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [, , ch, nn] = process.argv;

const expr = `new Promise(function(resolve){
  var img=new Image();
  img.onload=function(){
    var W=img.width,H=img.height;
    var t=document.createElement('canvas');t.width=W;t.height=H;
    var tc=t.getContext('2d');
    tc.fillStyle='#fff';tc.fillRect(0,0,W,H);tc.drawImage(img,0,0);
    var d=tc.getImageData(0,0,W,H).data;
    for(var i=0;i<d.length;i+=4){
      var l=(d[i]+d[i+1]+d[i+2])/3;
      if(l>=140){d[i+3]=0;}
      else{d[i]=d[i+1]=d[i+2]=15;d[i+3]=255;}
    }
    var o=document.createElement('canvas');o.width=W;o.height=H;
    o.getContext('2d').putImageData(new ImageData(d,W,H),0,0);
    resolve(o.toDataURL('image/png'));
  };
  img.src='lishu-src/${ch}/${nn}.gif';
})`;

(async () => {
  const targets = await getJson('http://localhost:9222/json');
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:8765/?t=' + Date.now() });
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const m = r.result.value.match(/base64,(.*)$/);
  const out = `shots-v3/chk-${ch}-${nn}.png`;
  fs.writeFileSync(out, Buffer.from(m[1], 'base64'));
  console.log('saved', out);
  ws.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

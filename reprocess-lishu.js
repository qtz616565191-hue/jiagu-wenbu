// reprocess-lishu.js — identify each chosen source GIF by IoU with current PNG,
// then rebuild binary (cut 140) transparent PNG.
const http = require('http'), fs = require('fs'), path = require('path');
function getJson(url) {
  return new Promise((res, rej) => { http.get(url, r => { let d=''; r.on('data', c => d+=c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CHARS = ['日','月','山','水','雨','目','家','马','鹿','休','明','河'];
const cands = {};
for (const ch of CHARS)
  cands[ch] = fs.readdirSync('lishu-src/' + ch).filter(f => f.endsWith('.gif')).sort();

const expr = `new Promise(function(resolve){
  var CHARS=${JSON.stringify(CHARS)}, cands=${JSON.stringify(cands)}, CUTI=185, CUT=140;
  var W=378,H=416;
  function load(src){return new Promise(function(ok,bad){
    var img=new Image();
    img.onload=function(){
      var cv=document.createElement('canvas');cv.width=W;cv.height=H;
      var c=cv.getContext('2d');
      c.fillStyle='#fff';c.fillRect(0,0,W,H);c.drawImage(img,0,0);
      ok(c.getImageData(0,0,W,H).data);
    };
    img.onerror=bad; img.src=src;
  });}
  function mask(d,cut){
    var m=new Uint8Array(W*H);
    for(var i=0;i<W*H;i++){var j=i*4;
      if(d[j+3]>0&&(d[j]+d[j+1]+d[j+2])/3<cut)m[i]=1;}
    return m;
  }
  function iou(a,b){var u=0,o=0;
    for(var i=0;i<W*H;i++){if(a[i]||b[i])u++;if(a[i]&&b[i])o++;}
    return u?o/u:0;}
  var report=[];
  (function run(k){
    if(k>=CHARS.length){resolve(JSON.stringify(report));return;}
    var ch=CHARS[k];
    load('img/lishu/'+ch+'.png').then(function(curD){
      var cur=mask(curD,CUTI);
      var best=null,bestV=-1;
      (function each(n){
        if(n>=cands[ch].length){
          // rebuild from best at CUT
          load('lishu-src/'+ch+'/'+best+'?r='+k).then(function(srcD){
            var out=new Uint8ClampedArray(W*H*4);
            for(var i=0;i<W*H;i++){var j=i*4,l=(srcD[j]+srcD[j+1]+srcD[j+2])/3;
              if(l<CUT){out[j]=out[j+1]=out[j+2]=15;out[j+3]=255;}
            }
            var cv=document.createElement('canvas');cv.width=W;cv.height=H;
            cv.getContext('2d').putImageData(new ImageData(out,W,H),0,0);
            report.push({ch:ch,src:best,iou:Math.round(bestV*1000)/1000,
              png:cv.toDataURL('image/png')});
            run(k+1);
          });
          return;
        }
        var f=cands[ch][n];
        load('lishu-src/'+ch+'/'+f+'?m='+k+'_'+n).then(function(d){
          var v=iou(cur,mask(d,CUTI));
          if(v>bestV){bestV=v;best=f;}
          each(n+1);
        }).catch(function(){each(n+1);});
      })(0);
    });
  })(0);
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
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:8765/?t=' + Date.now() });
  await sleep(600);
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (!r.result.value) { console.log(JSON.stringify(r).slice(0,2000)); process.exit(1); }
  const report = JSON.parse(r.result.value);
  for (const o of report) {
    const m = o.png.match(/base64,(.*)$/);
    fs.writeFileSync('img/lishu/' + o.ch + '.png', Buffer.from(m[1], 'base64'));
    console.log(o.ch, '<-', o.src, 'iou=' + o.iou);
  }
  ws.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

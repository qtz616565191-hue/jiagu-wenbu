// cdp-blacken.js — inverse of cdp-whiten: map the corner background color to pure black,
// for use with mix-blend-mode:screen so the black background disappears on dark surfaces.
// Usage: node cdp-blacken.js <in.png served path> <out.jpg> <width> [height] [plain]
//   plain = resize only, no level mapping (e.g. oracle background already balanced)
const http = require('http'), fs = require('fs');

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const [, , inPath, outPath, wArg, hArg, mode] = process.argv;
  const OW = +wArg, OH = +hArg || +wArg;
  const map = mode !== 'plain';
  const targets = await getJson('http://localhost:9222/json');
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:8765/?t=' + Date.now() });
  await sleep(1200);
  await send('Runtime.enable');

  const dataUrl = await evalJs(`(async function(){
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
      img.src = ${JSON.stringify('http://localhost:8765/' + inPath + '?t=' + Date.now())}; });
    const cv = document.createElement('canvas');
    cv.width = ${OW}; cv.height = ${OH};
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, ${OW}, ${OH});
    ${map ? `const imgData = ctx.getImageData(0, 0, ${OW}, ${OH});
    const d = imgData.data;
    const at = (x, y) => (y * ${OW} + x) * 4;
    const corners = [at(2,2), at(${OW}-3,2), at(2,${OH}-3), at(${OW}-3,${OH}-3)];
    let br=0, bg=0, bb=0;
    corners.forEach(k => { br+=d[k]; bg+=d[k+1]; bb+=d[k+2]; });
    br/=4; bg/=4; bb/=4;
    // 每通道线性：背景色 -> 0（黑）；gamma 1.08 压住暗部杂光，保住甲身亮部
    const lift = (v, b) => Math.max(0, (Math.pow(Math.max(0, v - b) / (255 - b), 1.08)) * 255);
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = lift(d[i], br);
      d[i+1] = lift(d[i+1], bg);
      d[i+2] = lift(d[i+2], bb);
    }
    ctx.putImageData(imgData, 0, 0);` : ''}
    return cv.toDataURL('image/jpeg', 0.9);
  })()`);

  fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('saved', outPath, (fs.statSync(outPath).size / 1024).toFixed(0) + 'KB');
  ws.close();
process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

// cdp-whiten.js — white-balance/levels: map the corner background color to pure white.
// For use with mix-blend-mode:multiply so the (former) background disappears on any surface.
// Usage: node cdp-whiten.js <in.png served path> <out.jpg> [size]
const http = require('http'), fs = require('fs');

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const [, , inPath, outPath, sizeArg] = process.argv;
  const SZ = +sizeArg || 1024;
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
    cv.width = cv.height = ${SZ};
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, ${SZ}, ${SZ});
    const imgData = ctx.getImageData(0, 0, ${SZ}, ${SZ});
    const d = imgData.data;
    const at = (x, y) => (y * ${SZ} + x) * 4;
    const corners = [at(2,2), at(${SZ}-3,2), at(2,${SZ}-3), at(${SZ}-3,${SZ}-3)];
    let br=0, bg=0, bb=0;
    corners.forEach(k => { br+=d[k]; bg+=d[k+1]; bb+=d[k+2]; });
    br/=4; bg/=4; bb/=4;
    // 每通道线性增益：背景色 -> 255；略带 gamma 0.92 保护壳身暗部
    const kr = 255/br, kg = 255/bg, kb = 255/bb;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.min(255, Math.pow(d[i]   * kr / 255, .92) * 255);
      d[i+1] = Math.min(255, Math.pow(d[i+1] * kg / 255, .92) * 255);
      d[i+2] = Math.min(255, Math.pow(d[i+2] * kb / 255, .92) * 255);
    }
    ctx.putImageData(imgData, 0, 0);
    return cv.toDataURL('image/jpeg', 0.92);
  })()`);

  fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('saved', outPath, (fs.statSync(outPath).size / 1024).toFixed(0) + 'KB');
  ws.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

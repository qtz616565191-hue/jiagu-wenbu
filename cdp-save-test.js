// cdp-save-test.js — intercept 保存卜辞 dataURL download and write the JPEG to disk
// Usage: node cdp-save-test.js <out.jpg> <#oracle|#oracle-bad>
const http = require('http'), fs = require('fs');

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const [, , outFile, hash, btnId] = process.argv;
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
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:8765/?t=' + Date.now() + hash });
  await sleep(1800);

  await evalJs(`(function(){
    window.__cap = null;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && /^data:image\\/jpeg/.test(this.href)) window.__cap = this.href;
    };
    document.getElementById(${JSON.stringify(btnId || 'btn-save-oracle')}).click();
    return 'queued';
  })()`);

  let dataUrl = null;
  for (let i = 0; i < 30; i++) {
    dataUrl = await evalJs('window.__cap');
    if (dataUrl) break;
    await sleep(200);
  }
  if (!dataUrl) throw new Error('saveOracle did not produce a data URL');
  fs.writeFileSync(outFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('saved', outFile, (fs.statSync(outFile).size / 1024).toFixed(0) + 'KB');
  ws.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

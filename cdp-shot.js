// cdp-shot.js — true mobile screenshots via Chrome DevTools Protocol (no deps)
// Usage: node cdp-shot.js <out.png> <urlPath>
const http = require('http');

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
const [, , outFile, urlPath, hOverride, postJs] = process.argv;
  const VH = hOverride && !isNaN(+hOverride) ? +hOverride : 844;
  const targets = await getJson('http://localhost:9222/json');
  const page = targets.find(t => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  function send(method, params = {}) {
    const mid = ++id;
    return new Promise(res => { pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  }

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: VH, deviceScaleFactor: 2, mobile: true,
  });
  const sep = urlPath.startsWith('#') ? '?t=' + Date.now() : '';
  await send('Page.navigate', { url: 'http://localhost:8765/' + sep + urlPath });
  await sleep(2000);
  if (postJs) {
    await send('Runtime.enable');
    await send('Runtime.evaluate', { expression: postJs, awaitPromise: true });
    await sleep(+process.env.POST_WAIT || 1200);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
  console.log('saved', outFile);
  ws.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

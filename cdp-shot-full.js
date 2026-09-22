// cdp-shot-full.js — full-page screenshot at arbitrary viewport width
// Usage: node cdp-shot-full.js <out.png> <urlPath> <width> <height>
const http = require('http');
function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d+=c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const [, , outFile, urlPath, vw, vh] = process.argv;
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: +vw, height: +vh, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:8765/' + urlPath });
  await sleep(+process.env.BASE_WAIT || 1500);
  const m = await send('Page.getLayoutMetrics');
  const cs = m.contentSize;
  const shot = await send('Page.captureScreenshot', { format: 'png',
    captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.max(cs.width, +vw), height: cs.height, scale: 1 } });
  require('fs').writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
  console.log('saved', outFile);
  ws.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

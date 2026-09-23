// qa-check.js — 全面体检：多机型溢出 / 真实灼龟 / 取消 / 拓印 / 分享图 / hash 钩子 / 控制台错误
// Usage: node qa-check.js
const http = require('http'), fs = require('fs'), path = require('path');
function getJson(u) {
  return new Promise((res, rej) => { http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 解析 JPEG 像素尺寸（扫 marker，取 SOF0/SOF2 段）
function jpegSize(fp) {
  const b = fs.readFileSync(fp);
  if (b[0] !== 0xFF || b[1] !== 0xD8) return { w: 0, h: 0 };
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xFF) { i++; continue; }
    while (b[i] === 0xFF) i++;
    const m = b[i++];
    if (m === 0xD9) break;                       // EOI
    if (m >= 0xD0 && m <= 0xD7) continue;        // RSTn（无长度）
    const len = b.readUInt16BE(i);
    if (m === 0xC0 || m === 0xC1 || m === 0xC2) {
      const h = b.readUInt16BE(i + 3), w = b.readUInt16BE(i + 5);
      return { w, h };
    }
    i += len;
  }
  return { w: 0, h: 0 };
}

(async () => {
  const errors = [];
  // 僵尸 target（崩溃 headless 残留，假 360x50 视口）和 edge:// 弹窗都不能用：
  // 逐个 candidate 连接、加载真实页、套模拟、实测内宽，第一个通过的才是活 target
  let ws = null, send, ev, go;
  const candidates = (await getJson('http://localhost:9222/json'))
    .filter(x => x.type === 'page' && (x.url === 'about:blank' || x.url.startsWith('http')));
  for (const pg of candidates) {
    const w = new WebSocket(pg.webSocketDebuggerUrl);
    await new Promise(r => w.onopen = r);
    let id = 0; const pend = new Map();
    w.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown')
        errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errors.push('console.error: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    };
    const s = (method, params = {}) => new Promise(res => {
      const mid = ++id; pend.set(mid, res); w.send(JSON.stringify({ id: mid, method, params }));
    });
    const v = e => s('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }).then(r => {
      if (r.result.exceptionDetails) errors.push('eval: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
      return r.result.value;
    });
    const g = async (url, wait = 1200) => { await v(`location.href=${JSON.stringify(url)}`); await sleep(wait); };
    await g('http://localhost:8765/?probe=' + Date.now(), 1000);
    await s('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
    if (await v('innerWidth+"x"+innerHeight') === '320x568') { ws = w; send = s; ev = v; go = g; break; }
    w.close(); errors.length = 0;
  }
  if (!ws) throw new Error('没有可用 target（全部是僵尸页），请重启 headless Edge');
  const activeId = () => ev(`[...document.querySelectorAll(".screen")].find(s=>s.classList.contains("active"))?.id||"-"`);

  const SCREENS = ['s-home', 's-d-ask', 's-d-burn', 's-d-result', 's-quiz', 's-rub', 's-evo', 's-result'];
  const overflowAt = async (W, H) => {
    await go('http://localhost:8765/?qa=' + Date.now(), 800);
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    const vp = await ev('innerWidth + "x" + innerHeight');
    if (vp !== `${W}x${H}`) throw new Error(`viewport ${vp}, 期望 ${W}x${H}`);
    const bad = [];
    for (const x of SCREENS) {
      await ev(`document.querySelectorAll(".screen.active").forEach(s=>s.classList.remove("active"));document.getElementById(${JSON.stringify(x)}).classList.add("active")`);
      await sleep(180);
      const o = await ev(`(function(){const el=document.getElementById(${JSON.stringify(x)});
        el.scrollLeft=999;const hx=el.scrollLeft;el.scrollLeft=0;
        el.scrollTop=999;const vy=el.scrollTop;el.scrollTop=0;
        return {cw:el.clientWidth,ch:el.clientHeight,hx,vy};})()`);
      if (o.hx > 0 || o.vy > 0) bad.push(`${x} ${o.cw}x${o.ch} 可滚 hx=${o.hx} vy=${o.vy}`);
    }
    return bad;
  };

  const results = [];
  const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });

  await send('Network.enable');
  await send('Network.clearBrowserCache');

  /* ---------- 1. 多机型 ---------- */
  for (const [W, H] of [[320, 568], [360, 640], [390, 844], [430, 932]]) {
    const bad = await overflowAt(W, H);
    check(`尺寸 ${W}x${H} 八屏无溢出`, bad.length === 0, bad.join('；') || 'all ✓');
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  /* ---------- 2. 真实灼龟（吉） ---------- */
  const holdBurn = async (forceBad) => {
    await go('http://localhost:8765/?b=' + Date.now(), 2700);
    await ev('document.getElementById("door-divine").click()'); await sleep(450);
    if (forceBad) await ev('window.__ornd = Math.random; Math.random = () => 0.9');
    await ev('document.getElementById("btn-charge").click()'); await sleep(450);
    const r = await ev(`(function(){const s=document.getElementById("burn-stage").getBoundingClientRect();
      return {x:s.left+s.width/2,y:s.top+s.height/2};})()`);
    await ev(`document.getElementById("burn-stage").dispatchEvent(new PointerEvent("pointerdown",
      {bubbles:true,cancelable:true,pointerId:11,clientX:${r.x},clientY:${r.y}}))`);
    await sleep(2700);
    const id = await activeId();
    const grade = await ev('document.getElementById("o-grade").textContent');
    const text = await ev('document.getElementById("o-text").textContent');
    if (forceBad) await ev('Math.random = window.__ornd');
    return { id, grade, text };
  };
  let r = await holdBurn(false);
  check('灼龟按住2s→自动入卜辞页', r.id === 's-d-result', `active=${r.id} grade=${r.grade}`);

  r = await holdBurn(true);
  const banned = /灾|祸|殃|死|亡|病|血|败|厄|咎|伤|难/;
  check('凶卜：判词只言缓/止/再卜，无灾祸描述',
    r.id === 's-d-result' && r.grade === '凶' && !banned.test(r.text), r.text);

  /* ---------- 3. 中途松手取消 ---------- */
  await go('http://localhost:8765/?c=' + Date.now(), 2700);
  await ev('document.getElementById("door-divine").click()'); await sleep(450);
  await ev('document.getElementById("btn-charge").click()'); await sleep(450);
  const sr = await ev(`(function(){const s=document.getElementById("burn-stage").getBoundingClientRect();
    return {x:s.left+s.width/2,y:s.top+s.height/2};})()`);
  await ev(`document.getElementById("burn-stage").dispatchEvent(new PointerEvent("pointerdown",
    {bubbles:true,cancelable:true,pointerId:12,clientX:${sr.x},clientY:${sr.y}}))`);
  await sleep(550);
  await ev(`document.getElementById("burn-stage").dispatchEvent(new PointerEvent("pointerup",
    {bubbles:true,cancelable:true,pointerId:12,clientX:${sr.x},clientY:${sr.y}}))`);
  await sleep(200);
  const cancel = await ev(`({heat:document.getElementById("s-d-burn").classList.contains("heating"),
    hint:document.getElementById("burn-hint").textContent,
    meter:document.getElementById("heat-fill").style.width})`);
  check('灼龟中途松手：火候复位、提示再试',
    !cancel.heat && /未足/.test(cancel.hint) && parseFloat(cancel.meter || '0') === 0,
    JSON.stringify(cancel));

  /* ---------- 4. 拓印全流程 ---------- */
  await go('http://localhost:8765/?r=' + Date.now() + '#rub', 1000);
  const cv = await ev(`(function(){const c=document.getElementById("rub-canvas").getBoundingClientRect();
    return {l:c.left,t:c.top,w:c.width,h:c.height};})()`);
  // 只擦中央字形区域（模拟真人；此前铺满全画布的擦法掩盖了阈值 bug）
  const moves = [];
  for (let y = cv.t + cv.h * .24; y < cv.t + cv.h * .78; y += 22)
    for (let x = cv.l + cv.w * .30; x < cv.l + cv.w * .72; x += 22)
      moves.push([x, y]);
  await ev(`document.getElementById("rub-canvas").dispatchEvent(new PointerEvent("pointerdown",
    {bubbles:true,cancelable:true,pointerId:21,clientX:${moves[0][0]},clientY:${moves[0][1]}}))`);
  for (const [x, y] of moves)
    await ev(`document.getElementById("rub-canvas").dispatchEvent(new PointerEvent("pointermove",
      {bubbles:true,cancelable:true,pointerId:21,clientX:${x},clientY:${y}}))`);
  await ev(`document.getElementById("rub-canvas").dispatchEvent(new PointerEvent("pointerup",
    {bubbles:true,cancelable:true,pointerId:21}))`);
  await sleep(800);
  const rubShown = await ev(`document.getElementById("rub-opts").style.display`);
  check('拓印显字过半：选项出现', rubShown === 'grid', `display=${rubShown}`);
  const theChar = await ev(`document.getElementById("rub-index").textContent.replace(/.*拓 · /,"").replace(/ 字.*/,"")`);
  await ev(`[...document.getElementById("rub-opts").children].find(b=>b.textContent.trim()===${JSON.stringify(theChar)}).click()`);
  await sleep(700);
  const exShown = await ev(`document.getElementById("e-mask").classList.contains("show")`);
  check('拓印答对：解说弹层出现', exShown === true, `char=${theChar}`);
  await ev('document.getElementById("btn-next").click()');
  await sleep(500);
  const afterRub = await ev(`({active:[...document.querySelectorAll(".screen")].find(s=>s.classList.contains("active"))?.id,
    idx:document.getElementById("q-index").textContent})`);
  check('拓印继续：回到答题下一字', afterRub.active === 's-quiz' && /5 \/ 12/.test(afterRub.idx), JSON.stringify(afterRub));

  /* ---------- 5. 分享图 ---------- */
  // 注：本机 headless 的下载管理器收齐字节后会在落盘环节取消（headless 已知环境
  // 问题，与页面代码无关），因此截获 createObjectURL 的 Blob，Node 侧落盘验证
  const dlDir = path.join(__dirname, 'qa-dl');
  if (!fs.existsSync(dlDir)) fs.mkdirSync(dlDir);
  fs.readdirSync(dlDir).forEach(f => fs.unlinkSync(path.join(dlDir, f)));
  await go('http://localhost:8765/?s=' + Date.now() + '#oracle', 1200);
  await ev(`(function(){
    window.__dlBlobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function(b){ window.__dlBlobs.push(b); return orig(b); };
  }())`);
  await ev('document.getElementById("btn-save-oracle").click()');
  await sleep(1500);
  const pkg = await ev(`(async function(){
    const b = window.__dlBlobs[window.__dlBlobs.length - 1];
    if (!b) return null;
    const bytes = new Uint8Array(await b.arrayBuffer());
    let bin = '';
    bytes.forEach(v => bin += String.fromCharCode(v));
    return { size: b.size, type: b.type, b64: btoa(bin) };
  }())`);
  let oracleInfo = 'no blob', dimOK = false;
  if (pkg) {
    const fp = path.join(dlDir, 'oracle.jpg');
    fs.writeFileSync(fp, Buffer.from(pkg.b64, 'base64'));
    const dim = jpegSize(fp);
    dimOK = dim.w === 750 && dim.h === 1334;
    oracleInfo = `${pkg.size}B ${pkg.type} ${dim.w}x${dim.h}`;
  }
  check('保存卜辞：750x1334 JPEG 已生成',
    !!pkg && pkg.size > 60000 && pkg.type === 'image/jpeg' && dimOK,
    oracleInfo);

  // 识字字鉴卡
  await go('http://localhost:8765/?z=' + Date.now(), 2700);
  await ev('window.__quizTest(1, 11)');
  await sleep(600);
  await ev('document.getElementById("btn-share").click()');
  await sleep(1800);
  const card = await ev(`(function(){const m=document.getElementById("card-mask"),i=document.getElementById("card-img");
    return {show:m.classList.contains("show"),w:i.naturalWidth,h:i.naturalHeight,len:(i.src||"").length};})()`);
  check('保存字鉴：收藏卡弹层 + 图已生成', card.show && card.w === 750 && card.len > 10000, JSON.stringify(card));
  await ev('document.getElementById("card-close").click()');

  /* ---------- 6. hash 钩子 ---------- */
  const hooks = { '#divine': 's-d-ask', '#burn': 's-d-burn', '#oracle': 's-d-result',
    '#oracle-bad': 's-d-result', '#rub': 's-rub', '#evo': 's-evo', '#result': 's-result' };
  for (const [h, want] of Object.entries(hooks)) {
    await go('http://localhost:8765/?h=' + Date.now() + h, 1300);
    const a = await activeId();
    check(`hash ${h}`, a === want, `active=${a}`);
  }

  /* ---------- 7. 控制台错误 ---------- */
  check('全程无 JS 异常 / console.error', errors.length === 0, errors.join('\n').slice(0, 800));

  /* ---------- 输出 ---------- */
  let pass = 0;
  for (const r of results) {
    console.log((r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : '  → ' + r.detail));
    if (r.ok) pass++;
  }
  console.log(`\n${pass}/${results.length} 通过`);
  ws.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

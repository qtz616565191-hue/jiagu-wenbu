// 《甲骨问卜》问卜模式 —— 命龟 → 灼龟（按住施火）→ 卜辞（只问吉凶，不算命）
// 复用 app.js 暴露的 window.SFX 与 window.startQuiz
(function () {
  const $ = (id) => document.getElementById(id);
  const ALL = ['s-home', 's-d-ask', 's-d-burn', 's-d-result',
    's-quiz', 's-rub', 's-evo', 's-result'];
  function show(id) {
    ALL.forEach(s => $(s).classList.toggle('active', s === id));
  }

  /* ---------- 事类（源自甲骨卜辞：出入、行止、会见、抉择等） ---------- */
  const CATS = ['出行', '行事', '相见', '抉择', '杂事'];
  let cat = null;

  /* ---------- 兆纹：吉凶有别（吉顺直少枝、凶横仄多折枝），200×200 坐标
     返回折线数组（首条为主纹）。所有点收在龟腹甲椭区内，不出甲缘；
     枝短、折行、不配对，避免成字成框 ---------- */
  const CX = 100, CY = 104, RX = 33, RY = 58;
  const R = (a, b) => a + Math.random() * (b - a);
  // 夹回甲面椭区（近似：x/y 独立按椭区夹）
  function clampP(p) {
    let x = Math.max(CX - RX + 2, Math.min(CX + RX - 2, p.x));
    let y = Math.max(CY - RY + 2, Math.min(CY + RY - 2, p.y));
    let dx = (x - CX) / RX, dy = (y - CY) / RY;
    const m = Math.hypot(dx, dy);
    if (m > 1) { x = CX + dx / m * (RX - 2); y = CY + dy / m * (RY - 2); }
    return { x, y };
  }

  function genCrack(v) {
    const main = [clampP({ x: 100 + R(-4, 4), y: 150 })];
    const lines = [main];
    if (v === '吉') {
      let x = main[0].x;
      for (let i = 0; i < 4; i++) {
        const y = 120 - i * 27 - R(0, 7);
        x += R(-6, 6);
        main.push(clampP({ x, y }));
      }
      // 两条短璺：错节点（高低错开）、异侧，近平出、各自微折
      const ks = shuffleIdx([1, 3]);
      ks.forEach((k, i) => {
        const p0 = main[k], dir = i === 0 ? -1 : 1;
        const pm = clampP({ x: p0.x + dir * R(9, 13), y: p0.y + R(-4, 4) });
        const p1 = clampP({ x: pm.x + dir * R(7, 12), y: pm.y + R(-7, 7) });
        lines.push([p0, pm, p1]);
      });
    } else {
      let x = main[0].x;
      for (let i = 0; i < 5; i++) {
        const y = 124 - i * 22 - R(0, 7);
        // 左右交替折行：如闪电绕中轴，不向一侧漂，避免成字
        x += (i % 2 === 0 ? -1 : 1) * R(9, 17);
        main.push(clampP({ x, y }));
      }
      // 三至四条短折枝：沿主纹上下散布，角度各异
      const n = 3 + Math.floor(Math.random() * 2);
      const pool = shuffleIdx([1, 2, 3, 4, 5]);
      const nodes = pool.slice(0, n).sort((a, b) => a - b);
      nodes.forEach(k => {
        const p0 = main[k], dir = Math.random() < .5 ? -1 : 1;
        const pm = clampP({ x: p0.x + dir * R(6, 9), y: p0.y + R(-8, 8) });
        const p1 = clampP({
          x: pm.x + dir * R(6, 11) * (0.6 + Math.random() * .6),
          y: pm.y + R(-0.6, 1.0) * R(8, 15),
        });
        lines.push([p0, pm, p1]);
      });
    }
    return lines;
  }
  function shuffleIdx(a) {
    const s = a.slice();
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }

  function pathD(l) {
    return 'M' + l.map(p => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L');
  }
  // mode: 'burn' = 灼龟屏三层辉光描出；'static' = 卜辞屏朱砂单层静态
  function crackMarkup(lines, mode) {
    if (mode === 'burn') {
      return lines.map((l, i) => {
        const d = pathD(l), w = i * 95;
        return `<path d="${d}" class="hc hc-glow draw" style="animation-delay:${w}ms"/>` +
          `<path d="${d}" class="hc hc-mid draw" style="animation-delay:${w + 70}ms"/>` +
          `<path d="${d}" class="hc hc-core draw" style="animation-delay:${w + 150}ms"/>`;
      }).join('');
    }
    return lines.map(l => `<path d="${pathD(l)}"/>`).join('');
  }

  /* ---------- 占辞（只释兆纹与行止态度，无具体预言） ---------- */
  const TEXTS = {
    '吉': [
      '兆纹顺直，光润而和——所问可往，循正而行。',
      '其纹清朗，无横无仄——吉，事可为，毋需疑虑。',
      '龟兆安宁，歧出皆顺——心正则路顺，自与吉会。',
      '火正而纹明——吉，唯慎终如始，则无败事。',
    ],
    '凶': [
      '兆纹旁出，其势稍阻——宜缓行，择时再卜。',
      '其纹横仄，未见其顺——今且止，不可强为。',
      '龟兆有疑，歧而不合——退而自省，后占未晚。',
      '火骤纹乱——凶，静守数日，转圜在人。',
    ],
  };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 干支 ---------- */
  const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  function dayGanZhi() {
    const n = new Date();
    const days = Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(2000, 0, 1)) / 864e5);
    const i = ((54 + days) % 60 + 60) % 60; // 2000-01-01 戊午
    return STEMS[i % 10] + BRANCHES[i % 12];
  }
  function yearGanZhi(y) {
    const i = ((y - 4) % 60 + 60) % 60;
    return STEMS[i % 10] + BRANCHES[i % 12];
  }

  /* ---------- 命龟 ---------- */
  function openAsk() {
    cat = null;
    document.querySelectorAll('#d-cats .cat').forEach(b => b.classList.remove('on'));
    show('s-d-ask');
  }

  function renderCats() {
    $('d-cats').innerHTML = CATS.map(c => `<button class="cat">${c}</button>`).join('');
    document.querySelectorAll('#d-cats .cat').forEach((b, i) =>
      b.onclick = () => {
        const on = b.classList.contains('on');
        document.querySelectorAll('#d-cats .cat').forEach(x => x.classList.remove('on'));
        b.classList.toggle('on', !on);
        cat = on ? null : CATS[i];
      });
  }

  /* ---------- 火尘：余烬上腾、爆火迸星（canvas，DPR 自适应） ---------- */
  const fxCv = $('burn-fx');
  let fx = fxCv.getContext('2d');
  let W2 = 0, H2 = 0, dpr = 1;
  let parts = [], raf = null, fxOn = false;

  function sizeFx() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W2 = fxCv.clientWidth; H2 = fxCv.clientHeight;
    fxCv.width = Math.round(W2 * dpr);
    fxCv.height = Math.round(H2 * dpr);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnEmber() {
    parts.push({
      k: 'e',
      x: W2 * (.38 + Math.random() * .24),
      y: H2 * (.70 + Math.random() * .1),
      vx: (Math.random() - .5) * .3,
      vy: -(0.7 + Math.random() * .9),
      r: 1.2 + Math.random() * 1.6,
      life: 0, ttl: 60 + Math.random() * 60,
      sw: Math.random() * 6.28,
    });
  }

  function burstSparks() {
    const cx = W2 * .5, cy = H2 * .62;
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.4;
      const sp = 1.6 + Math.random() * 4.6;
      parts.push({
        k: 's',
        x: cx + (Math.random() - .5) * W2 * .12,
        y: cy + (Math.random() - .5) * H2 * .06,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 1 + Math.random() * 2.2,
        life: 0, ttl: 40 + Math.random() * 55,
        sw: 0,
      });
    }
  }

  function fxFrame() {
    if (!fxOn) { raf = null; return; }
    fx.clearRect(0, 0, W2, H2);
    if (heating && parts.length < 40 && Math.random() < .3) spawnEmber();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life++;
      if (p.k === 'e') {
        p.x += p.vx + Math.sin((p.life + p.sw * 20) * .07) * .22;
        p.y += p.vy;
        p.vy *= .995;
      } else {
        p.vy += .045; p.vx *= .985;
        p.x += p.vx; p.y += p.vy;
      }
      const t = p.life / p.ttl;
      if (t >= 1) { parts.splice(i, 1); continue; }
      const a = p.k === 'e' ? (1 - t) * .85 : (1 - t);
      const rad = p.r * (p.k === 'e' ? 1 - t * .35 : 1);
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = a;
      fx.fillStyle = p.k === 'e'
        ? (t < .25 ? '#FFE6A8' : (t < .65 ? '#F4A24A' : '#C95A2E'))
        : '#FFD890';
      fx.beginPath();
      fx.arc(p.x, p.y, rad, 0, 6.2832);
      fx.fill();
    }
    fx.globalAlpha = 1;
    raf = requestAnimationFrame(fxFrame);
  }

  function startFx() {
    fxOn = true;
    if (!raf) raf = requestAnimationFrame(fxFrame);
  }
  window.addEventListener('resize', () => {
    if ($('s-d-burn').classList.contains('active')) sizeFx();
  });
  function stopFxSoon() {
    setTimeout(() => { fxOn = false; }, 1400);
  }
  function clearFx() {
    fxOn = false; parts = [];
    cancelAnimationFrame(raf); raf = null;
    fx.clearRect(0, 0, W2, H2);
  }

  /* ---------- 灼龟 ---------- */
  let verdict = '吉', crack = null;
  let heating = false, fired = false, timer = null, rumble = null;
  const HOLD_MS = 1250;

  function resetMeter() {
    const m = $('heat-fill');
    m.style.transition = 'none'; m.style.width = '0';
    void m.offsetWidth; m.style.transition = '';
  }

  function openBurn() {
    heating = false; fired = false;
    clearTimeout(timer); clearInterval(rumble);
    verdict = Math.random() < .5 ? '吉' : '凶';
    crack = genCrack(verdict);
    $('burn-cat').textContent = cat ? `问·${cat}` : '问卜';
    $('burn-hint').textContent = '按住龟甲，施以火炷';
    $('burn-crack').innerHTML = '';
    $('burn-verdict-v').textContent = '';
    $('burn-verdict').className = 'burn-say';
    const sec = $('s-d-burn');
    sec.classList.remove('heating', 'fired');
    $('burn-flash').classList.remove('fire');
    stage.classList.remove('shake');
    resetMeter();
    $('heat-meter').style.opacity = '';
    clearFx();
    show('s-d-burn');
    sizeFx(); // 须在 section 显示后取尺寸，否则 clientWidth 为 0
  }

  function startHeat(e) {
    if (fired) return;
    e.preventDefault();
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
    heating = true;
    $('s-d-burn').classList.add('heating');
    $('burn-hint').textContent = '火炷渐炽，勿松手……';
    startFx();
    if (window.SFX) rumble = setInterval(() => SFX.rub(), 110);
    timer = setTimeout(fire, HOLD_MS);
  }

  function cancelHeat() {
    if (!heating || fired) return;
    heating = false;
    clearTimeout(timer); clearInterval(rumble);
    $('s-d-burn').classList.remove('heating');
    resetMeter();
    $('burn-hint').textContent = '火候未足，再试一次';
  }

  function fire(v) {
    if (fired) return;
    if (v === '吉' || v === '凶') { verdict = v; crack = genCrack(v); }
    fired = true; heating = false;
    clearTimeout(timer); clearInterval(rumble);
    const sec = $('s-d-burn');
    sec.classList.remove('heating');
    sec.classList.add('fired');
    $('heat-meter').style.opacity = '0';
    $('burn-hint').textContent = '灼而成兆——';
    // 点火：爆闪、震屏、迸星、层叠爆响、触感
    const fl = $('burn-flash');
    fl.classList.remove('fire'); void fl.offsetWidth;
    fl.classList.add('fire');
    stage.classList.remove('shake'); void stage.offsetWidth;
    stage.classList.add('shake');
    burstSparks(); startFx(); stopFxSoon();
    if (window.SFX) {
      SFX.crack();
      setTimeout(() => SFX.crack(), 130);
      setTimeout(() => SFX.rub(), 300);
    }
    if (navigator.vibrate) navigator.vibrate([28, 40, 18]);
    $('burn-crack').innerHTML = crackMarkup(crack, 'burn');
    setTimeout(() => {
      $('burn-verdict-v').textContent = verdict;
      $('burn-verdict').className = 'burn-say show';
      if (window.SFX) { if (verdict === '吉') SFX.correct(); else SFX.wrong(); }
    }, 560);
    setTimeout(openOracle, 1850);
  }

  /* ---------- 卜辞 ---------- */
  function openOracle() {
    const now = new Date();
    $('o-meta').textContent =
      `维${yearGanZhi(now.getFullYear())}年·${dayGanZhi()}日　卜问${cat || '（默问）'}`;
    $('o-grade').textContent = verdict;
    $('o-text').textContent = pick(TEXTS[verdict]);
    $('o-crack').innerHTML = crackMarkup(crack, false);
    show('s-d-result');
  }

  function previewOracle(v) {
    cat = '出行';
    verdict = v;
    crack = genCrack(v);
    openOracle();
  }

  /* ---------- 保存卜辞（750×1334 分享图） ---------- */
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  // 先在「——」处断行；段内超长时优先在逗号处折，避免孤词末行
  function wrapSeg(t, n, out) {
    if (t.length <= n) { out.push(t); return; }
    let cut = t.lastIndexOf('，', n);
    if (cut < 4) cut = n - 1;
    out.push(t.slice(0, cut + 1));
    wrapSeg(t.slice(cut + 1), n, out);
  }
  function wrapText(s, n) {
    const out = [];
    s.split('——').forEach((seg, i) => wrapSeg((i ? '——' : '') + seg, n, out));
    return out;
  }

  async function saveOracle() {
    const W = 750, H = 1334;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const FONT = '"Noto Serif SC","Source Han Serif SC","STKaiti","KaiTi",serif';

    // 玄漆夜祭底图（与 750×1334 同比）+ 暖金发丝双线框
    const bg = await loadImage('img/oracle-bg.jpg');
    x.drawImage(bg, 0, 0, W, H);
    x.strokeStyle = 'rgba(176,146,94,.65)'; x.lineWidth = 1;
    x.strokeRect(38, 38, W - 76, H - 76);
    x.strokeStyle = 'rgba(176,146,94,.3)';
    x.strokeRect(50, 50, W - 100, H - 100);

    x.textAlign = 'center';
    x.fillStyle = '#B0925E';
    x.font = `500 27px ${FONT}`;
    x.fillText('甲骨问卜 · 卜辞', W / 2, 120);

    const now = new Date();
    x.fillStyle = '#A8936F'; x.font = `400 21px ${FONT}`;
    x.fillText(`维${yearGanZhi(now.getFullYear())}年·${dayGanZhi()}日　卜问${cat || '（默问）'}`, W / 2, 188);

    // 黑底龟甲 screen 落在夜祭中央：骨甲如在暗中自明
    const box = 360, bx0 = (W - box) / 2, by0 = 280;
    const shell = await loadImage('img/shell-dark.jpg');
    x.save();
    x.globalCompositeOperation = 'screen';
    x.drawImage(shell, bx0, by0, box, box);
    x.restore();
    const px = v => bx0 + v.x / 200 * box, py = v => by0 + v.y / 200 * box;
    x.lineCap = 'round'; x.lineJoin = 'round';
    const trace = () => {
      x.beginPath();
      crack.forEach(l => l.forEach((p, i) => i ? x.lineTo(px(p), py(p)) : x.moveTo(px(p), py(p))));
    };
    // 裂纹三趟，呼应屏上三层：琥珀辉光 → 朱砂 → 白炽芯
    trace();
    x.strokeStyle = 'rgba(224,120,56,.5)'; x.lineWidth = 12;
    x.shadowColor = 'rgba(224,120,56,.8)'; x.shadowBlur = 26;
    x.stroke();
    x.shadowBlur = 0;
    trace();
    x.strokeStyle = '#C64A34'; x.lineWidth = 5.5;
    x.stroke();
    trace();
    x.strokeStyle = '#FFE6B0'; x.lineWidth = 1.8;
    x.stroke();

    x.fillStyle = '#C64A34'; x.font = `900 132px ${FONT}`;
    x.fillText(verdict, W / 2, 818);

    x.fillStyle = '#E9DCBE'; x.font = `400 27px ${FONT}`;
    const lines = wrapText($('o-text').textContent, 22);
    lines.forEach((l, i) => x.fillText(l, W / 2, 920 + i * 46));

    x.fillStyle = '#84735A'; x.font = `400 19px ${FONT}`;
    x.fillText('殷人卜以决疑 · 此为甲骨文化体验，非算命之断，吉凶在人', W / 2, 1190);
    x.fillStyle = '#A8936F'; x.font = `600 22px ${FONT}`;
    x.fillText('甲骨问卜', W / 2, 1245);

    const a = document.createElement('a');
    a.download = '甲骨问卜-卜辞.jpg';
    a.href = cv.toDataURL('image/jpeg', .92);
    a.click();
  }

  /* ---------- 识字成绩图（750×1334，卷轴 + 竖排判词） ---------- */
  function drawCover(ctx, img, dx, dy, dw, dh) {
    const s = Math.max(dw / img.width, dh / img.height);
    const sw = dw / s, sh = dh / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
  }
  // 竖排成列：右列先行，自上而下
  function drawVertical(ctx, s, x, y, step) {
    for (let i = 0; i < s.length; i++) ctx.fillText(s[i], x, y + i * step);
  }

  async function saveQuiz() {
    const W = 750, H = 1334;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const FONT = '"Noto Serif SC","Source Han Serif SC","STKaiti","KaiTi",serif';

    x.fillStyle = '#EFE7D3'; x.fillRect(0, 0, W, H);

    // 卷轴卡：纵横比取屏上设计比 0.786（346×440），cover 源窗与屏幕一致
    // → 源 y 302..1217，恰好不含 AI 底图角落的红印
    const cx0 = 115, cy0 = 225, cw = 520, ch = 661;
    const scroll = await loadImage('img/result.jpg');
    drawCover(x, scroll, cx0, cy0, cw, ch);
    x.strokeStyle = 'rgba(156,123,69,.7)'; x.lineWidth = 1;
    x.strokeRect(cx0, cy0, cw, ch);
    x.strokeStyle = 'rgba(156,123,69,.4)';
    x.strokeRect(cx0 - 10, cy0 - 10, cw + 20, ch + 20);

    x.textAlign = 'center';
    x.fillStyle = '#7a6745'; x.font = `500 27px ${FONT}`;
    x.fillText('甲骨问卜 · 识字', W / 2, cy0 + 90);

    x.fillStyle = '#A63A2E'; x.font = `900 104px ${FONT}`;
    x.fillText($('r-grade').textContent, W / 2, cy0 + 240);

    x.fillStyle = '#5d4f36'; x.font = `400 27px ${FONT}`;
    x.fillText(`识得 ${$('r-score').textContent} / 12 字`, W / 2, cy0 + 348);

    // 竖排判词：右列 7 字为先，收在卡内（卡底 cy0+661）
    const s = $('r-text').textContent;
    const colR = s.slice(0, 7), colL = s.slice(7);
    const vy0 = cy0 + 398, step = 34;
    x.fillStyle = '#43351e'; x.font = `400 28px ${FONT}`;
    drawVertical(x, colR, 424, vy0, step);
    drawVertical(x, colL, 350, vy0, step);

    x.fillStyle = '#9a8760'; x.font = `400 19px ${FONT}`;
    x.fillText('循着一片龟甲，寻踪汉字三千年', W / 2, 1190);
    x.fillStyle = '#5d4f36'; x.font = `600 22px ${FONT}`;
    x.fillText('甲骨问卜', W / 2, 1245);

    const a = document.createElement('a');
    a.download = '甲骨问卜-识字.jpg';
    a.href = cv.toDataURL('image/jpeg', .92);
    a.click();
  }
  window.__saveQuiz = saveQuiz;

  /* ---------- 绑定 ---------- */
  $('door-divine').onclick = openAsk;
  $('door-quiz').onclick = () => { window.startQuiz(); show('s-quiz'); };
  $('ask-home').onclick = () => show('s-home');
  $('oracle-home').onclick = () => show('s-home');
  $('btn-charge').onclick = openBurn;
  $('btn-redivine').onclick = openAsk;
  $('btn-to-quiz').onclick = () => { window.startQuiz(); show('s-quiz'); };
  $('btn-save-oracle').onclick = saveOracle;
  $('btn-share').onclick = saveQuiz; // 覆盖 app.js 中的占位 alert
  $('btn-to-divine').onclick = openAsk;

  const stage = $('burn-stage');
  stage.onpointerdown = startHeat;
  stage.onpointerup = cancelHeat;
  stage.onpointercancel = cancelHeat;
  stage.onpointerleave = cancelHeat;
  stage.oncontextmenu = e => e.preventDefault(); // 长按不弹系统菜单

  renderCats();

  // CDP 调试接口
  window.__divine = {
    fire, preview: previewOracle, openBurn,
    heat: () => { heating = true; $('s-d-burn').classList.add('heating'); startFx(); },
  };

  // 预览钩子
  const h = location.hash;
  if (h === '#divine') openAsk();
  else if (h === '#burn') { cat = '出行'; openBurn(); }
  else if (h === '#oracle') previewOracle('吉');
  else if (h === '#oracle-bad') previewOracle('凶');
})();

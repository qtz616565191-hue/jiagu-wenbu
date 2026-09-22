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
        const d = pathD(l), w = i * 110;   // 主纹先出，枝纹逐条错峰
        return `<path d="${d}" class="hc hc-glow draw" style="animation-delay:${w}ms"/>` +
          `<path d="${d}" class="hc hc-mid draw" style="animation-delay:${w + 80}ms"/>` +
          `<path d="${d}" class="hc hc-core draw" style="animation-delay:${w + 160}ms"/>`;
      }).join('');
    }
    return lines.map(l => `<path d="${pathD(l)}"/>`).join('');
  }

  /* ---------- 占辞（按事类分池；只释兆纹与行止态度，无具体预言）
     统一句法：前半写兆纹形态，后半只给态度——可往/可为/可见/可决，
     或宜缓/宜止/再卜；不预断成败，不涉灾祥 ---------- */
  const TEXTS = {
    '出行': {
      '吉': [
        '兆纹顺达，末锐而敛——可行，宜及早启途，毋事逗留。',
        '其纹长直，枝短不牵——往则合宜，水陆两途，任其所之。',
        '龟兆清宁，歧出咸顺——可以出，循道而行，至而后图。',
      ],
      '凶': [
        '兆纹旁屈，其势不舒——行有未便，宜缓启途，更卜而往。',
        '其纹横出，中道如窒——今且止驾，无亟于行，旬日再占。',
        '龟兆两歧，开合不一——进退未决，宜止勿逐，待时后图。',
      ],
    },
    '行事': {
      '吉': [
        '兆纹明润，节节相承——事可举也，宜秉中正，慎终如始。',
        '其纹顺起顺收，无横枝——举事咸宜，决于己志，行之勿疑。',
        '火明而纹朗——所图可兴，宜速布置，毋失其时。',
      ],
      '凶': [
        '兆纹多折，枝出不协——事有未协，宜且停置，理顺再举。',
        '其纹乱而下垂——今未可为，静守毋躁，改卜他日。',
        '龟兆傍泄，主纹不聚——事宜缓图，毋强进，退而修备。',
      ],
    },
    '相见': {
      '吉': [
        '兆纹双歧同向，其末交抱——可见，宜诚素以往，相见则通。',
        '其纹相迎不相背——往见则宜，先之以信，无俟再三。',
        '龟兆和润，旁枝皆顺——会见有兆，宜定其期，躬身以往。',
      ],
      '凶': [
        '兆纹相背，末不外舒——见有未合，宜缓其期，更卜而后见。',
        '其纹中折，两歧不属——今未见宜，且止勿往，信通再图。',
        '龟兆横仄，如迎如拒——会见难必，宜止而待，无自轻往。',
      ],
    },
    '抉择': {
      '吉': [
        '兆纹一歧独明，余纹皆伏——所惑可决，从其明者，舍其二三。',
        '其纹中正，不左不右——取舍有定，宜守中道，断之以义。',
        '龟兆顺而有所归——两途之间，从心所安，既决勿反。',
      ],
      '凶': [
        '兆纹两歧争出，势均不合——兹事难决，宜且置之，三思后卜。',
        '其纹左右交折——取舍未定，毋匆遽择，静心思之。',
        '龟兆中窒，首尾不属——今皆未可，宜止而守，歧路毋行。',
      ],
    },
    '杂事': {
      '吉': [
        '兆纹安和，细纹咸理——细故可处，随宜了之，不以萦怀。',
        '其纹简净，无争无竞——小事吉，宜简节疏目，处之以宽。',
        '龟兆平顺，起止自如——凡百细务，皆可次第而理，毋亟毋滞。',
      ],
      '凶': [
        '兆纹微紊，细纹旁出——细故有梗，宜缓置，理顺而后处。',
        '其纹繁而不属——琐事难骤了，宜且止，宁迟毋躁。',
        '龟兆小有晦塞——事宜含忍，勿与小竞，改日再占。',
      ],
    },
  };
  // 未择事类（默问）：用不指向具体事相的通用占辞
  const GENERIC = {
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
  const pickText = (c, v) => pick((TEXTS[c] || GENERIC)[v]);

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
  let heating = false, fired = false, timer = null, crackTimer = null, rumble = null;
  const HOLD_MS = 2000;      // 按住总时长
  const CRACK_AT = 1000;     // 阶段2：裂纹逐条浮现的起点

  function resetMeter() {
    const m = $('heat-fill');
    m.style.transition = 'none'; m.style.width = '0';
    void m.offsetWidth; m.style.transition = '';
  }

  function openBurn() {
    heating = false; fired = false;
    clearTimeout(timer); clearTimeout(crackTimer); clearInterval(rumble);
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
    crackTimer = setTimeout(beginCracks, CRACK_AT);
    timer = setTimeout(fire, HOLD_MS);
  }

  // 阶段2（按住满 1s）：主纹先出、枝纹错峰逐条描出，配裂响；约 1s 内出齐
  function beginCracks() {
    if (!heating || fired) return;
    $('burn-crack').innerHTML = crackMarkup(crack, 'burn');
    $('burn-hint').textContent = '灼而成兆……';
    if (window.SFX) {
      SFX.crack();
      setTimeout(() => { if (heating) SFX.crack(); }, 230);
    }
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function cancelHeat() {
    if (!heating || fired) return;
    heating = false;
    clearTimeout(timer); clearTimeout(crackTimer); clearInterval(rumble);
    $('s-d-burn').classList.remove('heating');
    $('burn-crack').innerHTML = '';   // 已出裂纹一并撤去，恢复素甲
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
    if (window.SFX) SFX.crack();   // 阶段3：白光一闪的爆裂声
    if (navigator.vibrate) navigator.vibrate([28, 40, 18]);
    // 裂纹已在阶段2出齐，此处只揭晓判词
    setTimeout(() => {
      $('burn-verdict-v').textContent = verdict;
      $('burn-verdict').className = 'burn-say show';
      if (window.SFX) { if (verdict === '吉') SFX.correct(); else SFX.wrong(); }
    }, 220);
    setTimeout(openOracle, 450);   // 自按住起总时长 2.45s
  }

  /* ---------- 卜辞 ---------- */
  function openOracle() {
    const now = new Date();
    $('o-meta').textContent =
      `维${yearGanZhi(now.getFullYear())}年·${dayGanZhi()}日　卜问${cat || '（默问）'}`;
    $('o-grade').textContent = verdict;
    $('o-text').textContent = pickText(cat, verdict);
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

  /* ---------- 识字收藏卡（750×1334：2×6 甲骨格，答错置灰，长按保存） ---------- */
  function drawCover(ctx, img, dx, dy, dw, dh) {
    const s = Math.max(dw / img.width, dh / img.height);
    const sw = dw / s, sh = dh / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
  }
  // 内联 SVG（fill=currentColor，400 viewBox）→ 可绘入 canvas 的位图
  function rasterize(svgStr, color) {
    const svg = svgStr.replace('currentColor', color);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    return loadImage(url).then(img => { URL.revokeObjectURL(url); return img; });
  }

  async function saveQuiz() {
    const record = window.quizRecord();
    const W = 750, H = 1334;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const FONT = '"Noto Serif SC","Source Han Serif SC","STKaiti","KaiTi",serif';
    const INK = '#2B2418', GRAY = '#BCB3A2';

    // 米黄底 + 淡龟甲纹理（素甲摄影低透明度压底）
    x.fillStyle = '#EFE7D3'; x.fillRect(0, 0, W, H);
    const shell = await loadImage('img/shell.jpg');
    x.save(); x.globalAlpha = .09;
    drawCover(x, shell, 0, 0, W, H);
    x.restore();
    // 纸本细噪点
    for (let i = 0; i < 520; i++) {
      x.fillStyle = `rgba(120,96,60,${Math.random() * .05})`;
      x.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
    }
    // 暖金双线框
    x.strokeStyle = 'rgba(156,123,69,.65)'; x.lineWidth = 1;
    x.strokeRect(38, 38, W - 76, H - 76);
    x.strokeStyle = 'rgba(156,123,69,.3)';
    x.strokeRect(50, 50, W - 100, H - 100);

    x.textAlign = 'center';
    x.fillStyle = '#7a6745'; x.font = `500 30px ${FONT}`;
    x.fillText('甲骨问卜 · 识字字鉴', W / 2, 118);
    x.fillStyle = '#A8936F'; x.font = `400 20px ${FONT}`;
    const now = new Date();
    x.fillText(`维${yearGanZhi(now.getFullYear())}年·${dayGanZhi()}日　字鉴十二品`, W / 2, 172);

    // 2×6 甲骨格（按本局答题顺序）
    const CELL = 92, GAP = 18;
    const gw = 6 * CELL + 5 * GAP;
    const x0 = (W - gw) / 2, y0 = 226;
    const glyphImgs = await Promise.all(record.map(r => rasterize(r.glyph, r.ok ? INK : GRAY)));
    record.forEach((r, i) => {
      const col = i % 6, row = (i / 6) | 0;
      const gx = x0 + col * (CELL + GAP), gy = y0 + row * (CELL + GAP);
      x.fillStyle = r.ok ? '#F7F1E1' : '#E6E0D0';
      x.fillRect(gx, gy, CELL, CELL);
      x.strokeStyle = r.ok ? 'rgba(156,123,69,.75)' : 'rgba(160,150,130,.55)';
      x.strokeRect(gx + .5, gy + .5, CELL - 1, CELL - 1);
      // 甲骨真形：内缩 11px；答错者灰而淡
      x.save();
      if (!r.ok) x.globalAlpha = .8;
      x.drawImage(glyphImgs[i], gx + 11, gy + 11, CELL - 22, CELL - 22);
      x.restore();
      // 藏品序号（左上）
      x.textAlign = 'left';
      x.fillStyle = 'rgba(156,123,69,.55)'; x.font = `400 13px ${FONT}`;
      x.fillText(String(i + 1), gx + 6, gy + 17);
      x.textAlign = 'center';
    });

    // 评级
    x.fillStyle = '#A63A2E'; x.font = `900 118px ${FONT}`;
    x.fillText($('r-grade').textContent, W / 2, 596);
    x.fillStyle = '#5d4f36'; x.font = `400 29px ${FONT}`;
    x.fillText(`识得 ${$('r-score').textContent} / 12 字`, W / 2, 668);
    x.fillStyle = '#6f5f42'; x.font = `400 24px ${FONT}`;
    x.fillText($('r-text').textContent, W / 2, 726);

    // 图例：已识 / 未识
    const ly = 800, ls = 22;
    x.fillStyle = '#F7F1E1'; x.fillRect(W / 2 - 108, ly - 17, ls, ls);
    x.strokeStyle = 'rgba(156,123,69,.75)'; x.strokeRect(W / 2 - 107.5, ly - 16.5, ls - 1, ls - 1);
    x.fillStyle = '#E6E0D0'; x.fillRect(W / 2 + 28, ly - 17, ls, ls);
    x.strokeStyle = 'rgba(160,150,130,.55)'; x.strokeRect(W / 2 + 28.5, ly - 16.5, ls - 1, ls - 1);
    x.textAlign = 'left';
    x.fillStyle = '#6f5f42'; x.font = `400 19px ${FONT}`;
    x.fillText('已识', W / 2 - 80, ly);
    x.fillText('未识', W / 2 + 56, ly);
    x.textAlign = 'center';

    // 左下品牌
    x.textAlign = 'left';
    x.fillStyle = '#9a8760'; x.font = `400 20px ${FONT}`;
    x.fillText('循着一片龟甲，寻踪汉字三千年', 58, 1190);
    x.fillStyle = '#5d4f36'; x.font = `600 26px ${FONT}`;
    x.fillText('甲骨问卜', 58, 1240);

    // 右下二维码占位（白地 + 定位角 + 伪码点；日后替换为真实码）
    const qw = 128, qx = W - 54 - qw, qy = H - 54 - qw;
    x.fillStyle = '#FFFFFF'; x.fillRect(qx, qy, qw, qw);
    x.strokeStyle = 'rgba(120,100,70,.8)'; x.lineWidth = 1;
    x.strokeRect(qx + .5, qy + .5, qw - 1, qw - 1);
    const M = 7.2, pad = 9;
    // 三个回字定位角：黑块 → 白心 → 黑点
    [[pad, pad], [qw - pad - M * 3, pad], [pad, qw - pad - M * 3]].forEach(([fx, fy]) => {
      x.fillStyle = '#33291C'; x.fillRect(qx + fx, qy + fy, M * 3, M * 3);
      x.fillStyle = '#FFFFFF'; x.fillRect(qx + fx + M, qy + fy + M, M, M);
      x.fillStyle = '#33291C'; x.fillRect(qx + fx + M * 1.4, qy + fy + M * 1.4, M * .2, M * .2);
    });
    // 伪数据码点（确定性伪随机，仅占位）
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++) {
        const inFinder = (c < 6 && r < 6) || (c > 8 && r < 6) || (c < 6 && r > 8);
        if (!inFinder && rnd() > .58)
          x.fillRect(qx + pad + c * M, qy + pad + r * M, M * .86, M * .86);
      }
    x.textAlign = 'right';
    x.fillStyle = '#8a7858'; x.font = `400 17px ${FONT}`;
    x.fillText('扫码再寻', qx + qw, qy - 12);

    // 弹预览层：长按图片可存相册；<a download> 兼容直接下载
    const url = cv.toDataURL('image/jpeg', .92);
    $('card-img').src = url;
    $('card-link').href = url;
    $('card-mask').classList.add('show');
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
  $('card-close').onclick = () => $('card-mask').classList.remove('show');
  $('card-mask').onclick = e => { if (e.target === $('card-mask')) $('card-mask').classList.remove('show'); };

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
    previewCat: (c, v) => { cat = c; verdict = v; crack = genCrack(v); openOracle(); },
    heat: () => { heating = true; $('s-d-burn').classList.add('heating'); startFx(); },
  };

  // 预览钩子
  const h = location.hash;
  if (h === '#divine') openAsk();
  else if (h === '#burn') { cat = '出行'; openBurn(); }
  else if (h === '#oracle') previewOracle('吉');
  else if (h === '#oracle-bad') previewOracle('凶');
})();

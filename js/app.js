// 《甲骨问卜》—— 猜字 + 拓印 + 观变 + 程序化音效
(function () {
  const $ = (id) => document.getElementById(id);
  const screens = ['s-home', 's-quiz', 's-rub', 's-evo', 's-result'];

  let idx = 0, score = 0, wrongTouched = false, soundOn = true;
  let evoIdx = 0; // 观变当前阶段
  let rubChar = null, rubDone = false, rubWrong = false;
  let order = []; // 每局随机后的题目下标序列

  // 拓印插入点：答完第 4、9 题后，拓印刚答对的那个字（12 题版节奏）
  const RUB_AFTER = { 3: true, 8: true };

  // Fisher–Yates 洗牌
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function show(id) {
    screens.forEach(s => $(s).classList.toggle('active', s === id));
  }

  /* ---------- 音效：WebAudio 程序化合成（零素材，首次触摸解锁） ---------- */
  let actx = null;
  function audio() {
    if (!soundOn) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', gain = 0.18, when = 0, glideTo = null) {
    const c = audio(); if (!c) return;
    const t0 = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur = 0.25, gain = 0.12, hp = 1200) {
    const c = audio(); if (!c) return;
    const n = c.sampleRate * dur;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination); src.start();
  }
  const SFX = {
    unlock() { audio(); },
    correct() { tone(523.25, 0.16, 'sine', 0.16); tone(783.99, 0.3, 'sine', 0.14, 0.1); }, // 磬：C5→G5
    wrong() { tone(150, 0.22, 'triangle', 0.16, 0, 90); },                                  // 低鼓
    crack() { noise(0.28, 0.1, 1600); },
    open() { tone(392, 0.1, 'sine', 0.08); tone(587.33, 0.16, 'sine', 0.08, 0.07); },
    rub() { noise(0.06, 0.035, 2600); },
  };

  // 首题暖池（最象形的 5 个字），其余题完全随机
  const EASY_FIRST = ['日', '月', '山', '雨', '目'];

  function start() {
    idx = 0; score = 0; fromRub = false;
    const all = QUESTIONS.map((_, i) => i);
    const easyIdx = all.filter(i => EASY_FIRST.includes(QUESTIONS[i].char));
    const first = easyIdx[Math.floor(Math.random() * easyIdx.length)];
    order = [first, ...shuffle(all.filter(i => i !== first))];
    show('s-quiz');
    render();
  }

  function render() {
    const q = QUESTIONS[order[idx]];
    curQ = q;
    wrongTouched = false;
    $('q-index').textContent = `第 ${idx + 1} / ${QUESTIONS.length} 字`;
    $('q-score').textContent = `已识 ${score} 字`;
    $('q-progress').style.width = `${(idx / QUESTIONS.length) * 100}%`;

    const card = $('q-glyph');
    card.className = 'glyph-card';
    $('q-glyph-slot').innerHTML = q.glyph;

    const box = $('q-opts');
    box.innerHTML = '';
    const opts = [...q.options].sort(() => Math.random() - 0.5);
    opts.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = opt;
      b.onclick = () => choose(b, opt, q);
      box.appendChild(b);
    });
  }

  function choose(btn, opt, q) {
    if (btn.classList.contains('lock')) return;
    if (opt === q.answer) {
      if (!wrongTouched) score++;
      btn.classList.add('right');
      [...document.querySelectorAll('.opt')].forEach(b => b.classList.add('lock'));
      $('q-glyph').classList.add('correct');
      SFX.correct(); SFX.crack();
      setTimeout(openExplain, 600);
    } else {
      wrongTouched = true;
      btn.classList.add('bad', 'lock');
      $('q-glyph').classList.add('wrong');
      SFX.wrong();
      setTimeout(() => $('q-glyph').classList.remove('wrong'), 400);
    }
  }

  /* ---------- 解说弹层 ---------- */
  let curQ = null, fromRub = false;

  function openExplain(title) {
    $('e-title').textContent = title || (wrongTouched ? '终识此字' : '卜象吉');
    $('e-text').textContent = `「${curQ.answer}」—— ${curQ.explain}`;
    $('e-mask').classList.add('show');
  }
  function closeExplain() { $('e-mask').classList.remove('show'); }

  /* ---------- 拓印 ---------- */
  function openRub(char) {
    fromRub = true;
    rubDone = false; rubWrong = false;
    curQ = QUESTIONS.find(q => q.char === char);
    $('rub-index').textContent = `拓 · ${char} 字`;
    $('rub-progress').style.width = `${((idx + 1) / QUESTIONS.length) * 100}%`;
    $('rub-hint').textContent = '以指涂抹龟甲墨拓，显出甲骨之形';
    $('rub-glyph-slot').innerHTML = curQ.glyph;
    const box = $('rub-opts');
    box.style.display = 'none';
    box.innerHTML = '';
    show('s-rub');
    requestAnimationFrame(initRubCanvas);
  }

  function initRubCanvas() {
    const cv = $('rub-canvas'), stage = $('rub-stage');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth, h = stage.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.opacity = '1';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1F1A14';
    ctx.fillRect(0, 0, w, h);
    // 拓片颗粒
    for (let i = 0; i < w * h / 80; i++) {
      ctx.fillStyle = `rgba(247,241,225,${Math.random() * 0.13})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
    // 边缘受光（略暗）
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';

    let drawing = false, last = null;
    const pos = e => { const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    function start(e) { if (rubDone) return; drawing = true; last = pos(e);
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId); scratch(last); e.preventDefault(); }
    function move(e) {
      if (!drawing || rubDone) return;
      const p = pos(e);
      ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
      SFX.rub(); checkReveal(w, h, dpr);
      e.preventDefault();
    }
    function end() { drawing = false; if (!rubDone) checkReveal(w, h, dpr); };
    function scratch(p) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 7); ctx.fill();
    }
    cv.onpointerdown = start; cv.onpointermove = move;
    cv.onpointerup = end; cv.onpointercancel = end;
  }

  function checkReveal(w, h, dpr) {
    const cv = $('rub-canvas'), ctx = cv.getContext('2d');
    const step = 10, data = ctx.getImageData(0, 0, w * dpr, h * dpr).data;
    let cleared = 0, total = 0;
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step) {
        total++;
        if (data[(y * dpr * w * dpr + x * dpr) * 4 + 3] < 40) cleared++;
      }
    const pct = cleared / total;
    if (pct > 0.12) $('rub-hint').textContent = `拓印中… ${Math.min(99, Math.round(pct * 130))}%`;
    if (pct >= 0.55 && !rubDone) revealRub();
  }

  function revealRub() {
    rubDone = true;
    const cv = $('rub-canvas'), ctx = cv.getContext('2d');
    cv.style.transition = 'opacity .5s';
    cv.style.opacity = '0';
    setTimeout(() => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cv.width, cv.height);
    }, 520);
    $('rub-hint').textContent = '字形已显——此为何字？';
    SFX.crack();
    setTimeout(() => {
      const box = $('rub-opts');
      box.style.display = 'grid';
      const opts = [...curQ.options].sort(() => Math.random() - 0.5);
      opts.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'opt'; b.textContent = opt;
        b.onclick = () => {
          if (b.classList.contains('lock')) return;
          if (opt === curQ.answer) {
            if (!rubWrong) score++;
            b.classList.add('right');
            [...box.children].forEach(x => x.classList.add('lock'));
            SFX.correct();
            setTimeout(() => openExplain('拓得此字'), 400);
          } else {
            rubWrong = true; b.classList.add('bad', 'lock'); SFX.wrong();
          }
        };
        box.appendChild(b);
      });
    }, 420);
  }

  /* ---------- 观变 ---------- */
  function openEvo() {
    closeExplain();
    evoIdx = 0;
    show('s-evo');
    renderEvo(true);
    SFX.open();
  }
  function evoCell(q, i) {
    const f = q.evolution[i];
    return f.type === 'svg'
      ? f.html
      : `<span class="txt ${f.cls}">${f.text}</span>`;
  }
  function renderEvo(first) {
    const q = curQ;
    const g = $('evo-glyph');
    if (!first) g.innerHTML = ''; // 触发动画重放
    void g.offsetWidth;
    g.innerHTML = evoCell(q, evoIdx);
    $('evo-era').textContent = EVO_LABELS[evoIdx];
    $('evo-char').textContent = q.char;
    $('evo-note').textContent = EVO_NOTES[evoIdx];
    document.querySelectorAll('.evo-node').forEach((n, i) =>
      n.classList.toggle('on', i === evoIdx));
  }
  function evoGo(step) {
    const next = evoIdx + step;
    if (next < 0 || next > 4) return;
    evoIdx = next;
    renderEvo();
  }
  function buildRail() {
    $('evo-rail').innerHTML = EVO_LABELS.map((l, i) =>
      `<div class="evo-node" data-i="${i}"><i>${i + 1}</i><span>${l.replace(/^.+·/, '')}</span></div>`
    ).join('');
    $('evo-rail').querySelectorAll('.evo-node').forEach(n =>
      n.onclick = () => { evoIdx = +n.dataset.i; renderEvo(); SFX.open(); });
  }
  // 滑动手势（移动端左右滑；桌面端点左右半屏）
  (function bindSwipe() {
    let x = 0, swipedAt = 0;
    const stage = $('evo-stage');
    stage.addEventListener('touchstart', e => x = e.touches[0].clientX, { passive: true });
    stage.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - x;
      if (Math.abs(dx) > 44) { evoGo(dx < 0 ? 1 : -1); swipedAt = Date.now(); }
    }, { passive: true });
    stage.onclick = (e) => {
      if (Date.now() - swipedAt < 600) return; // 吞掉滑动后的合成 click
      const r = stage.getBoundingClientRect();
      evoGo(e.clientX > r.left + r.width / 2 ? 1 : -1);
    };
  })();

  function afterEvo() { onContinue(); }

  /* ---------- 流转 ---------- */
  function advanceQuiz() {
    idx++;
    if (idx >= QUESTIONS.length) return result();
    render();
    show('s-quiz');
  }

  // 解说弹层「继续」/ 观变页结束后的统一路由
  function onContinue() {
    closeExplain();
    if (fromRub) { fromRub = false; return advanceQuiz(); }
    if (RUB_AFTER[idx]) return openRub(curQ.char); // 拓印刚识之字
    advanceQuiz();
  }

  function result() {
    $('q-progress').style.width = '100%';
    const g = grade(score, QUESTIONS.length);
    $('r-grade').textContent = g.title;
    $('r-score').textContent = score;
    $('r-total').textContent = QUESTIONS.length;
    $('r-text').textContent = g.text;
    show('s-result');
  }

  /* ---------- 绑定 ---------- */
  // 首页「开始」按钮已随双门户重构移除，入口改由 divine.js 的门户接管
  $('btn-next').onclick = onContinue;
  $('btn-evo').onclick = openEvo;
  $('evo-done').onclick = afterEvo;
  $('evo-skip').onclick = afterEvo;
  $('btn-replay').onclick = start;
  $('btn-share').onclick = () => alert('正式版将支持保存/分享你的问卜卜辞图');
  $('btn-about').onclick = () =>
    alert('《甲骨问卜》\n殷墟甲骨文互动 H5\n灼龟观兆，问一事之吉凶；观形辨字，寻汉字三千年。');
  $('btn-sound').onclick = function () {
    soundOn = !soundOn;
    this.textContent = `♪ 音效：${soundOn ? '开' : '关'}`;
  };

  buildRail();

  // 供 divine.js 复用
  window.SFX = SFX;
  window.startQuiz = start;

  // 首次任意触摸即解锁音频（微信/iOS 策略）
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true, passive: true });

  // 预览钩子
  if (location.hash === '#quiz') start();
  if (location.hash === '#result') { start(); result(); }
  if (location.hash === '#explain') { start(); setTimeout(openExplain, 400); }
  if (location.hash.startsWith('#evo')) {
    start();
    setTimeout(() => { openEvo(); const n = parseInt(location.hash.split('-')[1], 10);
      if (n >= 2 && n <= 5) { evoIdx = n - 1; renderEvo(); } }, 100);
  }
  if (location.hash === '#rub') { start(); idx = 3; setTimeout(() => openRub(curQ && curQ.char || '日'), 100); }
})();

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage');
  const W = 960, H = 540, GY = 450;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- Canvas responsivo ---------- */
  let k = 1;
  function resize() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = 'scale(' + s + ')';
    k = s * (window.devicePixelRatio || 1);
    cv.width = Math.round(W * k);
    cv.height = Math.round(H * k);
  }
  addEventListener('resize', resize);
  resize();

  /* ---------- Áudio sintético (Web Audio API) ---------- */
  let AC = null;
  function audio() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        AC = null;
      }
    }
    if (AC && AC.state === 'suspended') AC.resume();
  }

  function tone(f, type, d, v, to, delay) {
    if (!AC) return;
    const n = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, n);
    if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(v, n);
    g.gain.exponentialRampToValueAtTime(0.001, n + d);
    o.connect(g);
    g.connect(AC.destination);
    o.start(n);
    o.stop(n + d + 0.02);
  }

  function noise(d, v, hp) {
    if (!AC) return;
    const n = AC.currentTime, len = Math.max(1, Math.floor(AC.sampleRate * d));
    const b = AC.createBuffer(1, len, AC.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = b;
    f.type = 'highpass';
    f.frequency.value = hp;
    g.gain.setValueAtTime(v, n);
    g.gain.exponentialRampToValueAtTime(0.001, n + d);
    s.connect(f);
    f.connect(g);
    g.connect(AC.destination);
    s.start(n);
  }

  const SFX = {
    jump: () => tone(280, 'square', 0.16, 0.08, 720),
    jump2: () => tone(460, 'square', 0.16, 0.08, 1100),
    slash: () => { noise(0.14, 0.18, 3500); tone(1000, 'sawtooth', 0.12, 0.06, 220); },
    kill: () => { noise(0.32, 0.25, 500); tone(220, 'sawtooth', 0.32, 0.14, 40); },
    deflect: () => tone(1500, 'triangle', 0.09, 0.1, 2400),
    coin: () => { tone(880, 'sine', 0.09, 0.12); tone(1320, 'sine', 0.18, 0.12, null, 0.07); },
    zap: () => tone(700, 'sawtooth', 0.14, 0.04, 160),
    hit: () => { noise(0.25, 0.25, 200); tone(160, 'sawtooth', 0.3, 0.16, 50); },
    over: () => { [420, 320, 220, 120].forEach((f, i) => tone(f, 'sawtooth', 0.42, 0.14, f / 2, i * 0.2)); }
  };

  /* ---------- Estado ---------- */
  let state = 'menu', scr = 'menu';
  let P, ents = [], proj = [], parts = [];
  let speed = 380, dist = 0, bonus = 0, coins = 0, lives = 3, spawnT = 0, orbT = 0, time = 0, shake = 0, bgx = 0, T = 0, hi = 0;
  const keys = { down: false };

  try { hi = +localStorage.getItem('nrcs_hi') || 0; } catch (e) { hi = 0; }
  const score = () => Math.floor(dist / 10) + bonus;
  const newPlayer = () => ({ x: 150, y: GY, vy: 0, w: 34, h: 56, jumps: 0, slide: false, ground: true, atk: 0, cd: 0, inv: 0, run: 0, spin: 0 });
  P = newPlayer();

  function show(id) {
    ['menu', 'over'].forEach(n => $(n).classList.toggle('hide', n !== id));
    scr = id;
  }

  function start() {
    audio();
    if (document.activeElement) document.activeElement.blur();
    P = newPlayer(); ents = []; proj = []; parts = [];
    speed = 380; dist = 0; bonus = 0; coins = 0; lives = 3; spawnT = 1.3; orbT = 2; time = 0; shake = 0; keys.down = false;
    state = 'play'; show(null);
  }

  function gameOver() {
    state = 'over'; SFX.over(); shake = 18;
    const cx = P.x + 17, cy = P.y - 28;
    burst(cx, cy, '#00f0ff', 50, 420); burst(cx, cy, '#ff2bd6', 40, 320);
    const s = score(), rec = s > hi;
    if (rec) { hi = s; try { localStorage.setItem('nrcs_hi', String(hi)); } catch (e) {} }
    $('oS').textContent = s; $('oC').textContent = coins; $('oH').textContent = hi;
    $('rec').textContent = rec ? 'NOVO RECORDE!' : '';
    setTimeout(() => { if (state === 'over') show('over'); }, 800);
  }

  /* ---------- Entrada ---------- */
  function jump() {
    if (state !== 'play' || P.jumps >= 2) return;
    if (P.jumps === 0) { P.vy = -800; SFX.jump(); }
    else { P.vy = -730; SFX.jump2(); burst(P.x + 17, P.y - 6, '#ff2bd6', 10, 160); }
    P.jumps++;
  }

  function attack() {
    if (state !== 'play' || P.cd > 0) return;
    P.cd = 0.32; P.atk = 0.18; SFX.slash();
  }

  addEventListener('keydown', e => {
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'Enter'].includes(c)) e.preventDefault();
    if (state !== 'play') {
      if (c === 'Enter' && scr) start();
      else if (c === 'Space' && state === 'menu') start();
      return;
    }
    if (e.repeat) return;
    if (c === 'KeyW' || c === 'ArrowUp' || c === 'Space') jump();
    else if (c === 'KeyS' || c === 'ArrowDown') keys.down = true;
    else if (c === 'KeyJ') attack();
  });

  addEventListener('keyup', e => { if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false; });
  cv.addEventListener('mousedown', e => { if (e.button === 0) attack(); });
  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), x = e.touches[0].clientX - r.left;
    if (x < r.width / 2) jump(); else attack();
  }, { passive: false });

  $('bStart').onclick = start;
  $('bRetry').onclick = start;

  /* ---------- Partículas ---------- */
  function burst(x, y, c, n, sp) {
    for (let i = 0; i < n && parts.length < 400; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.2, 1) * (sp || 240);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.35, 0.8), max: 0.8, c, s: rnd(2, 4.5) });
    }
  }

  function updParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.vx *= 0.99;
    }
  }

  /* ---------- Entidades ---------- */
  function R(e) {
    switch (e.t) {
      case 'robot': return [e.x + 4, e.y - 48, 32, 48];
      case 'drone': return [e.x + 4, e.y - 11, 38, 22];
      case 'lg': return [e.x + 6, GY - 26, e.w - 12, 14];
      case 'la': return [e.x + 6, GY - 62, e.w - 12, 18];
      default: return [e.x - e.r, e.y - e.r, e.r * 2, e.r * 2];
    }
  }

  const hit2 = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
  const PB = () => [P.x + 5, P.y - P.h + 4, P.w - 10, P.h - 6];
  const AB = () => [P.x + 10, P.y - P.h - 70, 115, P.h + 70];

  function spawn() {
    const r = Math.random(), x = W + 60;
    if (r < 0.27) ents.push({ t: 'robot', x, y: GY, a: 0 });
    else if (r < 0.5) { const by = rnd(200, 320); ents.push({ t: 'drone', x, y: by, by, ph: rnd(0, 6), fire: rnd(0.8, 1.6) }); }
    else if (r < 0.76) ents.push({ t: 'lg', x, y: GY, w: 84 });
    else ents.push({ t: 'la', x, y: GY, w: 84 });
    spawnT = Math.max(0.8, 1.7 - time * 0.012) + rnd(0, 0.7);
  }

  function spawnOrbs() {
    const n = Math.floor(rnd(3, 6)), y = [GY - 26, GY - 110, GY - 190][Math.floor(rnd(0, 3))], arc = Math.random() < 0.5;
    for (let i = 0; i < n; i++) ents.push({ t: 'orb', x: W + 60 + i * 42, y: y - (arc ? Math.sin(i / (n - 1) * Math.PI) * 50 : 0), r: 11 });
    orbT = rnd(2.2, 4.2);
  }

  function fireAt(e) {
    const sx = e.x + 23, sy = e.y + 10, tx = P.x + 17, ty = P.y - P.h / 2;
    const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1, s = 430;
    proj.push({ x: sx, y: sy, vx: dx / d * s, vy: dy / d * s }); SFX.zap();
  }

  function hurt() {
    lives--; P.inv = 1.4; shake = 14; SFX.hit();
    burst(P.x + 17, P.y - 30, '#ff2b4d', 22, 320);
    if (lives <= 0) gameOver();
  }

  /* ---------- Atualização ---------- */
  function update(dt) {
    T += dt;
    if (state !== 'play') {
      bgx += (state === 'menu' ? 220 : 60) * dt;
      if (state === 'menu') P.run += dt * 14;
      updParts(dt); shake = Math.max(0, shake - dt * 30);
      return;
    }
    time += dt; speed = Math.min(720, 380 + time * 7); dist += speed * dt; bgx += speed * dt;
    const p = P;
    p.cd -= dt; p.atk -= dt; p.inv -= dt; p.run += dt * (speed / 28);
    p.vy += 2200 * dt + (keys.down && p.y < GY ? 3200 * dt : 0);
    p.y += p.vy * dt;
    if (p.y >= GY) {
      if (p.y > GY && p.vy > 300) burst(p.x + 17, GY, '#8a3cff', 6, 110);
      p.y = GY; p.vy = 0; p.jumps = 0; p.spin = 0;
    }
    p.ground = p.y >= GY;
    p.slide = keys.down && p.ground; p.h = p.slide ? 26 : 56;
    if (!p.ground && p.jumps >= 2) p.spin += dt * 16;
    if (p.slide && Math.random() < 0.6) parts.push({ x: p.x + 4, y: GY - 2, vx: rnd(-160, -40), vy: rnd(-140, -30), life: 0.3, max: 0.8, c: '#ffe600', s: 2.5 });

    spawnT -= dt; if (spawnT <= 0) spawn();
    orbT -= dt; if (orbT <= 0) spawnOrbs();

    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      if (e.t === 'robot') { e.x -= (speed + 70) * dt; e.a += dt * 12; }
      else if (e.t === 'drone') {
        e.x -= speed * 0.6 * dt; e.y = e.by + Math.sin(T * 2.2 + e.ph) * 22; e.fire -= dt;
        if (e.fire <= 0 && e.x < W - 60 && e.x > p.x + 130) { fireAt(e); e.fire = rnd(1.6, 2.6); }
      } else e.x -= speed * dt;

      if (e.x < -140) { ents.splice(i, 1); continue; }
      const r = R(e);
      if (e.t === 'orb') {
        if (hit2(r, PB())) { coins++; bonus += 50; SFX.coin(); burst(e.x, e.y, '#ffe600', 14, 200); ents.splice(i, 1); }
        continue;
      }
      if (p.atk > 0 && (e.t === 'robot' || e.t === 'drone') && hit2(r, AB())) {
        bonus += 100; SFX.kill(); shake = Math.max(shake, 6);
        burst(e.x + 20, e.y - 20, '#ff2bd6', 24, 340); burst(e.x + 20, e.y - 20, '#ffe600', 12, 260);
        ents.splice(i, 1); continue;
      }
      if (p.inv <= 0 && hit2(r, PB())) {
        const dead = (e.t === 'robot' || e.t === 'drone');
        if (dead) { burst(e.x + 20, e.y - 20, '#ff2bd6', 14, 260); ents.splice(i, 1); }
        hurt();
        if (state !== 'play') return;
      }
    }
    for (let i = proj.length - 1; i >= 0; i--) {
      const q = proj[i]; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < -30 || q.x > W + 30 || q.y < -30 || q.y > H + 30) { proj.splice(i, 1); continue; }
      const r = [q.x - 6, q.y - 6, 12, 12];
      if (p.atk > 0 && hit2(r, AB())) { bonus += 25; SFX.deflect(); burst(q.x, q.y, '#ffe600', 12, 220); proj.splice(i, 1); continue; }
      if (p.inv <= 0 && hit2(r, PB())) { burst(q.x, q.y, '#ff2b4d', 10, 200); proj.splice(i, 1); hurt(); if (state !== 'play') return; }
    }
    updParts(dt); shake = Math.max(0, shake - dt * 30);
  }

  /* ---------- Desenho ---------- */
  const skyG = ctx.createLinearGradient(0, 0, 0, GY);
  skyG.addColorStop(0, '#06011a'); skyG.addColorStop(0.6, '#1a0640'); skyG.addColorStop(1, '#3a0a56');
  function genCity(n, minw, maxw, minh, maxh) {
    const a = []; let x = 0;
    for (let i = 0; i < n; i++) { const w = rnd(minw, maxw); a.push({ x, w, h: rnd(minh, maxh), id: i + 1 }); x += w + rnd(4, 22); }
    return { b: a, tw: x };
  }
  const stars = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, 300), s: rnd(0.8, 2), p: rnd(0, 6) }));
  const layers = [
    { f: 0.12, city: genCity(26, 40, 90, 90, 230), col: '#150838', edge: '#5a2aa8', win: '#6a3cc0', glow: 0 },
    { f: 0.35, city: genCity(20, 50, 110, 140, 330), col: '#0e0426', edge: '#00f0ff', win: '#ff2bd6', glow: 10 }
  ];
  const glow = (c, b) => { ctx.shadowColor = c; ctx.shadowBlur = b; };
  const noGlow = () => { ctx.shadowBlur = 0; };
  const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
  function neonText(s, x, y, size, col, align) {
    ctx.font = '900 ' + size + 'px "Trebuchet MS",Verdana,sans-serif'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    glow(col, 12); ctx.fillStyle = col; ctx.fillText(s, x, y); noGlow();
  }

  function drawBG() {
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, GY);
    for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(T * 1.5 + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
    const sg = ctx.createLinearGradient(0, 130, 0, 370); sg.addColorStop(0, '#ffe600'); sg.addColorStop(1, '#ff2bd6');
    glow('#ff2bd6', 40); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(660, 250, 120, 0, Math.PI * 2); ctx.fill(); noGlow();
    ctx.fillStyle = '#220a46';
    for (let i = 0; i < 7; i++) ctx.fillRect(530, 262 + i * 17, 260, 2 + i * 1.6);
    for (const L of layers) {
      const off = (bgx * L.f) % L.city.tw;
      for (let rep = -1; rep < 2; rep++) for (const b of L.city.b) {
        const bx = b.x - off + rep * L.city.tw;
        if (bx > W || bx + b.w < 0) continue;
        ctx.fillStyle = L.col; ctx.fillRect(bx, GY - b.h, b.w, b.h);
        ctx.strokeStyle = L.edge; ctx.lineWidth = 2;
        if (L.glow) glow(L.edge, L.glow);
        line(bx, GY - b.h, bx + b.w, GY - b.h); noGlow();
        ctx.fillStyle = L.win; ctx.globalAlpha = 0.75;
        for (let r = 0; r < b.h / 20 - 1; r++) for (let c = 0; c < b.w / 16 - 1; c++)
          if ((b.id * 31 + r * 17 + c * 7) % 7 < 2) ctx.fillRect(bx + 8 + c * 16, GY - b.h + 10 + r * 20, 6, 8);
        ctx.globalAlpha = 1;
      }
    }
    const gg = ctx.createLinearGradient(0, GY, 0, H); gg.addColorStop(0, '#1a0838'); gg.addColorStop(1, '#07010f');
    ctx.fillStyle = gg; ctx.fillRect(0, GY, W, H - GY);
    ctx.strokeStyle = 'rgba(138,60,255,.55)'; ctx.lineWidth = 1;
    const off = bgx % 80;
    for (let x = -off; x < W + 80; x += 80) line(x, GY, W / 2 + (x - W / 2) * 4, H);
    for (let j = 1; j <= 5; j++) { const y = GY + Math.pow(j / 5, 2) * (H - GY); line(0, y, W, y); }
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3; glow('#00f0ff', 16); line(0, GY, W, GY); noGlow();
  }

  function drawPlayer() {
    const p = P;
    if (state === 'over') return;
    if (p.inv > 0 && Math.floor(p.inv * 14) % 2) return;
    const q = p.atk > 0 ? 1 - p.atk / 0.18 : 0;
    ctx.save(); ctx.translate(p.x + 17, p.y - p.h / 2);
    if (!p.ground && p.jumps >= 2) ctx.rotate(p.spin);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const col = '#00f0ff'; ctx.strokeStyle = col; ctx.fillStyle = col; glow(col, 14);
    let hx, hy;
    if (p.slide) {
      ctx.lineWidth = 7; line(-16, 4, 8, 4);
      ctx.lineWidth = 5; line(4, 6, 28, 10); line(-6, 6, -18, 10);
      ctx.beginPath(); ctx.arc(14, -3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff2bd6'; glow('#ff2bd6', 10); ctx.lineWidth = 3; line(17, -4, 22, -4);
      ctx.beginPath(); ctx.moveTo(8, -4);
      for (let i = 1; i < 5; i++) ctx.lineTo(8 - i * 9, -4 + Math.sin(T * 14 + i) * 3);
      ctx.stroke();
      hx = 10; hy = 0;
    } else {
      const s = Math.sin(p.run);
      ctx.lineWidth = 6;
      if (p.ground) {
        line(0, 8, s * 14, 28 - Math.max(0, Math.cos(p.run)) * 6);
        line(0, 8, -s * 14, 28 - Math.max(0, -Math.cos(p.run)) * 6);
      } else { line(0, 8, 10, 22); line(0, 8, -8, 26); }
      ctx.lineWidth = 7; line(0, -16, 0, 8);
      ctx.beginPath(); ctx.arc(0, -25, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff2bd6'; glow('#ff2bd6', 10); ctx.lineWidth = 3; line(2, -26, 9, -26);
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-5, -24);
      for (let i = 1; i < 5; i++) ctx.lineTo(-5 - i * 9, -24 + Math.sin(T * 14 + i) * 3 - (p.ground ? 0 : i * 1.5));
      ctx.stroke();
      ctx.strokeStyle = col; glow(col, 14); ctx.lineWidth = 4; line(0, -12, 12, -6);
      hx = 12; hy = -6;
    }
    const a = p.atk > 0 ? -1.4 + q * 2.6 : -2.3;
    ctx.strokeStyle = '#ffffff'; glow('#ffe600', 12); ctx.lineWidth = 3;
    line(hx, hy, hx + Math.cos(a) * 38, hy + Math.sin(a) * 38);
    ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 5;
    line(hx - Math.cos(a) * 5, hy - Math.sin(a) * 5, hx + Math.cos(a) * 3, hy + Math.sin(a) * 3);
    if (p.atk > 0) {
      ctx.strokeStyle = '#ff2bd6'; glow('#ff2bd6', 20); ctx.globalAlpha = 1 - q * 0.8; ctx.lineWidth = 8 - q * 5;
      ctx.beginPath(); ctx.arc(8, 0, 68, -1.4 + q * 1.2, 1.0 + q * 1.0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(8, 0, 68, -1.2 + q * 1.2, 0.9 + q * 1.0); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    noGlow(); ctx.restore();
  }

  function drawEnt(e) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (e.t === 'robot') {
      const x = e.x, y = e.y, s = Math.sin(e.a) * 8;
      ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = 4; glow('#ff2bd6', 14);
      line(x + 14, y - 14, x + 14 + s, y); line(x + 26, y - 14, x + 26 - s, y);
      ctx.fillStyle = 'rgba(255,43,214,.18)'; ctx.fillRect(x + 4, y - 40, 32, 28); ctx.strokeRect(x + 4, y - 40, 32, 28);
      ctx.strokeRect(x + 10, y - 52, 20, 12); line(x + 20, y - 52, x + 20, y - 60);
      ctx.fillStyle = '#ffe600'; glow('#ffe600', 12); ctx.fillRect(x + 13, y - 48, 14, 4);
      ctx.strokeStyle = '#ff2bd6'; glow('#ff2bd6', 10); line(x + 4, y - 34, x - 6, y - 24);
    } else if (e.t === 'drone') {
      const x = e.x, y = e.y, ch = e.fire < 0.4;
      ctx.strokeStyle = '#8a3cff'; ctx.lineWidth = 3; glow('#8a3cff', 14);
      ctx.fillStyle = 'rgba(138,60,255,.28)';
      ctx.beginPath(); ctx.ellipse(x + 23, y, 23, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const pw = Math.sin(T * 60) * 10;
      ctx.strokeStyle = '#00f0ff'; glow('#00f0ff', 10); ctx.lineWidth = 2;
      line(x + 23, y - 11, x + 23, y - 17); line(x + 23 - 14 - pw * 0.2, y - 17, x + 23 + 14 + pw * 0.2, y - 17);
      const c = ch ? '#ffffff' : '#ff2b4d'; ctx.fillStyle = c; glow(c, ch ? 22 : 14);
      ctx.beginPath(); ctx.arc(x + 13, y + 1, ch ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.t === 'lg') {
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 5; glow('#ffe600', 12);
      line(e.x + 6, GY, e.x + 6, GY - 30); line(e.x + e.w - 6, GY, e.x + e.w - 6, GY - 30);
      const f = 0.75 + 0.25 * Math.sin(T * 40);
      ctx.fillStyle = '#ff2b4d'; glow('#ff2b4d', 18); ctx.globalAlpha = f; ctx.fillRect(e.x + 6, GY - 26, e.w - 12, 14);
      ctx.fillStyle = '#fff'; ctx.fillRect(e.x + 6, GY - 21, e.w - 12, 4); ctx.globalAlpha = 1;
    } else if (e.t === 'la') {
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 5; glow('#00f0ff', 12);
      line(e.x + 6, GY, e.x + 6, GY - 100); line(e.x + e.w - 6, GY, e.x + e.w - 6, GY - 100);
      const f = 0.75 + 0.25 * Math.sin(T * 40);
      ctx.fillStyle = '#ff2bd6'; glow('#ff2bd6', 18); ctx.globalAlpha = f; ctx.fillRect(e.x + 6, GY - 62, e.w - 12, 18);
      ctx.fillStyle = '#fff'; ctx.fillRect(e.x + 6, GY - 55, e.w - 12, 4); ctx.globalAlpha = 1;
    } else {
      const r = e.r + Math.sin(T * 8 + e.x * 0.05) * 1.5;
      glow('#ffe600', 18); ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x - 2, e.y - 2, r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    noGlow();
  }

  function drawHUD() {
    neonText('PONTUAÇÃO  ' + String(score()).padStart(6, '0'), 24, 40, 26, '#00f0ff');
    neonText('Recorde ' + Math.max(hi, score()), 24, 64, 16, '#cfd6ff');
    glow('#ffe600', 12); ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.arc(32, 92, 9, 0, Math.PI * 2); ctx.fill(); noGlow();
    neonText('MOEDAS  ' + coins, 52, 99, 20, '#ffe600');
    neonText('VIDA', W - 24, 34, 16, '#cfd6ff', 'right');
    for (let i = 0; i < 3; i++) {
      const x = W - 24 - (3 - i) * 52 + 4, on = i < lives;
      ctx.lineWidth = 2; ctx.strokeStyle = '#ff2bd6';
      if (on) { glow('#ff2bd6', 14); ctx.fillStyle = '#ff2bd6'; ctx.fillRect(x, 44, 44, 14); }
      else { ctx.globalAlpha = 0.4; ctx.strokeRect(x, 44, 44, 14); ctx.globalAlpha = 1; }
      noGlow();
    }
  }

  function draw() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-shake, shake) * 0.5, rnd(-shake, shake) * 0.5);
    drawBG();
    for (const e of ents) drawEnt(e);
    for (const q of proj) {
      const a = Math.atan2(q.vy, q.vx);
      ctx.strokeStyle = '#ff2b4d'; ctx.lineWidth = 5; ctx.lineCap = 'round'; glow('#ff2b4d', 16);
      line(q.x - Math.cos(a) * 14, q.y - Math.sin(a) * 14, q.x, q.y);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; line(q.x - Math.cos(a) * 8, q.y - Math.sin(a) * 8, q.x, q.y); noGlow();
    }
    drawPlayer();
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max * 1.2); glow(p.c, 10); ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1; noGlow();
    if (P.inv > 1.0 && state === 'play') { ctx.fillStyle = 'rgba(255,0,60,' + ((P.inv - 1) * 0.5) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    if (state !== 'menu') drawHUD();
  }

  /* ---------- Game Loop ---------- */
  let last = 0;
  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0); last = t;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  show('menu');
  requestAnimationFrame(loop);
})();
// city-audio.js — todo o som do City of God, sintetizado em tempo real (Web Audio), sem arquivos: mixer com barramentos
// (efeitos, ambiente, música, interface), compressor e reverberação de rua; sons posicionados (distância abafa e baixa,
// lado esquerdo/direito pela câmera). Receitas inspiradas no som real: tiro (estalo + corpo + grave + eco), buzina
// elétrica (dois tons distorcidos), motor por rotação com marchas, pneu cantando, batida com lataria, sirenes (wail da
// polícia, hi-lo do SAMU), latido e grito com formantes de voz, murmúrio de conversa, passos, socos; ambiente por região
// e hora (trânsito, vento, pássaros, grilos, carros passando, cães, baile funk ao longe na favela à noite) e a trilha
// do menu (bossa/lo-fi generativa com piano elétrico FM, baixo, bateria escovada e chiado de vinil).
'use strict';
const CityAudio = (() => {
  let ctx = null, out, master, sfx, amb, mus, ui, vox, rev, revIn, white, pink, brown, hidden = false;
  // eco por canal: o envio p/ a reverberação acompanha o volume do canal (efeitos em 0% não deixa o eco sobrando)
  const sends = new Map();
  const sendOf = bus => { let s = sends.get(bus); if (!s) { s = G(revIn, 1); sends.set(bus, s); } return s; };
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
  const DEFAULTS = { master: .75, music: .35, ambient: .7, effects: .8, voices: .8, interface: .8 };
  const settings = () => ({ ...DEFAULTS, ...(window.CityFront?.settings || {}) });

  // ---------- infraestrutura ----------
  function noiseBuffer(sec, color) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * .5362) * .11; }
      else if (color === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return b;
  }
  // resposta ao impulso sintética: rua com prédios (reflexões cedo + cauda escura)
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < ctx.sampleRate * .03 && Math.random() < .02 ? 3 : 1); } }
    return b;
  }
  const G = (dest, v = 1) => { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  function init() {
    if (ctx) return ctx;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { ctx = new C({ latencyHint: 'interactive' }); } catch (_) { return null; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .22; comp.connect(ctx.destination);
    out = G(comp); master = G(out); sfx = G(master); amb = G(master); mus = G(master); ui = G(master); vox = G(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(2.4, 3.2); revIn = G(rev, 1); rev.connect(G(master, .55));
    white = noiseBuffer(2, 'white'); pink = noiseBuffer(4, 'pink'); brown = noiseBuffer(4, 'brown');
    applyVolumes(); setInterval(applyVolumes, 500);
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; applyVolumes(); });
    addEventListener('city-front-settings', applyVolumes);   // mexeu no controle: aplica na hora
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = settings(), t = ctx.currentTime, k = hidden ? 0 : 1;
    const lv = [[master, s.master * k], [sfx, s.effects], [amb, s.ambient], [mus, s.music], [ui, s.interface], [vox, s.voices]];
    for (const [bus, v] of lv) { bus.gain.setTargetAtTime(v, t, .03); if (bus !== master) sendOf(bus).gain.setTargetAtTime(v, t, .03); }
    if (menuBus) menuBus.gain.setTargetAtTime(menuOn ? 1 : 0, t, menuOn ? .4 : 1.2);
  }
  const unlock = () => { if (!init()) return; if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { passive: true, capture: true });
  const ready = () => ctx && ctx.state === 'running';
  const now = () => ctx.currentTime;
  function noise(buf = white, rate = 1) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; return s; }
  const filt = (type, f, q = .7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function env(g, t, a, peak, d, hold = 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); if (hold) g.gain.setValueAtTime(Math.max(.0002, peak), t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + d); }
  const stopAt = (nodes, t) => { for (const n of nodes) { try { n.start?.(now()); } catch (_) {} try { n.stop?.(t); } catch (_) {} } setTimeout(() => nodes.forEach(n => { try { n.disconnect(); } catch (_) {} }), (t - now() + .3) * 1000); };
  const shaper = amount => { const s = ctx.createWaveShaper(), n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); } s.curve = c; return s; };

  // ---------- posição: ouvinte no jogador (ou carro), lado pela câmera ----------
  function listener() {
    const V = window.cityVehicles, p = window.cityVehicleBridge?.player;
    if (V?.driver && V.car) return { x: V.car.x, y: V.car.y };
    return p ? { x: p.x, y: p.y } : null;
  }
  // devolve a entrada de uma cadeia posicionada (filtro de distância → volume → lado → efeitos + eco)
  function place(x, y, { ref = 10, max = 180, echo = .25, bus = sfx } = {}) {
    const L = listener(); let d = 0, pan = 0;
    if (L && x != null) {
      const dx = x - L.x, dy = y - L.y; d = Math.hypot(dx, dy); if (d > max) return null;
      const C = typeof cam !== 'undefined' ? cam : null, sx = C ? C.cos * dx - C.sin * dy : dx;
      pan = Math.max(-.85, Math.min(.85, sx / (d + 6)));
    }
    const lp = filt('lowpass', Math.max(700, 19000 / (1 + d / 22))), g = G(null, 1 / (1 + (d / ref) ** 2)), p = ctx.createStereoPanner(); p.pan.value = pan;
    lp.connect(g); g.connect(p); p.connect(bus); p.connect(G(sendOf(bus), Math.min(.8, echo + d / 90)));
    return { input: lp, d, gain: g, pan: p };
  }

  // ======================= efeitos =======================
  const GUN = {
    pistol: { crack: .8, body: 1700, bq: .9, boom: 150, dec: .16, lvl: .85 }, revolver: { crack: .95, body: 1350, bq: .8, boom: 120, dec: .24, lvl: 1 },
    smg: { crack: .7, body: 2100, bq: 1, boom: 160, dec: .1, lvl: .7 }, rifle: { crack: 1.1, body: 1200, bq: .7, boom: 95, dec: .28, lvl: 1.1 },
    shotgun: { crack: .9, body: 850, bq: .6, boom: 75, dec: .36, lvl: 1.25 }, melee: null
  };
  function gun(cat, x, y, own = false) {
    if (!ready()) return; const P = GUN[cat] || GUN.pistol; if (!P) return;
    const S = place(x, y, { ref: own ? 30 : 16, max: 420, echo: .35 }); if (!S) return;
    const t = now(), lvl = P.lvl * (own ? .55 : 1) * rnd(.9, 1.05), sh = shaper(6); sh.connect(S.input);
    // estalo supersônico/boca do cano
    const n1 = noise(white, rnd(.9, 1.1)), h1 = filt('highpass', 2600), g1 = G(sh); n1.connect(h1); h1.connect(g1); env(g1, t, .0008, lvl * P.crack, .035);
    // corpo da explosão
    const n2 = noise(white), b2 = filt('bandpass', P.body * rnd(.9, 1.1), P.bq), g2 = G(sh); n2.connect(b2); b2.connect(g2); env(g2, t, .0015, lvl, P.dec);
    // grave (pressão)
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(P.boom * 2.2, t); o.frequency.exponentialRampToValueAtTime(P.boom * .45, t + .16);
    const g3 = G(S.input); o.connect(g3); env(g3, t, .002, lvl * .9, .2);
    // cauda abafada (eco entre prédios)
    const n4 = noise(brown), l4 = filt('lowpass', 500), g4 = G(S.input); n4.connect(l4); l4.connect(g4); env(g4, t + .02, .02, lvl * .35, P.dec * 2.5);
    stopAt([n1, n2, o, n4], t + 1.2);
  }
  function dryFire(x, y) { if (!ready()) return; const S = place(x, y, { ref: 4, max: 20 }); if (!S) return; tick(S.input, now(), 3200, .25); tick(S.input, now() + .05, 1900, .15); }
  function tick(dest, t, f, lvl, d = .025) { const n = noise(white), b = filt('bandpass', f, 9), g = G(dest); n.connect(b); b.connect(g); env(g, t, .0006, lvl, d); stopAt([n], t + d + .05); }
  // recarga: solta o pente, encaixa, puxa o ferrolho
  function reload(step, x, y) {
    if (!ready()) return; const S = place(x, y, { ref: 4, max: 25, echo: .05 }); if (!S) return; const t = now();
    if (step === 'out') { tick(S.input, t, 2400, .3); tick(S.input, t + .03, 1300, .25, .05); }
    else if (step === 'in') { tick(S.input, t, 1700, .45, .04); tick(S.input, t + .02, 3600, .3); }
    else if (step === 'ready') { tick(S.input, t, 2800, .35); tick(S.input, t + .09, 2200, .4, .04); }
  }
  // bala acertando parede/chão (às vezes ricocheteia)
  function bulletHit(x, y, soft) {
    if (!ready()) return; const S = place(x, y, { ref: 8, max: 90 }); if (!S) return; const t = now();
    const n = noise(white), b = filt('bandpass', soft ? 900 : 2500, 1.2), g = G(S.input); n.connect(b); b.connect(g); env(g, t, .001, soft ? .25 : .4, soft ? .08 : .05); stopAt([n], t + .2);
    if (!soft && Math.random() < .18) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(rnd(3200, 4200), t); o.frequency.exponentialRampToValueAtTime(rnd(900, 1400), t + .35); const g2 = G(S.input); o.connect(g2); env(g2, t, .005, .12, .32); stopAt([o], t + .4); }
  }
  // soco, taco, corpo caindo
  function thump(x, y, kind = 'punch') {
    if (!ready()) return; const S = place(x, y, { ref: 6, max: 50, echo: .1 }); if (!S) return; const t = now();
    const o = ctx.createOscillator(); o.type = 'sine'; const f = kind === 'fall' ? 70 : kind === 'bat' ? 140 : 110; o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f * .6, t + .1);
    const g = G(S.input); o.connect(g); env(g, t, .002, kind === 'fall' ? .7 : .55, kind === 'fall' ? .22 : .12);
    const n = noise(pink), l = filt('lowpass', kind === 'bat' ? 2200 : 900), g2 = G(S.input); n.connect(l); l.connect(g2); env(g2, t, .001, .45, .08);
    if (kind === 'bat') { const n3 = noise(white), b3 = filt('bandpass', 950, 9), g3 = G(S.input); n3.connect(b3); b3.connect(g3); env(g3, t, .001, .6, .18); stopAt([n3], t + .3); }
    stopAt([o, n], t + .4);
  }
  function whoosh(x, y) { if (!ready()) return; const S = place(x, y, { ref: 4, max: 20 }); if (!S) return; const t = now(), n = noise(white), b = filt('bandpass', 600, 2), g = G(S.input); b.frequency.setValueAtTime(400, t); b.frequency.exponentialRampToValueAtTime(2400, t + .18); n.connect(b); b.connect(g); env(g, t, .05, .25, .14); stopAt([n], t + .3); }
  // passos (concreto); correndo = mais forte e agudo
  function step(x, y, run) { if (!ready()) return; const S = place(x, y, { ref: 3, max: 25, echo: .05 }); if (!S) return; const t = now(), n = noise(pink, rnd(.8, 1.2)), l = filt('bandpass', run ? 1500 : 1000, .9), g = G(S.input); n.connect(l); l.connect(g); env(g, t, .002, run ? .22 : .13, run ? .07 : .05); const o = ctx.createOscillator(); o.frequency.value = rnd(70, 95); const g2 = G(S.input); o.connect(g2); env(g2, t, .002, run ? .15 : .08, .04); stopAt([n, o], t + .15); }
  // batida de carro: pancada grave + lataria (ressonâncias metálicas) + vidro se forte
  function crash(x, y, strength = 1) {
    if (!ready()) return; const S = place(x, y, { ref: 14, max: 160, echo: .3 }); if (!S) return; const t = now(), k = Math.min(1.4, .35 + strength);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + .25); const g = G(S.input); o.connect(g); env(g, t, .003, k, .3);
    const n = noise(white), sh = shaper(3), g0 = G(S.input); n.connect(sh);
    for (const [f, q, a] of [[620, 14, .5], [1320, 18, .4], [2750, 22, .3], [4100, 25, .2]]) { const b = filt('bandpass', f * rnd(.9, 1.1), q), gg = G(g0, a); sh.connect(b); b.connect(gg); }
    env(g0, t, .002, k * .9, .5);
    if (strength > .7) { const n2 = noise(white), h = filt('highpass', 5000), g2 = G(S.input); n2.connect(h); h.connect(g2); env(g2, t + .03, .003, .35, .6); stopAt([n2], t + .8); }
    stopAt([o, n], t + .9);
  }
  // buzina elétrica de carro: dois tons (terça) distorcidos num corneta (passa-banda)
  function horn(x, y, dur = .5, big = false, bus = sfx) {
    if (!ready()) return null; const S = place(x, y, { ref: 18, max: 260, echo: .2, bus }); if (!S) return null; const t = now();
    const f = big ? 330 : rnd(400, 440), sh = shaper(8), bp = filt('bandpass', big ? 700 : 1000, 1.3), g = G(S.input); sh.connect(bp); bp.connect(g);
    const os = [f, f * 1.25].map(fr => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(sh); return o; });
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + .015);
    os.forEach(o => o.start(t));
    const stop = (at = now()) => { g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(g.gain.value || .3, at); g.gain.exponentialRampToValueAtTime(.0001, at + .05); os.forEach(o => { try { o.stop(at + .08); } catch (_) {} }); setTimeout(() => { try { sh.disconnect(); g.disconnect(); } catch (_) {} }, (at - now() + .3) * 1000); };
    if (dur) stop(t + dur); return { stop };
  }
  // latido: pulsos com o tom subindo e caindo filtrados por formantes de cachorro
  function bark(x, y, big = Math.random() < .5, n = 1 + (Math.random() * 3 | 0), bus = sfx) {
    if (!ready()) return; const S = place(x, y, { ref: 12, max: 220, echo: .3, bus }); if (!S) return;
    for (let i = 0; i < n; i++) {
      const t = now() + i * rnd(.22, .34), f0 = big ? rnd(180, 230) : rnd(330, 420), o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * .8, t); o.frequency.linearRampToValueAtTime(f0 * 1.35, t + .03); o.frequency.exponentialRampToValueAtTime(f0 * .7, t + .14);
      const sum = G(S.input); env(sum, t, .006, .55, .15);
      for (const [f, q, a] of [[big ? 550 : 800, 5, 1], [big ? 1400 : 1900, 7, .55], [2700, 9, .25]]) { const b = filt('bandpass', f, q), g = G(sum, a); o.connect(b); b.connect(g); }
      const nz = noise(white), nb = filt('bandpass', 1600, 1.5), ng = G(sum, .25); nz.connect(nb); nb.connect(ng);
      stopAt([o, nz], t + .25);
    }
  }
  // voz sintética (formantes): grito de pânico e o "blá-blá-blá" das conversas
  const VOWEL = { a: [850, 1250, 2650], e: [520, 1900, 2550], i: [320, 2300, 3000], o: [520, 900, 2450], u: [350, 700, 2400] };
  function voice(dest, t, f0, vowel, dur, lvl, { vib = 5.5, rise = 0, breath = .12 } = {}) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); if (rise) { o.frequency.linearRampToValueAtTime(f0 * (1 + rise), t + dur * .25); o.frequency.linearRampToValueAtTime(f0 * (1 + rise * .3), t + dur); }
    const lfo = ctx.createOscillator(), dep = G(o.frequency, f0 * .025); lfo.frequency.value = vib; lfo.connect(dep);
    const sum = G(dest); env(sum, t, Math.min(.06, dur * .2), lvl, dur * .8, dur * .1);
    const F = VOWEL[vowel]; F.forEach((f, i) => { const b = filt('bandpass', f, 8 + i * 3), g = G(sum, [1, .55, .25][i]); o.connect(b); b.connect(g); });
    const n = noise(white), nb = filt('bandpass', F[1], 2), ng = G(sum, breath); n.connect(nb); nb.connect(ng);
    stopAt([o, lfo, n], t + dur + .1);
  }
  function scream(x, y, female = Math.random() < .5) {
    if (!ready()) return; const S = place(x, y, { ref: 12, max: 140, echo: .3, bus: vox }); if (!S) return;
    voice(S.input, now(), female ? rnd(560, 700) : rnd(330, 420), pick(['a', 'a', 'e', 'o']), rnd(.7, 1.2), .5, { vib: 7, rise: .18, breath: .3 });
  }
  function babble(x, y, female = Math.random() < .5) {
    if (!ready()) return; const S = place(x, y, { ref: 6, max: 30, echo: .08, bus: vox }); if (!S) return;
    let t = now(); const base = female ? rnd(200, 240) : rnd(115, 140), n = 3 + (Math.random() * 6 | 0);
    for (let i = 0; i < n; i++) { const d = rnd(.07, .14); tick(S.input, t, rnd(2500, 5000), .05, .02); voice(S.input, t + .01, base * rnd(.9, 1.2), pick(Object.keys(VOWEL)), d, .16, { vib: 0, breath: .2 }); t += d + rnd(.02, .08); }
  }

  // ---------- motor do carro do jogador (rotação e marcha a partir da velocidade) ----------
  const engine = { on: false };
  function engineStart() {
    if (engine.nodes) return; const t = now();
    const a = ctx.createOscillator(), b = ctx.createOscillator(), c = ctx.createOscillator(); a.type = 'sawtooth'; b.type = 'square'; c.type = 'sawtooth';
    const lp = filt('lowpass', 500, 1.5), sh = shaper(4), g = G(sfx, 0), n = noise(brown), nb = filt('bandpass', 180, 1), ng = G(lp, .4);
    a.connect(sh); b.connect(G(sh, .35)); c.connect(G(sh, .25)); sh.connect(lp); lp.connect(g); n.connect(nb); nb.connect(ng);
    const wob = ctx.createOscillator(); wob.frequency.value = 7; const wd = G(a.frequency, 2); wob.connect(wd);
    [a, b, c, n, wob].forEach(o => o.start(t));
    // pneu cantando (derrapagem)
    const s = noise(white), sb = filt('bandpass', 2300, 7), sg = G(sfx, 0), am = ctx.createOscillator(), amg = G(sg.gain, 0); s.connect(sb); sb.connect(sg); am.frequency.value = 16; am.connect(amg); s.start(t); am.start(t);
    engine.nodes = { a, b, c, lp, g, n, wob, s, sg, amg, am };
  }
  function engineStop() { const E = engine.nodes; if (!E) return; const t = now(); E.g.gain.setTargetAtTime(0, t, .15); E.sg.gain.setTargetAtTime(0, t, .1); setTimeout(() => { for (const k of ['a', 'b', 'c', 'n', 'wob', 's', 'am']) try { E[k].stop(); } catch (_) {} }, 900); engine.nodes = null; }
  function engineTick(dt) {
    const V = window.cityVehicles, driving = V?.driver && V.engineOn;
    if (!driving) { if (engine.nodes) engineStop(); return; }
    engineStart(); const E = engine.nodes, t = now(), sp = Math.abs(V.car?.speed || 0);
    const GEARS = [0, 7, 14, 22, 31, 42, 60], gi = Math.max(1, GEARS.findIndex(v => sp < v)), lo = GEARS[gi - 1] || 0, hi = GEARS[gi] || 60;
    const inp = typeof input !== 'undefined' ? input : null, thr = inp?.down?.('w') || inp?.down?.('s') ? 1 : 0;
    const rpm = sp < .5 ? 850 + thr * 600 : 1100 + (sp - lo) / (hi - lo) * 4600 + thr * 300, f = rpm / 60 * 2;   // 4 cilindros: 2 explosões/volta
    E.a.frequency.setTargetAtTime(f, t, .06); E.b.frequency.setTargetAtTime(f / 2, t, .06); E.c.frequency.setTargetAtTime(f * 1.5, t, .06);
    E.lp.frequency.setTargetAtTime(380 + rpm * .18 + thr * 900, t, .08);
    E.g.gain.setTargetAtTime(.07 + Math.min(.13, rpm / 50000) + thr * .05, t, .1);
    const slip = V.car?.drifting ? Math.min(1, Math.abs(V.car.slip || .3) * 2.5) * Math.min(1, sp / 8) : 0;
    E.sg.gain.setTargetAtTime(slip * .16, t, .05); E.amg.gain.setTargetAtTime(slip * .05, t, .05);
  }

  // ---------- sirenes (unidades da IA) ----------
  function siren(kind, bus = sfx) {
    if (!init()) return null; const t = now(), sh = shaper(5), bp = filt('bandpass', 1300, .9), p = ctx.createStereoPanner(), g = G(null, 0), lp = filt('lowpass', 8000);
    sh.connect(bp); bp.connect(lp); lp.connect(g); g.connect(p); p.connect(bus); p.connect(G(sendOf(bus), .3));
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'triangle'; o2.type = 'square'; const g2 = G(sh, .25); o.connect(sh); o2.connect(g2);
    let lfo = null;
    if (kind === 'police') { lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = .22; const dep = G(null, 380); lfo.connect(dep); dep.connect(o.frequency); dep.connect(o2.frequency); o.frequency.value = 1000; o2.frequency.value = 1000; lfo.start(t); }
    else { lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.15; const dep = G(null, 95); lfo.connect(dep); dep.connect(o.frequency); dep.connect(o2.frequency); o.frequency.value = 865; o2.frequency.value = 865; lfo.start(t); }
    o.start(t); o2.start(t);
    return {
      update(x, y, on) { const L = listener(); if (!L) return; const dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy), C = typeof cam !== 'undefined' ? cam : null, tt = now();
        g.gain.setTargetAtTime(on && d < 260 ? .3 / (1 + (d / 22) ** 2) : 0, tt, .2); lp.frequency.setTargetAtTime(Math.max(900, 14000 / (1 + d / 30)), tt, .2);
        p.pan.setTargetAtTime(Math.max(-.8, Math.min(.8, (C ? C.cos * dx - C.sin * dy : dx) / (d + 8))), tt, .2); },
      stop() { try { o.stop(); o2.stop(); lfo.stop(); } catch (_) {} setTimeout(() => { try { g.disconnect(); p.disconnect(); } catch (_) {} }, 300); }
    };
  }

  // ======================= ambiente (região e hora) =======================
  const ambNodes = {}; let ambT = 0, nextEvent = { bird: 2, car: 3, dog: 8, horn: 12, siren: 40, people: 3 }, funk = null;
  function ambStart() {
    if (ambNodes.traffic) return; const t = now();
    const mk = (buf, type, f, q, rate = 1) => { const s = noise(buf, rate), b = filt(type, f, q), g = G(amb, 0); s.connect(b); b.connect(g); s.start(t); return g; };
    ambNodes.traffic = mk(brown, 'lowpass', 320, .5);              // ronco distante da cidade
    ambNodes.city = mk(pink, 'bandpass', 900, .4);                 // ar da rua
    ambNodes.wind = mk(pink, 'bandpass', 500, .8, .7);              // vento
    const cr = ctx.createOscillator(), crg = G(amb, 0), am = ctx.createOscillator(), amg = G(crg.gain, 0); cr.frequency.value = 4600; am.frequency.value = 28; cr.connect(crg); am.connect(amg); cr.start(t); am.start(t);
    ambNodes.crickets = crg; ambNodes.cricketsAM = amg;
  }
  const district = () => { try { const p = window.cityVehicleBridge?.player, geo = window.cityVehicleBridge?.geo; if (!p || !geo) return 'urban'; const d = geo.districtAt?.(p.x, p.y), D = window.COG?.D || {}; return d === D.FAVELA || d === D.GHETTO ? 'favela' : d === D.DOWNTOWN ? 'downtown' : d === D.RURAL || d === D.FARM ? 'rural' : d === D.PORT || d === D.INDUSTRIAL ? 'industrial' : 'urban'; } catch (_) { return 'urban'; } };
  function chirp(x, y) { const S = place(x, y, { ref: 20, max: 120, echo: .15, bus: amb }); if (!S) return; let t = now(); const n = 2 + (Math.random() * 5 | 0), base = rnd(2600, 4200);
    for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = G(S.input); o.frequency.setValueAtTime(base * rnd(.9, 1.15), t); o.frequency.exponentialRampToValueAtTime(base * rnd(.6, 1.4), t + .07); o.connect(g); env(g, t, .008, .12, .07); stopAt([o], t + .12); t += rnd(.08, .16); } }
  function carPass(x, y) { const S = place(x, y, { ref: 25, max: 200, echo: .2, bus: amb }); if (!S) return; const t = now(), dur = rnd(2.5, 4.5), n = noise(pink), b = filt('bandpass', 420, .8), g = G(S.input), o = ctx.createOscillator(), og = G(S.input);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(85, 110), t); o.frequency.linearRampToValueAtTime(rnd(60, 75), t + dur);
    n.connect(b); b.connect(g); const lo = filt('lowpass', 300); o.connect(lo); lo.connect(og);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + dur * .45); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(.08, t + dur * .45); og.gain.exponentialRampToValueAtTime(.0001, t + dur);
    S.pan.pan.setValueAtTime(-S.pan.pan.value || -.6, t); S.pan.pan.linearRampToValueAtTime(S.pan.pan.value || .6, t + dur); stopAt([n, o], t + dur + .1); }
  // baile funk ao longe (tamborzão abafado pelas paredes): só o grave e a caixa passam
  function funkStart() {
    if (funk) return; const g = G(mus, 0), lp = filt('lowpass', 260, .8); lp.connect(g); funk = { g, lp, next: now() + .1, step: 0 };
  }
  function funkTick(on) {
    if (!funk) { if (on) funkStart(); else return; }
    funk.g.gain.setTargetAtTime(on ? .5 : 0, now(), 1.5);
    if (!on) return;
    const bpm = 130, s16 = 60 / bpm / 4, PAT = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], SN = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
    while (funk.next < now() + .3) {
      const t = funk.next, i = funk.step % 16;
      if (PAT[i]) { const o = ctx.createOscillator(), g = G(funk.lp); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + .18); o.connect(g); env(g, t, .002, .9, .25); stopAt([o], t + .3); }
      if (SN[i]) { const n = noise(white), b = filt('bandpass', 220, 1), g = G(funk.lp); n.connect(b); b.connect(g); env(g, t, .002, .5, .1); stopAt([n], t + .2); }
      funk.next += s16; funk.step++;
    }
  }
  function ambienceTick(dt) {
    ambStart(); const E = window.ENV || {}, day = E.day ?? 1, dark = E.dark ?? 0, wind = E.wind ?? .2, snow = E.snow ?? 0, t = now(), reg = district();
    const dens = { downtown: 1, urban: .8, favela: .7, industrial: .75, rural: .2 }[reg] ?? .7, indoor = window.cityVehicleBridge?.houses?.some?.(H => H.inside) ? .45 : 1;
    const muffle = 1 - snow * .35;
    ambNodes.traffic.gain.setTargetAtTime(.5 * dens * (.45 + .55 * day) * muffle * indoor, t, 1);
    ambNodes.city.gain.setTargetAtTime(.05 * dens * (.4 + .6 * day) * muffle * indoor, t, 1);
    ambNodes.wind.gain.setTargetAtTime((.04 + wind * .18) * indoor, t, .8);
    ambNodes.crickets.gain.setTargetAtTime(0, t, .5); ambNodes.cricketsAM.gain.setTargetAtTime(dark > .5 && reg !== 'downtown' ? .012 * (1 - dens * .5) * indoor : 0, t, 1);
    funkTick(reg === 'favela' && dark > .55 && indoor > .5);
    const L = listener(); if (!L) return;
    const around = (r1, r2) => { const a = Math.random() * TAU, d = rnd(r1, r2); return [L.x + Math.cos(a) * d, L.y + Math.sin(a) * d]; };
    for (const k in nextEvent) nextEvent[k] -= dt;
    if (nextEvent.bird <= 0) { nextEvent.bird = rnd(2, 7) / (reg === 'rural' ? 2 : 1); if (day > .5 && snow < .5) chirp(...around(10, 50)); }
    if (nextEvent.car <= 0) { nextEvent.car = rnd(3, 9) / (dens + .2); if (reg !== 'rural' || Math.random() < .3) carPass(...around(25, 70)); }
    if (nextEvent.dog <= 0) { nextEvent.dog = rnd(10, 28) / (reg === 'favela' || reg === 'rural' ? 2 : 1); bark(...around(40, 120), Math.random() < .5, 1 + (Math.random() * 4 | 0), amb); }
    if (nextEvent.horn <= 0) { nextEvent.horn = rnd(10, 30) / dens; if (reg !== 'rural') horn(...around(40, 110), rnd(.12, .35), false, amb); }
    if (nextEvent.siren <= 0) { nextEvent.siren = rnd(50, 120); if (dens > .6 && Math.random() < .4) { const s = siren(Math.random() < .6 ? 'police' : 'amb', amb), [x, y] = around(140, 200); if (s) { let k = 0; const iv = setInterval(() => { s.update(x, y, true); if (++k > 40) { clearInterval(iv); s.stop(); } }, 200); } } }
    // pets por perto latem de vez em quando
    if ((nextEvent.pet = (nextEvent.pet ?? 6) - dt) <= 0) { nextEvent.pet = rnd(14, 35); const pet = (window.CityPets?.actors || []).find(a => Math.hypot(a.x - L.x, a.y - L.y) < 25); if (pet) bark(pet.x, pet.y, (pet.size || pet.scale || 1) > .8, 1 + (Math.random() * 2 | 0)); }
    // murmúrio de quem está por perto
    if (nextEvent.people <= 0) { nextEvent.people = rnd(1.5, 4); const cs = window.cityCharacters?.npcList?.() || []; const near = cs.filter(n => !n.dead && !n.leaving && Math.hypot(n.x - L.x, n.y - L.y) < 22 && n.speed < .3); if (near.length) { const n = pick(near); babble(n.x, n.y, n.female); } }
  }

  // ======================= trilha do menu =======================
  let menuOn = false, seq = null, menuBus = null;
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  // piano elétrico (FM): portadora seno + moduladora 1:1 com índice que cai (o "tine")
  function rhodes(t, m, dur, lvl, dest) {
    const c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = G(c.frequency), g = G(dest); c.frequency.value = midi(m); mo.frequency.value = midi(m);
    mg.gain.setValueAtTime(midi(m) * 2.2, t); mg.gain.exponentialRampToValueAtTime(midi(m) * .25, t + .6); mo.connect(mg); c.connect(g);
    env(g, t, .01, lvl, dur * .9, dur * .1); stopAt([c, mo], t + dur + .2);
  }
  function bassNote(t, m, dur, dest) { const o = ctx.createOscillator(), l = filt('lowpass', 420, 1.2), g = G(dest); o.type = 'triangle'; o.frequency.value = midi(m); o.connect(l); l.connect(g); env(g, t, .01, .55, dur * .8, dur * .15); stopAt([o], t + dur + .1); }
  function kick(t, dest) { const o = ctx.createOscillator(), g = G(dest); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); o.connect(g); env(g, t, .002, .6, .2); stopAt([o], t + .3); }
  function rim(t, dest) { const n = noise(white), b = filt('bandpass', 1800, 6), g = G(dest); n.connect(b); b.connect(g); env(g, t, .001, .35, .05); stopAt([n], t + .1); }
  function shaker(t, dest, a) { const n = noise(white), h = filt('highpass', 6000), g = G(dest); n.connect(h); h.connect(g); env(g, t, .004, a, .05); stopAt([n], t + .1); }
  // Dm9 – G13 – Cmaj9 – A7(b13), com voicings de bossa; baixo em síncope; bateria escovada
  const PROG = [[50, [53, 57, 60, 64, 69]], [43, [53, 57, 59, 64, 69]], [48, [52, 55, 59, 62, 67]], [45, [55, 61, 65, 67, 70]], [50, [53, 57, 60, 64, 69]], [43, [53, 57, 59, 64, 71]], [48, [52, 55, 59, 62, 64]], [52, [50, 56, 59, 62, 65]]];
  const MEL = [76, 74, 72, 74, 69, 0, 72, 71, 72, 74, 76, 79, 77, 76, 74, 0];
  function menuMusic(on) {
    menuOn = !!on; if (!init()) return; applyVolumes();
    if (!on || seq) return;
    const bus = menuBus || (menuBus = G(mus, 0)), wow = ctx.createOscillator(); applyVolumes(); wow.frequency.value = .35; wow.start();   // fita levemente instável
    const lp = filt('lowpass', 5200, .5); lp.connect(bus); const send = G(sendOf(mus), .35); lp.connect(send);
    // chiado de vinil
    const vn = noise(white), vh = filt('highpass', 3500), vg = G(bus, .012); vn.connect(vh); vh.connect(vg); vn.start();
    seq = { next: now() + .15, step: 0, lp, bpm: 92 };
    const tickSeq = () => {
      if (!seq) return;
      const s16 = 60 / seq.bpm / 4;
      while (seq.next < now() + .4) {
        const t = seq.next, i = seq.step % 16, bar = Math.floor(seq.step / 16) % PROG.length, [root, chord] = PROG[bar];
        // acordes do piano: no 1 e antecipando o próximo compasso (14)
        if (i === 0 || i === 6 && Math.random() < .5) chord.forEach((m, j) => rhodes(t + j * .012, m, s16 * (i === 0 ? 6 : 4), .07, seq.lp));
        if (i === 14) { const nx = PROG[(bar + 1) % PROG.length][1]; nx.forEach((m, j) => rhodes(t + j * .01, m, s16 * 3, .05, seq.lp)); }
        // baixo de bossa: 1, 4(+), 8, 11
        if (i === 0) bassNote(t, root - 12, s16 * 3, seq.lp); if (i === 6) bassNote(t, root - 5, s16 * 2, seq.lp); if (i === 8) bassNote(t, root - 12, s16 * 3, seq.lp); if (i === 11) bassNote(t, root - 5, s16 * 2, seq.lp);
        // bateria escovada
        if (i === 0 || i === 10) kick(t, seq.lp); if (i === 4 || i === 12 || i === 7 && Math.random() < .4) rim(t, seq.lp); shaker(t, seq.lp, i % 4 === 2 ? .06 : .03);
        // melodia esparsa nos compassos pares
        if (bar % 2 === 0 && i % 2 === 0) { const m = MEL[(Math.floor(seq.step / 2)) % MEL.length]; if (m && Math.random() < .55) rhodes(t, m, s16 * 2.2, .05, seq.lp); }
        seq.next += s16 * (i % 2 ? .92 : 1.08); seq.step++;   // swing leve
      }
      setTimeout(tickSeq, 90);
    };
    tickSeq();
  }

  // ======================= interface =======================
  function uiSound(kind = 'click') {
    if (!init() || !ready()) return; const t = now();
    if (kind === 'hover') { const o = ctx.createOscillator(), g = G(ui); o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(1500, t + .03); o.connect(g); env(g, t, .002, .025, .04); stopAt([o], t + .08); return; }
    if (kind === 'click') { tick(ui, t, 2400, .18, .02); const o = ctx.createOscillator(), g = G(ui); o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(380, t + .05); o.connect(g); env(g, t, .002, .09, .06); stopAt([o], t + .1); return; }
    if (kind === 'confirm') { [0, .07].forEach((d, i) => { const o = ctx.createOscillator(), g = G(ui); o.type = 'triangle'; o.frequency.value = [660, 990][i]; o.connect(g); env(g, t + d, .004, .09, .18); stopAt([o], t + d + .25); }); return; }
    if (kind === 'back') { const o = ctx.createOscillator(), g = G(ui); o.type = 'triangle'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(420, t + .09); o.connect(g); env(g, t, .004, .08, .1); stopAt([o], t + .15); return; }
    if (kind === 'alert') { [0, .12].forEach(d => { const o = ctx.createOscillator(), g = G(ui); o.type = 'square'; o.frequency.value = 880; const l = filt('lowpass', 2000); o.connect(l); l.connect(g); env(g, t + d, .004, .05, .09); stopAt([o], t + d + .15); }); return; }
    if (kind === 'wasted') { const o = ctx.createOscillator(), g = G(ui), l = filt('lowpass', 900); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(55, t + 2.2); o.connect(l); l.connect(g); env(g, t, .05, .22, 2.4); const n = noise(brown), g2 = G(ui); n.connect(g2); env(g2, t, .01, .5, 1.6); stopAt([o, n], t + 2.6); }
  }
  // amostra curta de cada canal, sem posição (no ouvido do jogador)
  function preview(kind) {
    unlock(); if (!ready()) { setTimeout(() => ready() && preview(kind), 120); return; }
    const t = now();
    if (kind === 'music') { const d = G(mus, 1); [[50, [53, 57, 60, 64, 69]], [43, [53, 57, 59, 64, 71]]].forEach(([r, ch], i) => { ch.forEach((m, j) => rhodes(t + i * .9 + j * .012, m, .85, .08, d)); bassNote(t + i * .9, r - 12, .8, d); }); setTimeout(() => d.disconnect(), 2600); return; }
    if (kind === 'ambient') { chirp(null, null); carPass(null, null); return; }
    if (kind === 'effects') { const h = horn(null, null, .35); thump(null, null, 'punch'); return h; }
    if (kind === 'voices') { babble(null, null); return; }
    uiSound('confirm');
  }
  // passar o mouse/clicar em botões do menu e da HUD
  let lastHover = null;
  addEventListener('pointerover', e => { const b = e.target.closest?.('#city-front button, #city-front [role=tab], #city-controls button, #social-entry, #city-pets-entry, #city-cas-open, .city-app-icon'); if (b && b !== lastHover && !b.disabled) { lastHover = b; uiSound('hover'); } else if (!b) lastHover = null; }, { passive: true });
  addEventListener('click', e => { if (e.target.closest?.('#city-controls button, #social-entry, #city-pets-entry, #city-cas-open, .city-app-icon, #city-phone button')) uiSound('click'); }, { passive: true, capture: true });

  // ======================= laço =======================
  let lastT = performance.now();
  function tickAll() {
    const tNow = performance.now(), dt = Math.min(.1, (tNow - lastT) / 1000); lastT = tNow;
    if (ready()) {
      const playing = window.CityFront && !window.CityFront.blocked;
      if (playing) { engineTick(dt); ambienceTick(dt); }
      else { if (engine.nodes) engineStop(); for (const k of ['traffic', 'city', 'wind']) ambNodes[k]?.gain.setTargetAtTime(0, now(), .5); funk?.g.gain.setTargetAtTime(0, now(), .5); }
    }
    requestAnimationFrame(tickAll);
  }
  requestAnimationFrame(tickAll);
  // volume efetivo de cada canal agora (depuração no console)
  const levels = () => ctx && Object.fromEntries([['master', master], ['effects', sfx], ['ambient', amb], ['music', mus], ['interface', ui], ['voices', vox]].map(([k, b]) => [k, +b.gain.value.toFixed(3)]));
  return { init, unlock, preview, applyVolumes, levels, gun, dryFire, reload, bulletHit, thump, whoosh, step, crash, horn, bark, scream, babble, siren, menuMusic, ui: uiSound, get context() { return ctx; } };
})();
window.CityAudio = CityAudio;

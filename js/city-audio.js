// city-audio.js — o som do City of God feito só de gravações reais (pacotes Sonniss GDC, extraídas por tools/sound-pack.mjs
// para assets/sounds). Mixer com barramentos (efeitos, ambiente, música, interface, vozes), compressor e reverberação de rua;
// sons posicionados no mundo (a distância abafa e baixa, o lado vem da câmera). Motor do carro por rotação (quatro
// gravações de rotação constante cruzadas e afinadas), tiros por arma (e de longe, com a cauda nos prédios), sirenes,
// ambiente por região e hora (cidade de dia/noite, trânsito, gente, campo, chuva, música vazando na favela à noite),
// carros passando, portas, ônibus, interface. Id sem gravação fica em silêncio: nenhum som é sintetizado.
// Música: faixas gravadas (Kevin MacLeod, CC BY 4.0 — ver audio-credits.html): bossa no menu, calma na cidade, ação no tiroteio.
'use strict';
const CityAudio = (() => {
  let ctx = null, out, master, sfx, amb, mus, ui, vox, rev, revIn, hidden = false;
  // eco por canal: o envio p/ a reverberação acompanha o volume do canal (efeitos em 0% não deixa o eco sobrando)
  const sends = new Map();
  const sendOf = bus => { let s = sends.get(bus); if (!s) { s = G(revIn, 1); sends.set(bus, s); } return s; };
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
  const DEFAULTS = { master: .75, music: .35, ambient: .7, effects: .8, voices: .8, interface: .8 };
  const settings = () => ({ ...DEFAULTS, ...(window.CityFront?.settings || {}) });

  // ---------- infraestrutura ----------
  // resposta ao impulso da reverberação: rua com prédios (reflexões cedo + cauda escura)
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
    applyVolumes(); setInterval(applyVolumes, 500);
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; applyVolumes(); });
    addEventListener('city-front-settings', applyVolumes);   // mexeu no controle: aplica na hora
    loadSounds();
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = settings(), t = ctx.currentTime, k = hidden ? 0 : 1;
    const lv = [[master, s.master * k], [sfx, s.effects], [amb, s.ambient], [mus, s.music], [ui, s.interface], [vox, s.voices]];
    for (const [bus, v] of lv) { bus.gain.setTargetAtTime(v, t, .03); if (bus !== master) sendOf(bus).gain.setTargetAtTime(v, t, .03); }
  }
  const unlock = () => { if (!init()) return; if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { passive: true, capture: true });
  const ready = () => ctx && ctx.state === 'running';
  const now = () => ctx.currentTime;
  const filt = (type, f, q = .7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };

  // ---------- gravações (assets/sounds/manifest.json: { id: [{ src, loop, gain }] }) ----------
  // efeitos curtos são decodificados logo; loops (ambiente, motor, sirene) só quando pedidos
  const SND = { list: {}, buf: new Map(), loaded: false };
  function loadSounds() {
    fetch('assets/sounds/manifest.json').then(r => r.ok ? r.json() : {}).then(m => {
      SND.list = m && typeof m === 'object' ? m : {}; SND.loaded = true;
      for (const id in SND.list) if (!SND.list[id].some(v => v.loop)) fetchSound(id);
    }).catch(() => { SND.loaded = true; });
  }
  function fetchSound(id) {
    for (const v of SND.list[id] || []) {
      if (SND.buf.has(v.src)) continue; SND.buf.set(v.src, null);
      fetch(v.src).then(r => { if (!r.ok) throw Error(r.status); return r.arrayBuffer(); }).then(a => ctx.decodeAudioData(a))
        .then(b => SND.buf.set(v.src, b)).catch(() => SND.buf.set(v.src, false));
    }
  }
  const has = id => !!SND.list[id]?.some(v => SND.buf.get(v.src));
  // uma variação carregada do id (sorteada, sem repetir a última); pede o carregamento se ainda não veio
  const lastPick = {};
  function sample(id) {
    const vs = SND.list[id]; if (!vs) return null;
    const ok = vs.filter(v => SND.buf.get(v.src)); if (ok.length < vs.length) fetchSound(id); if (!ok.length) return null;
    let v = pick(ok); if (ok.length > 1 && v === lastPick[id]) v = ok[(ok.indexOf(v) + 1) % ok.length]; lastPick[id] = v;
    return { v, b: SND.buf.get(v.src) };
  }
  // toca o id na entrada dada (cadeia posicionada ou barramento); devolve { src, g, dur } ou null (sem gravação)
  function play(id, dest, { rate = 1, gain = 1, at = now(), loop, offset } = {}) {
    const s = sample(id); if (!s) return null;
    const src = ctx.createBufferSource(), lp = loop ?? s.v.loop; src.buffer = s.b; src.loop = lp; src.playbackRate.value = rate;
    const g = G(dest, gain * (s.v.gain ?? 1)); src.connect(g);
    src.start(at, offset ?? (lp ? Math.random() * s.b.duration : 0));
    if (!lp) src.onended = () => { try { g.disconnect(); } catch (_) {} };
    return { src, g, dur: s.b.duration / rate };
  }
  // laço contínuo gravado: volume controlado por fora; nasce mudo e começa quando o arquivo chega
  function loopLayer(id, dest) {
    const L = { id, g: G(dest, 0), src: null };
    L.ensure = () => { if (L.src) return true; const p = play(id, L.g, { loop: true }); if (!p) return false; L.src = p.src; return true; };
    L.set = (v, tc = .5) => { if (L.ensure() || v === 0) L.g.gain.setTargetAtTime(v, now(), tc); return !!L.src; };
    L.stop = () => { try { L.src?.stop(); } catch (_) {} setTimeout(() => { try { L.g.disconnect(); } catch (_) {} }, 200); };
    return L;
  }

  // ---------- posição: ouvinte no jogador (ou carro), lado pela câmera ----------
  function listener() {
    const V = window.cityVehicles, p = window.cityVehicleBridge?.player;
    if (V?.driver && V.car) return { x: V.car.x, y: V.car.y };
    return p ? { x: p.x, y: p.y } : null;
  }
  const panOf = (dx, dy, d, k = 6) => { const C = typeof cam !== 'undefined' ? cam : null; return Math.max(-.85, Math.min(.85, (C ? C.cos * dx - C.sin * dy : dx) / (d + k))); };
  // devolve a entrada de uma cadeia posicionada (filtro de distância → volume → lado → saída + eco)
  function place(x, y, { ref = 10, max = 180, echo = .25, bus = sfx } = {}) {
    const L = listener(); let d = 0, pan = 0;
    if (L && x != null) { const dx = x - L.x, dy = y - L.y; d = Math.hypot(dx, dy); if (d > max) return null; pan = panOf(dx, dy, d); }
    const lp = filt('lowpass', Math.max(700, 19000 / (1 + d / 22))), g = G(null, 1 / (1 + (d / ref) ** 2)), p = ctx.createStereoPanner(); p.pan.value = pan;
    lp.connect(g); g.connect(p); p.connect(bus); p.connect(G(sendOf(bus), Math.min(.8, echo + d / 90)));
    setTimeout(() => { try { lp.disconnect(); g.disconnect(); p.disconnect(); } catch (_) {} }, 15000);   // efeitos duram < 15 s
    return { input: lp, d, gain: g, pan: p };
  }
  // efeito gravado avulso, posicionado no mundo
  function fx(id, x, y, { ref = 10, max = 160, echo = .2, bus = sfx, rate = rnd(.97, 1.03), gain = 1, at } = {}) {
    if (!ready() || !SND.list[id]) return null; const S = place(x, y, { ref, max, echo, bus }); if (!S) return null;
    return play(id, S.input, { rate, gain, at });
  }

  // ======================= efeitos =======================
  // arma → gravações (a primeira que houver)
  const GUN = { pistol: ['gun_pistol', 'gun_revolver'], revolver: ['gun_revolver', 'gun_pistol'], smg: ['gun_smg', 'gun_rifle'], rifle: ['gun_rifle', 'gun_smg'], shotgun: ['gun_shotgun'] };
  function gun(cat, x, y, own = false) {
    if (!ready() || cat === 'melee') return;
    const S = place(x, y, { ref: own ? 30 : 16, max: 420, echo: .35 }); if (!S) return;
    // longe (> 110 m): tiro gravado de longe, com a cauda batendo nos prédios
    if (own || S.d < 90) music.combatT = 25;   // trilha de ação durante o tiroteio
    if (S.d > 110 && play(cat === 'smg' && has('gun_smg_far') ? 'gun_smg_far' : 'gun_far', S.input, { rate: rnd(.95, 1.05), gain: 1.4 })) return;
    const id = (GUN[cat] || GUN.pistol).find(has); if (id) play(id, S.input, { rate: rnd(.96, 1.04), gain: own ? .6 : 1 });
    // bala zunindo perto do jogador quando outro atira por perto
    if (!own && S.d > 4 && S.d < 70 && Math.random() < .4) { const L = listener(); if (L) fx('bullet_by', L.x + rnd(-2, 2), L.y + rnd(-2, 2), { ref: 4, max: 20, gain: .7, at: now() + Math.min(.25, S.d / 340) }); }
  }
  const dryFire = (x, y) => fx('gun_dry', x, y, { ref: 4, max: 20 });
  // a gravação já tem a recarga inteira: toca no começo ('out')
  function reload(step, x, y) { if (step === 'out') fx('gun_reload', x, y, { ref: 4, max: 25, echo: .05, gain: .8 }); }
  // bala na parede/chão (às vezes ricocheteia); 'soft' = terra, árvore
  function bulletHit(x, y, soft) {
    fx(soft ? 'bullet_soft' : 'bullet_hit', x, y, { ref: 8, max: 90, rate: rnd(.9, 1.1), gain: .7 });
    if (!soft && Math.random() < .18) fx('ricochet', x, y, { ref: 10, max: 120, rate: rnd(.9, 1.1), gain: .5 });
  }
  // soco, taco, corpo caindo
  function thump(x, y, kind = 'punch') {
    if (kind === 'bat') { fx('hit_bat', x, y, { ref: 6, max: 50, echo: .1, rate: rnd(.92, 1.06) }); return; }
    if (kind === 'fall') { fx(SND.list.body_fall ? 'body_fall' : 'punch', x, y, { ref: 6, max: 50, echo: .1, rate: SND.list.body_fall ? rnd(.95, 1.05) : .62, gain: .9 }); return; }
    fx('punch', x, y, { ref: 6, max: 50, echo: .1, rate: rnd(.9, 1.1), gain: .8 });
  }
  const whoosh = (x, y) => fx('whoosh', x, y, { ref: 4, max: 20, rate: rnd(.9, 1.15), gain: .6 });
  // passos; correndo = mais forte
  function step(x, y, run) { fx(SND.list.step ? (run && SND.list.step_run ? 'step_run' : 'step') : district() === 'rural' ? 'step_grass' : 'step', x, y, { ref: 3, max: 25, echo: .05, rate: rnd(.93, 1.07), gain: run ? .55 : .4 }); }
  // batida de carro: pancada de lataria e, se forte, vidro
  function crash(x, y, strength = 1) {
    fx('car_crash', x, y, { ref: 14, max: 160, echo: .3, gain: Math.min(1, .3 + strength * .7), rate: rnd(.92, 1.05) });
    if (strength > .7) fx('glass_break', x, y, { ref: 12, max: 120, echo: .3, gain: .6, at: ctx && now() + .04 });
  }
  // buzina: repete enquanto segura (dur = 0) e corta com um fade curto
  function horn(x, y, dur = .5, big = false, bus = sfx) {
    if (!ready()) return null; const S = place(x, y, { ref: 18, max: 260, echo: .2, bus }); if (!S) return null;
    const rec = play(big && has('bus_horn') ? 'bus_horn' : 'car_horn', S.input, { rate: rnd(.97, 1.04), gain: .8, loop: !dur }); if (!rec) return null;
    const stop = (at = now()) => { rec.g.gain.setValueAtTime(rec.g.gain.value, at); rec.g.gain.setTargetAtTime(0, at, .02); try { rec.src.stop(at + .15); } catch (_) {} };
    if (dur && dur < rec.dur) stop(now() + dur); return { stop };
  }
  // latidos: n latidos seguidos (cachorro grande = mais grave)
  function bark(x, y, big = Math.random() < .5, n = 1 + (Math.random() * 3 | 0), bus = sfx) {
    if (!ready()) return; const S = place(x, y, { ref: 12, max: 220, echo: .3, bus }); if (!S) return;
    let at = now(); for (let i = 0; i < n; i++) { const p = play('dog_bark', S.input, { at, rate: (big ? .85 : 1.1) * rnd(.95, 1.05) }); if (!p) return; at += p.dur * .8 + rnd(.05, .2); }
  }
  // sem vozes: gritos e conversas sintetizados/gravados não combinavam com o jogo (mantidos na API, mudos)
  function scream() {}
  function babble() {}

  // ---------- motor do carro do jogador (rotação e marcha a partir da velocidade) ----------
  // rotação de cada trecho gravado (Citroën C5, rotações constantes; medida pela frequência das explosões)
  const ENGINE_REC = [['engine_idle', 850], ['engine_low', 1260], ['engine_mid', 1880], ['engine_high', 3270]];
  const engine = { nodes: null, wasOn: undefined };
  function engineStart() {
    if (engine.nodes) return;
    ENGINE_REC.forEach(([id]) => fetchSound(id)); fetchSound('tire_skid');
    engine.nodes = { rec: ENGINE_REC.map(([id, ref]) => ({ L: loopLayer(id, sfx), ref })), skid: loopLayer('tire_skid', sfx) };
    if (engine.wasOn === false) play('car_start', sfx, { gain: .7 });
  }
  function engineStop() {
    const E = engine.nodes; if (!E) return; const t = now();
    for (const r of E.rec) r.L.g.gain.setTargetAtTime(0, t, .15); E.skid.g.gain.setTargetAtTime(0, t, .1);
    setTimeout(() => { E.rec.forEach(r => r.L.stop()); E.skid.stop(); }, 900); engine.nodes = null;
  }
  function engineTick() {
    const V = window.cityVehicles, driving = V?.driver && V.engineOn;
    if (!driving) { if (engine.nodes) engineStop(); engine.wasOn = false; return; }
    engineStart(); const E = engine.nodes, t = now(), sp = Math.abs(V.car?.speed || 0);
    const GEARS = [0, 7, 14, 22, 31, 42, 60], gi = Math.max(1, GEARS.findIndex(v => sp < v)), lo = GEARS[gi - 1] || 0, hi = GEARS[gi] || 60;
    const inp = typeof input !== 'undefined' ? input : null, thr = inp?.down?.('w') || inp?.down?.('s') ? 1 : 0;
    const rpm = sp < .5 ? 850 + thr * 600 : 1100 + (sp - lo) / (hi - lo) * 4600 + thr * 300;
    // as duas camadas vizinhas da rotação atual (escala log), cada uma acelerada/freada até a rotação certa
    const live = E.rec.filter(r => has(r.L.id));
    if (live.length) {
      const k = live.findIndex(r => r.ref > rpm), h = live.length === 1 ? 0 : k < 0 ? live.length - 1 : Math.max(1, k), l = Math.max(0, h - 1);
      const w = h === l ? 1 : Math.max(0, Math.min(1, (Math.log(rpm) - Math.log(live[l].ref)) / (Math.log(live[h].ref) - Math.log(live[l].ref)))), vol = .55 + thr * .25;
      live.forEach((r, i) => {
        const on = h === l ? (i === h ? 1 : 0) : i === l ? Math.cos(w * Math.PI / 2) : i === h ? Math.sin(w * Math.PI / 2) : 0;
        r.L.set(on * vol, .06); r.L.src?.playbackRate.setTargetAtTime(Math.max(.5, Math.min(2, rpm / r.ref)), t, .06);
      });
    }
    const slip = V.car?.drifting ? Math.min(1, Math.abs(V.car.slip || .3) * 2.5) * Math.min(1, sp / 8) : 0;
    E.skid.set(slip * .7, .05);
  }

  // ---------- sirenes (unidades da IA): laço gravado com distância e lado ----------
  function siren(kind, bus = sfx) {
    if (!init()) return null; const p = ctx.createStereoPanner(), g = G(null, 0), lp = filt('lowpass', 8000);
    lp.connect(g); g.connect(p); p.connect(bus); p.connect(G(sendOf(bus), .3));
    const L = loopLayer(kind === 'police' ? 'siren_police' : 'siren_amb', lp); fetchSound(L.id);
    return {
      update(x, y, on) { const Q = listener(); if (!Q) return; L.set(on ? 1 : 0, .1); const dx = x - Q.x, dy = y - Q.y, d = Math.hypot(dx, dy), tt = now();
        g.gain.setTargetAtTime(on && d < 260 ? .5 / (1 + (d / 22) ** 2) : 0, tt, .2); lp.frequency.setTargetAtTime(Math.max(900, 14000 / (1 + d / 30)), tt, .2);
        p.pan.setTargetAtTime(panOf(dx, dy, d, 8), tt, .2); },
      stop() { L.stop(); setTimeout(() => { try { g.disconnect(); p.disconnect(); } catch (_) {} }, 300); }
    };
  }

  // ======================= ambiente calmo (hora, região, chuva) =======================
  // fundo leve e calmo (pássaros e trânsito bem longe de dia, grilos à noite, mato no campo); sem vozes nem buzinas
  const recAmb = {}; let petT = 6;
  const district = () => { try { const p = window.cityVehicleBridge?.player, geo = window.cityVehicleBridge?.geo; if (!p || !geo) return 'urban'; const d = geo.districtAt?.(p.x, p.y), D = window.COG?.D || {}; return d === D.RURAL || d === D.FARM ? 'rural' : 'urban'; } catch (_) { return 'urban'; } };
  function setLayers(mix) {
    for (const id in mix) { const v = mix[id], L = recAmb[id] || (v > .01 && SND.list[id] ? (recAmb[id] = loopLayer(id, amb)) : null); if (L) L.set(v, 2); }
  }
  function ambienceTick(dt) {
    const E = window.ENV || {}, day = E.day ?? 1, snow = E.snow ?? 0, rain = E.rain ?? 0, rural = district() === 'rural';
    const indoor = window.cityVehicleBridge?.houses?.some?.(H => H.inside) ? .35 : 1, bus = !!window.CityBus?.riding, calm = (1 - snow * .35) * indoor * (bus ? .3 : 1) * (1 - rain * .6);
    setLayers({
      amb_calm_day: (rural ? 0 : day) * calm,
      amb_calm_night: (rural ? .3 : 1) * (1 - day) * calm,
      amb_rural: (rural ? 1 : 0) * (.4 + .6 * day) * calm,
      amb_rain: rain * indoor, amb_storm: Math.max(0, rain - .6) * 2.5 * indoor,
      amb_bus_ride: bus ? .8 : 0
    });
    // pets por perto latem de vez em quando
    if ((petT -= dt) <= 0) { petT = rnd(14, 35); const L = listener(), pet = L && (window.CityPets?.actors || []).find(a => Math.hypot(a.x - L.x, a.y - L.y) < 25); if (pet) bark(pet.x, pet.y, (pet.size || pet.scale || 1) > .8, 1 + (Math.random() * 2 | 0)); }
  }

  // ======================= música (faixas gravadas em assets/music; créditos em audio-credits.html) =======================
  // menu: bossa nova; andando pela cidade: trilha calma com pausas entre as faixas; tiroteio ou procurado: trilha de ação
  const MUSIC = {
    menu: ['assets/music/menu-bossa-antigua.mp3'],
    calm: ['assets/music/calm-samba-isobel.mp3', 'assets/music/calm-bossabossa.mp3', 'assets/music/calm-dub-eastern.mp3'],
    action: ['assets/music/action-latin-industries.mp3', 'assets/music/action-cut-and-run.mp3', 'assets/music/action-hot-pursuit.mp3', 'assets/music/action-suvaco-do-cristo.mp3']
  };
  const LEVEL = { menu: .8, calm: .4, action: .85 };
  const music = { mode: 'off', cur: null, bag: {}, gapT: 0, combatT: 0 };
  let menuOn = false;
  // próxima faixa do modo (embaralhadas, sem repetir até tocar todas)
  function nextOf(mode) { if (!music.bag[mode]?.length) music.bag[mode] = [...MUSIC[mode]].sort(() => Math.random() - .5); return music.bag[mode].pop(); }
  function startTrack(mode) {
    const a = new Audio(nextOf(mode)); a.preload = 'auto';
    const g = G(mus, 0); ctx.createMediaElementSource(a).connect(g);
    const T = { a, g, mode };
    a.addEventListener('ended', () => { if (music.cur === T) { music.cur = null; music.gapT = mode === 'calm' ? rnd(25, 70) : 0; } dropTrack(T, .05); });
    a.play().then(() => g.gain.setTargetAtTime(LEVEL[mode], now(), mode === 'action' ? .35 : 1.5)).catch(() => { if (music.cur === T) { music.cur = null; music.gapT = 2; } });
    return T;
  }
  function dropTrack(T, tc = 1) { if (!T) return; T.g.gain.setTargetAtTime(0, now(), tc); setTimeout(() => { T.a.pause(); T.a.removeAttribute('src'); T.a.load(); try { T.g.disconnect(); } catch (_) {} }, tc * 5000 + 50); }
  function setMusic(mode) {   // 'menu' | 'calm' | 'action' | 'off'
    if (music.mode === mode) return; const prev = music.mode; music.mode = mode;
    if (music.cur) { dropTrack(music.cur, mode === 'action' ? .4 : 1.5); music.cur = null; }
    music.gapT = mode === 'calm' ? (prev === 'action' ? rnd(10, 25) : 4) : 0;
  }
  function musicTick(dt, playing) {
    music.combatT = Math.max(0, music.combatT - dt);
    const wanted = (window.cityCharacters?.wanted?.level || 0) > 0;
    setMusic(playing ? (music.combatT > 0 || wanted ? 'action' : 'calm') : menuOn ? 'menu' : 'off');
    if (music.mode !== 'off' && !music.cur && (music.gapT -= dt) <= 0) music.cur = startTrack(music.mode);
  }
  // o menu avisa quando a música do menu deve tocar (e se o volume de música está aberto)
  function menuMusic(on) { menuOn = !!on; init(); }

  // ======================= interface =======================
  function uiSound(kind = 'click') {
    if (!init() || !ready()) return;
    play('ui_' + kind, ui, { gain: kind === 'hover' ? .35 : kind === 'wasted' ? 1 : .7 });
  }
  // amostra curta de cada canal, sem posição (no ouvido do jogador)
  function preview(kind) {
    unlock(); if (!ready()) { setTimeout(() => ready() && preview(kind), 120); return; }
    if (kind === 'music') { const T = startTrack('calm'); setTimeout(() => dropTrack(T, .4), 3500); return; }
    if (kind === 'ambient') { const L = loopLayer('amb_calm_day', amb); L.set(1, .3); setTimeout(() => { L.set(0, .4); setTimeout(L.stop, 2000); }, 3000); return; }
    if (kind === 'effects') { const h = horn(null, null, .35); thump(null, null, 'punch'); return h; }
    uiSound('confirm');
  }
  // passar o mouse/clicar em botões do menu e da HUD
  let lastHover = null;
  addEventListener('pointerover', e => { const b = e.target.closest?.('#city-front button, #city-front [role=tab], #city-controls button, #social-entry, #city-pets-entry, #city-cas-open, .city-app-icon'); if (b && b !== lastHover && !b.disabled) { lastHover = b; uiSound('hover'); } else if (!b) lastHover = null; }, { passive: true });
  addEventListener('click', e => { if (e.target.closest?.('#city-controls button, #social-entry, #city-pets-entry, #city-cas-open, .city-app-icon, #city-phone button')) uiSound('click'); }, { passive: true, capture: true });

  // portas: entrou no carro / saiu (abre + fecha), percebido pela troca de motorista
  let wasDriver = null;
  function doorsTick() {
    const V = window.cityVehicles, d = !!V?.driver; if (wasDriver === null) { wasDriver = d; return; }
    if (d === wasDriver) return; wasDriver = d; const c = V?.car, p = window.cityVehicleBridge?.player, x = c?.x ?? p?.x, y = c?.y ?? p?.y;
    fx('car_door_open', x, y, { ref: 6, max: 40, gain: .7 }); setTimeout(() => fx('car_door_close', x, y, { ref: 6, max: 40, gain: .8 }), d ? 700 : 900);
  }

  // ======================= laço =======================
  let lastT = performance.now();
  function tickAll() {
    const tNow = performance.now(), dt = Math.min(.1, (tNow - lastT) / 1000); lastT = tNow;
    if (ready()) {
      const playing = window.CityFront && !window.CityFront.blocked;
      musicTick(dt, playing);
      if (playing) { engineTick(); ambienceTick(dt); doorsTick(); }
      else { if (engine.nodes) engineStop(); for (const k in recAmb) recAmb[k].g.gain.setTargetAtTime(0, now(), .5); }
    }
    requestAnimationFrame(tickAll);
  }
  requestAnimationFrame(tickAll);
  // volume efetivo de cada canal agora e quais ids têm gravação carregada (depuração no console)
  const levels = () => ctx && Object.fromEntries([['master', master], ['effects', sfx], ['ambient', amb], ['music', mus], ['interface', ui], ['voices', vox]].map(([k, b]) => [k, +b.gain.value.toFixed(3)]));
  const recorded = () => Object.keys(SND.list).filter(has);
  return { init, unlock, preview, applyVolumes, levels, fx, recorded, gun, dryFire, reload, bulletHit, thump, whoosh, step, crash, horn, bark, scream, babble, siren, menuMusic, ui: uiSound, get music() { return { mode: music.mode, track: music.cur && decodeURIComponent(music.cur.a.src.split('/').pop()), playing: !!music.cur && !music.cur.a.paused, combat: +music.combatT.toFixed(1) }; }, get context() { return ctx; } };
})();
window.CityAudio = CityAudio;

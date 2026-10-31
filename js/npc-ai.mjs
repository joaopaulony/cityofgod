// npc-ai.mjs — IA da rua: procurado e polícia (viaturas que perseguem a pé ou de carro; a equipe desce, atira ou
// prende, e volta p/ a viatura quando o jogador foge de carro), ambulâncias com socorristas (máx. 2 ambulâncias e
// 4 socorristas na cena; se morrerem, outra vem depois), gangues (bondes parados nas quebradas, vingança contra quem
// mexe com um deles, reforço chegando, guerra Last Kings × Novelis Crew com a polícia intervindo) e o combate tático
// de todo mundo armado (linha de visão, rajadas, recarga, anda de lado, mantém distância, procura onde viu por último,
// flanqueia, recua ferido). character-webgl.mjs entrega os personagens; ai-vehicles.mjs dirige os carros.
import {createAIVehicles} from './ai-vehicles.mjs';

const TAU = Math.PI * 2;
const now = () => performance.now();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const GANG_NAME = { 'last-kings': 'Last Kings', 'novelis-crew': 'Novelis Crew' };
// tiro por categoria: rajada, intervalo dentro dela, pausa entre rajadas, alcance, distância mínima, pontaria, pente
const ARMS = {
  rifle:    { burst: 3, inB: .14, gap: [1.3, 2.2], range: 26, min: 7, acc: .52, mag: 30, reload: 2.1 },
  smg:      { burst: 5, inB: .09, gap: [1.4, 2.4], range: 18, min: 5, acc: .4,  mag: 30, reload: 1.8 },
  pistol:   { burst: 1, inB: .4,  gap: [.55, 1],   range: 16, min: 4, acc: .5,  mag: 15, reload: 1.5 },
  revolver: { burst: 1, inB: .6,  gap: [.8, 1.3],  range: 16, min: 4, acc: .55, mag: 6,  reload: 2.2 },
  shotgun:  { burst: 1, inB: .9,  gap: [1, 1.4],   range: 9,  min: 3, acc: .7,  mag: 6,  reload: 2.4 }
};
const GANG_TALK = ['Aqui é nóis, tá ligado?', 'Movimento tá fraco hoje.', 'Fica de olho na esquina.', 'Os cana passaram mais cedo.', 'Ninguém entra sem a gente saber.', 'Hoje tem baile.'];
const GANG_RAGE = ['Mexeu com a gente, vai morrer!', 'Pega ele!', 'Vai pagar caro!', 'Cerca ele aí!'];

export function createNPCAI(THREE, scene, ctx) {
  const { bridge, system, npcs, entries } = ctx, P = () => bridge.player, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const fleet = createAIVehicles(THREE, scene, bridge, { people: () => [P(), ...npcs.filter(n => !n.dead && entries.has(n))] });
  system.fleet = fleet.state;
  const notify = t => window.CityUI?.notify?.(t);
  const looks = g => ctx.roster()?.list().filter(c => c.group === g) || [];
  const arms = n => { const W = window.CityWeapons?.list[n.weaponId]; return { ...(ARMS[W?.cat] || ARMS.pistol), dmg: W?.damage || 26 }; };
  const sight = ctx.sight;
  let pendingPolice = 0, pendingAmb = 0, medT = 0, crewT = 2, warT = rnd(40, 80), lastShot = -1e9, warId = 0;

  // ======================= procurado =======================
  const wanted = { level: 0, sawAt: 0, since: 0, reinforce: 0 }; system.wanted = wanted;
  const LOST_S = 30, REVIVE_S = 55;
  function crime(kind) {
    const p = P(); if (p.dead) return;
    const lvl = kind === 'copkill' ? 3 : kind === 'kill' || kind === 'copassault' ? 2 : 1, was = wanted.level;
    wanted.level = Math.min(3, Math.max(was, lvl) + (was >= lvl && lvl >= 2 ? 1 : 0)); wanted.sawAt = now();
    if (was) return;
    wanted.since = now(); wanted.reinforce = 3; wanted.engaged = false; window.CityAudio?.ui('alert');
    notify(kind === 'shots' ? 'Disparos denunciados — a polícia está a caminho!' : 'Você é procurado pela polícia!');
    for (const n of npcs) if (n.cop && !n.dead && dist(n, p) < 70) { n.chase = true; n.leaving = false; n.target = null; }
    for (const u of fleet.units) if (u.kind === 'police' && dist(u, p) < 130) u.role = 'pursuit';
  }
  function clearWanted(text) {
    if (!wanted.level) return;
    wanted.level = 0;
    for (const n of npcs) if (n.cop) { n.chase = false; n.aiming = false; n.aimHold = 0; n.warned = false; }
    for (const u of fleet.units) if (u.role === 'pursuit') u.role = null;
    if (text) notify(text);
  }
  function wantedTick(dt) {
    if (!wanted.level) return;
    const p = P();
    if (p.dead) return clearWanted(null);
    // o tempo p/ despistar só corre depois que a polícia chegou perto (até lá ela sabe onde foi o crime)
    if (!wanted.engaged) { if (fleet.units.some(u => u.kind === 'police' && dist(u, p) < 60) || npcs.some(n => n.cop && n.chase && !n.dead && dist(n, p) < 60)) wanted.engaged = true; else if ((now() - wanted.since) / 1000 < 75) wanted.sawAt = now(); }
    if ((now() - wanted.sawAt) / 1000 > LOST_S) return clearWanted('Você despistou a polícia.');
    wanted.reinforce -= dt;
    if (wanted.reinforce <= 0) {
      wanted.reinforce = 12;
      const cars = fleet.units.filter(u => u.kind === 'police' && u.role === 'pursuit' && !u.abandoned).length + pendingPolice;
      if (cars < wanted.level) void dispatchPolice('pursuit', p);
    }
  }
  const playerFoe = () => { const p = P(), V = window.cityVehicles, c = V?.driver ? V.car : null; return c ? { x: c.x, y: c.y, player: true, car: true } : { x: p.x, y: p.y, player: true }; };
  // situação p/ prender: só 1 estrela, a pé, sem arma apontada e sem atirar há 6 s
  const threat = () => { const p = P(); return bridge.driving() || p.armed && !p.weapon?.melee && (p.aiming || p.aimHold > 0) || now() - lastShot < 6000; };
  const arrestMode = () => wanted.level === 1 && !threat();

  // ======================= viaturas e ambulâncias =======================
  // ponto de rua a min..max do alvo, de frente p/ ele
  function spawnPoint(at, min, max) {
    const p = P();
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * TAU, d = rnd(min, max), q = fleet.roadPoint(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, 35);
      if (!q || Math.hypot(q.x - p.x, q.y - p.y) < min * .7) continue;
      if (fleet.units.some(u => Math.hypot(u.x - q.x, u.y - q.y) < 9)) continue;
      const toward = Math.atan2(at.y - q.y, at.x - q.x);
      return { x: q.x, y: q.y, a: Math.abs(angDiff(q.a, toward)) < Math.PI / 2 ? q.a : q.a + Math.PI };
    }
    return null;
  }
  const away = u => { const p = P(), a = Math.atan2(u.y - p.y, u.x - p.x) + rnd(-.6, .6); return fleet.roadPoint(u.x + Math.cos(a) * 160, u.y + Math.sin(a) * 160, 80) || { x: u.x + Math.cos(a) * 160, y: u.y + Math.sin(a) * 160 }; };
  function despawnIfFar(u, d = 150) {
    if (dist(u, P()) < d) return;
    for (const n of u.crew) ctx.remove(n);
    fleet.remove(u);
  }
  async function dispatchPolice(role, at) {
    const sp = spawnPoint(at, 70, 95);
    if (!sp) return footUnit('police', at, 2, { chase: role === 'pursuit' });
    pendingPolice++;
    const u = await fleet.spawn('police', sp.x, sp.y, sp.a); pendingPolice--;
    if (!u) return footUnit('police', at, 2, { chase: role === 'pursuit' });
    u.role = role; u.crewIn = 2; u.war = role === 'gang' ? at : null; u.suspect = role === 'outlaw' ? at : null;
    system.lastOccurrence = { kind: 'police', label: 'Viatura a caminho', x: at.x, y: at.y };
  }
  async function dispatchAmbulance(v) {
    const group = npcs.filter(o => o.dead && entries.has(o) && !o.dead.medic && dist(o, v) < 20);
    for (const o of group) o.dead.medic = true;
    const sp = spawnPoint(v, 70, 100);
    if (!sp) return footUnit('medic', v, 2, { victims: group });
    pendingAmb++;
    const u = await fleet.spawn('ambulance', sp.x, sp.y, sp.a); pendingAmb--;
    if (!u) { for (const o of group) if (o.dead) o.dead.medic = false; return; }
    u.state = 'going'; u.victims = group; u.crewIn = 2;
    system.lastOccurrence = { kind: 'medical', label: 'Ambulância a caminho', x: v.x, y: v.y };
  }
  // sem rua (mapa de teste) ou sem modelo: chegam a pé, como antes
  async function footUnit(kind, at, count, { chase = false, victims = [] } = {}) {
    const pool = looks(kind === 'police' ? 'policia' : 'socorristas'); if (!pool.length) return;
    for (let k = 0; k < count; k++) {
      let sx = 0, sy = 0;
      for (let t = 0; t < 14; t++) { const b = Math.random() * TAU; sx = at.x + Math.cos(b) * (26 + t * 2); sy = at.y + Math.sin(b) * (26 + t * 2); if (ctx.clear(sx, sy, null, .35)) break; }
      const props = kind === 'police' ? copProps(chase) : { kind: 'service', medic: true, aid: victims[k % Math.max(1, victims.length)] || null, aidSide: k % 2 ? 1 : -1, walk: 1.4 };
      await ctx.addNPC(pick(pool), { x: sx, y: sy, face: Math.atan2(at.y - sy, at.x - sx), ...props });
    }
  }
  const copProps = chase => ({ kind: 'service', cop: true, chase, hp: 130, armed: true, mag: 30, walk: 1.4, weaponId: window.CityWeapons?.npcWeapon('police', { long: Math.random() < .6 }) || null });
  async function dismount(u) {
    if (u.dismounting) return;
    u.dismounting = true; const n0 = u.crewIn; u.crewIn = 0;
    for (let i = 0; i < n0; i++) {
      const q = fleet.door(u, i), pool = looks(u.kind === 'police' ? 'policia' : 'socorristas'); if (!pool.length) break;
      const props = u.kind === 'police' ? copProps(u.role === 'pursuit') : { kind: 'service', medic: true, walk: 1.4 };
      if (u.kind === 'ambulance') { const v = u.victims.filter(v => v.dead)[i % Math.max(1, u.victims.filter(v => v.dead).length)]; props.aid = v || null; props.aidSide = i % 2 ? 1 : -1; }
      const n = await ctx.addNPC(pick(pool), { x: q.x, y: q.y, face: Math.atan2(q.y - u.y, q.x - u.x), vehicle: u, ...props });
      if (n) u.crew.push(n); else u.crewIn++;
    }
    u.dismounting = false;
  }
  // viatura: persegue o jogador (carro: mira à frente dele; a pé: para a ~11 m e a equipe desce); se o jogador
  // foge de carro, a equipe volta, embarca e retoma; sem alvo, todos embarcam e a viatura vai embora
  function policeUnit(u, dt) {
    const p = P(), V = window.cityVehicles, car = V?.driver ? V.car : null;
    u.crew = u.crew.filter(n => npcs.includes(n) && !n.dead);
    if (!u.dismounting && u.crewIn + u.crew.length === 0) { u.abandoned = true; u.siren = false; u.goal = null; return despawnIfFar(u); }
    let target = null;
    if (u.role === 'pursuit' && wanted.level && !p.dead) target = car ? { x: car.x, y: car.y, car, spd: Math.abs(car.speed || 0) } : { x: p.x, y: p.y };
    else if (u.role === 'gang' && u.war && !u.war.over) target = u.war;
    else if (u.role === 'outlaw') { const o = u.suspect; if (o && !o.dead && npcs.includes(o) && outlaw(o) && dist(o, u) < 160) target = { x: o.x, y: o.y, war: true }; }
    if (!target) {
      for (const n of u.crew) n.board = true;
      u.siren = false;
      if (!u.crew.length && !u.dismounting) { u.goal = u.leaveTo || (u.leaveTo = away(u)); u.arrive = 4; u.direct = false; despawnIfFar(u); } else u.goal = null;
      return;
    }
    u.siren = true; u.leaveTo = null;
    const d = Math.hypot(target.x - u.x, target.y - u.y);
    // quem está na viatura também vê o jogador (mantém o procurado); de carro a perseguição é rápida
    u.losT = (u.losT || 0) - dt; if (u.losT <= 0) { u.losT = .4; u.sees = d < 60 && sight(u.x, u.y, target.x, target.y, target.car ? 2.6 : 1.4); }
    if (u.sees && u.role === 'pursuit') wanted.sawAt = now();
    u.maxSp = target.car ? 30 : 19;
    if (!u.crew.length && !u.dismounting) {
      // enroscou perto (alvo fora da rua, cerca, carros): a equipe desce e vai a pé
      if (d < 40 && u.noProgress > 3 && Math.abs(u.speed) < 1) { void dismount(u); return; }
      if (target.car) {
        const lead = Math.min(1.1, d / 22), c = target.car;
        u.goal = { x: c.x + Math.cos(c.angle) * (c.speed || 0) * lead, y: c.y + Math.sin(c.angle) * (c.speed || 0) * lead };
        u.arrive = 3; u.direct = d < 32;
        u.stopT = d < 16 && target.spd < 1.5 ? (u.stopT || 0) + dt : 0;
        if (u.stopT > 1.2 && Math.abs(u.speed) < 1) { u.stopT = 0; void dismount(u); }
      } else {
        u.goal = { x: target.x, y: target.y }; u.arrive = target.war ? 16 : 11; u.direct = d < 40;
        if (d < (target.war ? 24 : 19) && Math.abs(u.speed) < .8) void dismount(u);
      }
    } else {
      u.goal = null;
      const flee = target.car ? target.spd > 6 || d > 32 : d > 60;
      for (const n of u.crew) n.board = flee;
    }
  }
  // ambulância: vai até a vítima, para, os socorristas descem; acabou o socorro, embarcam e ela vai embora
  function ambulanceUnit(u, dt) {
    u.crew = u.crew.filter(n => npcs.includes(n) && !n.dead);
    if (!u.dismounting && u.crewIn + u.crew.length === 0) { u.abandoned = true; u.siren = false; u.goal = null; return despawnIfFar(u); }
    if (u.state === 'going') {
      const v = u.victims.find(v => v.dead && entries.has(v));
      if (!v) u.state = 'leaving';
      else {
        const g = u.park || (u.park = fleet.roadPoint(v.x, v.y, 22) || { x: v.x, y: v.y }), d = Math.hypot(g.x - u.x, g.y - u.y);
        u.goal = g; u.arrive = 2.5; u.direct = d < 30; u.siren = true;
        // chegou (ou enroscou já perto, ex.: outra ambulância na vaga): estaciona ali mesmo
        if (d < (u.bestD ?? 1e9) - .5) { u.bestD = d; u.jam = 0; } else u.jam = (u.jam || 0) + dt;   // sem chegar mais perto há um tempo
        if ((d < 6 || Math.hypot(v.x - u.x, v.y - u.y) < 10 || Math.hypot(v.x - u.x, v.y - u.y) < 30 && u.jam > 4) && Math.abs(u.speed) < 1) { u.state = 'scene'; u.goal = null; void dismount(u); }
      }
    }
    if (u.state === 'scene') { u.goal = null; if (!u.dismounting && !u.crew.some(n => !n.board)) u.state = 'leaving'; }
    if (u.state === 'leaving') {
      u.siren = false;
      for (const n of u.crew) n.board = true;
      if (!u.crew.length && !u.dismounting) { u.goal = u.leaveTo || (u.leaveTo = away(u)); u.arrive = 4; u.direct = false; despawnIfFar(u); }
    }
  }
  function boardTick(n, dt) {
    const u = n.vehicle;
    if (!u || u.dead || !fleet.units.includes(u)) { n.board = false; n.vehicle = null; n.leaving = true; const a = Math.random() * TAU; n.target = { x: n.x + Math.cos(a) * 60, y: n.y + Math.sin(a) * 60 }; return; }
    const i = Math.max(0, u.crew.indexOf(n)), q = fleet.door(u, i), d = Math.hypot(q.x - n.x, q.y - n.y);
    n.aiming = false; n.aimHold = 0; n.aid = null; n.aiding = false;
    if (d > 1.3) {
      n.run = d > 3;
      if (!ctx.stepToward(n, Math.atan2(q.y - n.y, q.x - n.x), d > 3 ? 4.2 : 1.5, dt)) n.bstuck = (n.bstuck || 0) + dt; else n.bstuck = 0;
      if (!(n.bstuck > 3)) return;
    }
    u.crew.splice(u.crew.indexOf(n), 1); u.crewIn++; ctx.remove(n);
  }

  // ======================= socorristas =======================
  function aidSpot(v, side) {
    const s = v.dead?.kind === 'car' ? .45 : -.45, cx = v.x + Math.cos(v.face) * s, cy = v.y + Math.sin(v.face) * s;   // peito da vítima
    return { x: cx - Math.sin(v.face) * side * .58, y: cy + Math.cos(v.face) * side * .58, tx: cx, ty: cy };
  }
  function medicTick(n, dt) {
    if (!n.aid || !n.aid.dead || !entries.has(n.aid)) {
      n.aid = null; n.aiding = false;
      // outra vítima sem socorro perto (no máx. 2 socorristas por vítima)
      const base = n.vehicle || n, v = npcs.find(v => v.dead && entries.has(v) && dist(v, base) < 30 && npcs.filter(m => m.aid === v).length < 2);
      if (v) { n.aid = v; n.aidSide = npcs.some(m => m.aid === v && m.aidSide === -1) ? 1 : -1; v.dead.medic = true; }
      else if (n.vehicle) { n.board = true; return boardTick(n, dt); }
      else { n.medic = false; n.leaving = true; const a = Math.random() * TAU; n.target = { x: n.x + Math.cos(a) * 70, y: n.y + Math.sin(a) * 70 }; return ctx.walkNPC(n, dt); }
    }
    const v = n.aid, t = aidSpot(v, n.aidSide), d = Math.hypot(t.x - n.x, t.y - n.y);
    if (!n.aiding && d > .3) {
      n.run = d > 4;
      if (!ctx.stepToward(n, Math.atan2(t.y - n.y, t.x - n.x), d > 4 ? 3.8 : 1.4, dt)) { n.stuck = (n.stuck || 0) + dt; if (n.stuck > 2 && ctx.clear(t.x, t.y, null, .2)) { n.x = t.x; n.y = t.y; } }
      return;
    }
    if (!n.aiding) { n.aiding = true; n.x = t.x; n.y = t.y; if (n.aidSide < 0) ctx.say(n, pick(['Aguenta firme! Tá me ouvindo?', 'Sem pulso! Começando a massagem!', 'Fica comigo, fica comigo!']), '🚑'); }
    n.speed = 0; n.running = false; n.face = Math.atan2(t.ty - n.y, t.tx - n.x);
  }
  function revive(v) {
    v.dead = null; v.hp = 55; v.stagger = 1.6; v.actionZ = 0; v.revived = true;
    v.chase = false; v.aid = null; v.aiding = false; v.angry = false; v.war = null; v.shotCop = false; v.shotBy = null; v.armed = false; v.board = false;
    for (const m of npcs) if (m.aid === v) { m.aid = null; m.aiding = false; }
    ctx.say(v, 'O que... aconteceu?', '😵');
    const a = Math.random() * TAU; v.leaving = true; v.run = false; v.route = null; v.hang = null; v.target = { x: v.x + Math.cos(a) * 45, y: v.y + Math.sin(a) * 45 };
    system.lastRevive = { name: v.name, x: v.x, y: v.y };
  }
  function deadTick(n, dt) {
    if (!npcs.some(m => m.aid === n && m.aiding)) return false;
    n.dead.aidT = (n.dead.aidT || 0) + dt;
    if (n.dead.aidT < REVIVE_S) return false;
    revive(n); return true;
  }
  // a cada 1 s: chama ambulância p/ quem morreu (máx. 2 ambulâncias e 4 socorristas); vítima cujo socorro morreu
  // volta à fila depois de 25 s
  function medicalTick(dt) {
    medT -= dt; if (medT > 0) return; medT = 1;
    const amb = fleet.units.filter(u => u.kind === 'ambulance' && !u.abandoned);
    const medics = npcs.filter(n => n.medic && !n.dead).length + amb.reduce((s, u) => s + u.crewIn, 0) + pendingAmb * 2;
    for (const v of npcs) {
      if (!v.dead?.medic || npcs.some(m => m.aid === v && !m.dead) || amb.some(u => u.state === 'going' && u.victims.includes(v))) { if (v.dead) v.dead.orphanT = 0; continue; }
      v.dead.orphanT = (v.dead.orphanT || 0) + 1; if (v.dead.orphanT > 25) { v.dead.medic = false; v.dead.orphanT = 0; }
    }
    const v = npcs.find(v => v.dead && entries.has(v) && !v.dead.medic && v.dead.t > 3);
    if (v && amb.length + pendingAmb < 2 && medics + 2 <= 4) void dispatchAmbulance(v);
  }

  // ======================= gangues =======================
  const anger = new Map(), wars = [];
  system.gangs = { anger, wars };
  function turfAt(x, y) { const g = bridge.geo?.gangAt?.(x, y); return g ? (g.index % 2 ? 'novelis-crew' : 'last-kings') : null; }
  function turfNear(p) { for (const [dx, dy] of [[0, 0], [45, 0], [-45, 0], [0, 45], [0, -45]]) { const t = turfAt(p.x + dx, p.y + dy); if (t) return t; } return null; }
  const gangProps = (group, extra = {}) => ({ kind: 'gang', gang: group, hp: 100, walk: .9 + Math.random() * .4, weaponId: window.CityWeapons?.npcWeapon('gang') || null, armed: false, mag: 0, ...extra });
  // lugar p/ surgir: a min..max do alvo, livre e (se der) fora da vista do jogador
  function hiddenSpot(at, min, max) {
    const p = P(); let best = null;
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * TAU, d = rnd(min, max), x = at.x + Math.cos(a) * d, y = at.y + Math.sin(a) * d;
      if (!ctx.clear(x, y, null, .35)) continue;
      best = { x, y }; if (!sight(p.x, p.y, x, y)) return best;
    }
    return best;
  }
  async function spawnGangsters(group, count, at, extra = {}) {
    const pool = looks(group), out = []; if (!pool.length || !at) return out;
    for (let k = 0; k < count; k++) {
      const x = at.x + (k % 2 ? 1 : -1) * (.8 + k * .5), y = at.y + (k > 1 ? 1.2 : 0), ok = ctx.clear(x, y, null, .3);
      const n = await ctx.addNPC(pick(pool), { x: ok ? x : at.x, y: ok ? y : at.y, face: Math.random() * TAU, ...gangProps(group, typeof extra === 'function' ? extra(k) : extra) });
      if (n) out.push(n);
    }
    return out;
  }
  // calçada perto (min..max m) do alvo, a partir da rede de ruas; senão a busca antiga do character-webgl
  function sidewalkNear(at, min, max) {
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * TAU, d = rnd(min, max), q = fleet.roadPoint(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, 25); if (!q) continue;
      const s = Math.random() < .5 ? 1 : -1, off = (bridge.ROAD_W || 3.5) + 1.2, x = q.x - Math.sin(q.a) * off * s, y = q.y + Math.cos(q.a) * off * s, dd = Math.hypot(x - at.x, y - at.y);
      if (dd < min * .8 || dd > max * 1.2 || !ctx.clear(x, y, null, .35)) continue;
      return { x, y };
    }
    return ctx.sidewalkSpot();
  }
  // bondes parados nas quebradas (2–3 parceiros conversando); às vezes da facção rival
  function crewTick(dt) {
    crewT -= dt; if (crewT > 0) return; crewT = 3.5;
    const p = P(), turf = turfNear(p); if (!turf || p.dead) return;
    const gangsters = npcs.filter(n => n.gang && !n.dead && !n.leaving);
    if (gangsters.length >= 14) return;
    const spot = sidewalkNear(p, 26, 55); if (!spot) return;
    const group = Math.random() < .2 ? (turf === 'last-kings' ? 'novelis-crew' : 'last-kings') : turf, c = { x: spot.x, y: spot.y };
    void spawnGangsters(group, 2 + (Math.random() < .5), c, k => ({ hang: { x: c.x + Math.cos(k * 2.1) * 1.1, y: c.y + Math.sin(k * 2.1) * 1.1 }, lookAt: Math.atan2(-Math.sin(k * 2.1), -Math.cos(k * 2.1)) }));
  }
  function hangTick(n, dt) {
    if (n.stagger > 0) { n.stagger -= dt; n.speed = 0; return; }
    const h = n.hang, d = dist(n, h);
    if (d > .8) { n.run = false; if (!ctx.stepToward(n, Math.atan2(h.y - n.y, h.x - n.x), 1.1, dt)) n.hang = { x: n.x, y: n.y }; return; }
    n.speed = 0; n.running = false; if (n.lookAt != null) n.face = n.lookAt;
    n.chatT = (n.chatT ?? rnd(3, 14)) - dt;
    if (n.chatT <= 0) { n.chatT = rnd(10, 22); if (dist(n, P()) < 30) ctx.say(n, pick(GANG_TALK), '💬'); }
  }
  // mexeu com um: a facção inteira por perto saca e vem; chega reforço em ondas (até 3) enquanto durar a raiva
  function provoke(group, where) {
    let a = anger.get(group); const t = now();
    if (!a) { a = { until: 0, sawAt: t, waves: 0, waveT: 6 }; anger.set(group, a); notify(GANG_NAME[group] + ' quer vingança — saia daí!'); }
    a.until = t + 120000; a.sawAt = t;
    for (const n of npcs) if (n.gang === group && !n.dead && dist(n, where) < 70) rage(n);
  }
  function rage(n) {
    if (n.angry) return;
    n.angry = true; n.armed = true; n.leaving = false; n.route = null; n.target = null; n.pause = 0; n.hang = null; n.socialUntil = 0;
    ctx.say(n, pick(GANG_RAGE), '😡');
  }
  function giveUp(n) {
    n.angry = false; n.armed = false; n.aiming = false; n.aimHold = 0; n.leaving = true; n.run = false; n.sawPlayer = null; n.lastSeen = null; n.flank = null;
    const a = Math.atan2(n.y - P().y, n.x - P().x) + rnd(-.8, .8); n.target = { x: n.x + Math.cos(a) * 60, y: n.y + Math.sin(a) * 60 };
  }
  function calm(group) {
    for (const n of npcs) if (n.gang === group && n.angry && !n.dead) {
      n.angry = false; n.armed = false; n.aiming = false; n.aimHold = 0; n.leaving = true; n.run = false;
      const a = Math.random() * TAU; n.target = { x: n.x + Math.cos(a) * 60, y: n.y + Math.sin(a) * 60 };
    }
  }
  function angerTick(dt) {
    const p = P(), t = now();
    for (const [g, a] of [...anger]) {
      const active = npcs.filter(n => n.gang === g && n.angry && !n.dead);
      for (const n of active) {
        if (n.sees) n.sawPlayer = t; else n.sawPlayer ??= t;
        if (dist(n, p) > 55 || t - n.sawPlayer > 15000) giveUp(n);   // longe ou sem ver há 15 s: desiste e esquece
      }
      if (active.some(n => n.sees)) a.sawAt = t;
      if (p.dead || t > a.until || t - a.sawAt > 25000 || !npcs.some(n => n.gang === g && n.angry && !n.dead) && a.waves >= 1) { calm(g); anger.delete(g); if (!p.dead) notify(GANG_NAME[g] + ' perdeu você de vista.'); continue; }
      a.waveT -= dt;
      if (a.waveT <= 0 && a.waves < 3 && active.length < 6) { a.waveT = 25; a.waves++; void spawnGangsters(g, 2 + (Math.random() < .5), hiddenSpot(p, 32, 48), { angry: true, armed: true }); }
    }
  }
  // jogador apontando a arma p/ um deles, de perto: provocação
  function threatTick(dt) {
    const p = P(); if (!p.armed || p.weapon?.melee || !(p.aiming || p.aimHold > 0) || bridge.driving()) return;
    const fx = Math.cos(p.face), fy = Math.sin(p.face);
    for (const n of npcs) {
      if (!n.gang || n.dead || n.angry) continue;
      const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
      if (d < 10 && (dx * fx + dy * fy) / d > .94) { n.threatT = (n.threatT || 0) + dt; if (n.threatT > 1.2) provoke(n.gang, n); }
      else n.threatT = 0;
    }
  }
  // guerra entre as facções perto do jogador; a polícia vem intervir
  async function startWar() {
    const spot = sidewalkNear(P(), 28, 50); if (!spot) return;
    let b = null;
    for (let k = 0; k < 10 && !b; k++) { const a = Math.random() * TAU, x = spot.x + Math.cos(a) * 26, y = spot.y + Math.sin(a) * 26; if (ctx.clear(x, y, null, .4)) b = { x, y }; }   // lados afastados: avançam trocando tiro
    if (!b) return;
    const war = { id: ++warId, x: (spot.x + b.x) / 2, y: (spot.y + b.y) / 2, sides: ['last-kings', 'novelis-crew'], t: 0, over: false, police: false };
    wars.push(war);
    notify('Tiroteio entre Last Kings e Novelis Crew!');
    await Promise.all([spawnGangsters('last-kings', 3, { x: spot.x, y: spot.y }, { war, armed: true }), spawnGangsters('novelis-crew', 3, b, { war, armed: true })]);
  }
  function warTick(dt) {
    warT -= dt;
    const p = P();
    if (warT <= 0) { warT = rnd(70, 130); if (!wars.length && !p.dead && turfNear(p) && Math.random() < .6) void startWar(); }
    for (const w of [...wars]) {
      w.t += dt;
      const side = s => npcs.filter(n => n.war === w && n.gang === s && !n.dead && !n.fled);
      const A = side(w.sides[0]), B = side(w.sides[1]), all = [...A, ...B];
      if (all.length) { w.x = all.reduce((s, n) => s + n.x, 0) / all.length; w.y = all.reduce((s, n) => s + n.y, 0) / all.length; }
      if (!w.police && w.t > 4) { w.police = true; void dispatchPolice('gang', w); void dispatchPolice('gang', w); }
      if (w.t > 4 && (!A.length || !B.length) || w.t > 100) {
        w.over = true; wars.splice(wars.indexOf(w), 1);
        for (const n of npcs) if (n.war === w && !n.dead) { n.war = null; n.shotCop = false; n.shotBy = null; if (!n.angry) { n.armed = false; n.aiming = false; n.aimHold = 0; n.leaving = true; const a = Math.random() * TAU; n.target = { x: n.x + Math.cos(a) * 60, y: n.y + Math.sin(a) * 60 }; n.run = true; } }
      }
    }
  }

  // ======================= combate =======================
  const outlaw = o => o.outlaw && now() - o.outlaw < 60000;
  // criminosos (NPC) que atiraram: sem viatura por perto, chama uma p/ ir atrás do suspeito
  let outlawT = 2;
  function outlawTick(dt) {
    outlawT -= dt; if (outlawT > 0) return; outlawT = 2;
    for (const o of npcs) {
      if (!outlaw(o) || o.dead || o.cop || o.war) continue;
      if (fleet.units.some(u => u.kind === 'police' && !u.abandoned && (u.suspect === o || dist(u, o) < 90)) || pendingPolice) continue;
      void dispatchPolice('outlaw', o); notify('Polícia a caminho: tiros de ' + (GANG_NAME[o.gang] || 'um suspeito') + '.'); break;
    }
  }
  function copFoe(n) {
    const p = P();
    if (wanted.level && !p.dead && (n.chase || dist(n, p) < 40)) { n.chase = true; return playerFoe(); }
    let best = null, bd = 50;
    for (const o of npcs) if (!o.cop && !o.dead && o.armed && (o.war || o.shotCop || outlaw(o)) && entries.has(o)) { const d = dist(n, o); if (d < bd) { bd = d; best = o; } }
    return best ? { x: best.x, y: best.y, actor: best } : null;
  }
  function gangFoe(n) {
    const p = P();
    if (n.angry && !p.dead) return playerFoe();
    if (n.shotBy && !n.shotBy.dead && npcs.includes(n.shotBy) && dist(n, n.shotBy) < 50) return { x: n.shotBy.x, y: n.shotBy.y, actor: n.shotBy };
    let best = null, bd = 42;
    for (const o of npcs) {
      if (o === n || o.dead || !entries.has(o)) continue;
      const hostile = o.cop && (n.war || n.shotCop || outlaw(n) && o.chaseNPC !== false && dist(o, n) < 30) || n.war && o.war === n.war && o.gang !== n.gang;
      if (!hostile) continue; const d = dist(n, o); if (d < bd) { bd = d; best = o; }
    }
    return best ? { x: best.x, y: best.y, actor: best } : null;
  }
  function combat(n, dt, foe) {
    n.recoilT = (n.recoilT ?? 9) + dt;
    if (n.stagger > 0) { n.stagger -= dt; n.speed = 0; return; }
    n.armed = true; n.leaving = false; n.hang = null;
    const W = arms(n), dx = foe.x - n.x, dy = foe.y - n.y, d = Math.hypot(dx, dy) || .01, aim = Math.atan2(dy, dx);
    n.losT = (n.losT || 0) - dt;
    if (n.losT <= 0) { n.losT = .22 + Math.random() * .1; n.sees = d < 45 && sight(n.x, n.y, foe.x, foe.y, foe.car ? 2.6 : 0); if (n.sees) n.lastSeen = { x: foe.x, y: foe.y }; }
    if (n.sees && foe.player && n.cop) wanted.sawAt = now();
    if (n.mag == null || n.mag <= 0 && n.reloadT < 0) { if (n.mag == null) n.mag = W.mag; else n.reloadT = 0; }
    if (n.reloadT >= 0) { n.reloadT += dt; if (n.reloadT > W.reload) { n.reloadT = -1; n.mag = W.mag; } }
    // gangster muito ferido recua (foge e some)
    if (!n.cop && n.hp < 35 && !n.fled && Math.random() < .5 * dt * 4) { n.fled = true; n.angry = false; n.war = null; n.leaving = true; n.run = true; n.armed = false; n.aiming = false; n.aimHold = 0; n.target = { x: n.x - dx / d * 50, y: n.y - dy / d * 50 }; return; }
    if (n.sees && d < W.range) {
      n.aiming = true; n.aimHold = 1.3;
      // anda de lado trocando de lado de vez em quando; recua se perto demais, avança se longe
      n.strafeT = (n.strafeT || 0) - dt;
      if (n.strafeT <= 0) { n.strafeT = rnd(1.2, 3); n.strafe = Math.random() < .35 ? 0 : Math.random() < .5 ? -1 : 1; }
      let mx = 0, my = 0; const ux = dx / d, uy = dy / d;
      if (d < W.min) { mx -= ux; my -= uy; } else if (d > W.range * .8) { mx += ux; my += uy; }
      if (n.strafe) { mx += -uy * n.strafe * .8; my += ux * n.strafe * .8; }
      n.run = false;
      if ((mx || my) && n.reloadT < 0) { if (!ctx.stepToward(n, Math.atan2(my, mx), 1.5, dt)) n.strafe = -n.strafe; }
      else n.speed = 0;
      n.running = false; n.face = aim;
      n.fireT = (n.fireT ?? rnd(.7, 1.2)) - dt;   // reação antes do primeiro tiro
      if (n.fireT <= 0 && n.reloadT < 0) {
        shoot(n, foe, d, W); n.burst = (n.burst || 0) + 1; n.mag--;
        if (n.mag <= 0) n.reloadT = 0;
        n.fireT = n.burst % W.burst ? W.inB : rnd(...W.gap);
      }
      return;
    }
    // sem visão (ou longe): vai até onde viu por último; chegou e nada → flanqueia pelo lado
    n.aiming = false; n.aimHold = Math.max(0, (n.aimHold || 0) - dt); n.fireT = Math.max(n.fireT ?? 0, .7);
    let g = n.lastSeen && dist(n, n.lastSeen) > 2 && !n.flank ? n.lastSeen : null;
    if (!g) {
      if (!n.flank || dist(n, n.flank) < 2) { const s = Math.random() < .5 ? -1 : 1, a = aim + s * 1.1; n.flank = { x: foe.x - Math.cos(a) * 9, y: foe.y - Math.sin(a) * 9 }; n.lastSeen = null; }
      g = d > 14 ? foe : n.flank;
    }
    n.run = true;
    if (!ctx.stepToward(n, Math.atan2(g.y - n.y, g.x - n.x), n.cop ? 4.6 : 4.3, dt)) { n.blocked = (n.blocked || 0) + dt; if (n.blocked > 1.2) { n.blocked = 0; n.flank = null; n.lastSeen = null; n.face += Math.PI / 2; } } else n.blocked = 0;
  }
  function shoot(n, foe, d, W) {
    const p = P(), m = system.muzzle(n) || [n.x, n.y, (n.floorZ || 0) + 1.35];
    if (!n.cop) n.outlaw = now();
    bridge.npcGun?.(window.CityWeapons?.list[n.weaponId]?.cat || 'pistol', n.x, n.y);
    n.recoilT = 0;
    const moving = foe.player ? p.speed > 3 || foe.car : (foe.actor?.speed || 0) > 2;
    const acc = Math.max(.08, Math.min(.9, W.acc - d * .012 - (moving ? .12 : 0) - (foe.car ? .1 : 0) - (n.speed > .5 ? .08 : 0))), hit = Math.random() < acc;
    const a = Math.atan2(foe.y - m[1], foe.x - m[0]) + (hit ? 0 : (Math.random() < .5 ? -1 : 1) * rnd(.04, .18)), ux = Math.cos(a), uy = Math.sin(a);
    const wall = bridge.raycast ? bridge.raycast(m[0], m[1], ux, uy, 45).t : 45;
    const reach = foe.player ? (hit ? Math.min(wall, d - .4) : wall) : Math.min(wall, d + .6);
    const who = system.shoot(m[0], m[1], ux, uy, reach, Math.round(W.dmg * (foe.player ? .85 : .55)), n);   // NPC×NPC: tiroteio dura mais
    let end = who ? [who.x, who.y, who.z] : [m[0] + ux * wall, m[1] + uy * wall, Math.max(.05, m[2] - wall * .012)];
    const playerHit = foe.player && !who && hit && wall >= d - .6;
    if (playerHit) { end = [foe.x, foe.y, (p.floorZ || 0) + (foe.car ? 1 : 1.2)]; bridge.hurtPlayer?.(Math.max(3, Math.round(W.dmg * (foe.car ? .17 : .27))), n); }
    bridge.npcShot?.(m, end, !who && !playerHit);
    ctx.panic(n.x, n.y, n, 24);
  }
  function arrestTick(n, dt) {
    const p = P(), d = dist(n, p);
    n.recoilT = (n.recoilT ?? 9) + dt; n.armed = true; n.aiming = d < 9; n.aimHold = d < 9 ? 1.3 : 0;
    n.losT = (n.losT || 0) - dt; if (n.losT <= 0) { n.losT = .25; n.sees = d < 40 && sight(n.x, n.y, p.x, p.y); }
    if (n.sees) wanted.sawAt = now();
    if (!n.warned && d < 14) { n.warned = true; ctx.say(n, 'Polícia! Parado, mão na cabeça!', '🚨'); }
    if (d > 1.25) { n.run = d > 4; ctx.stepToward(n, Math.atan2(p.y - n.y, p.x - n.x), d > 4 ? 4.6 : 1.6, dt); if (d < 9) n.face = Math.atan2(p.y - n.y, p.x - n.x); n.arrestT = 0; return; }
    n.speed = 0; n.running = false; n.face = Math.atan2(p.y - n.y, p.x - n.x);
    n.arrestT = (n.arrestT || 0) + dt;
    if (p.speed < .8 && n.arrestT > 1.2) {
      bridge.arrestPlayer?.();
      clearWanted(null);
    }
  }
  // decide quem cuida do personagem neste quadro; false = segue a rotina normal (walkNPC)
  function tickNPC(n, dt) {
    if (n.board) { boardTick(n, dt); return true; }
    if (n.medic || n.aid) { medicTick(n, dt); return true; }
    if (n.cop) {
      const foe = copFoe(n);
      if (foe) { if (foe.player && arrestMode()) arrestTick(n, dt); else combat(n, dt, foe); return true; }
      n.aiming = false; n.aimHold = 0; n.warned = false;
      if (n.vehicle) { n.board = true; boardTick(n, dt); return true; }
      return false;
    }
    if (n.gang) {
      const foe = n.angry || n.war || n.shotCop || n.shotBy || outlaw(n) ? gangFoe(n) : null;
      if (foe) { combat(n, dt, foe); return true; }
      if (n.armed && !n.angry && !n.war) { n.armed = false; n.aiming = false; n.aimHold = 0; n.shotCop = false; n.shotBy = null; }
      if (n.hang && !n.leaving) { hangTick(n, dt); return true; }
    }
    return false;
  }
  function onHurt(n, hit) {
    const p = P(), from = hit.from;
    if (from === p) {
      if (n.gang) provoke(n.gang, n);
      if (hit.kind !== 'car') crime(n.cop ? 'copassault' : 'assault');
    } else if (from?.cop && n.gang) n.shotCop = true;
    else if (from?.gang && n.gang && from.gang !== n.gang) n.shotBy = from;
  }
  function onKill(n, hit) {
    const p = P();
    if (hit.from === p) { crime(n.cop ? 'copkill' : 'kill'); if (n.gang) provoke(n.gang, n); }
    if (n.gang && hit.from?.cop) for (const o of npcs) if (o.gang === n.gang && !o.dead && dist(o, n) < 30) { o.shotCop = true; o.armed = true; }
    if (n.gang && hit.from?.gang && hit.from.gang !== n.gang) for (const o of npcs) if (o.gang === n.gang && !o.dead && dist(o, n) < 30 && !o.shotBy) o.shotBy = hit.from;
  }
  // bala de policial não pega em colega/socorrista; de gangster, não pega em parceiro da mesma facção
  const friendly = (from, n) => from?.cop && n.kind === 'service' || !!from?.gang && n.gang === from.gang;
  function tick(dt) {
    fleet.update(dt);
    for (const u of [...fleet.units]) (u.kind === 'police' ? policeUnit : ambulanceUnit)(u, dt);
    wantedTick(dt); outlawTick(dt); medicalTick(dt); angerTick(dt); warTick(dt); crewTick(dt); threatTick(dt);
    const p = P();
    for (const n of [...npcs]) if (n.kind === 'gang' && !n.angry && !n.war && !n.dead && dist(n, p) > 95) ctx.remove(n);
  }
  system.aiState = () => ({ wanted: { ...wanted }, fleet: fleet.units.map(u => ({ kind: u.kind, role: u.role || u.state, x: +u.x.toFixed(1), y: +u.y.toFixed(1), speed: +u.speed.toFixed(1), crewIn: u.crewIn, out: u.crew.length, d: +dist(u, P()).toFixed(1) })), anger: [...anger.keys()], wars: wars.map(w => ({ t: +w.t.toFixed(1), x: w.x, y: w.y })) });
  system.startGangWar = startWar;
  system.fleetUnits = () => fleet.units;   // depuração no console
  return { tick, tickNPC, onHurt, onKill, deadTick, crime, clearWanted, friendly, shot: () => { lastShot = now(); }, fleet };
}

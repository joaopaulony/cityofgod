// npc-street-life.mjs — vida entre NPCs na rua: encontros (um vai até o outro, param, se viram e conversam em turnos
// com balões e gestos — aceno, celular, comemoração), às vezes saem andando juntos; rivais discutem e um sai bravo.
// As falas vêm do simulador social (relações mudam com cada conversa). Também escolhe quem aparece em cada região
// (favela: moradores e gangue; centro: moradores e motoboys; indústria/porto: operários; bairros: moradores).
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

// pesos por região: civil (moradores), gang, worker (operários), moto (motoboy)
const REGION_MIX = {
  favela: { civil: .55, gang: .45 }, downtown: { civil: .84, moto: .16 }, industrial: { civil: .5, worker: .5 },
  urban: { civil: .9, worker: .05, moto: .05 }, rural: { civil: 1 }
};

export function regionOf(districtAt, x, y) {
  const D = globalThis.COG?.D || {}, d = districtAt(x, y);
  if (d === D.FAVELA || d === D.GHETTO) return 'favela';
  if (d === D.DOWNTOWN) return 'downtown';
  if (d === D.INDUSTRIAL || d === D.PORT) return 'industrial';
  if (d === D.RURAL || d === D.FARM) return 'rural';
  return 'urban';
}
// visual p/ quem vai aparecer naquela região (moradores não repetem; operário e motoboy podem repetir)
export function pickStreetLook(roster, region, busy) {
  const mix = REGION_MIX[region] || REGION_MIX.urban;
  let r = Math.random(), cat = 'civil';
  for (const [k, w] of Object.entries(mix)) { if ((r -= w) <= 0) { cat = k; break; } }
  const all = roster.list(), pool = cat === 'gang' ? all.filter(c => c.role === 'gang' && !busy.has(c.id))
    : cat === 'worker' ? all.filter(c => c.group === 'operarios') : cat === 'moto' ? all.filter(c => c.group === 'motoboy')
    : all.filter(c => c.role === 'civil' && !busy.has(c.id));
  return pool.length ? pick(pool) : pick(all.filter(c => c.role === 'civil' && !busy.has(c.id)) || []);
}

export function createStreetLife(ctx) {
  const { npcs, entries, bridge, distance } = ctx, meets = new Set(), byNpc = new Map();
  let clock = 2;
  const free = n => entries.has(n) && !n.dead && !n.leaving && !n.target && !n.angry && !n.war && !n.cop && !n.medic && !n.aid && !n.board && !n.hang
    && n.kind === 'street' && !byNpc.has(n) && !ctx.activities.has(n) && !(n.socialUntil > (ctx.social()?.time ?? 0)) && !(n.follow);
  const emote = (n, id, dur) => { const e = entries.get(n); if (e && !n.armed) e.emote = { id, end: performance.now() + (dur || 2600) }; };
  function start() {
    const p = bridge.player, cands = npcs.filter(n => free(n) && distance(n, p) < 50);
    if (cands.length < 2) return;
    const a = pick(cands), others = cands.filter(b => b !== a && b.lookId !== a.lookId && distance(a, b) < 16);
    if (!others.length) return;
    const S = ctx.social(), b = others.sort((x, y) => (S ? S.relation(a.lookId, y.lookId).friend - S.relation(a.lookId, x.lookId).friend : 0))[0];
    const rel = S ? S.relation(a.lookId, b.lookId).friend : 0;
    const m = { a, b, state: 'approach', t: 0, turn: 0, next: .4, dur: rnd(9, 17), rival: rel < -25 || Math.random() < .12, talker: a };
    meets.add(m); byNpc.set(a, m); byNpc.set(b, m);
  }
  function end(m, walkTogether) {
    meets.delete(m); byNpc.delete(m.a); byNpc.delete(m.b);
    for (const n of [m.a, m.b]) { n.socialUntil = 0; n.pause = 0; }
    if (walkTogether && !m.a.dead && !m.b.dead) { m.b.follow = { lead: m.a, until: performance.now() + rnd(15000, 30000) }; m.b.route = null; }
    if (m.rival && !m.b.dead) { // discussão: um sai bravo, rápido
      const a = Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x); m.b.route = null; m.b.run = Math.random() < .5; m.b.leaving = true; m.b.target = { x: m.b.x + Math.cos(a) * 40, y: m.b.y + Math.sin(a) * 40 };
    }
  }
  function line(m) {
    const S = ctx.social(), sp = m.talker, ls = sp === m.a ? m.b : m.a;
    let text = null, icon = m.rival ? '😠' : '💬';
    if (S) {
      const action = m.rival ? pick(['disagree', 'insult', 'snap', 'teasing', 'coldShoulder']) : S.suggest(sp.lookId, ls.lookId);
      const r = S.interact(sp.lookId, ls.lookId, action); if (r?.ok) { text = r.line || r.text; icon = r.reaction || icon; if (r.reaction === '😄' && Math.random() < .5) emote(ls, 'cheer', 2500); }
    }
    if (!text) text = m.rival ? pick(['Tá olhando o quê?', 'Me deixa em paz!', 'Isso não vai ficar assim.', 'Sai fora, mano.']) : pick(['E aí, tudo certo?', 'Viu o jogo ontem?', 'Tá calor hoje, hein.', 'Bora no baile sábado?', 'Minha mãe mandou um abraço.', 'O ônibus atrasou de novo.', 'Tô trampando muito.', 'Kkkk verdade!']);
    ctx.say(sp, text, icon);
    // gestos reais (Universal Animation Library): quem fala gesticula; quem ouve concorda, cruza os braços ou nega
    if (!m.rival && Math.random() < .18) emote(sp, 'phone', 3000);   // mostra algo no celular
    else emote(sp, m.rival ? pick(['no', 'call']) : 'talk', 2600);
    if (Math.random() < .45) emote(ls, m.rival ? pick(['fold', 'no']) : pick(['yes', 'fold', 'talk']), 2400);
    m.talker = ls;
  }
  // controla quem está num encontro (ou seguindo um amigo); false = segue a rotina normal
  function control(n, dt) {
    if (n.follow) {
      const f = n.follow, L = f.lead;
      if (!L || L.dead || !npcs.includes(L) || performance.now() > f.until || n.leaving || n.angry) { n.follow = null; return false; }
      const side = { x: L.x - Math.sin(L.face) * .9, y: L.y + Math.cos(L.face) * .9 }, d = Math.hypot(side.x - n.x, side.y - n.y);
      if (d > .35) { n.run = d > 4; ctx.stepToward(n, Math.atan2(side.y - n.y, side.x - n.x), d > 4 ? 3 : Math.max(.6, L.speed || 1), dt); } else { n.speed = L.speed; n.face = L.face; }
      return true;
    }
    const m = byNpc.get(n); if (!m) return false;
    if ([m.a, m.b].some(x => x.dead || !entries.has(x) || x.leaving || x.angry || x.target || x.war)) { end(m, false); return false; }
    if (n !== m.a && m.state === 'approach') { n.speed = 0; n.face = Math.atan2(m.a.y - n.y, m.a.x - n.x); return true; }   // espera quem vem
    if (n === m.a) {
      m.t += dt;
      if (m.state === 'approach') {
        const d = distance(m.a, m.b);
        if (d > 1.15) { m.a.run = false; if (!ctx.stepToward(m.a, Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x), m.a.walk || 1.1, dt) || m.t > 14) { end(m, false); return false; } return true; }
        m.state = 'talk'; m.t = 0;
        if (!m.rival) { emote(m.a, 'wave', 2200); emote(m.b, 'wave', 2200); }
      }
      if (m.state === 'talk') {
        m.next -= dt; if (m.next <= 0) { m.next = rnd(2.2, 3.4); line(m); }
        if (m.t > m.dur) { end(m, !m.rival && Math.random() < .3); return false; }
      }
    }
    // os dois de frente um p/ o outro, parados
    const o = n === m.a ? m.b : m.a; n.speed = 0; n.running = false; n.face = Math.atan2(o.y - n.y, o.x - n.x);
    return true;
  }
  function tick(dt) { clock -= dt; if (clock <= 0) { clock = rnd(2.5, 4.5); if (meets.size < 3) start(); } }
  return { tick, control, get count() { return meets.size; } };
}

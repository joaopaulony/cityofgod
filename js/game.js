// game.js — laço principal: jogador, tiro, recarga, partículas, câmera estilo Zomboid e render.
'use strict';

const view = document.getElementById('view'), g = view.getContext('2d');
const hudC = document.getElementById('hud'), h = hudC.getContext('2d');
const light = makeCanvas(1, 1), lg = light.getContext('2d');
const glows=makeCanvas(1,1),gg=glows.getContext('2d');
const buildingMask=makeCanvas(1,1),mg=buildingMask.getContext('2d');
const buildingShade=makeCanvas(1,1),sg=buildingShade.getContext('2d');
const focusCanvas=makeCanvas(1,1),fg=focusCanvas.getContext('2d');

buildWorld();

const player = makeActor({ x: world.spawn[0], y: world.spawn[1], face: world.aimDir, pal: PAL.hero, ammo: 30, reserve: 90 });
ecosystemInit();
// NPCs passeiam na frente do mercado e de uma das casas
const shopH = houses.find(h => h.brick) || houses[0], homeH = houses.find(h => h !== shopH) || shopH;
const spotAt = (H, w) => H ? [H.front[0] + H.doorN[0] * 1.5 - w / 2, H.front[1] + H.doorN[1] * 1.5 - w / 2, w, w] : [world.spawn[0] + 4, world.spawn[1] + 4, 3, 3];
const npcs = [
  makeActor({ face: 2, armed: false, pal: PAL.red, name: 'Lucas', home: spotAt(shopH, 5) }),
  makeActor({ face: 1, armed: false, pal: PAL.girl, name: 'Ana', home: spotAt(homeH, 4) }),
];
const actors = [player, ...npcs];
const parts = [], tracers = [], bubbles = [];
const st = { player, npcs, hp: 0.92, food: 0.63, water: 0.48, clock: 17 * 60 + 40, night: false, shake: 0 };
let fireCD = 0, last = performance.now(), T = 0, dragX = null;
const ZOOMS = [22, 28, 34, 42, 52, 64].map(z => z * RENDER_SCALE);
let zi = 3; cam.tzoom = cam.zoom = ZOOMS[zi];
cam.x = cam.tx = player.x; cam.y = cam.ty = player.y;

function resize() {
  view.width = Math.ceil(innerWidth / RS); view.height = Math.ceil(innerHeight / RS);
  hudC.width = innerWidth; hudC.height = innerHeight;
  light.width = view.width; light.height = view.height;
  glows.width=view.width;glows.height=view.height;
  buildingMask.width=view.width;buildingMask.height=view.height;
  buildingShade.width=view.width;buildingShade.height=view.height;
  focusCanvas.width=view.width;focusCanvas.height=view.height;
  cam.W = view.width; cam.H = view.height;
}
addEventListener('resize', resize); resize();

// ---------- entrada do mouse / câmera ----------
view.addEventListener('mousemove', e => {
  input.mx = e.clientX; input.my = e.clientY;
  if (dragX !== null) { cam.tang += (e.clientX - dragX) * 0.008; dragX = e.clientX; }
});
view.addEventListener('mousedown', e => {
  if (e.button === 0) { input.lmb = true; player.wantShot = true; }
  if (e.button === 2) input.rmb = true;
  if (e.button === 1) { dragX = e.clientX; e.preventDefault(); }
});
addEventListener('mouseup', e => {
  if (e.button === 0) input.lmb = false;
  if (e.button === 2) input.rmb = false;
  if (e.button === 1) { dragX = null; cam.tang = Math.round((cam.tang - Math.PI / 4) / (Math.PI / 2)) * Math.PI / 2 + Math.PI / 4; }
});
view.addEventListener('wheel', e => { zi = clamp(zi + (e.deltaY > 0 ? -1 : 1), 0, ZOOMS.length - 1); cam.tzoom = ZOOMS[zi]; e.preventDefault(); }, { passive: false });

// ---------- chat ----------
const logEl = document.getElementById('log'), say = document.getElementById('say');
function chat(who, text) {
  const mins = Math.floor(st.clock) % 1440, t = `[${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}]`;
  const d = document.createElement('div'); d.innerHTML = `${t} <b></b> `; d.querySelector('b').textContent = who + ':'; d.append(text);
  logEl.append(d); while (logEl.children.length > 4) logEl.firstChild.remove();
}
for (const n of npcs) { n.x = n.home[0] + n.home[2] / 2; n.y = n.home[1] + n.home[3] / 2; }
chat('Sistema', `mundo ${MAP}×${MAP} m (4× a área) — semente ${world.seed}. G gera outro.`);
addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.activeElement === say) {
    const t = say.value.trim(); say.value = ''; say.blur();
    if (t) { chat('Você', t); bubbles.push({ who: player, text: t, t: 4 }); }
  } else { say.focus(); input.keys.clear(); }
});
const npcLines = ['alguém pra ajudar na entrega?', 'ouviu esses tiros?', 'o mercado fecha às 22h', 'to indo pro campo', 'cuidado com a mira aí!'];

// ---------- efeitos ----------
function emit(o) { parts.push(Object.assign({ vx: 0, vy: 0, vz: 0, life: 1, max: 1, g: 9.8, size: 0.04 }, o)); }
// Os dois tipos de folha (vento e disparo) usam paintLeaf() do world.js:
// mesmo contorno, mesmo espectro de cores e comportamento de queda.
function spawnTreeShotLeaves(hit) {
  if (!hit.ref || !hit.ref.sp || parts.length > 210) return;
  const sp=hit.ref.sp, colors=sp.leafColors;
  const count=sp.kind==='pine'?14:24;
  for(let i=0;i<count;i++) {
    const angle=rnd(0,TAU),speed=rnd(.6,2.1),height=sp.trunkH+rnd(.3,sp.r*1.35),
      fallSpeed=rnd(.55,.95),lifetime=Math.min(13,height/fallSpeed+1.8);
    emit({kind:'falling-leaf',x:hit.x+rnd(-sp.r*.23,sp.r*.23),
      y:hit.y+rnd(-sp.r*.23,sp.r*.23),z:height,
      vx:Math.cos(angle)*speed+(hit.nx||0)*.5,
      vy:Math.sin(angle)*speed+(hit.ny||0)*.5,
      vz:rnd(.45,1.6),g:0,fallSpeed,age:0,phase:rnd(0,TAU),
      spin:rnd(-5,5),life:lifetime,max:lifetime,size:rnd(.058,.095),
      col:colors[(Math.random()*colors.length)|0],shot:true});
  }
}
function impact(hit, z) {
  const n = hit.kind === 'tree' ? 'leaf' : hit.glass ? 'glass' : hit.kind === 'none' ? 'dirt' : 'chip';
  const cols = { leaf: ['#4a7d32', '#6e9d40', '#2e5a26'], glass: ['#cfe6ef', '#9cc0d8', '#ffffff'], dirt: ['#7a6040', '#5a4a30', '#a08860'], chip: ['#cfc6b0', '#8a8278', '#f2e2b0'] }[n];
  if (n === 'leaf') spawnTreeShotLeaves(hit);
  else for (let i = 0; i < 7; i++) {
    const a = rnd(0, TAU), sp = rnd(0.6, 2.4);
    emit({ x: hit.x, y: hit.y, z, vx: (hit.nx || 0) * sp + Math.cos(a) * 0.8, vy: (hit.ny || 0) * sp + Math.sin(a) * 0.8, vz: rnd(0.5, 2.5),
      life: rnd(0.4, 0.9), max: 0.9, col: cols[i % 3], kind: n, g: 9.8, size: 0.035 });
  }
  emit({ x: hit.x, y: hit.y, z, life: 0.5, max: 0.5, kind: 'puff', g: -0.6, vz: 0.4, size: 0.18, col: n === 'dirt' ? '#8a7a5a' : '#d8d2c4' });
  if (hit.ref && hit.kind === 'target') { hit.ref.hit = 0.25; hit.ref.wob = 0.5; }
  if (hit.ref && hit.kind === 'tree') hit.ref.hit = 0.4;
}

function fire(J) {
  const R = J.rifle, m = R.muzzle, aim = unproj(input.mx / RS, input.my / RS, m[2]);
  let dx = aim[0] - m[0], dy = aim[1] - m[1];
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const spread = (1 - player.aimV) * 0.08 + (player.speed > 0.1 ? 0.03 : 0.008), a = Math.atan2(dy, dx) + rnd(-spread, spread);
  dx = Math.cos(a); dy = Math.sin(a);
  const hit = raycast(m[0], m[1], dx, dy, 45);
  const hz = Math.max(0.05, m[2] - hit.t * 0.012);
  tracers.push({ a: m, b: [hit.x, hit.y, hz], t: 0.09 });
  impact(hit, hz);
  player.ammo--; player.recoilT = 0; player.flash = 0.11; st.shake = 0.12;
  // cápsula ejetada p/ a direita do fuzil
  const side = V.norm(V.cross([0, 0, 1], V.sub(R.muzzle, R.butt)));
  const e = R.recv1;
  emit({ x: e[0], y: e[1], z: e[2], vx: -side[0] * 2.2 + rnd(-0.4, 0.4), vy: -side[1] * 2.2 + rnd(-0.4, 0.4), vz: 2.4, life: 1.6, max: 1.6, kind: 'casing', col: '#d9b23a', bounce: 2 });
  emit({ x: m[0], y: m[1], z: m[2], vx: dx * 0.8, vy: dy * 0.8, vz: 0.3, life: 0.6, max: 0.6, kind: 'puff', g: -0.8, size: 0.14, col: '#cfcac0' });
}

// ---------- atualização ----------
function updatePlayer(dt) {
  const p = player;
  if(vehicleSystem.driver){
    p.speed=0;p.aiming=false;p.wantShot=false;p.running=false;
    p.aimHold=0;return;
  }
  let mx = 0, my = 0;
  if (input.down('w')) my--; if (input.down('s')) my++; if (input.down('a')) mx--; if (input.down('d')) mx++;
  p.aiming = input.rmb;
  p.running = input.down('shift') && !p.aiming;
  const aimPt = unproj(input.mx / RS, input.my / RS, 1.4);
  let spd = 0;
  if ((mx || my) && !p.stairTravel) {
    const w = screenDirToWorld(mx, my), l = Math.hypot(w[0], w[1]);
    p.moveA = Math.atan2(w[1], w[0]);
    spd = p.aiming || p.aimHold > 0 ? 1.15 : p.running ? 3.7 : 1.75;
    if (p.reloadT >= 0) spd = Math.min(spd, 1.3);
    const [nx, ny] = moveTo(p.x, p.y, p.x + w[0] / l * spd * dt, p.y + w[1] / l * spd * dt, 0.28, p.floor||0);
    const moved = Math.hypot(nx - p.x, ny - p.y);
    p.x = nx; p.y = ny; spd = dt > 0 ? moved / dt : p.speed;
  }
  p.speed = lerp(p.speed, spd, 1 - Math.exp(-dt * 12));
  p.phase += p.speed * dt / lerp(1.45, 2.5, p.runW);
  // virar: p/ o mouse quando mira/atira/recarrega; senão p/ onde anda
  const lookMouse = p.aiming || p.aimHold > 0 || p.reloadT >= 0 || input.lmb || p.wantShot;
  const want = lookMouse ? Math.atan2(aimPt[1] - p.y, aimPt[0] - p.x) : (mx || my) ? p.moveA : p.face;
  p.face += angDiff(p.face, want) * (1 - Math.exp(-dt * (lookMouse ? 16 : 10)));

  fireCD -= dt;
  // clique curto fica na fila: o fuzil sobe (antecipação) e o tiro sai quando a mira assenta
  if ((input.lmb || p.wantShot) && p.reloadT < 0) {
    p.aimHold = 1.3;
    if (p.ammo <= 0) { p.wantShot = false; if (fireCD <= 0) { hud.msg = 'Sem munição — aperte R'; hud.msgT = 1.6; fireCD = 0.4; } }
    else if (p.aimV > 0.82 && fireCD <= 0 && p.J && Math.abs(angDiff(p.face, Math.atan2(aimPt[1] - p.y, aimPt[0] - p.x))) < 0.25) { fire(p.J); fireCD = 0.12; p.wantShot = false; }
  }
  if (p.reloadT >= 0) p.wantShot = false;
  if (input.hit('r') && p.reloadT < 0 && p.ammo < 30 && p.reserve > 0) { p.reloadT = 0; hud.msg = 'Recarregando…'; hud.msgT = 1.2; }
  for (const ev of p.events.splice(0)) {
    if (ev === 'magOut') p.magState = 'hand';
    if (ev === 'magDrop') {
      p.magState = 'none'; const hd = p.J.handL;
      emit({ x: hd[0], y: hd[1], z: hd[2] - 0.1, vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3), vz: -0.5, life: 6, max: 6, kind: 'mag', col: '#2b2b2e', bounce: 1 });
    }
    if (ev === 'magNew') p.magState = 'hand';
    if (ev === 'magIn') { p.magState = 'in'; st.shake = 0.05; }
    if (ev === 'ready') { const n = Math.min(30 - p.ammo, p.reserve); p.ammo += n; p.reserve -= n; }
  }
}

function updateNPC(n, dt) {
  n.timer = (n.timer || 0) - dt;
  if (!n.goal || n.timer < 0) {
    const [hx, hy, w, hgt] = n.home;
    n.goal = Math.random() < 0.4 ? null : [hx + rnd(0, w), hy + rnd(0, hgt)];
    n.timer = rnd(2, 6);
    if (Math.random() < 0.18) { const t = npcLines[(Math.random() * npcLines.length) | 0]; chat(n.name, t); bubbles.push({ who: n, text: t, t: 3.5 }); }
  }
  let spd = 0;
  if (n.goal) {
    const dx = n.goal[0] - n.x, dy = n.goal[1] - n.y, d = Math.hypot(dx, dy);
    if (d > 0.2) {
      n.moveA = Math.atan2(dy, dx); spd = 1.3;
      const [x, y] = moveTo(n.x, n.y, n.x + dx / d * spd * dt, n.y + dy / d * spd * dt, 0.28); n.x = x; n.y = y;
      n.face += angDiff(n.face, n.moveA) * (1 - Math.exp(-dt * 8));
    } else n.goal = null;
  }
  n.speed = lerp(n.speed, spd, 1 - Math.exp(-dt * 10));
  n.phase += n.speed * dt / 1.45;
}

// Folhas ambientais: poucas partículas por segundo, só de árvores perto da câmera.
// Aproveita a ordenação de profundidade que já existe para todas as partículas.
let ambientLeafBudget = 0;
function spawnAmbientLeaves(dt) {
  if (dt <= 0) return;
  const near = [];
  for (const p of world.props) {
    if (p.type !== 'tree' || Math.abs(p.x-cam.x)>16 || Math.abs(p.y-cam.y)>16) continue;
    near.push(p);
  }
  if (!near.length) { ambientLeafBudget = 0; return; }
  // ~0.5-2.5 folhas/s na região, evitando florestas de partículas.
  ambientLeafBudget = Math.min(3, ambientLeafBudget + dt * Math.min(2.5, near.length*0.14));
  if (parts.length > 180) return;
  let active = 0;
  for (const p of parts) if (p.kind === 'falling-leaf') active++;
  while (ambientLeafBudget >= 1 && active < 48) {
    ambientLeafBudget--;
    const p=near[(Math.random()*near.length)|0], sp=p.sp;
    if(sp.kind==='pine' && Math.random()<0.88)continue;
    const a=Math.random()*TAU, d=Math.sqrt(Math.random())*sp.r*.82;
    const z=sp.trunkH+rnd(.35,sp.kind==='pine'?sp.r*1.5:sp.r*2.0);
    const fallSpeed=rnd(.55,.86);
    // Vida depende da altura: a folha não desaparece no ar antes de cair.
    const duration=Math.min(13,z/fallSpeed+1.25);
    emit({kind:'falling-leaf',x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d,
      z, vx:rnd(-.12,.15),vy:rnd(-.10,.14),vz:0,g:0,
      age:0,phase:rnd(0,TAU),spin:rnd(-2.4,2.4),fallSpeed,
      life:duration,max:duration,size:rnd(.058,.095),
      col:sp.leafColors[(Math.random()*sp.leafColors.length)|0]});
    active++;
  }
}

function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    if (q.kind === 'falling-leaf') {
      q.age += dt; q.life -= dt;
      // Movimento pendular, giro e queda lenta guiada pelo vento local.
      const breeze = wind(T, q.x, q.y);
      if (q.z > 0.025) {
        // Ao atirar, a folha recebe impulso radial que perde energia no vento.
        q.vx *= Math.exp(-dt*(q.shot?1.65:.32));
        q.vy *= Math.exp(-dt*(q.shot?1.65:.32));
        q.x += (q.vx + breeze*.13 + Math.sin(q.phase+q.age*2.4)*.12)*dt;
        q.y += (q.vy + breeze*.09 + Math.cos(q.phase+q.age*1.8)*.10)*dt;
        q.vz=Math.max(-q.fallSpeed,(q.vz||0)-(q.shot?3.4:2)*dt);
        q.z=Math.max(.025,q.z+(q.vz+Math.cos(q.phase+q.age*3)*.08)*dt);
      } else {
        q.life = Math.min(q.life, 1.2);
      }
      if (q.life <= 0) parts.splice(i, 1);
      continue;
    }
    q.life -= dt;
    if (q.life <= 0) { parts.splice(i, 1); continue; }
    q.vz -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    if (q.kind === 'leaf') { q.vx *= 0.96; q.vy *= 0.96; q.x += Math.sin(T * 6 + i) * dt * 0.6; }
    if (q.z < 0.02 && q.vz < 0) {
      if (q.bounce) { q.z = 0.02; q.vz *= -0.35; q.vx *= 0.5; q.vy *= 0.5; q.bounce--; }
      else { q.z = 0.02; q.vz = 0; q.vx *= 0.6; q.vy *= 0.6; if (q.kind === 'leaf' || q.kind === 'casing') q.g = 0; }
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) if ((tracers[i].t -= dt) <= 0) tracers.splice(i, 1);
  for (let i = bubbles.length - 1; i >= 0; i--) if ((bubbles[i].t -= dt) <= 0) bubbles.splice(i, 1);
}

function drawPart(q) {
  const p = proj(q.x, q.y, q.z), a = clamp(q.life / q.max * 2, 0, 1), s = Math.max(1, q.size * cam.zoom);
  if (q.kind === 'falling-leaf' || q.kind === 'leaf') {
    g.save();
    g.globalAlpha = Math.min(1,Math.max(0,q.life/1.1)) * Math.min(1,(q.age||.4)*3);
    const len=Math.max(1.5,s*1.75),angle=q.phase+(q.age||0)*q.spin;
    // Compartilha a forma exata das folhas desenhadas na copa.
    paintLeaf(g,p.x,p.y,len,angle,q.col,len>3.8);
    g.restore();
  } else if (q.kind === 'puff') {
    g.globalAlpha = a * 0.55; g.fillStyle = q.col; g.beginPath(); g.arc(p.x, p.y, s * (1.6 - q.life / q.max), 0, TAU); g.fill(); g.globalAlpha = 1;
  } else if (q.kind === 'casing') {
    g.fillStyle = INK; g.fillRect(p.x - 2, p.y - 1, 4, 3); g.fillStyle = q.col; g.fillRect(p.x - 1, p.y - 1, 2, 2);
  } else if (q.kind === 'mag') {
    const b = proj(q.x + 0.12, q.y + 0.05, q.z + (q.vz === 0 ? 0 : 0.15)); limb(g, p, b, Math.max(1.5, 0.03 * cam.zoom), '#34343a', '#1c1c20');
  } else { g.globalAlpha = a; g.fillStyle = INK; g.fillRect(p.x - s / 2 - 1, p.y - s / 2 - 1, s + 2, s + 2); g.fillStyle = q.col; g.fillRect(p.x - s / 2, p.y - s / 2, s, s); g.globalAlpha = 1; }
}

// ---------- render ----------
function render() {
  const W = view.width, H = view.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  g.fillStyle = '#26301c'; g.fillRect(0, 0, W, H);
  // chão: a textura pintada uma vez é só reprojetada com uma transformação afim (gira/zoom de graça)
  const s = cam.zoom, c = cam.cos, sn = cam.sin;
  drawGround(g,W,H);
  if(st.night)for(const lamp of world.lamps)drawLampBeam(g,lamp,T);

  const list = [], margin = 6 * s;
  for (const p of world.props) {
    const b = proj(p.x, p.y, 0);
    if (b.x < -margin || b.x > W + margin || b.y < -margin * 0.3 || b.y > H + margin * 1.2) continue;
    list.push({ d: b.d + (p.flat ? -0.3 : 0), draw: ctx => drawProp(ctx,p,T,player),prop:p });
  }
  ecosystemAddDrawables(list, g, T, player);
  houseDrawables(list,player.x,player.y);
  urbanDrawables(list,g);
  for (const l of world.lamps) {
    const pos = proj(l.x,l.y,0),padding=cam.zoom*5;
    if(pos.x < -padding || pos.x > W+padding ||
       pos.y < -padding || pos.y > H+padding) continue;
    list.push({ d: depthOf(l.x, l.y), draw: ctx => drawLamp(ctx,l,st.night),lamp:l });
  }
  for (const a of actors) {
    if(a===player&&vehicleSystem.driver)continue;
    const upper=houses.find(H=>H.upper&&H.inside&&a.floorZ>.15&&
      a.x>H.x0&&a.x<H.x1&&a.y>H.y0&&a.y<H.y1);
    const above=upper?Math.max(...[[upper.x0,upper.y0],[upper.x1,upper.y1]]
      .map(p=>depthOf(p[0],p[1])))+4:depthOf(a.x,a.y)+.05;
    list.push({d:above,draw:ctx=>{
      ctx.save();
      if(a.floorZ)ctx.translate(0,-a.floorZ*cam.zoom*HZ);
      drawActor(ctx,a,a.J,a.pal);
      ctx.restore();
    },actor:a});
  }
  for (const q of parts) list.push({ d: depthOf(q.x, q.y) + (q.z > 0.5 ? 0.3 : 0), draw: () => drawPart(q) });
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.draw(g);
  ecosystemDrawPollen(g, T, st.night);

  // rastros das balas e clarão
  for (const t of tracers) {
    const a = proj(...t.a), b = proj(...t.b), k = t.t / 0.09;
    g.lineCap = 'round';
    g.strokeStyle = `rgba(255,220,140,${0.35 * k})`; g.lineWidth = 4; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    g.strokeStyle = `rgba(255,250,220,${k})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lerp(a.x, b.x, 1 - k), lerp(a.y, b.y, 1 - k)); g.lineTo(b.x, b.y); g.stroke();
  }
  // O antigo X-ray de personagem nao respeitava a profundidade: parecia
  // flutuar em cima do telhado. A lente redesenha a cena sem a parede
  // que realmente bloqueia a camera, com mascara radial suavizada.
  if (st.night) {
    drawNight(W,H);
    carNightLamps(g,T);
  }
  const blocker=occluded();
  if(blocker)drawPlayerVision(list,blocker,W,H);
  drawMuzzleFlash(g,player,st.night);
  // balões de fala
  g.font = '7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const b of bubbles) {
    const p = proj(b.who.x, b.who.y, 2.25), w = g.measureText(b.text).width + 8;
    g.globalAlpha = clamp(b.t, 0, 1);
    poly(g, [[p.x - w / 2, p.y - 12], [p.x + w / 2, p.y - 12], [p.x + w / 2, p.y], [p.x + 3, p.y], [p.x, p.y + 4], [p.x - 3, p.y], [p.x - w / 2, p.y]], '#f6f1e6', INK, 1);
    g.fillStyle = '#222'; g.fillText(b.text, p.x, p.y - 5.5);
    g.globalAlpha = 1;
  }
}

// Devuelve unicamente a construcao que cobre a projecao do corpo;
// nunca ativa a lente se o jogador esta de fato dentro do edificio.
// Mede cobertura do CORPO (cabeca, ombros, torax e pernas), e nao
// somente a posicao dos pes: minimo 80% dos 15 pontos deve estar atras
// da superficie, reduzindo circulos disparados por beiradas de telhado.
function houseBodyCoverage(H,actor){
  if(H.inside||actor.x>H.x0-.15&&actor.x<H.x1+.15&&
       actor.y>H.y0-.15&&actor.y<H.y1+.15)return 0;
  const cx=actor.x,cy=actor.y;
  const surfaces=[];
  for(const side of Object.values(H.sides)){
    const x=side.a[0]+side.dir[0]*side.len,
      y=side.a[1]+side.dir[1]*side.len;
    // Ignore fachadas orientadas para longe do observador.
    const vertices=[[side.a[0],side.a[1],0],[x,y,0],
      [x,y,H.h],[side.a[0],side.a[1],H.h]];
    surfaces.push({poly:vertices.map(p=>proj(...p)),
      depth:depthOf((side.a[0]+x)/2,(side.a[1]+y)/2)});
  }
  const roof=H.roofGeom||(H.roofGeom=buildRoofGeom(H));
  if(roof.flat){
    surfaces.push({poly:[[H.x0,H.y0,H.h],[H.x1,H.y0,H.h],
      [H.x1,H.y1,H.h],[H.x0,H.y1,H.h]].map(p=>proj(...p)),
      depth:depthOf((H.x0+H.x1)/2,(H.y0+H.y1)/2)});
  }else for(const face of roof.faces){
    surfaces.push({poly:face.p.map(p=>proj(...p)),
      depth:depthOf((H.x0+H.x1)/2,(H.y0+H.y1)/2)});
  }
  const depth=depthOf(cx,cy),z=actor.floorZ||0;
  let hidden=0,total=0;
  for(const h of [.16,.48,.82,1.15,1.48]){
    for(const shift of [-.13,0,.13]){
      const p=proj(cx+shift,cy,h+z);total++;
      if(surfaces.some(face=>face.depth>depth-.25&&
        insideScreenPoly(p.x,p.y,face.poly)))hidden++;
    }
  }
  return hidden/total;
}
function occluded(){
  let candidate=null,coverage=.80;
  for(const H of houses){
    if(H.inside)continue;
    if(player.x<H.x0-10||player.x>H.x1+10||
       player.y<H.y0-10||player.y>H.y1+10)continue;
    const amount=houseBodyCoverage(H,player);
    if(amount>=coverage){coverage=amount;candidate=H;}
  }
  return candidate;
}
// Flash do cano DEPOIS do sombreamento noturno. Luz efemera quente e
// pequenos raios acompanham exatamente a boca da arma em qualquer camera.
function drawMuzzleFlash(ctx,actor,night=false){
  if(!actor.J||!(actor.flash>0))return;
  const m=proj(...actor.J.rifle.muzzle);
  const tip=proj(...V.add(actor.J.rifle.muzzle,
    V.mul(V.norm(V.sub(actor.J.rifle.muzzle,actor.J.rifle.hg1)),.36)));
  const k=clamp(actor.flash/.11,0,1),size=cam.zoom;
  ctx.save();ctx.globalCompositeOperation='screen';
  const radius=size*(night?.74:.42);
  const glow=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,radius);
  glow.addColorStop(0,'rgba(255,246,205,'+(.54*k)+')');
  glow.addColorStop(.20,'rgba(255,216,131,'+(.32*k)+')');
  glow.addColorStop(1,'rgba(255,153,65,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(m.x,m.y,radius,0,TAU);ctx.fill();
  ctx.restore();
  ctx.save();ctx.globalAlpha=k;
  const vx=tip.x-m.x,vy=tip.y-m.y,vl=Math.hypot(vx,vy)||1,
    nx=-vy/vl,ny=vx/vl,dx=vx/vl,dy=vy/vl;
  const flame=[
    [m.x+nx*size*.065,m.y+ny*size*.065],
    [tip.x+dx*size*.22,tip.y+dy*size*.22],
    [m.x-nx*size*.065,m.y-ny*size*.065],
    [m.x+dx*size*.10,m.y+dy*size*.10]
  ];
  poly(ctx,flame,'#fff0ae',null);
  ctx.fillStyle='#fff8e1';ctx.beginPath();
  ctx.arc(m.x,m.y,Math.max(1,size*.045),0,TAU);ctx.fill();
  ctx.restore();
}
// Abertura macia de visao apenas sobre a superficie realmente oclusora.
// Replica a cena no pequeno circulo, sem desenhar paredes/telhado do
// obstaculo e SEM revelar mobilia interna a um jogador que esteja fora.
function drawPlayerVision(list,blocker,W,H){
  const point=proj(player.x,player.y,1.05+(player.floorZ||0));
  const radius=clamp(cam.zoom*1.33,42,83);
  const cx=point.x,cy=point.y+cam.zoom*.17;
  if(cx+radius<0||cy+radius<0||cx-radius>W||cy-radius>H)return;
  fg.setTransform(1,0,0,1,0,0);
  fg.globalCompositeOperation='source-over';fg.clearRect(0,0,W,H);
  fg.save();
  fg.beginPath();fg.arc(cx,cy,radius+3,0,TAU);fg.clip();
  drawGround(fg,W,H);
  for(const it of list){
    if(it.roof===blocker||it.wall?.house===blocker&&it.wall.ext)continue;
    if(it.upper===blocker)continue;
    if(it.actor||it.roof||it.wall||it.house||it.fence||it.lamp||it.prop||
       it.box||it.urbanLitter||it.urbanBin)it.draw(fg);
  }
  // O personagem permanece nas coordenadas reais. Iluminacao reduzida
  // cria leitura sem expor um interior que o jogador nao deveria ver.
  if(st.night){
    fg.fillStyle='rgba(9,16,25,.35)';fg.fillRect(cx-radius-2,cy-radius-2,
      radius*2+4,radius*2+4);
  }
  fg.restore();
  fg.globalCompositeOperation='destination-in';
  const edge=fg.createRadialGradient(cx,cy,radius*.38,cx,cy,radius);
  edge.addColorStop(0,'rgba(255,255,255,1)');
  edge.addColorStop(.62,'rgba(255,255,255,.92)');
  edge.addColorStop(.82,'rgba(255,255,255,.30)');
  edge.addColorStop(1,'rgba(255,255,255,0)');
  fg.fillStyle=edge;
  fg.beginPath();fg.arc(cx,cy,radius+.1,0,TAU);fg.fill();
  fg.globalCompositeOperation='source-over';
  g.drawImage(focusCanvas,0,0);
  // Nenhuma linha circular artificial: so a transicao suave.
}

function drawNight(W,H){
  const Z=cam.zoom;
  lg.setTransform(1,0,0,1,0,0);
  lg.globalCompositeOperation='source-over';
  lg.clearRect(0,0,W,H);
  lg.fillStyle='rgba(10,16,31,.78)';lg.fillRect(0,0,W,H);
  const radial=(ctx,x,y,r,k,flat=TILT,col='0,0,0')=>{
    ctx.save();ctx.translate(x,y);ctx.scale(1,flat);
    const gr=ctx.createRadialGradient(0,0,0,0,0,r);
    gr.addColorStop(0,'rgba('+col+','+k+')');
    gr.addColorStop(.54,'rgba('+col+','+(k*.68)+')');
    gr.addColorStop(1,'rgba('+col+',0)');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,r,0,TAU);
    ctx.fill();ctx.restore();
  };
  const visible=(x,y,r)=>{
    const p=proj(x,y,0);
    return p.x>-r*Z&&p.x<W+r*Z&&p.y>-r*Z&&p.y<H+r*Z;
  };
  const lamps=[];
  for(const l of world.lamps){
    const x=l.x+l.ax*1.1,y=l.y+l.ay*1.1,r=5.1;
    if(!visible(x,y,r))continue;
    lamps.push({l,x,y,r,polygon:lightVisibilityFor(l,x,y,r)});
  }
  // Janela acesa emite apenas pelo lado EXTERNO de sua fachada.
  // A luminaria interior so gera esse brilho se o interruptor estiver ligado.
  const windows=[];
  for(const home of houses){
    if(!home.lightOn)continue;
    for(const s of home.segs){
      if(!s.ext||!s.window||!s.side)continue;
      const x=(s.x1+s.x2)*.5+s.nx*.24,
        y=(s.y1+s.y2)*.5+s.ny*.24,r=2.05;
      if(!visible(x,y,r))continue;
      windows.push({x,y,r,s,nx:s.nx,ny:s.ny,
        polygon:exteriorLightCone(x,y,r,s.nx,s.ny,Math.PI*.30)});
    }
  }
  const porch=[];
  for(const home of houses){
    if(!home.wallLamp||!home.frontSide)continue;
    const sd=home.sides[home.frontSide],
      x=sd.a[0]+sd.dir[0]*home.wallLamp[0]+sd.n[0]*.30,
      y=sd.a[1]+sd.dir[1]*home.wallLamp[0]+sd.n[1]*.30,
      r=3.4;
    if(!visible(x,y,r))continue;
    porch.push({x,y,home,r,nx:sd.n[0],ny:sd.n[1],
      polygon:exteriorLightCone(x,y,r,sd.n[0],sd.n[1],Math.PI*.36)});
  }
  lg.globalCompositeOperation='destination-out';
  const carve=(x,y,r,k,polygon,z=0)=>{
    lg.save();if(polygon)clipLightPolygon(lg,polygon,z);
    const p=proj(x,y,z);radial(lg,p.x,p.y,r*Z,k);
    lg.restore();
  };
  // Luz de fachada em gota eliptica: centro projetado para fora
  // e bordas atenuadas ANTES do corte angular. Dois focos proximos
  // se misturam sem as facetas trapezoidais na grama/calçada.
  const directional=(ctx,source,intensity,col='0,0,0')=>{
    ctx.save();
    clipLightPolygon(ctx,source.polygon);
    const center=proj(source.x+source.nx*source.r*.36,
      source.y+source.ny*source.r*.36,0);
    ctx.translate(center.x,center.y);
    ctx.scale(1,TILT);
    const r=source.r*Z*.61;
    const grad=ctx.createRadialGradient(0,0,0,0,0,r);
    grad.addColorStop(0,'rgba('+col+','+intensity+')');
    grad.addColorStop(.38,'rgba('+col+','+(intensity*.56)+')');
    grad.addColorStop(.72,'rgba('+col+','+(intensity*.13)+')');
    grad.addColorStop(1,'rgba('+col+',0)');
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
    ctx.restore();
  };
  for(const l of lamps)carve(l.x,l.y,l.r,.985,l.polygon);
  for(const w of windows)directional(lg,w,.60);
  for(const w of porch)directional(lg,w,.88);
  // Luminarias internas iluminam cada comodo sem atravessar divisorias.
  // Interruptores F controlam a luz; o pavimento superior tem plano proprio.
  const indoor=[];
  for(const home of houses)if(home.inside&&home.lightOn)
    for(const fixture of home.indoorLights||[]){
      if(fixture.floor!==(player.floor||0))continue;
      indoor.push({...fixture,polygon:lightVisibilityPolygon(
        fixture.x,fixture.y,fixture.r,fixture.floor)});
    }
  for(const p of indoor)carve(p.x,p.y,p.r,.67,p.polygon,
    p.floor?STOREY_HEIGHT:0);
  // Projetores dinamicos so em veiculos com farois ligados:
  // o mesmo teste de oclusao protege fachadas e paredes.
  for(const b of vehicleSystem.cars){
    if(!b.headlights)continue;
    for(const spot of carLightSpots(b)){
      const r=4.5;
      if(!visible(spot.x,spot.y,r))continue;
      directional(lg,{...spot,r,polygon:exteriorLightCone(
        spot.x,spot.y,r,spot.nx,spot.ny,Math.PI*.28)},.81);
    }
  }
  carve(player.x,player.y,1.05,.25,
    lightVisibilityPolygon(player.x,player.y,1.05));
  lg.globalCompositeOperation='source-over';
  // Zera a luz projetada sobre fachada e telhado, reinstalando neles SOMENTE
  // o sombreado ambiente. O brilho fisico permanece no solo adjacente.
  protectBuildingSurfaces(lg,'rgba(10,16,31,.78)');
  g.drawImage(light,0,0);
  // Cor da luz: camada independente, tambem protegida pelas casas. Uma
  // radial quente nao pode ser sobreposta a geometria depois do mascaramento.
  gg.setTransform(1,0,0,1,0,0);
  gg.globalCompositeOperation='source-over';
  gg.clearRect(0,0,W,H);
  gg.globalCompositeOperation='lighter';
  const tint=(x,y,r,a,color,polygon,z=0)=>{
    gg.save();if(polygon)clipLightPolygon(gg,polygon,z);
    const p=proj(x,y,z);radial(gg,p.x,p.y,r*Z,a,TILT,color);
    gg.restore();
  };
  for(const l of lamps){
    // Tres camadas controladas de iluminacao quente: piscina principal
    // concentrada, rebatedor amplo e brilho suave na borda do pavimento.
    tint(l.x,l.y,l.r*.95,.27,'250,200,114',l.polygon);
    tint(l.x,l.y,l.r*.62,.18,'255,222,160',l.polygon);
    tint(l.x,l.y,l.r*1.12,.062,'244,187,106',l.polygon);
    // A emissao do bulbo sera desenhada depois da mascara das casas.
    // O raycast no CHAO desligava postes visiveis diante de edificios.
  }
  // Mesma mascara suave para a cor: fonte e sombra coincidem
  // espacialmente, sem cortes triangulares nos cones sobrepostos.
  gg.globalCompositeOperation='screen';
  for(const w of windows)directional(gg,w,.20,'239,183,103');
  for(const w of porch)directional(gg,w,.33,'255,207,129');
  gg.globalCompositeOperation='source-over';
  for(const p of indoor)tint(p.x,p.y,p.r*.74,.18,'249,211,150',
    p.polygon,p.floor?STOREY_HEIGHT:0);
  gg.globalCompositeOperation='source-over';
  protectBuildingSurfaces(gg);
  g.drawImage(glows,0,0);
  g.globalCompositeOperation='screen';
  for(const l of lamps){
    if(!lampHeadVisible(l.l))continue;
    const bulb=proj(l.x,l.y,4.03);
    // Emissivo no ponto real da luminaria, mesmo que o chao entre
    // jogador e poste esteja atras de uma parede de outra casa.
    radial(g,bulb.x,bulb.y,.46*Z,.35,1,'255,235,182');
    radial(g,bulb.x,bulb.y,.82*Z,.12,1,'247,196,111');
  }
  g.globalCompositeOperation='source-over';
}

// ---------- laço ----------
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05) * (window.__timeScale ?? 1); last = now;
  if (!window.__manual) tick(dt);   // __manual: a gravação avança o jogo quadro a quadro
  requestAnimationFrame(frame);
}
function tick(dt) {
  T += dt;
  st.clock += dt; hud.msgT -= dt;
  if (input.hit('q')) cam.tang += Math.PI / 2;
  if (input.hit('e')) cam.tang -= Math.PI / 2;
  if (input.hit('g')) location.search = '?seed=' + ((Math.random() * 1e6) | 0);
  if (input.hit('n')) { st.night = !st.night; world.night = st.night; st.clock = st.night ? 21 * 60 + 5 : 17 * 60 + 40; }
  // F prioriza o patamar; quando nao ha escada, usa portas, luzes e moveis.
  const interactPressed=input.hit('f');
  const carMessage=interactPressed?vehicleInteraction(player):null;
  if(carMessage){hud.msg=carMessage;hud.msgT=3;}
  const stairStarted=(!carMessage&&!vehicleSystem.driver)&&
    updateHouseStairs(player,dt,interactPressed);
  if(interactPressed&&!carMessage&&!stairStarted&&!vehicleSystem.driver&&
     useHouseInteraction(player,st,T)){
    hud.msg=st._interactionMessage||'Objeto utilizado';hud.msgT=2.0;
  }
  if(stairStarted&&player.stairTravel&&player.stairTravel.t===0){
    hud.msg=player.stairTravel.to===1?'Subindo as escadas':'Descendo as escadas';
    hud.msgT=1.8;
  }
  const accessoryMessage=vehicleAccessoryInteraction(player);
  if(accessoryMessage){hud.msg=accessoryMessage;hud.msgT=2.5;}
  vehicleVisualUpdate(dt);
  if(vehicleSystem.driver)vehicleUpdate(dt,player);
  updatePlayer(dt);
  ecosystemTick(dt,player,T);
  for (const n of npcs) updateNPC(n, dt);
  updateHouseOpenings(dt, actors, st.night);
  for (const a of actors) { a.clock = T; a.pose = animate(a, dt); a.J = solveSkeleton(a, a.pose); }
  for (const p of world.props) { if (p.hit > 0) p.hit = Math.max(0, p.hit - dt); if (p.wob > 0) p.wob = Math.max(0, p.wob - dt); }
  player.flash = Math.max(0, (player.flash || 0) - dt);
  spawnAmbientLeaves(dt);
  updateParts(dt);
  // câmera: segue o jogador e, ao mirar, avança na direção do mouse (como no Zomboid)
  let lx = 0, ly = 0;
  if (player.aimV > 0.3) {
    const a = unproj(input.mx / RS, input.my / RS, 0);
    lx = clamp((a[0] - player.x) * 0.25, -3, 3) * player.aimV; ly = clamp((a[1] - player.y) * 0.25, -3, 3) * player.aimV;
  }
  cam.tx = player.x + lx; cam.ty = player.y + ly;
  cam.update(dt);
  st.shake = Math.max(0, st.shake - dt);
  const sx = cam.x, sy = cam.y;
  if (st.shake > 0) { cam.x += rnd(-1, 1) * st.shake * 0.5; cam.y += rnd(-1, 1) * st.shake * 0.5; }
  render();
  cam.x = sx; cam.y = sy;
  drawHUD(h,hudC.width,hudC.height,st);
  vehicleDrivingHUD(h,hudC.width,hudC.height);
  // Dica discreta so quando ha objeto proximo. Nao cobre o campo de visao.
  const nearby=vehicleSystem.driver?'F — sair do carro':
    vehicleNear(player)?'F — entrar no '+carModel(vehicleNear(player)).name:null;
  const prompt=nearby||interactionPrompt(player);
  if(prompt&&!player.stairTravel){
    h.save();h.font='600 14px sans-serif';h.textAlign='center';
    const w=h.measureText(prompt).width+28,x=hudC.width/2-w/2,y=hudC.height-158;
    h.fillStyle='rgba(20,19,16,.84)';h.fillRect(x,y,w,29);
    h.strokeStyle='rgba(215,185,127,.54)';h.strokeRect(x+.5,y+.5,w-1,28);
    h.fillStyle='#f3dfb6';h.fillText(prompt,hudC.width/2,y+20);
    h.restore();
  }
  input.endFrame();
}
requestAnimationFrame(frame);
window.__game = { player, cam, st, world, houses };

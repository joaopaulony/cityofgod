// game.js — laço principal: jogador, tiro, recarga, partículas, câmera estilo Zomboid e render.
'use strict';

const view = document.getElementById('view'), g = view.getContext('2d');
const hudC = document.getElementById('hud'), h = hudC.getContext('2d');
const light = makeCanvas(1, 1), lg = light.getContext('2d');
const glows=makeCanvas(1,1),gg=glows.getContext('2d');
const buildingMask=makeCanvas(1,1),mg=buildingMask.getContext('2d');
const buildingShade=makeCanvas(1,1),sg=buildingShade.getContext('2d');
const focusCanvas=makeCanvas(1,1),fg=focusCanvas.getContext('2d');

if(typeof CityRealty!=='undefined')CityRealty.init();
buildWorld();
if(typeof remodelProperty==='function')for(const H of houses)remodelProperty(H);
for(const H of houses)if(H.architecture&&H.contains(...world.spawn)){world.spawn=[...H.front];break;}

const player = makeActor({ x: world.spawn[0], y: world.spawn[1], face: world.aimDir, pal: PAL.hero, ammo: 30, reserve: 90 });
ecosystemInit();
// Reset humano: nenhum NPC humano é instanciado. Reintroduziremos após o CAS novo.
const npcs = [];
const actors = [player, ...npcs];
const parts = [], tracers = [], bubbles = [];
const st = { player, npcs, hp: 0.92, food: 0.63, water: 0.48, clock: 17 * 60 + 40, night: false, shake: 0 };
CityLife.init(st);
CitySim.init(st);
window.CityExtras?.bonus?.();
let locCache=null,locNext=0;
window.CityDistrictsLocation=()=>{
  if(!world.open||typeof OW==='undefined'||!OW.geo||!COG.locationAt)return null;
  const now=performance.now();
  if(!locCache||now>=locNext){
    locCache=COG.locationAt(OW.geo,world.roads,player.x,player.y);
    locNext=now+1200;
  }
  return locCache;
};
let fireCD = 0, last = performance.now(), T = 0, dragX = null, dragY = null;
// Zoom progressivo: inclui plano próximo estilo simuladores de vida.
const ZOOMS = [20, 26, 32, 42, 52, 64, 80, 100, 125, 148, 176, 205].map(z => z * RENDER_SCALE);
let zi = 3; cam.tzoom = cam.zoom = ZOOMS[zi];
cam.x = cam.tx = player.x; cam.y = cam.ty = player.y;
// Ponte explícita entre o jogo isométrico e a cena WebGL de veículos.
// O GLB conserva sua malha/textura original; nenhuma conversão em sprites.
window.cityVehicleBridge={
  cam,player,world,houses,boxes,actors,buildRoofGeom,
  get urbanBins(){return urbanLife.bins;},get geo(){return typeof OW!=='undefined'&&world.open?OW.geo:null;},get urbanLitter(){return urbanLife.litter;},
  get terrainItems(){return terrain.items;},
  // objetos 3D (props-3d.mjs): tempo do jogo p/ os semáforos, vias p/ o meio-fio e onde ele se interrompe
  get gameTime(){return T;},trafficPhase,props3d,ROAD_W,
  get roads(){return world.roads;},
  curbBreak:(x,y,id)=>roadDist(x,y)<ROAD_W-.25||(world.curbCuts||[]).some(c=>Math.hypot(x-c.x,y-c.y)<c.r)||(world.open?CityStreetLayout.nearOtherRoad(x,y,id,{map:OW.roadHash,cell:OW.RC},ROAD_W+SIDE+.6):!!world.junction&&Math.hypot(x-world.junction.x,y-world.junction.y)<ROAD_W+SIDE+3.5),
  down:k=>!window.CityAdmin?.active&&input.down(k),hit:k=>!window.CityAdmin?.active&&input.hit(k),
  pondVal,roadDist,
  gasPumpNear:(x,y,r)=>typeof gasPumpNear==='function'?gasPumpNear(x,y,r):null,
  collide, addBox, drawParkedCar, onRoad:(x,y)=>!!world.open&&roadDist(x,y)<ROAD_W+SIDE,
  movePet:moveTo,petStairs:updateHouseStairs,
  releaseControls:()=>{input.keys.clear();input.pressed.clear();input.lmb=input.rmb=false;},
  driving:()=>!!window.cityVehicles?.driver,
  canPickSocial:()=>!wmap.open&&!window.CityHomeUI?.active&&!window.CityRealty?.dialogOpen&&!window.cityCharacterEditorOpen&&!window.CityPets?.uiOpen,
  get mapSize(){return MAP;}
};

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
  if(wmap.open){
    wmapPointer(e.clientX,e.clientY);
    if(wmap.drag){
      wmapDrag(e.clientX-wmap.drag[0],e.clientY-wmap.drag[1]);
      wmap.drag=[e.clientX,e.clientY];
    }
    return;
  }
  if (dragX !== null) {
    cam.tang += (e.clientX - dragX) * .008;
    cam.ttilt = clamp(cam.ttilt - (e.clientY - dragY) * .0025, .34, .84);
    dragX = e.clientX; dragY = e.clientY;
  }
});
view.addEventListener('mousedown', e => {
  if (window.CityUI?.blocksGameInput()) { e.preventDefault(); return; }
  if (wmap.open) { if (e.button === 0) {wmap.drag=[e.clientX,e.clientY];wmap.clickStart=[e.clientX,e.clientY];wmap.dragDistance=0;} e.preventDefault(); return; }   // mapa aberto: arrastar move o mapa, sem atirar
  if (e.button === 0) { input.lmb = true; player.wantShot = true; }
  if (e.button === 2) input.rmb = true;
  if (e.button === 1) { dragX = e.clientX; dragY = e.clientY; e.preventDefault(); }
});
addEventListener('mouseup', e => {
  if (e.button === 0 && wmap.open && wmap.clickStart && wmap.dragDistance<8 && Math.hypot(e.clientX-wmap.clickStart[0],e.clientY-wmap.clickStart[1])<8) window.CityGPS?.click?.(e.clientX,e.clientY);
  if (e.button === 0) {wmap.drag = null;wmap.clickStart=null;}
  if (e.button === 0) input.lmb = false;
  if (e.button === 2) input.rmb = false;
  if (e.button === 1) { dragX = null; dragY = null; } // persiste ângulo e inclinação
});
view.addEventListener('wheel', e => { if(window.CityUI?.blocksGameInput()) {e.preventDefault();return;} if (wmap.open) { wmapZoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.17 : 1/1.17); e.preventDefault(); return; } zi = clamp(zi + (e.deltaY > 0 ? -1 : 1), 0, ZOOMS.length - 1); cam.tzoom = ZOOMS[zi]; e.preventDefault(); }, { passive: false });

// ---------- chat ----------
const logEl = document.getElementById('log'), say = document.getElementById('say'), chatBox = document.getElementById('chat');
function chat(who, text) {
  const mins = Math.floor(st.clock) % 1440, t = `[${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}]`;
  const d = document.createElement('div'); d.innerHTML = `${t} <b></b> `; d.querySelector('b').textContent = who + ':'; d.append(text);
  logEl.append(d); while (logEl.children.length > 4) logEl.firstChild.remove();
}
for (const n of npcs) { n.x = n.home[0] + n.home[2] / 2; n.y = n.home[1] + n.home[3] / 2; }
if (world.arrival) { hud.msg = 'Bem-vindo! Você desembarcou no ' + world.arrival.airport; hud.msgT = 6; }
chat('Sistema', world.open ? `voo pousou — você desembarcou no ${world.spawnName}. Pegue um carro e vá para a cidade. (G abre um mapa de teste)` : `mundo ${MAP}×${MAP} m (4× a área) — semente ${world.seed}. G gera outro.`);
addEventListener('keydown', e => {
  if (document.activeElement === say && e.key === 'Escape') {
    e.preventDefault(); say.value = ''; say.blur(); return;
  }
  if (window.cityCharacterEditorOpen) return;
  if (window.CityUI?.blocksGameInput()) return;
  if (e.key !== 'Enter' || e.repeat) return;
  if (document.activeElement === say) {
    e.preventDefault();
    const t = say.value.trim(); say.value = ''; say.blur();
    if (t) { chat('Você', t); bubbles.push({ who: player, text: t, t: 4 }); }
  } else if ([document.body,document.documentElement,view].includes(document.activeElement)) {
    e.preventDefault();
    chatBox.classList.add('chat-typing'); say.focus(); input.keys.clear();input.pressed.clear();
  }
});
say.addEventListener('focus',()=>chatBox.classList.add('chat-typing'));
say.addEventListener('blur',()=>chatBox.classList.remove('chat-typing'));
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
  const R = J.rifle, m = window.cityCharacters?.muzzle(player)||R.muzzle, aim = unproj(input.mx / RS, input.my / RS, m[2]);
  let dx = aim[0] - m[0], dy = aim[1] - m[1];
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const spread = (1 - player.aimV) * 0.08 + (player.speed > 0.1 ? 0.03 : 0.008), a = Math.atan2(dy, dx) + rnd(-spread, spread);
  dx = Math.cos(a); dy = Math.sin(a);
  const hit = raycast(m[0], m[1], dx, dy, 45);
  const hz = Math.max(0.05, m[2] - hit.t * 0.012);
  tracers.push({ a: m, b: [hit.x, hit.y, hz], t: 0.09 });
  impact(hit, hz);
  player.ammo--; player.recoilT = 0; player.flash = 0.11; st.shake = 0.12;
  window.cityCharacters?.report?.('shot', player.x, player.y);   // tiros seguidos chamam a polícia
  // cápsula ejetada p/ a direita do fuzil
  const side = V.norm(V.cross([0, 0, 1], V.sub(R.muzzle, R.butt)));
  const e = R.recv1;
  emit({ x: e[0], y: e[1], z: e[2], vx: -side[0] * 2.2 + rnd(-0.4, 0.4), vy: -side[1] * 2.2 + rnd(-0.4, 0.4), vz: 2.4, life: 1.6, max: 1.6, kind: 'casing', col: '#d9b23a', bounce: 2 });
  emit({ x: m[0], y: m[1], z: m[2], vx: dx * 0.8, vy: dy * 0.8, vz: 0.3, life: 0.6, max: 0.6, kind: 'puff', g: -0.8, size: 0.14, col: '#cfcac0' });
}

// ---------- atualização ----------
function updatePlayer(dt) {
  const p = player;
  const traversing=window.cityCharacters?.move(dt);
  if(traversing){p.aiming=false;p.wantShot=false;p.running=false;return;}
  if(window.cityVehicles?.driver){
    p.speed=0;p.aiming=false;p.wantShot=false;p.running=false;
    p.aimHold=0;return;
  }
  let mx = 0, my = 0;
  if (input.down('w')) my--; if (input.down('s')) my++; if (input.down('a')) mx--; if (input.down('d')) mx++;
  p.aiming = input.rmb;
  p.running = input.down('shift') && !p.aiming && !p.crouching && st.needs.stamina > .025;
  const aimPt = unproj(input.mx / RS, input.my / RS, 1.4);
  let spd = 0;
  if ((mx || my) && !p.stairTravel) {
    const w = screenDirToWorld(mx, my), l = Math.hypot(w[0], w[1]);
    p.moveA = Math.atan2(w[1], w[0]);
    spd = p.aiming || p.aimHold > 0 ? 1.15 : p.running ? 3.7 : 1.75;
    if (st.water < .09 || st.food < .09 || st.needs.energy < .09) spd *= .68;
    if(p.crouching)spd=Math.min(spd,.75);
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
  if (p.armed && (input.lmb || p.wantShot) && p.reloadT < 0 && !p.jump) {
    p.aimHold = 1.3;
    if (p.ammo <= 0) { p.wantShot = false; if (fireCD <= 0) { hud.msg = p.reserve > 0 ? 'Sem munição — aperte R' : 'Sem munição'; hud.msgT = 1.6; fireCD = 0.4; } }
    else if (p.aimV > 0.82 && fireCD <= 0 && p.J && Math.abs(angDiff(p.face, Math.atan2(aimPt[1] - p.y, aimPt[0] - p.x))) < 0.25) { fire(p.J); fireCD = 0.12; p.wantShot = false; }
  }
  if (p.reloadT >= 0) p.wantShot = false;
  if (p.armed && input.hit('r') && p.reloadT < 0 && p.ammo < 30 && p.reserve <= 0) { hud.msg = 'Sem carregadores'; hud.msgT = 1.4; }
  if (p.armed && input.hit('r') && p.reloadT < 0 && p.ammo < 30 && p.reserve > 0) { p.reloadT = 0; hud.msg = 'Recarregando…'; hud.msgT = 1.2; }
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
    // fala de vez em quando, sem repetir a última frase; o chat local só registra quem está por perto
    if (Math.random() < 0.08 && Math.hypot(n.x - player.x, n.y - player.y) < 22) {
      let t; do t = npcLines[(Math.random() * npcLines.length) | 0]; while (t === n.lastLine && npcLines.length > 1);
      n.lastLine = t; chat(n.name, t); bubbles.push({ who: n, text: t, t: 3.5 });
    }
  }
  let spd = 0;
  if (n.goal) {
    const dx = n.goal[0] - n.x, dy = n.goal[1] - n.y, d = Math.hypot(dx, dy);
    if (d > 0.2) {
      n.moveA = Math.atan2(dy, dx); spd = n.population?.walkSpeed||1.3;
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
    if (p.type !== 'tree' || p.sp.kind === 'palm' || Math.abs(p.x-cam.x)>16 || Math.abs(p.y-cam.y)>16) continue;   // palmeira não solta folhas
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
  drawSnowGround(g,W,H);   // neve acumulada no chão (env.js)
  if(st.night)for(const lamp of world.lamps)drawLampBeam(g,lamp,T);

  const list = [], margin = 6 * s;
  for (const p of (world.propsInView ? world.propsInView(W, H) : world.props)) {
    const b = proj(p.x, p.y, 0);
    if (b.x < -margin || b.x > W + margin || b.y < -margin * 0.3 || b.y > H + margin * 1.2) continue;
    list.push({ d: b.d + (p.flat ? -0.3 : 0), draw: ctx => drawProp(ctx,p,T,player),prop:p });
  }
  ecosystemAddDrawables(list, g, T, player);
  houseDrawables(list,player.x,player.y);
  urbanDrawables(list,g);
  for (const l of globalThis.VEG3D?[]:world.lamps) {   // postes em 3D (props-3d.mjs)
    const pos = proj(l.x,l.y,0),padding=cam.zoom*5;
    if(pos.x < -padding || pos.x > W+padding ||
       pos.y < -padding || pos.y > H+padding) continue;
    list.push({ d: depthOf(l.x, l.y), draw: ctx => drawLamp(ctx,l,st.night),lamp:l });
  }
  // Semaforos gerados junto ao cruzamento principal. Usar a mesma
  // ordenacao de profundidade que postes, casas e personagens.
  for(const signal of globalThis.VEG3D?[]:world.trafficSignals||[]){   // semáforos em 3D
    const pos=proj(signal.x,signal.y,0),padding=cam.zoom*6;
    if(pos.x<-padding||pos.x>W+padding||
       pos.y<-padding||pos.y>H+padding)continue;
    list.push({d:depthOf(signal.x,signal.y),
      draw:ctx=>drawTrafficSignal(ctx,signal,T,st.night),
      trafficSignal:signal});
  }
  for (const a of actors) {
    // No models/sprites/ghosts until the next human asset direction is approved.
    if(window.CITY_HIDE_HUMANS)continue;
    if(a===player&&window.cityVehicles?.driver)continue;
    const upper=houses.find(H=>H.upper&&H.inside&&a.floorZ>.15&&
      a.x>H.x0&&a.x<H.x1&&a.y>H.y0&&a.y<H.y1);
    const above=upper?Math.max(...[[upper.x0,upper.y0],[upper.x1,upper.y1]]
      .map(p=>depthOf(p[0],p[1])))+4:depthOf(a.x,a.y)+.05;
    list.push({d:above,draw:ctx=>{
      ctx.save();
      if(a.floorZ)ctx.translate(0,-a.floorZ*cam.zoom*HZ);
      if(!window.cityCharacters?.has(a))drawActor(ctx,a,a.J,a.pal);
      else{
        const shadow=proj(a.x,a.y,0);
        ctx.fillStyle='rgba(15,20,8,0.25)';ctx.beginPath();
        ctx.ellipse(shadow.x,shadow.y,.25*cam.zoom,.12*cam.zoom,0,0,TAU);ctx.fill();
      }
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
  drawSkyTint(g,W,H);   // dourado do fim de tarde, lilás do crepúsculo, nuvens
  if (ENV.dark > 0.02) drawNight(W,H);   // escurece aos poucos com o pôr do sol
  const blocker=occluded();
  window.cityVehicleBridge.visionBlocker=window.cityVehicles?.driver||window.cityCharacters?.has(player)?blocker:null;
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
  if(H.inside||(H.contains?H.contains(actor.x,actor.y):
    actor.x>H.x0-.15&&actor.x<H.x1+.15&&actor.y>H.y0-.15&&actor.y<H.y1+.15))return 0;
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
    surfaces.push({poly:(H.corners||[[H.x0,H.y0],[H.x1,H.y0],
      [H.x1,H.y1],[H.x0,H.y1]]).map(p=>proj(p[0],p[1],H.h)),
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
  const v=window.cityVehicles;
  const target=v?.driver?{x:v.car.x,y:v.car.y,floorZ:0}:player;
  let candidate=null,coverage=.80;
  for(const H of houses){
    if(H.inside||H.architecture)continue;
    if(target.x<H.x0-10||target.x>H.x1+10||
       target.y<H.y0-10||target.y>H.y1+10)continue;
    const amount=houseBodyCoverage(H,target);
    if(amount>=coverage){coverage=amount;candidate=H;}
  }
  return candidate;
}
// Flash do cano DEPOIS do sombreamento noturno. Luz efemera quente e
// pequenos raios acompanham exatamente a boca da arma em qualquer camera.
function drawMuzzleFlash(ctx,actor,night=false){
  if(!actor.J||!(actor.flash>0))return;
  const liveMuzzle=window.cityCharacters?.muzzle(actor),origin=liveMuzzle||actor.J.rifle.muzzle;
  const m=proj(...origin);
  const forward=liveMuzzle?[Math.cos(actor.face),Math.sin(actor.face),0]:V.norm(V.sub(origin,actor.J.rifle.hg1));
  const tip=proj(...V.add(origin,V.mul(forward,.36)));
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
  const vehicle=window.cityVehicles;
  const driving=!!vehicle?.driver;
  const point=driving?proj(vehicle.car.x,vehicle.car.y,1.05):proj(player.x,player.y,1.05+(player.floorZ||0));
  const radius=Math.min(W,H)*.85/2;
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
  const NA='rgba(10,16,31,'+(.78*ENV.dark).toFixed(3)+')';
  lg.fillStyle=NA;lg.fillRect(0,0,W,H);
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
  for(const l of st.night?world.lamps:[]){
    const x=l.x+l.ax*1.1,y=l.y+l.ay*1.1,r=5.1;
    if(!visible(x,y,r))continue;
    lamps.push({l,x,y,r,polygon:lightVisibilityFor(l,x,y,r)});
  }
  // Janela acesa emite apenas pelo lado EXTERNO de sua fachada.
  // A luminaria interior so gera esse brilho se o interruptor estiver ligado.
  const windows=[];
  for(const home of houses){
    if(!home.lightOn||!st.night)continue;
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
    if(!home.wallLamp||!home.frontSide||!st.night)continue;
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
  // postos de gasolina (parking.js): o pátio sob a cobertura e a frente da loja ficam claros como de dia
  const gasLights=[];
  if(st.night)for(const s of world.gasStations||[]){
    for(const is of s.islands){const x=s.ox+s.qx*is.u,y=s.oy+s.qy*(is.v0+is.v1)/2;if(visible(x,y,10))gasLights.push({x,y,r:9});}
    const x=s.ox+s.qx*(s.store.u0+s.store.u1)/2,y=s.oy+s.qy*(s.store.v0-2.5);if(visible(x,y,10))gasLights.push({x,y,r:8});
  }
  for(const l of gasLights)carve(l.x,l.y,l.r,.99,null);
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
  carve(player.x,player.y,1.05,.25,
    lightVisibilityPolygon(player.x,player.y,1.05));
  lg.globalCompositeOperation='source-over';
  // Zera a luz projetada sobre fachada e telhado, reinstalando neles SOMENTE
  // o sombreado ambiente. O brilho fisico permanece no solo adjacente.
  protectBuildingSurfaces(lg,NA);
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
  for(const l of gasLights){tint(l.x,l.y,l.r,.15,'226,236,255');tint(l.x,l.y,l.r*.55,.1,'245,248,255');}
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
  if (!window.__manual) {   // __manual: a gravação avança o jogo quadro a quadro
    const t0 = performance.now(); terrain.workMs = 0;
    tick(dt);
    // custo do quadro sem a pintura do chão define quanto tempo o chão pode usar no próximo
    const cost = performance.now() - t0 - terrain.workMs;
    const driving=!!window.cityVehicles?.driver;
    terrain.driving=driving;
    terrain.budget = clamp(14 - cost, driving?1:1.5, driving?4:7);
    // mundo grande: gera/descarrega setores em volta do jogador (ou do carro) com orçamento próprio
    // à frente do movimento (~3 s), p/ o carro não chegar antes do setor
    const lead = terrain.vel || [0, 0];
    if(!window.CityFront?.blocked||window.CityFront?.loading){
      if (world.streamTick) world.streamTick(player.x + lead[0] * 3, player.y + lead[1] * 3, clamp(15 - cost - terrain.workMs, driving?.75:2.5, driving?4:6));
      if (cost + terrain.workMs < 12) warmIdle();
    }
  }
  requestAnimationFrame(frame);
}
function tick(dt) {
  if(window.cityCharacters?.socialInputBlocked){input.keys.clear();input.pressed.clear();input.lmb=input.rmb=false;player.wantShot=false;player.aiming=false;}
  if(window.CityFront?.blocked){
    if(window.CityFront.loading){
      for(const a of actors)if(!a.J){a.clock=T;a.pose=animate(a,0);a.J=solveSkeleton(a,a.pose);}
      window.cityCharacters?.update(0);cam.update(dt);render();window.cityVehicles?.render();h.clearRect(0,0,hudC.width,hudC.height);window.CityFront.markFrame();
    }
    input.keys.clear();input.pressed.clear();input.lmb=input.rmb=false;input.endFrame();return;
  }
  if(window.cityCharacterEditorOpen||window.CityPets?.uiOpen){input.keys.clear();input.lmb=input.rmb=false;input.endFrame();return;}
  // Build/Buy mode: freeze character, physics and game clock while showing the live interior.
  if(window.CityHomeUI?.active){
    cam.update(dt);
    render();
    window.cityVehicles?.render();
    h.clearRect(0,0,hudC.width,hudC.height);
    window.CityHomeUI.draw(h);
    input.keys.clear();input.pressed.clear();input.lmb=false;input.rmb=false;input.endFrame();
    return;
  }
  if(window.CityRealty?.dialogOpen){
    cam.update(dt);render();window.cityVehicles?.render();
    h.clearRect(0,0,hudC.width,hudC.height);
    input.keys.clear();input.pressed.clear();input.lmb=false;input.rmb=false;input.endFrame();
    return;
  }
  // Pause gameplay while the full map owns the mouse and keyboard.
  if(wmap.open){
    if(input.hit('m')||input.hit('escape'))wmapToggle();
    if(wmap.open){
      h.clearRect(0,0,hudC.width,hudC.height);
      drawWorldMap(h,hudC.width,hudC.height,st);
      input.endFrame();return;
    }
  }
  T += dt;
  st.clock += dt; hud.msgT -= dt;window.CityUI?.syncClock?.(st.clock);
  // sol, lua, claridade e clima seguem o relógio (env.js); a noite deixa de ser só a tecla N
  envTick(dt, st.clock);
  if (st.night !== ENV.night) st.night = world.night = ENV.night;
  // câmera livre: segurar Q/E gira em qualquer ângulo (sem travar de 90 em 90°)
  const spin = (input.down('q') ? 1 : 0) - (input.down('e') ? 1 : 0);
  if (spin) cam.tang += spin * 1.6 * dt;   // ~90°/s; cam.update suaviza a chegada ao soltar
  const pitch = (input.down('pageup') ? 1 : 0) - (input.down('pagedown') ? 1 : 0);
  if (pitch) cam.ttilt = clamp(cam.ttilt + pitch * .5 * dt, .34, .84);
  if (input.hit('g')) location.search = '?seed=' + ((Math.random() * 1e6) | 0);
  if (input.hit('m') || (wmap.open && input.hit('escape'))) wmapToggle();
  // N pula p/ a manhã ou p/ a noite; K troca o clima (calmo, brisa, ventania, neve)
  if (input.hit('n')) { st.clock = ENV.night ? 7 * 60 : 21 * 60 + 5; envTick(0, st.clock); st.night = world.night = ENV.night; }
  if (input.hit('k')) { envSetWeather(ENV.weather + 1); hud.msg = 'Clima: ' + envWeather().name; hud.msgT = 2; }
  // Veiculo tem prioridade ao entrar/sair; casas preservam F fora dele.
  const interactPressed=input.hit('f');
  const nearbyHouse=findHouseInteraction(player);
  const nearbyStair=houseStairProximity(player);
  const houseDistance=nearbyHouse?Math.hypot(nearbyHouse.obj.x-player.x,nearbyHouse.obj.y-player.y):Infinity;
  const firstHouseAction=nearbyStair&&nearbyStair.distance+.12<houseDistance?'stair':nearbyHouse?'object':nearbyStair?'stair':null;
  const houseAction=interactPressed&&input.down('shift')&&nearbyStair&&nearbyHouse
    ?(firstHouseAction==='stair'?'object':'stair'):firstHouseAction;
  const vehicleMessage=interactPressed?window.cityVehicles?.interact():false;
  if(vehicleMessage){hud.msg=vehicleMessage;hud.msgT=3;}
  const garageUsed=interactPressed&&!vehicleMessage&&!window.cityVehicles?.driver&&window.CityGarage?.use(player);
  if(garageUsed){hud.msg=garageUsed;hud.msgT=2.8;}
  const realtyOpened=interactPressed&&!vehicleMessage&&!garageUsed&&!window.cityVehicles?.driver&&window.CityRealty?.onInteract(player);
  const stairStarted=!vehicleMessage&&!garageUsed&&!realtyOpened&&updateHouseStairs(player,dt,interactPressed&&houseAction==='stair');
  if(interactPressed&&!vehicleMessage&&!garageUsed&&!realtyOpened&&!stairStarted&&houseAction==='object'&&useHouseInteraction(player,st,T)){
    hud.msg=st._interactionMessage||'Objeto utilizado';hud.msgT=2.0;
  }
  if(stairStarted&&player.stairTravel&&player.stairTravel.t===0){
    hud.msg=player.stairTravel.to===1?'Subindo as escadas':'Descendo as escadas';
    hud.msgT=1.8;
  }
  window.cityVehicles?.update(dt);
  // Indoor A* guide owns movement only while an autonomous domestic action
  // is running. Any manual movement key cancels it immediately.
  const manualHomeInput=['w','a','s','d','shift'].some(k=>input.down(k))||input.rmb;
  const guided=window.CityHomeRoutine?.tick(dt,player,(x,y)=>
    moveTo(player.x,player.y,x,y,.28,player.floor||0),manualHomeInput);
  if(!guided)updatePlayer(dt);
  window.CityHome?.tick(player);
  window.CityHomeUI?.tick();
  window.CityGPS?.tick(player);
  CityLife.tick(dt,player);
  CitySim.tick();
  ecosystemTick(dt,player,T);
  for(const n of npcs){
    const visiting=window.CityHomeVisitors?.tick(dt,n,(x,y,nx,ny)=>moveTo(x,y,nx,ny,.28,n.floor||0));
    if(!visiting)updateNPC(n,dt);
  }
  window.CityPets?.tick(dt);
  const petActors=window.CityPets?.actors||[];
  updateHouseOpenings(dt,petActors.length?[...actors,...petActors]:actors,st.night);
  for (const a of actors) { a.clock = T; a.pose = animate(a, dt); a.J = solveSkeleton(a, a.pose); }
  window.cityCharacters?.update(dt);
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
  if(!window.cityVehicles?.driver){
    // Centra tronco e rosto em zoom alto, em vez de colocar os pés no meio da tela.
    const floorFocus=((player.floorZ||0)+.85)*HZ/TILT;
    cam.tx = player.x + lx-Math.sin(cam.ang)*floorFocus;cam.ty=player.y+ly-Math.cos(cam.ang)*floorFocus;
    if(window.cityPropertyReviewFocus){cam.tx=window.cityPropertyReviewFocus.x;cam.ty=window.cityPropertyReviewFocus.y;}
  }
  cam.update(dt);
  st.shake = Math.max(0, st.shake - dt);
  const sx = cam.x, sy = cam.y;
  if (st.shake > 0) { cam.x += rnd(-1, 1) * st.shake * 0.5; cam.y += rnd(-1, 1) * st.shake * 0.5; }
  render();
  window.cityVehicles?.render();
  window.CityCamera?.afterRender?.(view,document.getElementById('vehicle3d'));
  window.CityDriving?.install?.();
  cam.x = sx; cam.y = sy;
  drawHUD(h,hudC.width,hudC.height,st);
  window.CityHomeRoutine?.draw?.(h,hudC.width,hudC.height);
  // O painel 3D precisa de alinhamento proprio; a HUD usa textAlign=right.
  h.save();h.textAlign='left';h.textBaseline='alphabetic';
  window.cityVehicles?.drawHUD(h,hudC.width,hudC.height);
  h.restore();
  if (wmap.open) { drawWorldMap(h, hudC.width, hudC.height, st); input.endFrame(); return; }
  // Ações próximas aparecem junto aos atalhos, acima do minimapa.
  const primaryHousePrompt=firstHouseAction==='stair'?nearbyStair?.label:interactionPrompt(player);
  const secondaryHousePrompt=nearbyHouse&&nearbyStair?(firstHouseAction==='stair'?interactionPrompt(player):nearbyStair.label):'';
  const otherPrompt=window.cityVehicles?.prompt()||window.CityGarage?.prompt(player)||window.CityRealty?.prompt(player);
  const prompt=otherPrompt||
    (primaryHousePrompt?'F · '+primaryHousePrompt.replace(/^F\s*·\s*/,''):'');
  if(prompt&&!player.stairTravel){
    const alternate=!otherPrompt&&secondaryHousePrompt?'Shift+F · '+secondaryHousePrompt.replace(/^F\s*·\s*/,''):'';
    const {mx,my,compact}=hudMapLayout(hudC.width,hudC.height);
    const entry=document.getElementById('city-home-entry');
    const hasHomeEntry=entry&&!entry.hidden&&!document.body.classList.contains('city-home-open');
    const maxWidth=Math.min(hudC.width-mx-12,compact?hudC.width-mx-12:460);
    const y=Math.max(38,my-(hasHomeEntry?(alternate?103:88):(alternate?70:55)));
    drawHudHeadline(h,prompt,mx,y,compact?16:18,maxWidth);
    if(alternate)drawHudHeadline(h,alternate,mx,y+22,compact?14:16,maxWidth);
  }
  input.endFrame();
}
// Pré-pinta as texturas das casas (paredes e telhados) antes de aparecerem na tela, uma peça por
// quadro com folga. Cada casa inteira custa ~20–60 ms; sem isto o jogo trava ao andar pela cidade.
const warmCtx = makeCanvas(1, 1).getContext('2d');
function warmRoof(H) {
  H._warm = true;
  try { drawRoofInner(warmCtx, H); } catch (e) { console.warn('warmRoof', e); }
}
function warmIdle() {
  let best = null, bd = 1e9;
  for (const H of houses) if (!H._warm) { const d = Math.hypot((H.x0 + H.x1) / 2 - player.x, (H.y0 + H.y1) / 2 - player.y); if (d < bd) { bd = d; best = H; } }
  if (!best) return;
  try {
    if (!houseTexStep(best)) return;                              // uma fachada por quadro
    if (typeof warmRoofStep === 'function' && !warmRoofStep(best)) return;   // uma água do telhado por quadro
  } catch (e) { console.warn('warmHouse', e); best._warm = true; return; }
  warmRoof(best);   // detalhes restantes (rápido: as texturas já existem)
}
for (const H of houses) if (!H.architecture&&Math.hypot((H.x0 + H.x1) / 2 - player.x, (H.y0 + H.y1) / 2 - player.y) < 45) { houseTex(H); warmRoof(H); }
requestAnimationFrame(frame);
window.__game = { player, cam, st, world, houses };
CityUI.mount();
window.CityHomeUI?.mount();
window.CityFront?.attachGame({
  release:()=>{input.keys.clear();input.pressed.clear();input.lmb=input.rmb=false;player.wantShot=false;player.aiming=false;player.aimHold=0;},
  mapOpen:()=>wmap.open,openMap:()=>{if(!wmap.open)wmapToggle();},
  save:()=>{CityLife.save();CitySim.save();window.CityPets?.controller.save();},
  capture:()=>player.stairTravel?null:{version:1,mode:world.open?'open':'local',seed:world.seed??SEED,x:player.x,y:player.y,floor:player.floor||0,clock:st.clock,at:Date.now(),vehicle:window.cityVehicles?.captureCheckpoint?.()},
  restore:async save=>{
    if(save.x<.5||save.y<.5||save.x>MAP-.5||save.y>MAP-.5)return false;
    // Generate the destination before testing collisions or looking up its house.
    Object.assign(player,{x:save.x,y:save.y});Object.assign(cam,{x:save.x,tx:save.x,y:save.y,ty:save.y});
    await world.prepareResume?.(save.x,save.y);
    const home=houses.find(H=>H.contains?.(save.x,save.y,save.floor));
    const floor=save.floor>0&&home?save.floor:0,q=collide(save.x,save.y,.28,floor);
    if(!save.vehicle&&(Math.hypot(q[0]-save.x,q[1]-save.y)>.6||floor===0&&pondVal(q[0],q[1])<=1.02&&roadDist(q[0],q[1])>ROAD_W+SIDE))return false;
    if(save.vehicle){q[0]=save.x;q[1]=save.y;}
    Object.assign(player,{x:q[0],y:q[1],floor,floorZ:floor*(home?.floorHeight||3),stairTravel:null,jump:null,traversal:null,actionZ:0,speed:0});
    st.clock=save.clock;envTick(0,st.clock);Object.assign(cam,{x:player.x,tx:player.x,y:player.y,ty:player.y});return true;
  }
});

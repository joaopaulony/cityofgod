// skeleton.js — esqueleto 3D invisível: IK de 2 ossos (braços/pernas), poses-chave e animação.
// Espaço do corpo: x = frente, y = esquerda, z = cima, origem no chão entre os pés.
'use strict';

const BODY = {
  hipZ: 0.93, hipW: 0.1, thigh: 0.46, shin: 0.45, ankle: 0.08, foot: 0.17,
  shZ: 1.42, shW: 0.19, upper: 0.29, fore: 0.28, neckZ: 1.5, headZ: 1.63, headR: 0.135,
};

// IK analítico de 2 ossos com vetor de polo (decide p/ onde dobra joelho/cotovelo)
function ik2(A, T, l1, l2, pole) {
  let D = V.sub(T, A), d = V.len(D);
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const dir = V.norm(D);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let pn = V.sub(pole, V.mul(dir, V.dot(pole, dir)));
  pn = V.norm(pn);
  return { mid: V.add(V.add(A, V.mul(dir, a)), V.mul(pn, h)), end: V.add(A, V.mul(dir, d)) };
}

// ---------- poses-chave ----------
const POSE0 = { bx: 0, by: 0, bz: 0, yaw: 0, pitch: 0, lean: 0, twist: 0, crouch: 0, headPitch: 0,
  lhHG: 1, lhMag: 0, lhPouch: 0, lhCh: 0, lhDown: 0, lhBack: 0 };
const P = (o) => Object.assign({}, POSE0, o);
const POSES = {
  low:  P({ bx: 0.08, by: -0.15, bz: 1.2, yaw: 0.62, pitch: -0.5, lean: 0.03, twist: 0.18, headPitch: 0.06 }),
  aim:  P({ bx: 0.04, by: -0.11, bz: 1.46, yaw: 0.02, pitch: 0.0, lean: 0.08, twist: -0.12, crouch: 0.0, headPitch: 0.2 }),
  run:  P({ bx: 0.14, by: -0.12, bz: 1.22, yaw: 0.95, pitch: 0.55, lean: 0.2, twist: 0.25, headPitch: -0.05 }),
  rel:  P({ bx: 0.15, by: -0.08, bz: 1.22, yaw: 0.62, pitch: 0.42, lean: 0.12, twist: 0.22, headPitch: 0.42, crouch: 0.03 }),
};
const KEYS_ = Object.keys(POSE0);
function blendPose(a, b, t) { const o = {}; for (const k of KEYS_) o[k] = a[k] + (b[k] - a[k]) * t; return o; }
function addPose(a, d, w = 1) { const o = Object.assign({}, a); for (const k in d) o[k] += d[k] * w; return o; }

// easeInOutBack: o "mergulho" inicial é a antecipação, o passar do ponto é a recuperação
function backEase(x, s = 1.1) {
  const c2 = s * 1.525;
  return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
                 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

// recuo do tiro (aditivo): coice -> volta passando do ponto -> assenta
const RECOIL = [
  [0, {}], [0.045, { bx: -0.075, pitch: 0.24, lean: -0.07, headPitch: -0.1, bz: 0.025, twist: 0.05 }],
  [0.15, { bx: 0.014, pitch: -0.035, lean: 0.01 }], [0.26, {}],
];
// recarga: chaves absolutas sobre a pose "rel"; eventos disparam no tempo exato
const RELOAD = {
  dur: 2.5,
  keys: [
    [0.0, {}], [0.3, {}],
    [0.42, { lhHG: 0, lhMag: 1 }],
    [0.52, { lhHG: 0, lhMag: 1, lhDown: 0.02 }],
    [0.68, { lhHG: 0, lhMag: 1, lhDown: 0.22, pitch: 0.24 }],
    [0.98, { lhHG: 0, lhPouch: 1, twist: 0.3 }],
    [1.12, { lhHG: 0, lhPouch: 1, lhDown: 0.04, twist: 0.3 }],
    [1.4, { lhHG: 0, lhMag: 1, lhDown: 0.17 }],
    [1.55, { lhHG: 0, lhMag: 1, lhDown: 0.0 }],
    [1.62, { lhHG: 0, lhMag: 1, lhDown: -0.035, pitch: 0.26, bz: 0.015 }],
    [1.82, { lhHG: 0, lhCh: 1, headPitch: 0.3 }],
    [1.95, { lhHG: 0, lhCh: 1, lhBack: 0.1, bx: -0.02 }],
    [2.02, { lhHG: 0, lhCh: 1, lhBack: 0, bx: 0.01 }],
    [2.28, {}], [2.5, {}],
  ],
};
function sampleKeys(keys, t, base, additive) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, a] = keys[i], [t1, b] = keys[i + 1];
  const u = smooth(clamp((t - t0) / (t1 - t0), 0, 1));
  if (additive) { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = lerp(a[k] || 0, b[k] || 0, u); return addPose(base, o); }
  const pa = Object.assign({}, base, a), pb = Object.assign({}, base, b);
  return blendPose(pa, pb, u);
}

// ---------- personagem animado ----------
function makeActor(o) {
  return Object.assign({
    x: 20, y: 10, face: 0, moveA: 0, speed: 0, phase: 0, walkW: 0, runW: 0,
    aimV: 0, aimHold: 0, recoilT: 9, reloadT: -1, magState: 'in', armed: true,
    ammo: 30, reserve: 90, events: [],
  }, o);
}

// avança relógios da animação e devolve a pose final do quadro
function animate(a, dt) {
  const wantAim = a.armed && (a.aiming || a.aimHold > 0) && a.reloadT < 0;
  a.aimV = clamp(a.aimV + (wantAim ? 1 : -1) * dt * (wantAim ? 5.5 : 3), 0, 1);
  const aimE = backEase(a.aimV, wantAim ? 1.1 : 0.7);
  const tgtRun = a.running && !wantAim ? 1 : 0;
  a.runW = lerp(a.runW, tgtRun, 1 - Math.exp(-dt * 8));
  a.walkW = lerp(a.walkW, a.speed > 0.1 ? 1 : 0, 1 - Math.exp(-dt * 10));
  a.aimHold = Math.max(0, a.aimHold - dt);

  let p = blendPose(POSES.low, POSES.run, a.runW);
  p = blendPose(p, POSES.aim, aimE);
  // respiração no parado
  const br = Math.sin(a.clock * 2.2) * (1 - a.walkW);
  p.bz += br * 0.008; p.lean += br * 0.01;
  // caminhada: tronco gira contra as pernas e inclina p/ frente
  p.twist += Math.sin(a.phase * TAU) * 0.12 * a.walkW * (1 - aimE * 0.7);
  p.lean += 0.05 * a.walkW;
  // tiro: recuo aditivo
  a.recoilT += dt;
  if (a.recoilT < 0.26) p = sampleKeys(RECOIL, a.recoilT, p, true);
  // recarga com entrada/saída suaves
  if (a.reloadT >= 0) {
    const prev = a.reloadT;
    a.reloadT += dt;
    for (const [t, name] of [[0.52, 'magOut'], [0.68, 'magDrop'], [1.08, 'magNew'], [1.55, 'magIn'], [1.95, 'charge'], [2.02, 'ready']])
      if (prev < t && a.reloadT >= t) a.events.push(name);
    const w = backEase(clamp(Math.min(a.reloadT / 0.3, (RELOAD.dur - a.reloadT) / 0.3), 0, 1), 0.8);
    const rp = sampleKeys(RELOAD.keys, a.reloadT, POSES.rel, false);
    p = blendPose(p, rp, w);
    if (a.reloadT >= RELOAD.dur) a.reloadT = -1;
  }
  // Domestic activity animation uses the same procedural skeleton and IK.
  // The player can walk away: actions naturally terminate after their duration.
  if(a.homeAction){
    const state=a.homeAction;
    // CityHomeRoutine owns elapsed time; advancing here as well doubled
    // the playback speed and cut the recovery pose short.
    state.t=Math.max(0,state.t||0);
    const seated=['sit','watch','work'].includes(state.kind),sleep=state.kind==='sleep';
    const pose=P({crouch:sleep?.68:seated?.52:.12,
      lean:sleep?.57:seated?.09:.17,bz:sleep?.75:seated?.98:1.28,
      bx:.10,by:-.1,pitch:sleep?-.25:0,
      twist:Math.sin(state.t*(seated?1.4:4))*(seated?.035:.18),
      headPitch:sleep?.36:seated?.09:.17,lhHG:0});
    const blend=Math.min(1,state.t/.35,(state.duration-state.t)/.45);
    p=blendPose(p,pose,Math.max(0,blend));
    if(state.t>=state.duration)a.homeAction=null;
  }
  if (!a.armed) p = Object.assign({}, p, { lhHG: 0 });
  if(a.crouching){p.crouch+=.34;p.lean+=.1;p.bz-=.24;}
  if(a.traversal){const w=Math.sin(Math.PI*a.traversal.t/a.traversal.duration);p.lean+=.3*w;p.crouch+=.1*w;}
  return p;
}

// rifle: pontos ao longo do eixo (distância, alto, lado) a partir da coronha
function rifleFrame(p) {
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  const f = [cp * cy, cp * sy, sp];
  const up = V.norm(V.sub([0, 0, 1], V.mul(f, sp)));
  const side = V.cross(up, f);
  const butt = [p.bx, p.by, p.bz];
  return { f, up, side, at: (d, u = 0, s = 0) => V.add(V.add(V.add(butt, V.mul(f, d)), V.mul(up, u)), V.mul(side, s)) };
}

// monta todas as juntas em espaço do mundo
function solveSkeleton(a, p) {
  const B = BODY, cf = Math.cos(a.face), sf = Math.sin(a.face);
  const crouch = p.crouch;
  // locomoção: ciclo de passos (apoio linear + balanço com elevação)
  const L = lerp(1.45, 2.5, a.runW), lift = lerp(0.17, 0.28, a.runW);
  const mv = angDiff(a.face, a.moveA), mdx = Math.cos(mv), mdy = Math.sin(mv);
  const bob = a.walkW * (lerp(0.035, 0.06, a.runW) * Math.cos(a.phase * TAU * 2) - 0.01);
  const pelvisZ = B.hipZ - crouch - bob - a.runW * 0.05;
  const toW = q => [a.x + q[0] * cf - q[1] * sf, a.y + q[0] * sf + q[1] * cf, q[2]];

  // tronco: inclinação + torção em volta da pelve
  const piv = [0, 0, pelvisZ];
  const ct = Math.cos(p.twist), st = Math.sin(p.twist), cl = Math.cos(p.lean), sl = Math.sin(p.lean);
  const sway = a.walkW * Math.sin(a.phase * TAU) * 0.03;
  const up = q => {
    let x = q[0], y = q[1], z = q[2] - piv[2];
    [x, y] = [x * ct - y * st, x * st + y * ct];
    [x, z] = [x * cl + z * sl, -x * sl + z * cl];
    return toW([x, y + sway, z + piv[2]]);
  };
  const J = {};
  J.pelvis = toW([0, sway * 0.6, pelvisZ]);
  J.chest = up([0, 0, B.shZ - 0.12 - crouch * 0.5]);
  J.neck = up([0.01, 0, B.neckZ - crouch * 0.5]);
  J.head = up([0.02 + Math.sin(p.headPitch) * 0.04, 0, B.headZ - crouch * 0.5]);
  J.shL = up([0, B.shW, B.shZ - crouch * 0.5]); J.shR = up([0, -B.shW, B.shZ - crouch * 0.5]);
  J.hipL = toW([0, B.hipW, pelvisZ]); J.hipR = toW([0, -B.hipW, pelvisZ]);
  // direção do olhar (p/ desenhar rosto)
  const hf = [Math.cos(p.headPitch) * ct, Math.cos(p.headPitch) * st, -Math.sin(p.headPitch)];
  J.headFwd = [hf[0] * cf - hf[1] * sf, hf[0] * sf + hf[1] * cf, hf[2]];
  J.bodyFwd = [cf * ct - sf * st, sf * ct + cf * st, 0];

  // pernas com IK: alvo do tornozelo vem do ciclo de passo
  const fw = toW([1, 0, 0]), fwd = V.sub(fw, toW([0, 0, 0]));
  for (const [side, off, hip] of [['L', 0, J.hipL], ['R', 0.5, J.hipR]]) {
    const u = ((a.phase + off) % 1 + 1) % 1;
    let s, h;
    if (u < 0.5) { s = L / 4 * (1 - 4 * u); h = 0; }
    else { const v = (u - 0.5) * 2; s = -L / 4 + L / 2 * smooth(v); h = Math.sin(Math.PI * v) * lift; }
    s *= a.walkW; h *= a.walkW;
    if(a.jump||a.traversal){const action=a.traversal||a.jump,w=Math.sin(Math.PI*clamp(action.t/action.duration,0,1));h+=w*(side==='L'?.25:.16);s+=w*(side==='L'?.12:-.12);}
    const stance = (1 - a.walkW) * a.aimV;   // postura de tiro quando parado mirando
    const lat = (side === 'L' ? 1 : -1) * (0.11 + stance * 0.05);
    const stag = stance * (side === 'L' ? 0.12 : -0.09);
    const ank = toW([mdx * s + stag, lat + mdy * s, B.ankle + h]);
    const pole = V.add(fwd, [0, 0, 0.1]);
    const r = ik2(hip, ank, B.thigh, B.shin, pole);
    J['knee' + side] = r.mid; J['ank' + side] = r.end;
    const pitchToe = h > 0.02 ? -0.5 * Math.sin(Math.PI * clamp(h / lift, 0, 1)) : 0;
    J['toe' + side] = V.add(r.end, [fwd[0] * B.foot, fwd[1] * B.foot, -0.05 + pitchToe * 0.1]);
  }

  // rifle e mãos
  const rf = rifleFrame(p);
  const R = (d, u, s) => up(rf.at(d, u, s));
  J.rifle = {
    butt: R(0, 0.02), buttLow: R(0.02, -0.08), grip: R(0.24, -0.08), gripTop: R(0.22, 0), recv0: R(0.16, 0.01), recv1: R(0.46, 0.01),
    hg0: R(0.46, 0.0), hg1: R(0.7, 0.0), muzzle: R(0.92, 0.01), sight: R(0.3, 0.07), sightB: R(0.18, 0.06),
    magTop: R(0.36, -0.03), magBot: R(0.42, -0.22), chg: R(0.17, 0.05),
  };
  const lhTargets = {
    lhHG: rf.at(0.6, -0.04, 0.01), lhMag: rf.at(0.39, -0.16, 0.02),
    lhPouch: [0.06, 0.2, pelvisZ + 0.02], lhCh: rf.at(0.17, 0.06, 0.03),
  };
  let lh = [0, 0, 0];
  for (const k in lhTargets) lh = V.add(lh, V.mul(lhTargets[k], p[k]));
  lh = V.add(lh, V.mul(rf.up, -p.lhDown));
  lh = V.add(lh, V.mul(rf.f, -p.lhBack));
  let rh = rf.at(0.24, -0.09, 0);

  if (!a.armed) {   // sem arma: braços balançam com o passo
    const sw = Math.sin(a.phase * TAU) * a.walkW * lerp(0.22, 0.4, a.runW);
    lh = [sw, B.shW + 0.06, B.shZ - 0.55 + Math.abs(sw) * 0.2];
    rh = [-sw, -B.shW - 0.06, B.shZ - 0.55 + Math.abs(sw) * 0.2];
  }
  const handL = up(lh), handR = up(rh);
  // polo do cotovelo: para trás, para fora e para baixo
  const back = V.mul(fwd, -1), left = [-fwd[1], fwd[0], 0];
  const aL = ik2(J.shL, handL, B.upper, B.fore, V.add(V.add(back, V.mul(left, 0.7)), [0, 0, -0.9]));
  const aR = ik2(J.shR, handR, B.upper, B.fore, V.add(V.add(back, V.mul(left, -0.7)), [0, 0, -0.9]));
  J.elbL = aL.mid; J.handL = aL.end; J.elbR = aR.mid; J.handR = aR.end;
  return J;
}

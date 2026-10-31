// procedural-anim.mjs — animações que a biblioteca Mixamo não tem, montadas por pose: morte por tiro (cai de
// costas), atropelamento (cai de bruços), soco, taco de beisebol e pistola em uma mão (mirar, atirar, recarregar).
// Cada quadro-chave diz p/ onde aponta cada osso (direção do osso até o filho) no referencial do PERSONAGEM —
// [esquerda, cima, frente] — e/ou uma rotação extra; o construtor converte em rotações locais dos ossos usando o
// repouso do próprio personagem (npc-roster.mjs → restPose), então serve p/ os 52.
// Clipes "upper" só trazem tronco/braços/cabeça (tocam por cima da locomoção: atirar/recarregar correndo).
import * as THREE from 'three';
import {restPose} from './npc-roster.mjs';

const CHILD = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', LeftShoulder: 'LeftArm', RightShoulder: 'RightArm',
  LeftArm: 'LeftForeArm', RightArm: 'RightForeArm', LeftForeArm: 'LeftHand', RightForeArm: 'RightHand', LeftHand: 'LeftHandMiddle1', RightHand: 'RightHandMiddle1',
  LeftUpLeg: 'LeftLeg', RightUpLeg: 'RightLeg', LeftLeg: 'LeftFoot', RightLeg: 'RightFoot', LeftFoot: 'LeftToeBase', RightFoot: 'RightToeBase' };
const REST = new WeakMap();
const FINGER = /^(Left|Right)Hand(Index|Middle|Ring|Pinky)[123]$/, CURL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.2);
export const UPPER = /^mixamorig(Spine1|Spine2|Neck|Head|(Left|Right)(Shoulder|Arm|ForeArm|Hand))/;

// referencial do personagem no espaço da armadura: esquerda, cima, frente
function frameOf(rest) {
  const P = n => rest.get('mixamorig' + n)?.pos;
  const up = P('Head').clone().sub(P('Hips')).normalize(), left = P('LeftArm').clone().sub(P('RightArm')).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize(); left.crossVectors(up, fwd).normalize();
  return { left, up, fwd, v: ([l, u, f]) => new THREE.Vector3().addScaledVector(left, l).addScaledVector(up, u).addScaledVector(fwd, f).normalize() };
}

// keys: [{ t, dirs: { Osso: [l,u,f] }, rot: { Osso: [[l,u,f] eixo, graus] }, hips: [l,u,f] deslocamento e hipsH: altura
// do quadril — ambos em "alturas de quadril" do próprio personagem }]
export function poseClip(root, name, keys, { upperOnly = false, height = 1.75, fist = null } = {}) {
  // cache próprio: o userData.restPose do npc-roster vira objeto comum quando o personagem é clonado (JSON)
  let rest = REST.get(root); if (!rest) REST.set(root, rest = restPose(root));
  if (!rest) return null;
  const F = frameOf(rest), names = [...rest.keys()], hips = rest.get('mixamorigHips');
  const foot = rest.get('mixamorigLeftFoot'), hipH = hips.pos.dot(F.up) - (foot ? foot.pos.dot(F.up) : 0);   // altura do quadril (unidades da armadura)
  const times = keys.map(k => k.t), out = new Map(names.map(n => [n, new Float32Array(keys.length * 4)])), hipsPos = new Float32Array(keys.length * 3);
  keys.forEach((k, i) => {
    const world = new Map();
    for (const n of names) {
      const R = rest.get(n), short = n.replace('mixamorig', ''), parentW = R.parent ? world.get(R.parent) : null;
      let w;
      const dir = k.dirs?.[short], rot = k.rot?.[short];
      if (dir || rot) {
        // gira o repouso do osso até a direção pedida (menor rotação) e aplica a rotação extra (em volta de eixos do personagem)
        w = R.world.clone();
        const child = CHILD[short] && rest.get('mixamorig' + CHILD[short]);
        if (dir && child) { const d0 = child.pos.clone().sub(R.pos).normalize(); w.premultiply(new THREE.Quaternion().setFromUnitVectors(d0, F.v(dir))); }
        if (rot) w.premultiply(new THREE.Quaternion().setFromAxisAngle(F.v(rot[0]), THREE.MathUtils.degToRad(rot[1])));
      } else {
        w = parentW ? parentW.clone().multiply(R.q) : R.world.clone();   // sem pose: segue o pai no repouso local
        // punho fechado: dobra as falanges (polegar fica) em volta do X local
        const f = (k.fist || fist) && FINGER.exec(short);
        if (f && (k.fist || fist).includes(f[1])) w.multiply(CURL);
      }
      world.set(n, w);
      const local = parentW ? parentW.clone().invert().multiply(w) : w.clone();
      const o = out.get(n); local.normalize().toArray(o, i * 4);
      if (i && local.dot(new THREE.Quaternion().fromArray(o, (i - 1) * 4)) < 0) for (let c = 0; c < 4; c++) o[i * 4 + c] *= -1;
    }
    // quadril: abaixa até hipsH da altura em pé e desloca (hips) — o quadril é filho da armadura, mesmo referencial de F
    const off = k.hips || [0, 0, 0], h = k.hipsH ?? 1, p = hips.p.clone();
    p.addScaledVector(F.up, -hipH * (1 - h));
    p.addScaledVector(F.left, off[0] * hipH).addScaledVector(F.up, off[1] * hipH).addScaledVector(F.fwd, off[2] * hipH);
    p.toArray(hipsPos, i * 3);
  });
  const tracks = [];
    for (const n of names) if (!upperOnly || UPPER.test(n)) tracks.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', times, out.get(n)));
  if (!upperOnly) tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, hipsPos));
  return new THREE.AnimationClip(name, times[times.length - 1] || 0, tracks);
}

// metades de um clipe Mixamo: de cima (tronco a partir do Spine1, braços, cabeça) e de baixo (quadril, pernas)
export function splitClip(clip) {
  const up = clip.clone(), low = clip.clone();
  up.name = clip.name + '@upper'; low.name = clip.name + '@lower';
  up.tracks = up.tracks.filter(t => UPPER.test(t.name));
  low.tracks = low.tracks.filter(t => !UPPER.test(t.name));
  return [up, low];
}

// ---------- poses ----------
const DOWN = [0, -1, 0];
const L = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// braços pendendo (mão na lateral da coxa)
const relaxed = { LeftArm: [.12, -1, .02], RightArm: [-.12, -1, .02], LeftForeArm: [.05, -1, .15], RightForeArm: [-.05, -1, .15] };

export function makeCombatClips(root, height = 1.75) {
  const clips = [];
  const add = c => c && clips.push(c);
  // morte por tiro: dobra os joelhos, cai de costas e fica deitado, braços abertos
  add(poseClip(root, 'death_shot', [
    { t: 0, dirs: { ...relaxed, Spine1: [0, 1, 0], LeftUpLeg: [.1, -1, 0], RightUpLeg: [-.1, -1, 0], LeftLeg: DOWN, RightLeg: DOWN } },
    { t: .22, rot: { Hips: [[1, 0, 0], -12] }, dirs: { LeftArm: [.6, -.6, .3], RightArm: [-.6, -.6, .3], LeftForeArm: [.5, -.2, .6], RightForeArm: [-.5, -.2, .6], Spine1: [0, 1, -.3], Neck: [0, 1, .3], LeftUpLeg: [.12, -1, .35], RightUpLeg: [-.12, -1, .35], LeftLeg: [.05, -1, -.3], RightLeg: [-.05, -1, -.3] }, hipsH: .82 },
    { t: .55, rot: { Hips: [[1, 0, 0], -55] }, dirs: { LeftArm: [.9, .1, -.2], RightArm: [-.9, .1, -.2], LeftForeArm: [.7, .5, -.2], RightForeArm: [-.7, .5, -.2], Neck: [0, .7, -.6], LeftUpLeg: [.15, -.6, .75], RightUpLeg: [-.15, -.6, .75], LeftLeg: [.05, -.9, .2], RightLeg: [-.05, -.9, .2] }, hips: [0, 0, -.35], hipsH: .45 },
    { t: .9, rot: { Hips: [[1, 0, 0], -88] }, dirs: { LeftArm: [.95, 0, -.25], RightArm: [-.95, 0, -.25], LeftForeArm: [.8, .1, .5], RightForeArm: [-.8, .1, .5], Spine1: [0, 0, -1], Neck: [0, -.15, -1], LeftUpLeg: [.2, 0, 1], RightUpLeg: [-.15, 0, 1], LeftLeg: [.1, -.25, 1], RightLeg: [-.05, 0, 1], LeftFoot: [0, .9, .3], RightFoot: [0, .9, .3] }, hips: [0, 0, -.55], hipsH: .14 },
    { t: 1.6, rot: { Hips: [[1, 0, 0], -90] }, dirs: { LeftArm: [.95, 0, -.3], RightArm: [-.95, 0, -.2], LeftForeArm: [.75, 0, .6], RightForeArm: [-.8, 0, .55], Spine1: [0, 0, -1], Neck: [0, 0, -1], LeftUpLeg: [.2, 0, 1], RightUpLeg: [-.15, 0, 1], LeftLeg: [.12, -.1, 1], RightLeg: [-.05, 0, 1], LeftFoot: [.2, .9, .2], RightFoot: [-.2, .9, .2] }, hips: [0, 0, -.6], hipsH: .12 }
  ], { height }));
  // atropelado: é jogado, gira e cai de bruços (o deslocamento no chão é feito pelo código: voo + rolagem)
  add(poseClip(root, 'death_car', [
    { t: 0, rot: { Hips: [[1, 0, 0], 25] }, dirs: { LeftArm: [.7, .6, -.2], RightArm: [-.7, .6, -.2], LeftForeArm: [.5, .8, 0], RightForeArm: [-.5, .8, 0], LeftUpLeg: [.2, -.8, -.5], RightUpLeg: [-.2, -.9, .3], LeftLeg: [.1, -.9, -.4], RightLeg: [-.1, -.9, .2] }, hipsH: .9 },
    { t: .35, rot: { Hips: [[1, 0, 0], 70] }, dirs: { LeftArm: [.8, .3, .4], RightArm: [-.8, .4, .3], LeftForeArm: [.4, .2, .9], RightForeArm: [-.4, .3, .9], Spine1: [0, .2, 1], LeftUpLeg: [.25, -.4, -.9], RightUpLeg: [-.25, -.2, -1], LeftLeg: [.1, .3, -1], RightLeg: [-.1, .1, -1] }, hipsH: .5 },
    { t: .75, rot: { Hips: [[1, 0, 0], 90] }, dirs: { LeftArm: [.9, 0, .4], RightArm: [-.6, 0, -.8], LeftForeArm: [.5, 0, .9], RightForeArm: [-.9, 0, -.2], Spine1: [0, 0, 1], Neck: [.4, 0, 1], LeftUpLeg: [.3, 0, -1], RightUpLeg: [-.15, 0, -1], LeftLeg: [.25, .35, -1], RightLeg: [-.1, 0, -1], LeftFoot: [0, .2, -1], RightFoot: [0, -.9, -.3] }, hips: [0, 0, .5], hipsH: .14 },
    { t: 1.6, rot: { Hips: [[1, 0, 0], 90] }, dirs: { LeftArm: [.9, 0, .45], RightArm: [-.6, 0, -.8], LeftForeArm: [.55, 0, .85], RightForeArm: [-.9, 0, -.25], Spine1: [0, 0, 1], Neck: [.45, 0, 1], LeftUpLeg: [.3, 0, -1], RightUpLeg: [-.15, 0, -1], LeftLeg: [.25, .2, -1], RightLeg: [-.1, 0, -1], LeftFoot: [0, .1, -1], RightFoot: [0, -.9, -.3] }, hips: [0, 0, .55], hipsH: .12 }
  ], { height }));
  // soco (de cima): guarda, jab de direita, volta à guarda
  const guard = { LeftArm: [.35, -.65, .6], RightArm: [-.35, -.7, .55], LeftForeArm: [-.15, .75, .65], RightForeArm: [.1, .8, .6], Spine2: [0, 1, .08] };
  add(poseClip(root, 'punch@upper', [
    { t: 0, dirs: guard },
    { t: .09, dirs: { ...guard, RightArm: [-.15, .05, 1], RightForeArm: [-.05, .08, 1], Spine2: [-.15, 1, .12] }, rot: { Spine1: [[0, 1, 0], -20] } },
    { t: .2, dirs: { ...guard, RightArm: [-.12, .05, 1], RightForeArm: [-.04, .06, 1] }, rot: { Spine1: [[0, 1, 0], -16] } },
    { t: .42, dirs: guard }
  ], { upperOnly: true, height, fist: ['Right', 'Left'] }));
  // taco: prepara no ombro direito, gira na horizontal p/ a esquerda e acompanha
  const wind = { RightArm: [-.6, .3, -.25], RightForeArm: [.4, .85, .1], LeftArm: [-.2, -.2, .5], LeftForeArm: [-.75, .55, .1], Spine2: [-.1, 1, -.1] };
  add(poseClip(root, 'bat_swing@upper', [
    { t: 0, dirs: wind, rot: { Spine1: [[0, 1, 0], -35] } },
    { t: .14, dirs: { RightArm: [-.45, .05, .85], RightForeArm: [.2, .1, 1], LeftArm: [.05, -.1, 1], LeftForeArm: [-.25, .1, 1], Spine2: [0, 1, .1] }, rot: { Spine1: [[0, 1, 0], 5] } },
    { t: .26, dirs: { RightArm: [.4, .1, .9], RightForeArm: [.8, .2, .5], LeftArm: [.6, 0, .75], LeftForeArm: [.9, .15, .2], Spine2: [.1, 1, .05] }, rot: { Spine1: [[0, 1, 0], 40] } },
    { t: .55, dirs: wind, rot: { Spine1: [[0, 1, 0], -30] } }
  ], { upperOnly: true, height, fist: ['Right', 'Left'] }));
  // taco em repouso: no ombro
  add(poseClip(root, 'bat_idle@upper', [{ t: 0, dirs: { ...relaxed, RightArm: [-.3, -.75, .45], RightForeArm: [.05, .95, -.05] } }, { t: 1, dirs: { ...relaxed, RightArm: [-.3, -.75, .45], RightForeArm: [.05, .95, -.05] } }], { upperOnly: true, height, fist: ['Right', 'Left'] }));
  // pistola em uma mão: mira com o braço direito estendido, o esquerdo relaxado; baixa (pronta) quando não mira
  const aim1 = { RightArm: [-.05, .02, 1], RightForeArm: [0, .02, 1], RightHand: [0, .05, 1], LeftArm: [.18, -1, .05], LeftForeArm: [.05, -1, .25], Spine2: [-.05, 1, .05] };
  add(poseClip(root, 'pistol_aim@upper', [{ t: 0, dirs: aim1, rot: { Spine1: [[0, 1, 0], -12] } }, { t: 1, dirs: aim1, rot: { Spine1: [[0, 1, 0], -12] } }], { upperOnly: true, height, fist: ['Right'] }));
  add(poseClip(root, 'pistol_fire@upper', [
    { t: 0, dirs: aim1, rot: { Spine1: [[0, 1, 0], -12] } },
    { t: .05, dirs: { ...aim1, RightArm: [-.05, .12, 1], RightForeArm: [0, .3, .95], RightHand: [0, .45, .9] }, rot: { Spine1: [[0, 1, 0], -12] } },
    { t: .2, dirs: aim1, rot: { Spine1: [[0, 1, 0], -12] } }
  ], { upperOnly: true, height, fist: ['Right'] }));
  const low1 = { RightArm: [-.12, -.95, .3], RightForeArm: [-.05, -.6, .8], RightHand: [0, -.5, .85], LeftArm: [.14, -1, .05], LeftForeArm: [.05, -1, .2] };
  add(poseClip(root, 'pistol_idle@upper', [{ t: 0, dirs: low1 }, { t: 1, dirs: low1 }], { upperOnly: true, height, fist: ['Right'] }));
  // recarga de uma mão: traz a pistola p/ frente do peito, a esquerda troca o carregador e volta
  const chest = { RightArm: [-.3, -.75, .55], RightForeArm: [.35, .55, .75], RightHand: [.4, .3, .85] };
  add(poseClip(root, 'pistol_reload@upper', [
    { t: 0, dirs: { ...low1, ...chest, LeftArm: [.14, -1, .05], LeftForeArm: [.05, -1, .2] } },
    { t: .35, dirs: { ...chest, LeftArm: [.25, -.9, .2], LeftForeArm: [.2, -.6, .7] } },
    { t: .7, dirs: { ...chest, LeftArm: [.2, -.7, .55], LeftForeArm: [-.45, .2, .85] } },
    { t: 1.1, dirs: { ...chest, LeftArm: [.25, -.7, .5], LeftForeArm: [-.5, .3, .8] } },
    { t: 1.5, dirs: { ...aim1 } }
  ], { upperOnly: true, height, fist: ['Right'] }));
  return clips;
}

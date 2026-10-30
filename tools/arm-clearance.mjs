// tools/arm-clearance.mjs — mede, em cada personagem, quantos graus os braços precisam abrir nos clipes relaxados
// (parado e caminhada) p/ a mão e o antebraço não entrarem no quadril/coxa (folga de 1 cm), e grava em
// assets/npcs/roster.json (armOut: {idle, walk}). Usa a malha e os pesos reais (skinning na CPU), não uma estimativa:
// abre 1° por vez até folgar (máx. 16° parado e 12° andando, p/ não virar pose de braços abertos). Se nem isso resolve (o contato é com o
// glúteo quando o braço balança p/ trás, não do lado), fica no menor ângulo que já dá 0,6 cm, ou não abre nada.
// O jogo só lê os números (js/npc-roster.mjs → retargetMixamo).
// Uso: node tools/arm-clearance.mjs [ids...]   (sem ids: todos)
import fs from 'node:fs';
import * as THREE from 'three';
import { loadGLB, library, skinned } from './rig-audit.mjs';
import { retargetMixamo, STYLE } from '../js/npc-roster.mjs';

const MARGIN = 0.01, MAX = { idle: 16, walk: 12 }, FILE = 'assets/npcs/roster.json';
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8')), ids = process.argv.slice(2);
const SAMPLES = { idle: [0, 0.25, 0.5, 0.75], walk: [0, 0.2, 0.4, 0.6, 0.8] };

for (const meta of doc.characters) {
  if (ids.length && !ids.includes(meta.id)) continue;
  const g = await loadGLB('assets/npcs/' + meta.file), lib = await library(meta.sex);
  let mesh; g.scene.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const names = mesh.skeleton.bones.map(b => b.name.replace('mixamorig', '')), SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight;
  const dom = i => { let b = 0, w = -1; for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > w) { w = SW.getComponent(i, k); b = SI.getComponent(i, k); } return names[b]; };
  const hand = [], hip = [];
  for (let i = 0; i < SI.count; i++) { const d = dom(i); if (/^(Left|Right)(ForeArm|Hand)/.test(d)) hand.push(i); else if (/^(Hips|LeftUpLeg|RightUpLeg)$/.test(d)) hip.push(i); }
  const gap = (cn, deg) => {
    let best = 1e9; const ts = SAMPLES[cn];
    {
      const clip = retargetMixamo(lib.animations.find(c => c.name === cn), lib.scene, g.scene, cn, { style: STYLE[meta.sex], armOut: { [cn]: deg } });
      for (const t of ts) {
        const m = new THREE.AnimationMixer(g.scene); m.clipAction(clip).play(); m.setTime(t * clip.duration); g.scene.updateMatrixWorld(true);
        const P = skinned(mesh);
        for (let a = 0; a < hand.length; a += 3) { const i = hand[a]; for (let b = 0; b < hip.length; b += 3) { const j = hip[b], dy = P[i * 3 + 1] - P[j * 3 + 1]; if (dy > best || -dy > best) continue;
          const d = Math.hypot(P[i * 3] - P[j * 3], dy, P[i * 3 + 2] - P[j * 3 + 2]); if (d < best) best = d; } }
        m.stopAllAction(); m.uncacheRoot(g.scene);
      }
    }
    return best;
  };
  const res = {}, log = [];
  for (const cn of Object.keys(SAMPLES)) {
    const curve = [gap(cn, 0)];
    while (curve.at(-1) < MARGIN && curve.length <= MAX[cn]) curve.push(gap(cn, curve.length));
    if (process.env.CURVE) console.log(cn, curve.map(v => +(v * 100).toFixed(1)).join(' '));
    let deg = curve.findIndex(v => v >= MARGIN);
    if (deg < 0) deg = curve.findIndex(v => v >= 0.006);
    if (deg > 0) res[cn] = deg;
    log.push(cn + ' ' + (curve[0] * 100).toFixed(1) + '→' + (curve[Math.max(0, deg)] * 100).toFixed(1) + 'cm' + (deg > 0 ? ' (+' + deg + '°)' : ''));
  }
  if (Object.keys(res).length) meta.armOut = res; else delete meta.armOut;
  console.log(meta.id.padEnd(22), log.join(' | '));
}
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1));

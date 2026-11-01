// tools/face-check.mjs — o rosto tem de se mover como um bloco rígido (só a cabeça gira); se a parte de baixo (boca,
// queixo) estiver presa ao pescoço, ele "entorta" quando cabeça e pescoço giram diferente. Mede, em cada personagem, a
// deformação das arestas do rosto (frente da cabeça, da altura do queixo aos olhos) no parado e na caminhada:
// p99 de |comprimento/repouso − 1|. Rosto íntegro ≈ 0%.   Uso: node tools/face-check.mjs [ids...]
import fs from 'node:fs';
import * as THREE from 'three';
import { loadGLB, library, skinned } from './rig-audit.mjs';
import { retargetMixamo, restPose, STYLE } from '../js/npc-roster.mjs';
const roster = JSON.parse(fs.readFileSync('assets/npcs/roster.json', 'utf8')).characters, ids = process.argv.slice(2);
const rows = [];
for (const meta of roster) {
  if (ids.length && !ids.includes(meta.id)) continue;
  const g = await loadGLB('assets/npcs/' + meta.file), lib = await library(meta.sex);
  let mesh; g.scene.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const rest = restPose(g.scene), head = rest.get('mixamorigHead').pos.clone().applyMatrix4(g.scene.getObjectByName('mixamorigHips').parent.matrixWorld);
  const P0 = mesh.geometry.attributes.position.array, H = meta.height, idx = mesh.geometry.index.array;
  // rosto: na frente da cabeça (z além do pivô), entre 1% abaixo e 7% acima do pivô da cabeça, perto do meio
  const face = new Uint8Array(P0.length / 3);
  for (let i = 0; i < face.length; i++) { const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2]; face[i] = Math.abs(x) < 0.04 * H && y > head.y - 0.01 * H && y < head.y + 0.07 * H && z > head.z + 0.035 * H ? 1 : 0; }
  const edges = []; for (let t = 0; t < idx.length; t += 3) for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) if (face[a] && face[b] && a < b) edges.push(a, b);
  const len = (P, a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  let worst = 0, where = '';
  for (const [cn, ts] of [['idle', [0.25, 0.75]], ['walk', [0.25, 0.5, 0.75]]]) {
    const clip = retargetMixamo(lib.animations.find(c => c.name === cn), lib.scene, g.scene, cn, { style: STYLE[meta.sex], armOut: meta.armOut });
    for (const t of ts) {
      const m = new THREE.AnimationMixer(g.scene); m.clipAction(clip).play(); m.setTime(t * clip.duration); g.scene.updateMatrixWorld(true);
      const P = skinned(mesh), st = [];
      for (let e = 0; e < edges.length; e += 2) { const l0 = len(P0, edges[e], edges[e + 1]); if (l0 > 1e-5) st.push(Math.abs(len(P, edges[e], edges[e + 1]) / l0 - 1)); }
      st.sort((a, b) => a - b); const p99 = st[Math.floor(st.length * 0.99)] || 0;
      if (p99 > worst) { worst = p99; where = cn + '@' + t; }
      m.stopAllAction(); m.uncacheRoot(g.scene);
    }
  }
  rows.push([meta.id, worst]); console.log(meta.id.padEnd(22), 'rosto p99', (worst * 100).toFixed(1) + '%', worst > 0.03 ? '← entorta (' + where + ')' : '');
}
if (rows.length > 1) console.log(rows.filter(r => r[1] > 0.03).length, 'de', rows.length, 'acima de 3%');

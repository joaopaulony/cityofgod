// landmarks-3d.mjs — marcos de Los Angeles na camada WebGL. Por ora: o letreiro gigante na serra ao norte da
// cidade, no estilo do de Hollywood mas com o nome do jogo ("CITY OF GOD"), letras brancas de chapa sobre andaimes
// de aço, levemente inclinadas na encosta, iluminadas por refletores à noite. A posição sai da geografia
// (bridge.geo): o primeiro trecho de mata da serra ao norte do centro.
import {makeKit} from './kit-3d.mjs';

// fonte de blocos 4×5 (linhas de cima p/ baixo)
const FONT = {
  C: ['.###', '#...', '#...', '#...', '.###'], I: ['###', '.#.', '.#.', '.#.', '###'], T: ['####', '.##.', '.##.', '.##.', '.##.'],
  Y: ['#..#', '#..#', '.##.', '.##.', '.##.'], O: ['.##.', '#..#', '#..#', '#..#', '.##.'], F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'], D: ['###.', '#..#', '#..#', '#..#', '###.'], ' ': ['..', '..', '..', '..', '..'],
};

export function createLandmarks(THREE, scene, bridge) {
  const Kit = makeKit(THREE), state = { sign: null };
  const matLetters = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  const matSteel = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matGlow = new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false });
  let group = null, tries = 0;

  function place(geo) {
    const D = globalThis.COG && globalThis.COG.D, A = geo.anchors, cx = A.downtown.x - 120;
    for (let y = 40; y < geo.H * 0.5; y += 10) {
      if (!geo.isLand(cx, y) || geo.coastDist(cx, y) < 60) continue;
      const ok = [-36, 0, 36].every(dx => geo.isLand(cx + dx, y) && (!D || geo.districtAt(cx + dx, y + 30) === D.FOREST || geo.districtAt(cx + dx, y + 30) === D.RURAL));
      if (ok) return [cx, y + 50];
    }
    return null;
  }
  function build(x0, y0) {
    const text = 'CITY OF GOD', cw = 1.25, chh = 2.0, gap = 1.4, depth = 0.32, lift = 1.6;
    const letters = Kit(), steel = Kit(), glow = Kit();
    const widths = [...text].map(ch => FONT[ch][0].length * cw);
    const total = widths.reduce((a, w) => a + w, 0) + gap * (text.length - 1);
    let x = -total / 2;
    [...text].forEach((ch, li) => {
      const rows = FONT[ch], w = widths[li];
      // cada linha da letra vira uma chapa contínua (sem a costura entre blocos)
      rows.forEach((row, r) => { const by = lift + (rows.length - 1 - r) * chh; for (let k = 0; k < row.length;) { if (row[k] !== '#') { k++; continue; } let e = k; while (e < row.length && row[e] === '#') e++; letters.box(x + k * cw, by - 0.02, -depth / 2, x + e * cw, by + chh + 0.02, depth / 2, '#f4f2ec'); k = e; } });
      if (ch !== ' ') {
        // andaime atrás da letra: montantes, travessas e diagonais de aço, e a sapata de concreto
        const h = lift + rows.length * chh;
        for (const px of [x + 0.4, x + w - 0.4]) { steel.box(px - 0.07, 0, -0.9, px + 0.07, h - 0.3, -0.76, '#5f6366'); steel.box(px - 0.3, 0, -1.1, px + 0.3, 0.25, -0.55, '#a9a49a'); }
        for (let yy = 1.2; yy < h - 0.5; yy += 2.4) steel.box(x + 0.3, yy, -0.88, x + w - 0.3, yy + 0.1, -0.78, '#6a6e72');
        const diag = new THREE.BoxGeometry(0.07, Math.hypot(w - 0.8, 2.4), 0.07); diag.rotateZ(Math.atan2(w - 0.8, 2.4)); diag.translate(x + w / 2, 2.4, -0.84); steel.raw(diag, '#6a6e72');
        // refletores no pé da letra (acendem à noite)
        for (const px of [x + w * 0.3, x + w * 0.7]) { steel.box(px - 0.2, 0, 1.6, px + 0.2, 0.35, 2.0, '#3a3d40'); glow.box(px - 0.16, 0.12, 1.58, px + 0.16, 0.32, 1.6, '#ffffff'); }
      }
      x += w + gap;
    });
    const g = new THREE.Group(), add = (geos, mat) => { for (const geo of Object.values(geos)) { const m = new THREE.Mesh(geo, mat); m.castShadow = mat !== matGlow; m.receiveShadow = true; g.add(m); } };
    add(letters.done(), matLetters); add(steel.done(), matSteel); add(glow.done(), matGlow);
    g.position.set(x0, 0, y0); g.rotation.x = -0.1;   // encostado na serra
    scene.add(g); state.sign = { x: x0, y: y0, width: total };
    // as árvores 3D abrem espaço p/ o letreiro
    (window.cityLandmarkHoles || (window.cityLandmarkHoles = [])).push([x0 - total / 2 - 8, y0 - 8, x0 + total / 2 + 8, y0 + 34]);   // inclui a encosta abaixo: dá p/ ver da cidade
    return g;
  }
  return {
    state,
    update() {
      if (!group && tries < 200) { tries++; const geo = bridge.geo; if (geo) { const p = place(geo); if (p) group = build(p[0], p[1]); else tries = 999; } }
      if (!group) return;
      const E = globalThis.ENV, night = E ? E.dark : (bridge.world.night ? 1 : 0);
      matLetters.emissive.setRGB(0.42 * night, 0.41 * night, 0.38 * night);
      matGlow.color.setRGB(0.15 + 2.2 * night, 0.15 + 2.1 * night, 0.15 + 1.8 * night);
    },
  };
}

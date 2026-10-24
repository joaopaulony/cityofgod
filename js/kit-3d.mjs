// kit-3d.mjs — ajudante de modelagem dos objetos 3D (props-3d.mjs, house-3d.mjs): junta peças simples
// (caixas arredondadas, cilindros, esferas, cones listrados) com cor por vértice e devolve as geometrias
// mescladas por conjunto (corpo, brilho, vidro, ...), prontas p/ InstancedMesh.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;

export function makeKit(THREE) {
  const col = hex => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
  return function Kit() {
    const sets = {};
    const add = (g, c, set = 'body') => {
      g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = typeof c === 'string' ? col(c) : c;
      for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      (sets[set] || (sets[set] = [])).push(g); return g;
    };
    const k = {
      col,
      // caixa de (x0,y0,z0) a (x1,y1,z1); r = raio do arredondamento
      box(x0, y0, z0, x1, y1, z1, c, r = 0, set) {
        const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0), rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
        const g = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
        g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return add(g, c, set);
      },
      // cilindro vertical de y0 a y1 (rTop opcional: cone)
      cyl(x, y0, z, r, y1, c, seg = 14, rTop = r, set) { const g = new THREE.CylinderGeometry(rTop, r, y1 - y0, seg); g.translate(x, (y0 + y1) / 2, z); return add(g, c, set); },
      // cilindro deitado ao longo de x ou z
      cylX(x0, x1, y, z, r, c, seg = 12, set) { const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, y, z); return add(g, c, set); },
      cylZ(x, y, z0, z1, r, c, seg = 12, set) { const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg); g.rotateX(Math.PI / 2); g.translate(x, y, (z0 + z1) / 2); return add(g, c, set); },
      sph(x, y, z, r, c, sy = 1, set, sx = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx, sy, sz); g.translate(x, y, z); return add(g, c, set); },
      // guarda-sol listrado: cone com gomos alternados
      umbrella(x, y, z, r, h, c1, c2) {
        const g = new THREE.ConeGeometry(r, h, 12, 1, true).toNonIndexed(); g.translate(x, y + h / 2, z);
        const n = g.attributes.position.count, a = new Float32Array(n * 3), A = col(c1), B = col(c2), p = g.attributes.position;
        for (let i = 0; i < n; i += 3) { let ax = 0, az = 0; for (let j = 0; j < 3; j++) { ax += p.getX(i + j) - x; az += p.getZ(i + j) - z; } const s = Math.floor((Math.atan2(az, ax) + Math.PI) / TAU * 12) % 2 ? A : B; for (let j = 0; j < 3; j++) a.set([s.r, s.g, s.b], (i + j) * 3); }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3)); (sets.body || (sets.body = [])).push(g);
      },
      raw(g, c, set) { return add(g, c, set); },
      // geometria já colorida (atributo color próprio)
      colored(g, set = 'body') { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); (sets[set] || (sets[set] = [])).push(g); return g; },
      done() { const out = {}; for (const [s, list] of Object.entries(sets)) if (list.length) out[s] = mergeGeometries(list); return out; },
    };
    return k;
  };
}

// parked-3d.mjs — carros estacionados (caixas 'parkedcar' das vagas, pátios, postos e garagens) com os mesmos
// modelos GLB dos veículos dirigíveis. Cada modelo carrega uma vez; as instâncias perto da câmera são clones que
// compartilham malhas e materiais (só a pintura da carroceria ganha um material por cor). Enquanto um carro tem
// modelo 3D, o desenho 2D dele é pulado (b.r3d).
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {VEHICLE_MODELS} from './vehicle-catalog.mjs';
import {streetModel} from './vehicle-fleet.mjs';

const POOL = VEHICLE_MODELS.filter(v=>v.source==='passenger').map(v=>v.id);
const PAINT = /paint|body|carpaint|car_paint|exterior|chassis|main/i;
// SUV vem de fábrica em grafite escuro (sem separar pintura de borracha na textura): fica com a cor original
const KEEP_FACTORY = new Set(['suv']);

export function createParked3D(THREE, scene, bridge) {
  const state = { models: 0, cars: 0, failed: 0, paint: {} };
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const models = new Map(), live = new Map(), paintCache = new Map();
  let started = false;

  function normalize(root, cfg) {
    // carro parado não anima: malhas com esqueleto viram malhas comuns na pose de repouso (clonáveis sem ossos)
    const skinned = []; root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
    for (const sk of skinned) { const m = new THREE.Mesh(sk.geometry, sk.material); m.name = sk.name; m.position.copy(sk.position); m.quaternion.copy(sk.quaternion); m.scale.copy(sk.scale); sk.parent.add(m); sk.parent.remove(sk); }
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), dim = new THREE.Vector3(), c = new THREE.Vector3(); box.getSize(dim); box.getCenter(c);
    const pos = new THREE.Group(); pos.position.set(-c.x, -box.min.y, -c.z); pos.add(root);
    const sc = new THREE.Group(); sc.scale.setScalar(cfg.length / Math.max(dim.z, dim.x)); sc.add(pos);
    const al = new THREE.Group(); al.rotation.y = cfg.front === '+Z' ? Math.PI / 2 : -Math.PI / 2; al.add(sc);
    // material da pintura: pelo nome, senão o de maior área entre os não-escuros/não-transparentes
    let paint = null, best = 0;
    root.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      // sem mapa de ambiente na cena: metal puro sairia preto; vira pintura acetinada
      for (const m of [].concat(o.material)) if (m && 'metalness' in m && !m.userData.parkFix) { m.userData.parkFix = 1; m.metalness = Math.min(m.metalness, 0.25); m.metalnessMap = null; m.roughness = Math.min(Math.max(m.roughness, 0.35), 0.6); m.needsUpdate = true; }
      for (const m of [].concat(o.material)) {
        if (!m || m.transparent || !m.color) continue;
        if (PAINT.test(m.name || '')) { paint = paint && PAINT.test(paint.name || '') ? paint : m; continue; }
        if (paint && PAINT.test(paint.name || '')) continue;
        o.geometry.computeBoundingBox(); const s = new THREE.Vector3(); o.geometry.boundingBox.getSize(s);
        const hsl = {}; m.color.getHSL(hsl); const area = (s.x * s.y + s.y * s.z + s.x * s.z) * (hsl.l > 0.12 ? 1 : 0.1);
        if (area > best) { best = area; paint = m; }
      }
    });
    state.paint[cfg.id] = paint ? paint.name || '(sem nome)' : null;
    if (paint && paint.map && paint.map.image && !KEEP_FACTORY.has(cfg.id)) paint.map = neutralPaint(paint.map);
    return { tpl: al, paint };
  }
  // a textura da carroceria já vem com a cor de fábrica: os pixels saturados (a pintura) viram cinza claro e a
  // cor de cada carro entra pelo material; cromados, borrachas, faróis e frisos (pouco saturados) ficam como estão
  function neutralPaint(tex) {
    const im = tex.image, N = Math.min(1024, im.width || 1024), c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, N, N); const d = g.getImageData(0, 0, N, N), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const r = a[i], gg = a[i + 1], b = a[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx - mn < 24) continue; const v = Math.min(255, (0.3 * r + 0.59 * gg + 0.11 * b) * 1.5 + 30); a[i] = a[i + 1] = a[i + 2] = v; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4; return t;
  }
  async function start() {
    started = true; await MeshoptDecoder.ready;
    for (const id of POOL) {
      const cfg = VEHICLE_MODELS.find(v => v.id === id); if (!cfg) continue;
      loader.loadAsync('assets/vehicles/live/' + cfg.file).then(g => { models.set(id, normalize(g.scene, cfg)); state.models = models.size; }).catch(e => { state.failed++; console.warn('Carro estacionado não carregou', id, e); });
    }
  }
  const h = b => { let k = Math.imul(Math.round(b.x * 10) * 73856093 ^ Math.round(b.y * 10) * 19349663, 2654435761); return (k ^ (k >>> 15)) >>> 0; };
  function make(b) {
    const id=streetModel(b),M=models.get(id);if(!M)return null;
    const obj = M.tpl.clone(true);
    if (M.paint && b.col && !KEEP_FACTORY.has(id)) {
      const key = id + b.col; let mat = paintCache.get(key);
      if (!mat) { mat = M.paint.clone(); mat.color = new THREE.Color().setStyle(b.junk ? '#7a6a58' : b.col, THREE.SRGBColorSpace); paintCache.set(key, mat); }
      obj.traverse(o => { if (o.isMesh) { if (Array.isArray(o.material)) o.material = o.material.map(m => m === M.paint ? mat : m); else if (o.material === M.paint) o.material = mat; } });
    }
    const g = new THREE.Group(); g.add(obj); g.position.set(b.x, 0, b.y); g.rotation.y = -b.rot;
    scene.add(g); b.r3d = true; return g;
  }
  let tick = 0;
  return {
    state,
    paintActive(root,b){const id=streetModel(b),M=models.get(id);if(!M?.paint||KEEP_FACTORY.has(id))return;
      const mat=M.paint.clone();if(b.col)mat.color.setStyle(b.junk?'#7a6a58':b.col,THREE.SRGBColorSpace);
      root.traverse(o=>{if(!o.isMesh)return;const replace=m=>m.name===M.paint.name?mat:m;o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);});
    },
    update() {
      if (!started) start();
      if ((tick = (tick + 1) % 12) !== 0 || !models.size) return;
      const c = bridge.cam, R = 95, want = [];
      for (const b of bridge.boxes) if (b.kind === 'parkedcar'&&!b.fleetHidden) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < R) want.push([d, b]); }
      want.sort((a, q) => a[0] - q[0]);
      const keep = new Set(want.slice(0, 48).map(w => w[1]));
      for (const [b, g] of live) if (!keep.has(b)) { scene.remove(g); b.r3d = false; live.delete(b); }
      for (const b of keep) if (!live.has(b)) { const g = make(b); if (g) live.set(b, g); }
      state.cars = live.size;
    },
  };
}

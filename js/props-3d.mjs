// props-3d.mjs — objetos da rua e móveis das casas em 3D (estilo The Sims 4) na camada WebGL, no lugar dos desenhos 2D:
// hidrante, lixeiras, caixa de correio, poste de madeira, banca de jornal, caçamba, carrinho de cachorro-quente,
// postes de luz, semáforos (carros e pedestres, com as luzes trocando), meio-fio com sarjeta, e os móveis
// (cozinha, banheiro, sala e quarto completos). Cada modelo é montado com caixas arredondadas, cilindros e esferas
// com cor por vértice, gerado uma vez e desenhado com InstancedMesh. Móveis aparecem só com o jogador dentro da casa
// (e no andar em que ele está), virados p/ o centro do cômodo.
import {makeKit} from './kit-3d.mjs';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const hash2 = (x, y, k = 0) => { let h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (k * 83492791), 0x45d9f3b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export function createProps(THREE, scene, bridge) {
  const col = hex => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

  const Kit = makeKit(THREE);

  // ======================= modelos (frente = +z, centro na base, medidas nominais) =======================
  const CHROME = '#c9ced2', DARK = '#2b2d30', WHITE = '#ecebe6', WOOD = '#8a6446', WOODL = '#b08a62';
  const M = {};
  M.chair={dims:[.5,.85,.55],tinted:true,make(k,c){chair(k,0,0,0,c);}};
  M.plant={dims:[.44,.74,.44],tinted:true,make(k,c){
    k.cyl(0,0,0,.15,.27,c||'#a07853',14);
    k.cyl(0,.27,0,.035,.59,'#386d48',8);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;
      k.sph(Math.cos(a)*.12,.51+Math.sin(i*17)*.1,Math.sin(a)*.12,.16,
       i%2?'#357b53':'#5ca77a');}
  }};
  M.bookstack={dims:[.34,.2,.26],tinted:true,make(k,c){
    for(let i=0;i<4;i++){
      k.box(-.16,.02+i*.05,-.12,.16,.06+i*.05,.12,i===0?(c||'#bd805d'):i%2?'#567891':'#d5aa67',.01);
      k.box(-.15,.04+i*.05,-.123,.15,.045+i*.05,-.12,'#ece2c8');
    }
  }};
  M.microwave={dims:[.48,.32,.37],tinted:true,make(k,c){
    k.box(-.24,0,-.18,.24,.32,.18,c||'#dce1e5',.035);
    k.box(-.205,.07,.183,.105,.275,.194,'#212c38',.01);
    k.box(.14,.07,.185,.21,.26,.195,'#333f4a',.006);
    for(let y=.1;y<.24;y+=.055)k.sph(.175,y,.195,.008,'#a8e4fd');
  }};
  M.lampdesk={dims:[.32,.58,.32],tinted:true,make(k,c){
    k.cyl(0,0,0,.1,.04,'#8b7a68',12);
    k.cyl(0,.03,0,.025,.34,'#b7ac91',10);
    k.cyl(0,.29,0,.075,.56,c||'#efd3ac',14,.15);
    k.sph(0,.42,0,.085,'#fff2cb',.8);
  }};
  M.lamp={dims:[.4,1.68,.4],tinted:true,make(k,c){
    k.cyl(0,0,0,.18,.05,'#8a8078',14);
    k.cyl(0,.04,0,.035,1.36,'#b4b2b0',10);
    k.cyl(0,1.28,0,.12,1.67,c||'#f6daa9',16,.19);
    k.sph(0,1.43,0,.13,'#ffecc4');
  }};
  M.sectional={dims:[2.45,.87,.9],tinted:true,make(k,c){
    const x=c||'#728b99',dark=new THREE.Color(col(x)).multiplyScalar(.78);
    k.box(-1.22,.16,-.43,1.22,.52,.43,x,.13);
    k.box(-1.22,.5,-.45,1.22,.87,-.21,dark,.065);
    k.box(-1.22,.31,-.44,-.99,.68,.44,x,.06);
    k.box(.99,.31,-.44,1.22,.68,.44,x,.06);
    for(let i=0;i<3;i++)k.box(-1.02+i*.7,.43,-.18,-.35+i*.7,.57,.38,x,.06);
  }};
  M.studentdesk={dims:[1.2,.75,.65],tinted:true,make(k,c){
    for(const x of [-.5,.5])for(const z of [-.23,.23])k.cyl(x,0,z,.025,.71,'#687780',6);
    k.box(-.6,.7,-.325,.6,.75,.325,c||'#bf9b68',.025);k.box(-.18,.75,-.13,.14,.765,.1,'#e8e4da');
  }};
  M.hospitalbed={dims:[1.15,.9,2.05],make(k){
    for(const x of [-.43,.43])for(const z of [-.75,.75]){k.cyl(x,.1,z,.035,.48,'#9aa8ae',8);k.sph(x,.1,z,.09,'#3c464d');}
    k.box(-.53,.43,-.97,.53,.55,.97,'#d1dadb',.04);k.box(-.5,.55,-.94,.5,.7,.94,'#e8eee9',.06);
    k.box(-.45,.7,-.86,.45,.8,-.48,'#faf9f2',.06);k.box(-.5,.7,-.4,.5,.73,.88,'#85b3b0',.02);
    for(const z of [-1,1])k.box(-.55,.55,z-.025,.55,.9,z+.025,'#d5dedf',.03);
    for(const x of [-.55,.55]){k.cyl(x,.5,0,.02,.84,'#b5c5c8',8);k.box(x-.02,.82,-.5,x+.02,.86,.5,'#b5c5c8',.01);}
  }};
  // ---------- rua ----------
  M.hydrant = { dims: [0.3, 0.75, 0.3], make(k) {
    k.cyl(0, 0, 0, 0.16, 0.07, '#cfc9b8'); k.cyl(0, 0.07, 0, 0.115, 0.52, '#e7c21e', 16); k.cyl(0, 0.52, 0, 0.15, 0.58, '#d9b01a', 16);
    k.sph(0, 0.6, 0, 0.12, '#e7c21e', 0.75); k.cyl(0, 0.66, 0, 0.035, 0.74, '#cfc9b8', 6);
    for (const s of [-1, 1]) { k.cylX(s * 0.11, s * 0.2, 0.42, 0, 0.045, '#e7c21e'); k.cylX(s * 0.2, s * 0.215, 0.42, 0, 0.052, '#cfc9b8', 6); }
    k.cylZ(0, 0.36, 0.1, 0.2, 0.065, '#e7c21e'); k.cylZ(0, 0.36, 0.2, 0.22, 0.07, '#cfc9b8', 6);
  } };
  M.trashcan = { dims: [0.6, 0.95, 0.6], make(k) {
    k.cyl(0, 0, 0, 0.27, 0.06, '#2a3a2e', 16); k.cyl(0, 0.06, 0, 0.25, 0.86, '#1f2a22', 16);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, x = Math.cos(a) * 0.27, z = Math.sin(a) * 0.27; const g = k.box(x - 0.025, 0.08, z - 0.012, x + 0.025, 0.84, z + 0.012, '#35503d'); }
    k.cyl(0, 0.82, 0, 0.29, 0.88, '#2d4434', 16); k.sph(0, 0.88, 0, 0.27, '#2d4434', 0.3);
  } };
  M.bin = { dims: [0.6, 1, 0.65], tinted: true, make(k, c) {
    const body = c || '#3b6554', lid = new THREE.Color(col(body)).multiplyScalar(0.75);
    k.box(-0.27, 0.1, -0.28, 0.27, 0.92, 0.28, body, 0.04); k.box(-0.3, 0.92, -0.32, 0.3, 0.99, 0.3, lid, 0.03);
    k.cylX(-0.29, 0.29, 0.1, -0.24, 0.1, DARK); k.cylX(-0.24, 0.24, 0.96, -0.33, 0.022, lid);
    for (const s of [-1, 1]) k.box(s * 0.22, 0.4, 0.28, s * 0.12, 0.7, 0.3, lid);
  } };
  M.post = { dims: [0.14, 1.1, 0.14], make(k) { k.box(-0.06, 0, -0.06, 0.06, 1.1, 0.06, '#e9e5dc', 0.01); k.box(-0.075, 0, -0.075, 0.075, 0.08, 0.075, '#8f8a80'); } };
  M.mailbox = { dims: [0.48, 0.3, 0.26], tinted: true, make(k, c) {
    const body = c || '#2b4f7a';
    k.box(-0.24, 0, -0.12, 0.24, 0.17, 0.12, body, 0.01); k.cylX(-0.24, 0.24, 0.17, 0, 0.12, body, 16);
    k.box(0.235, 0.02, -0.11, 0.25, 0.27, 0.11, new THREE.Color(col(body)).multiplyScalar(0.8)); k.box(-0.02, 0.15, 0.12, 0.02, 0.36, 0.14, '#d0342c'); k.box(-0.02, 0.3, 0.12, 0.12, 0.36, 0.14, '#d0342c');
  } };
  M.newsbox = { dims: [0.5, 1.05, 0.45], make(k) {
    for (const [x, z] of [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.15], [0.18, 0.15]]) k.cyl(x, 0, z, 0.02, 0.42, '#606870', 6);
    k.box(-0.25, 0.42, -0.22, 0.25, 1.0, 0.22, '#2b5fa8', 0.02); k.box(-0.26, 1.0, -0.23, 0.26, 1.05, 0.23, '#234f8e', 0.01);
    k.box(-0.18, 0.62, 0.215, 0.18, 0.9, 0.23, '#b8d0e0'); k.box(-0.06, 0.94, 0.22, 0.06, 0.98, 0.235, CHROME);
  } };
  M.dumpster = { dims: [1.9, 1.2, 1.2], make(k) {
    k.box(-0.92, 0.12, -0.55, 0.92, 1.12, 0.58, '#2f5a3a', 0.04); k.box(-0.95, 0.95, -0.6, 0.95, 1.02, 0.62, '#264a30');
    k.box(-0.92, 1.12, -0.55, 0, 1.17, 0.58, '#3a6b46', 0.02);
    k.box(0.02, 1.12, -0.55, 0.92, 1.17, 0.58, '#3a6b46', 0.02);
    for (const x of [-0.75, 0.75]) for (const z of [-0.45, 0.45]) k.cyl(x, 0, z, 0.08, 0.14, DARK, 8);
    k.box(-0.3, 0.55, 0.58, 0.3, 0.7, 0.6, '#e9e5dc');
  } };
  M.cart = { dims: [1.6, 1.1, 1.0], make(k) {
    k.box(-0.72, 0.32, -0.42, 0.72, 0.95, 0.42, '#cfd3d6', 0.04); k.box(-0.74, 0.95, -0.44, 0.74, 1.0, 0.44, '#e9ecee', 0.02);
    k.box(-0.72, 0.4, 0.42, 0.72, 0.62, 0.44, '#d63a2f'); for (const s of [-1, 1]) k.cylZ(s * 0.5, 0.25, -0.5, 0.5, 0.025, DARK, 6);
    for (const s of [-1, 1]) { k.cylZ(s * 0.55, 0.22, -0.48, -0.42, 0.22, DARK, 16); k.cylZ(s * 0.55, 0.22, 0.42, 0.48, 0.22, DARK, 16); }
    k.cylX(0.74, 1.0, 0.85, -0.3, 0.025, CHROME); k.cylX(0.74, 1.0, 0.85, 0.3, 0.025, CHROME); k.cylZ(1.0, 0.85, -0.3, 0.3, 0.025, CHROME);
    k.cyl(-0.2, 1.0, 0.1, 0.035, 1.18, '#d63a2f', 8); k.cyl(-0.1, 1.0, 0.1, 0.035, 1.18, '#e7c21e', 8); k.box(0.15, 1.0, -0.25, 0.55, 1.12, 0.1, '#b8bcc0');
    k.cyl(0, 1.0, 0, 0.025, 2.2, '#e9e5dc', 6); k.umbrella(0, 2.0, 0, 1.15, 0.45, '#d63a2f', '#f7f5ef');
  } };
  M.couch = { dims: [2.0, 0.75, 0.9], tinted: true, make(k, c) { sofaModel(k, c || '#7a5a48', 2.0, 0.9, true); } };
  // ---------- lixo dos bairros pobres ----------
  // saco de lixo: esfera amassada (rugas por ruído), base achatada, nó com as duas orelhas; plástico brilhante
  M.trashbag = { dims: [0.6, 0.55, 0.6], tinted: true, shiny: true, pick: b => ['#1b1c1f', '#1b1c1f', '#1b1c1f', '#26332a', '#d9d7d0', '#2a3550'][(hash2(b.x * 10 | 0, b.y * 10 | 0, 5) * 6) | 0],
    make(k, c) {
      const body = c || '#1b1c1f', g = new THREE.SphereGeometry(0.27, 22, 16), p = g.attributes.position, sd = hash2(3, 7, (c || '').length);
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const w = 1 + 0.07 * Math.sin(x * 31 + y * 17 + sd * 9) * Math.cos(z * 27 - y * 11) + 0.05 * Math.sin(y * 45 + x * 13);
        x *= w * 1.05; z *= w * 1.05; y = y * 0.82 * w;
        if (y < -0.17) y = -0.17 + (y + 0.17) * 0.15;   // assenta no chão
        if (y > 0.12) { const t = (y - 0.12) / 0.1; x *= 1 - t * 0.55; z *= 1 - t * 0.55; }   // afunila até o nó
        p.setXYZ(i, x, y + 0.2, z);
      }
      g.computeVertexNormals(); k.raw(g, body, 'shiny');
      k.cyl(0, 0.4, 0, 0.05, 0.47, body, 8, 0.025, 'shiny');
      for (const s of [-1, 1]) { const e = k.box(-0.035, 0, -0.01, 0.035, 0.12, 0.01, body, 0.008, 'shiny'); e.rotateZ(s * 0.7); e.translate(s * 0.03, 0.46, 0); }
    } };
  M.tire = { dims: [0.7, 0.22, 0.7], make(k) {
    const t = new THREE.TorusGeometry(0.25, 0.1, 10, 26); t.rotateX(Math.PI / 2); t.scale(1, 1.05, 1); t.translate(0, 0.105, 0); k.raw(t, '#1d1d1f');
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, g = k.box(-0.012, 0.02, -0.03, 0.012, 0.19, 0.03, '#141416'); g.rotateY(-a); g.translate(Math.cos(a) * 0.345, 0, Math.sin(a) * 0.345); }
    k.cyl(0, 0.03, 0, 0.17, 0.05, '#5a4a36', 18);
  } };
  M.mattress = { dims: [1.9, 0.2, 1.4], tinted:true, make(k,c) {
    k.box(-0.95, 0, -0.7, 0.95, 0.2, 0.7, c||'#cdbfa4', 0.06);
    for (let x = -0.75; x <= 0.76; x += 0.3) for (let z = -0.5; z <= 0.51; z += 0.33) k.cyl(x, 0.195, z, 0.018, 0.205, '#a89a80', 6);
    for (const [x, z, r] of [[0.3, 0.1, 0.32], [-0.5, -0.25, 0.2], [0.65, -0.4, 0.15]]) k.cyl(x, 0.2, z, r, 0.204, '#9c8562', 16);
    k.box(-0.95, 0.07, 0.69, 0.95, 0.13, 0.705, '#8e7d62');
  } };
  // ---------- quadra de basquete: poste, tabela, aro e rede (frente = lado da quadra) ----------
  M.hoop = { dims: [0.3, 3.05, 0.3], make(k) {
    k.box(-0.2, 0, -0.2, 0.2, 0.06, 0.2, '#7d7a72'); k.cyl(0, 0.06, 0, 0.065, 3.25, '#3e4246', 12);
    k.box(-0.11, 0.06, -0.11, 0.11, 1.8, 0.11, '#1f3b6e', 0.03);   // proteção acolchoada
    k.box(-0.04, 2.95, 0, 0.04, 3.05, 0.5, '#3e4246'); k.box(-0.04, 3.2, 0, 0.04, 3.28, 0.5, '#3e4246');
    k.box(-0.9, 2.9, 0.5, 0.9, 3.95, 0.53, '#f4f4f0', 0.01); k.box(-0.93, 2.87, 0.49, 0.93, 3.98, 0.5, '#2a2a2c');
    for (const [x0, y0, x1, y1] of [[-0.3, 3.0, 0.3, 3.04], [-0.3, 3.41, 0.3, 3.45], [-0.3, 3.0, -0.26, 3.45], [0.26, 3.0, 0.3, 3.45]]) k.box(x0, y0, 0.53, x1, y1, 0.536, '#c0392b');
    k.box(-0.08, 2.98, 0.53, 0.08, 3.06, 0.56, '#d8642a');
    const rim = new THREE.TorusGeometry(0.23, 0.012, 6, 28); rim.rotateX(Math.PI / 2); rim.translate(0, 3.05, 0.79); k.raw(rim, '#e0672b');
    const net = new THREE.CylinderGeometry(0.225, 0.14, 0.42, 18, 1, true); net.translate(0, 2.84, 0.79); k.raw(net, '#f2f2ee', 'net');
  } };
  // ---------- praia ----------
  M.cooler = { dims: [0.6, 0.4, 0.4], tinted: true, make(k, c) {
    const body = c || '#2b6fb8';
    k.box(-0.3, 0, -0.2, 0.3, 0.3, 0.2, body, 0.035); k.box(-0.31, 0.29, -0.21, 0.31, 0.38, 0.21, '#f2f0ea', 0.035);
    k.box(-0.2, 0.38, -0.025, 0.2, 0.4, 0.025, '#f2f0ea', 0.01); for (const s of [-1, 1]) k.box(s * 0.31 - 0.015, 0.16, -0.08, s * 0.31 + 0.015, 0.22, 0.08, '#d8d4cc', 0.008);
    k.box(-0.08, 0.24, 0.2, 0.08, 0.3, 0.215, '#d8d4cc');
  } };
  // toalha estendida: pano com rugas leves, listras brancas e bainha
  M.towel = { dims: [1.0, 0.012, 1.8], tinted: true, make(k, c) {
    const base = k.col(c || '#e8364f'), white = new THREE.Color(0.96, 0.95, 0.92), hem = base.clone().multiplyScalar(0.8);
    const g = new THREE.PlaneGeometry(1, 1.8, 20, 36).toNonIndexed(); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cl = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      let cx = 0, cz = 0; for (let j = 0; j < 3; j++) { cx += p.getX(i + j) / 3; cz += p.getZ(i + j) / 3; }
      const stripe = ((cx + 0.5) % 0.4) > 0.2 && ((cx + 0.5) % 0.4) < 0.35, edge = Math.abs(cz) > 0.84, cc = edge ? hem : stripe ? white : base;
      for (let j = 0; j < 3; j++) cl.set([cc.r, cc.g, cc.b], (i + j) * 3);
    }
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.006 + 0.006 * Math.sin(x * 9 + z * 3) * Math.cos(z * 7 - x * 2) + (Math.abs(x) > 0.46 ? 0.004 : 0)); }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); k.colored(g);
  } };
  // ---------- lixo espalhado na rua (latas, garrafas, papel amassado, embalagens, jornal, copos) ----------
  const LIT = { can: ['#c8302a', '#c9ced2', '#2f7a3a'], bottle: ['#6b3a12', '#2f6a3a', '#b8d8d0'], paper: ['#efece4', '#e6dcc0', '#f4f2ec'], wrapper: ['#d63a2f', '#e8b51e', '#2b5fa8'], newspaper: ['#d8d4ca', '#cfcabd', '#e0dcd2'], cup: ['#f4f2ec', '#c8302a', '#2b6fb8'] };
  M.can = { dims: [0.07, 0.07, 0.12], tinted: true, shiny: true, make(k, c) { k.cylZ(0, 0.033, -0.06, 0.05, 0.033, c, 12, 'shiny'); k.cylZ(0, 0.033, 0.05, 0.06, 0.03, '#d6dadd', 12, 'shiny'); k.box(-0.034, 0.03, -0.02, 0.034, 0.04, 0.01, '#f4f2ec', 0, 'shiny'); } };
  M.bottle = { dims: [0.07, 0.07, 0.26], tinted: true, shiny: true, make(k, c) { k.cylZ(0, 0.035, -0.13, 0.04, 0.035, c, 12, 'shiny'); const n = new THREE.CylinderGeometry(0.014, 0.035, 0.07, 10); n.rotateX(Math.PI / 2); n.translate(0, 0.035, 0.075); k.raw(n, c, 'shiny'); k.cylZ(0, 0.035, 0.11, 0.13, 0.015, '#c8a03a', 8, 'shiny'); k.cylZ(0, 0.035, -0.06, 0.0, 0.036, '#efe8d8', 12); } };
  M.paper = { dims: [0.1, 0.09, 0.1], tinted: true, make(k, c) { const g = new THREE.IcosahedronGeometry(0.05, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = 0.75 + 0.45 * Math.abs(Math.sin(Math.round(p.getX(i) * 400) * 12.9898 + Math.round(p.getY(i) * 400) * 78.233 + Math.round(p.getZ(i) * 400) * 37.719) * 43758.5453 % 1); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.85 + 0.042, p.getZ(i) * f); } g.computeVertexNormals(); k.raw(g, c); } };
  M.wrapper = { dims: [0.15, 0.02, 0.1], tinted: true, shiny: true, make(k, c) { const g = new THREE.PlaneGeometry(0.15, 0.1, 6, 4); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.004 + 0.008 * Math.abs(Math.sin(p.getX(i) * 70 + p.getZ(i) * 40))); g.computeVertexNormals(); k.raw(g, c, 'shiny'); const b = g.clone(); b.rotateX(Math.PI); b.translate(0, 0.008, 0); k.raw(b, '#c9ced2', 'shiny'); } };
  M.newspaper = { dims: [0.32, 0.02, 0.22], tinted: true, make(k, c) {
    const a = k.box(-0.16, 0, -0.11, 0.16, 0.012, 0.11, c); a.rotateY(0.04);
    const b = k.box(-0.15, 0.012, -0.1, 0.13, 0.02, 0.1, c); b.rotateY(-0.12);
    for (let i = 0; i < 6; i++) k.box(-0.12, 0.0205, -0.08 + i * 0.03, -0.12 + (i % 3 ? 0.2 : 0.1), 0.0215, -0.07 + i * 0.03, '#6a6862');
    k.box(-0.12, 0.0205, -0.095, 0.08, 0.022, -0.085, '#2a2a2c');
  } };
  M.cup = { dims: [0.09, 0.09, 0.11], tinted: true, make(k, c) { const g = new THREE.CylinderGeometry(0.045, 0.032, 0.11, 14, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0.04, 0); k.raw(g, c); const l = new THREE.CylinderGeometry(0.047, 0.047, 0.012, 14); l.rotateX(Math.PI / 2); l.translate(0, 0.045, 0.058); k.raw(l, '#f4f2ec'); k.cylZ(0.02, 0.07, 0.05, 0.12, 0.004, '#e8e2d0', 5); } };
  // ---------- móveis ----------
  M.fridge = { dims: [0.72, 1.8, 0.7], face: 'any', tinted:true, make(k,c) {
    k.box(-0.36, 0.04, -0.35, 0.36, 1.8, 0.35, c||'#e8e6e0', 0.035); k.box(-0.34, 0, -0.32, 0.34, 0.06, 0.3, DARK);
    k.box(-0.35, 1.18, 0.33, 0.35, 1.2, 0.36, '#9c9a94');
    k.box(0.25, 0.5, 0.35, 0.28, 1.08, 0.39, CHROME, 0.01); k.box(0.25, 1.28, 0.35, 0.28, 1.6, 0.39, CHROME, 0.01);
  } };
  M.stove = { dims: [0.75, 0.9, 0.62], face: 'any', tinted:true, make(k,c) {
    k.box(-0.375, 0, -0.31, 0.375, 0.87, 0.31, c||'#e9e6df', 0.02); k.box(-0.37, 0.87, -0.3, 0.37, 0.9, 0.3, '#1d1e20');
    for (const [x, z] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]]) { k.cyl(x, 0.9, z, 0.09, 0.91, '#4a4c50', 18); k.cyl(x, 0.91, z, 0.04, 0.915, '#2a2b2e', 12); }
    k.box(-0.3, 0.12, 0.31, 0.3, 0.6, 0.32, '#2a2d32'); k.cylX(-0.26, 0.26, 0.66, 0.335, 0.015, CHROME);
    for (let i = 0; i < 4; i++) k.cylZ(-0.24 + i * 0.16, 0.78, 0.31, 0.34, 0.025, '#3a3c40', 10);
    k.box(-0.375, 0.9, -0.31, 0.375, 1.0, -0.27, c||'#e9e6df', 0.01);
  } };
  M.sink = { dims: [0.8, 0.86, 0.58], face: 'any', tinted:true, make(k,c) {
    k.box(-0.4, 0.06, -0.29, 0.4, 0.82, 0.27, c||WHITE, 0.01); k.box(-0.38, 0, -0.27, 0.38, 0.06, 0.24, DARK);
    k.box(-0.005, 0.1, 0.27, 0.005, 0.78, 0.28, '#b8b4aa'); for (const s of [-1, 1]) k.box(s * 0.05 - 0.008, 0.6, 0.27, s * 0.05 + 0.008, 0.72, 0.3, CHROME);
    k.box(-0.42, 0.82, -0.3, 0.42, 0.86, 0.3, '#d8d4cc'); k.box(-0.24, 0.84, -0.17, 0.24, 0.865, 0.17, '#9ca2a6');
    k.cyl(0, 0.86, -0.22, 0.02, 1.08, CHROME, 8); k.cylZ(0, 1.07, -0.22, -0.08, 0.016, CHROME, 8);
  } };
  M.counter = { dims: [2.8, 0.9, 0.6], face: 'short', tinted:true, make(k,c) {
    const W = 1.4; k.box(-W, 0.08, -0.3, W, 0.86, 0.28, c||WHITE, 0.01); k.box(-W + 0.02, 0, -0.27, W - 0.02, 0.08, 0.24, DARK);
    for (let x = -W + 0.6; x < W; x += 0.6) k.box(x - 0.005, 0.1, 0.28, x + 0.005, 0.84, 0.29, '#b8b4aa');
    for (let x = -W + 0.3; x < W; x += 0.6) { k.box(x - 0.08, 0.72, 0.28, x + 0.08, 0.735, 0.31, CHROME); }
    k.box(-W - 0.02, 0.86, -0.31, W + 0.02, 0.9, 0.31, '#4a4642');
    k.box(-W + 0.1, 0.9, -0.25, -W + 0.6, 1.18, 0.12, '#2e3034', 0.02); k.box(-W + 0.14, 0.95, 0.12, -W + 0.46, 1.13, 0.13, '#15181c');   // micro-ondas
    k.box(-0.2, 0.9, -0.08, 0.25, 0.915, 0.18, '#c49a6c'); k.cyl(0.65, 0.9, -0.12, 0.08, 1.08, '#c03a30', 14); k.cyl(0.65, 1.08, -0.12, 0.02, 1.11, DARK, 8);
    k.cyl(-0.65, 0.9, -0.05, 0.12, 0.96, '#e4ddd0', 16); for (let i = 0; i < 4; i++) k.sph(-0.65 + (i % 2 - 0.5) * 0.08, 0.99, -0.05 + ((i / 2) | 0) * 0.07 - 0.03, 0.045, i % 2 ? '#e88a2a' : '#c8302a');
  } };
  M.cabinet = { dims: [1.05, 1.6, 0.48], face: 'short', tinted: true, make(k, c) {
    const w = c || '#9a7a56', dk = new THREE.Color(col(w)).multiplyScalar(0.7);
    k.box(-0.525, 0, -0.24, 0.525, 1.6, 0.22, w, 0.01); k.box(-0.54, 1.56, -0.25, 0.54, 1.62, 0.24, dk);
    k.box(-0.005, 0.05, 0.22, 0.005, 1.55, 0.23, dk); for (const s of [-1, 1]) k.box(s * 0.06 - 0.01, 0.75, 0.22, s * 0.06 + 0.01, 0.95, 0.25, CHROME);
  } };
  M.wardrobe = { dims: [1.43, 1.9, 0.62], face: 'short', tinted: true, make(k, c) {
    const w = c || '#7a5a3e', dk = new THREE.Color(col(w)).multiplyScalar(0.68);
    k.box(-0.715, 0.06, -0.31, 0.715, 1.85, 0.29, w, 0.01); k.box(-0.7, 0, -0.29, 0.7, 0.06, 0.27, dk); k.box(-0.74, 1.85, -0.32, 0.74, 1.92, 0.31, dk);
    k.box(-0.006, 0.1, 0.29, 0.006, 1.82, 0.3, dk); for (const s of [-1, 1]) { k.box(s * 0.07 - 0.012, 0.8, 0.29, s * 0.07 + 0.012, 1.15, 0.32, CHROME); k.box(s * 0.36 - 0.28, 0.15, 0.29, s * 0.36 + 0.28, 1.75, 0.295, new THREE.Color(col(w)).multiplyScalar(1.08)); }
  } };
  M.shelf = { dims: [2.5, 1.9, 0.45], face: 'short', tinted:true, make(k,c) {
    const W = 1.25, r = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7), BOOK = ['#9a2f2a', '#2f5a8a', '#3d7a4a', '#c8a03a', '#6a4a8a', '#e8e0d0', '#2a2a2a', '#b85a2a'];
    k.box(-W, 0, -0.22, -W + 0.04, 1.9, 0.22, c||WOOD); k.box(W - 0.04, 0, -0.22, W, 1.9, 0.22, c||WOOD); k.box(-W, 0, -0.22, W, 1.9, -0.2, '#6e4e36');
    for (let y = 0; y <= 1.86; y += 0.465) { k.box(-W, y, -0.22, W, y + 0.035, 0.22, c||WOOD); if (y > 1.8) break;
      for (let x = -W + 0.08; x < W - 0.12;) { const bw = 0.03 + r() * 0.04, bh = 0.24 + r() * 0.14; if (r() < 0.12) { x += 0.15; continue; } k.box(x, y + 0.035, -0.17, x + bw, y + 0.035 + bh, 0.13, BOOK[(r() * BOOK.length) | 0]); x += bw + 0.004; } }
  } };
  M.desk = { dims: [1.1, 0.74, 0.62], face: 'short', tinted:true, make(k,c) {
    k.box(-0.55, 0.7, -0.31, 0.55, 0.74, 0.31, c||WOODL, 0.01); for (const s of [-1, 1]) k.box(s * 0.53 - 0.02, 0, -0.29, s * 0.53 + 0.02, 0.7, 0.29, c||WOODL);
    k.box(0.15, 0.45, -0.29, 0.51, 0.7, 0.29, WOOD); k.box(0.2, 0.55, 0.29, 0.46, 0.65, 0.3, '#5a3e2a');
    k.box(-0.3, 0.74, -0.05, 0.1, 0.755, 0.22, '#3a3d42'); k.box(-0.3, 0.755, -0.06, 0.1, 1.0, -0.05, '#1c1f24'); k.box(-0.28, 0.77, -0.049, 0.08, 0.98, -0.045, '#3c6a8a');
    // cadeira de escritório na frente
    k.cyl(0, 0, 0.6, 0.05, 0.05, DARK, 5); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.box(Math.cos(a) * 0.22 - 0.02, 0.02, 0.6 + Math.sin(a) * 0.22 - 0.02, Math.cos(a) * 0.22 + 0.02, 0.05, 0.6 + Math.sin(a) * 0.22 + 0.02, DARK); }
    k.cyl(0, 0.05, 0.6, 0.025, 0.42, '#6a6e72', 8); k.box(-0.23, 0.42, 0.38, 0.23, 0.5, 0.82, '#2f3540', 0.04); k.box(-0.21, 0.5, 0.78, 0.21, 0.98, 0.84, '#2f3540', 0.04);
  } };
  M.table = { dims: [1.5, 0.75, 1.1], face: 'any', tinted:true, make(k,c) {
    k.box(-0.75, 0.71, -0.55, 0.75, 0.75, 0.55, c||'#a07650', 0.015); for (const x of [-0.66, 0.66]) for (const z of [-0.46, 0.46]) k.box(x - 0.035, 0, z - 0.035, x + 0.035, 0.71, z + 0.035, '#7a5638');
    for (const x of [-0.35, 0.35]) for (const s of [-1, 1]) chair(k, x, s * 0.78, s < 0 ? 0 : Math.PI,c);
    k.cyl(0, 0.75, 0, 0.06, 0.93, '#e8e2d4', 12); for (let i = 0; i < 3; i++) k.sph((i - 1) * 0.04, 0.97, (i % 2) * 0.03, 0.04, '#d84a5a');
    for (const x of [-0.35, 0.35]) for (const s of [-1, 1]) k.cyl(x, 0.75, s * 0.32, 0.12, 0.76, '#f4f2ec', 18);
  } };
  M.sofa = { dims: [2.1, 0.56, 0.85], face: 'short', tinted: true, make(k, c) { sofaModel(k, c || '#5d6e82', 2.1, 0.85, false); } };
  M.tv = { dims: [1.1, 0.55, 0.45], face: 'any', tinted:true, make(k,c) {
    k.box(-0.55, 0.05, -0.22, 0.55, 0.5, 0.22, c||'#3a2e26', 0.01); k.box(-0.53, 0, -0.2, 0.53, 0.05, 0.2, DARK);
    for (const s of [-1, 1]) k.box(s * 0.27 - 0.25, 0.1, 0.22, s * 0.27 + 0.25, 0.45, 0.225, '#4a3c32');
    k.box(-0.06, 0.5, -0.12, 0.06, 0.55, -0.02, DARK); k.box(-0.015, 0.55, -0.08, 0.015, 0.62, -0.06, DARK);
    k.box(-0.52, 0.6, -0.1, 0.52, 1.2, -0.06, '#151618', 0.01); k.box(-0.5, 0.62, -0.06, 0.5, 1.18, -0.055, '#1d2b3a');
    k.box(-0.3, 0.5, 0.05, 0.3, 0.56, 0.12, '#202226', 0.01);
  } };
  M.bed = { dims: [1.6, 0.55, 2.1], face: 'long', tinted: true, make(k, c) {
    const blanket = c || '#5a7aa8', fold = new THREE.Color(col(blanket)).lerp(new THREE.Color(1, 1, 1), 0.35);
    k.box(-0.8, 0.1, -1.05, 0.8, 0.32, 1.05, WOOD, 0.02); for (const x of [-0.74, 0.74]) for (const z of [-0.98, 0.98]) k.box(x - 0.04, 0, z - 0.04, x + 0.04, 0.1, z + 0.04, '#5a3e2a');
    k.box(-0.77, 0.32, -1.0, 0.77, 0.52, 1.02, '#f2f0ea', 0.06);
    k.box(-0.82, 0.3, -0.32, 0.82, 0.57, 1.07, blanket, 0.05); k.box(-0.8, 0.5, -0.4, 0.8, 0.6, -0.22, fold, 0.05);
    for (const s of [-1, 1]) k.box(s * 0.38 - 0.32, 0.52, -0.98, s * 0.38 + 0.32, 0.66, -0.6, '#f8f6f0', 0.06);
    k.box(-0.86, 0.1, -1.12, 0.86, 1.15, -1.03, '#6e4e36', 0.02); k.box(-0.78, 0.4, -1.04, 0.78, 1.05, -1.0, new THREE.Color(col(blanket)).multiplyScalar(0.6), 0.03);
  } };
  M.toilet = { dims: [0.45, 0.45, 0.7], face: 'long', tinted:true, make(k,c) {
    k.box(-0.2, 0.4, -0.35, 0.2, 0.8, -0.17, c||'#f4f2ec', 0.04); k.box(-0.21, 0.79, -0.36, 0.21, 0.82, -0.16, '#e8e6e0', 0.01); k.cyl(0, 0.82, -0.26, 0.025, 0.835, CHROME, 8);
    k.cyl(0, 0, -0.04, 0.12, 0.3, '#eceae4', 16, 0.15); k.sph(0, 0.33, 0.02, 0.19, '#f4f2ec', 0.45, undefined, 1, 1.35);
    k.box(-0.19, 0.4, -0.17, 0.19, 0.43, 0.28, '#f8f6f2', 0.06);
  } };
  M.shower = { dims: [0.85, 1.9, 0.85], face: 'any', tinted:true, make(k,c) {
    k.box(-0.425, 0, -0.425, 0.425, 0.08, 0.425, '#f4f2ec', 0.02); k.cyl(0, 0.08, 0, 0.04, 0.085, '#9ca0a4', 10);
    k.box(-0.425, 0, -0.425, 0.425, 1.95, -0.4, c||'#dfe8ea'); k.box(-0.425, 0, -0.425, -0.4, 1.95, 0.425, c||'#dfe8ea');
    for (let y = 0.3; y < 1.95; y += 0.3) { k.box(-0.42, y, -0.401, 0.42, y + 0.006, -0.398, '#b8c4c8'); k.box(-0.401, y, -0.42, -0.398, y + 0.006, 0.42, '#b8c4c8'); }
    k.cyl(0.1, 0.9, -0.39, 0.012, 1.95, CHROME, 8); k.cylZ(0.1, 1.95, -0.39, -0.25, 0.012, CHROME, 8); k.cyl(0.1, 1.9, -0.25, 0.07, 1.93, CHROME, 14);
    k.box(-0.425, 0.08, 0.41, 0.425, 1.95, 0.425, '#bfe0ea', 0, 'glass'); k.box(0.41, 0.08, -0.425, 0.425, 1.95, 0.425, '#bfe0ea', 0, 'glass');
    k.box(0.405, 0.08, 0.405, 0.43, 1.95, 0.43, CHROME); k.box(-0.43, 1.93, 0.405, 0.43, 1.96, 0.43, CHROME);
  } };
  M.mirror = { dims: [0.85, 1.6, 0.1], face: 'short', tinted:true, make(k,c) { k.box(-0.38, 0.85, -0.05, 0.38, 1.55, 0.0, c||'#f0ece2', 0.02); k.box(-0.34, 0.89, 0.0, 0.34, 1.51, 0.01, '#b8ccd6'); } };
  M.rug = { dims: [1.5, 0.02, 1.05], face: 'any', tinted: true, make(k, c) {
    const base = c || '#8c7665', dk = new THREE.Color(col(base)).multiplyScalar(0.65), lt = new THREE.Color(col(base)).lerp(new THREE.Color(1, 0.95, 0.85), 0.4);
    k.box(-0.75, 0, -0.525, 0.75, 0.012, 0.525, dk); k.box(-0.66, 0.012, -0.44, 0.66, 0.016, 0.44, base);
    for (let i = -2; i <= 2; i++) k.box(i * 0.24 - 0.04, 0.016, -0.36, i * 0.24 + 0.04, 0.018, 0.36, lt);
  } };
  M.screen = { dims: [1.2, 0.7, 0.1], face: 'short', tinted:true, make(k,c) { k.box(-0.6, 0, -0.05, 0.6, 0.7, 0.0, c||'#151618', 0.01); k.box(-0.57, 0.03, 0.0, 0.57, 0.67, 0.006, '#1d2b3a'); } };
  // cadeira de jantar virada p/ rot
  function chair(k, x, z, rot,paint=null) {
    const c = Math.cos(rot), s = Math.sin(rot), P = (u, v) => [x + u * c + v * s, z - u * s + v * c];
    const parts = [];
    const bx = (u0, y0, v0, u1, y1, v1, cl, r = 0) => { const [ax, az] = P((u0 + u1) / 2, (v0 + v1) / 2), g = k.box(-Math.abs(u1 - u0) / 2, y0, -Math.abs(v1 - v0) / 2, Math.abs(u1 - u0) / 2, y1, Math.abs(v1 - v0) / 2, cl, r); g.rotateY(rot); g.translate(ax, 0, az); };
    bx(-0.21, 0.43, -0.21, 0.21, 0.47, 0.21, paint||'#7a5638', 0.01); for (const u of [-0.18, 0.18]) for (const v of [-0.18, 0.18]) bx(u - 0.02, 0, v - 0.02, u + 0.02, 0.43, v + 0.02, '#6a4a30');
    bx(-0.2, 0.47, 0.18, 0.2, 0.92, 0.22, paint||'#7a5638', 0.01); bx(-0.19, 0.47, -0.19, 0.19, 0.5, 0.19, '#c8b89a', 0.02);
  }
  function sofaModel(k, fabric, W, D, worn) {
    const f = col(fabric), dk = f.clone().multiplyScalar(0.78), hw = W / 2, hd = D / 2;
    for (const x of [-hw + 0.08, hw - 0.08]) for (const z of [-hd + 0.08, hd - 0.08]) k.cyl(x, 0, z, 0.03, 0.08, '#2a2420', 6);
    k.box(-hw, 0.08, -hd, hw, 0.24, hd, dk, 0.03);
    const n = W > 1.6 ? 3 : 2, cw = (W - 0.36) / n; for (let i = 0; i < n; i++) k.box(-hw + 0.18 + i * cw + 0.01, 0.24, -hd + 0.22, -hw + 0.18 + (i + 1) * cw - 0.01, 0.44, hd - 0.02, f, 0.05);
    k.box(-hw, 0.24, -hd, hw, 0.9, -hd + 0.22, f, 0.06); for (const s of [-1, 1]) k.box(s * hw - (s > 0 ? 0.18 : 0), 0.24, -hd, s * hw + (s < 0 ? 0.18 : 0), 0.62, hd, f, 0.06);
    if (!worn) for (const s of [-1, 1]) { const p = k.box(-0.18, 0, -0.06, 0.18, 0.36, 0.06, s > 0 ? '#e8d8b8' : '#c87a4a', 0.06); p.rotateY(s * 0.25); p.rotateX(-0.2); p.translate(s * (hw - 0.42), 0.46, -hd + 0.3); }
  }

  // ======================= materiais e malhas instanciadas =======================
  // Shared physically based materials for indoor furniture. Street props keep
  // the original light Lambert shader; no expensive per-item material instances.
  const wovenData=new Uint8Array(48*48*4);
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){
    const o=(y*48+x)*4,u=((x%4)-1.5)/1.5,v=((y%4)-1.5)/1.5;
    wovenData[o]=Math.max(110,Math.min(145,128+u*5));
    wovenData[o+1]=Math.max(110,Math.min(145,128+v*5));
    wovenData[o+2]=254;wovenData[o+3]=255;
  }
  const wovenNormal=new THREE.DataTexture(wovenData,48,48,THREE.RGBAFormat);
  wovenNormal.wrapS=wovenNormal.wrapT=THREE.RepeatWrapping;
  wovenNormal.repeat.set(3,3);wovenNormal.needsUpdate=true;
  const matHomeFabric=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0,
    normalMap:wovenNormal,normalScale:new THREE.Vector2(.22,.22)});
  const matHomeWood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.67,metalness:0});
  const matHomeCeramic=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.28,metalness:.07});
  const matHomeSteel=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.34,metalness:.46});
  const fabricSet=new Set(['sofa','couch','sectional','chair','bed','mattress','rug']);
  const metallicSet=new Set(['fridge','stove','microwave','mirror','tv','screen','lamp','lampdesk']);
  const ceramicSet=new Set(['sink','toilet','shower']);
  const indoorMaterial=name=>fabricSet.has(name)?matHomeFabric:metallicSet.has(name)?matHomeSteel:
    ceramicSet.has(name)?matHomeCeramic:matHomeWood;
  const matBody = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matGlass = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false });
  const matShiny = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x555555 });   // plástico, lata, vidro
  // rede da cesta: losangos pintados num canvas, recorte por alphaTest
  const netTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 3; for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 2); return t; })();
  const matNet = new THREE.MeshLambertMaterial({ vertexColors: true, map: netTex, alphaTest: 0.5, side: THREE.DoubleSide });
  const kinds = new Map();   // chave (tipo|cor) -> { def, meshes, list }
  const CAP = { hydrant: 1500, trashcan: 900, bin: 900, post: 800, mailbox: 400, newsbox: 400, dumpster: 200, cart: 120, couch: 200, trashbag: 900, tire: 400, can: 400, bottle: 400, paper: 400, wrapper: 400, newspaper: 400, cup: 400, towel: 300, cooler: 300, hoop: 120 };
  function kindOf(name, color) {
    const def = M[name], key = def.tinted && color ? name + '|' + color : name;
    if (kinds.has(key)) return kinds.get(key);
    if (def.tinted && color && [...kinds.keys()].filter(k => k.startsWith(name + '|')).length >= 8) return kindOf(name, null);
    const kit = Kit(); def.make(kit, def.tinted ? color : undefined); const geos = kit.done(), cap = CAP[name] || 300, meshes = [];
    for (const [set, geo] of Object.entries(geos)) {
      const chosen={glass:matGlass,shiny:matShiny,net:matNet}[set]||(def?.dims?indoorMaterial(name):matBody);
      const m = new THREE.InstancedMesh(geo,chosen,cap);
      m.castShadow = set !== 'glass' && set !== 'net' && name !== 'towel'; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m); meshes.push(m);
    }
    const bounds=new THREE.Box3();for(const geo of Object.values(geos)){geo.computeBoundingBox();bounds.union(geo.boundingBox);}
    const k = { def, meshes, list: [], cap, bounds }; kinds.set(key, k); return k;
  }

  // poste de luz: modelo próprio em metros (braço ao longo de +x), lente que acende à noite
  const lampKit = Kit();
  lampKit.cyl(0, 0, 0, 0.2, 0.22, '#8f8b84', 12); lampKit.cyl(0, 0.22, 0, 0.075, 4.0, '#8a9296', 10, 0.055);
  lampKit.raw(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 3.95, 0), new THREE.Vector3(0, 4.15, 0), new THREE.Vector3(0.3, 4.15, 0)), 8, 0.05, 8), '#8a9296');
  lampKit.cylX(0.25, 1.05, 4.15, 0, 0.045, '#8a9296', 8); lampKit.box(0.8, 4.06, -0.13, 1.35, 4.18, 0.13, '#3c4044', 0.03); lampKit.box(0.85, 4.04, -0.1, 1.3, 4.06, 0.1, '#fff4d8', 0, 'glow');
  const lampGeo = lampKit.done(), matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const lampMeshes = Object.entries(lampGeo).map(([set, geo]) => { const m = new THREE.InstancedMesh(geo, set === 'glow' ? matGlow : matBody, 2500); m.castShadow = set !== 'glow'; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; });

  // ======================= semáforos (poucos: um Group por semáforo) =======================
  const LIGHT = { red: '#ff3a2a', yellow: '#ffc21a', green: '#2aff7a', walk: '#e8fff2', stop: '#ff6a2a' };
  const lightMat = {};   // grupo|cor -> material (liga/desliga trocando a cor)
  const lm = key => lightMat[key] || (lightMat[key] = new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false }));
  const signals = new Map();
  function buildSignal(s) {
    const g = new THREE.Group(), body = new THREE.MeshLambertMaterial({ color: col('#3a3e42') }), yellow = new THREE.MeshLambertMaterial({ color: col('#2a2c2e') });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.075, 0.09, s.poleHeight, 12), body, s.x, s.poleHeight / 2, s.y);
    const tipX = s.x + s.ix * s.armSpan, tipZ = s.y + s.iy * s.armSpan, arm = add(new THREE.CylinderGeometry(0.055, 0.065, s.armSpan, 10), body, (s.x + tipX) / 2, s.armHeight, (s.y + tipZ) / 2);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s.ix, 0, s.iy));
    const faceRot = Math.atan2(-s.ax, -s.ay);
    for (const f of [0.53, 1]) {
      const hx = s.x + s.ix * s.armSpan * f, hz = s.y + s.iy * s.armSpan * f;
      add(new THREE.CylinderGeometry(0.025, 0.025, s.armHeight - s.headHeight - 0.5, 6), body, hx, (s.armHeight + s.headHeight + 0.5) / 2, hz);
      const head = new THREE.Group(); head.position.set(hx, s.headHeight, hz); head.rotation.y = faceRot; g.add(head);
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.36, 1.0, 0.26, 2, 0.04), yellow); box.castShadow = true; head.add(box);
      ['red', 'yellow', 'green'].forEach((c, i) => {
        const y = 0.3 - i * 0.3, lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), lm(s.group + '|' + c)); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, y, 0.135); head.add(lamp);
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 16, 1, true, -Math.PI / 2, Math.PI), yellow); visor.rotation.x = Math.PI / 2; visor.position.set(0, y + 0.02, 0.2); head.add(visor);
      });
    }
    const ped = new THREE.Group(); ped.position.set(s.x, 2.4, s.y); ped.rotation.y = Math.atan2(-s.ix, -s.iy); g.add(ped);
    ped.add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.55, 0.22, 2, 0.03), yellow));
    for (const [y, c] of [[0.12, 'stop'], [-0.12, 'walk']]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), lm('ped|' + c)); p.position.set(0, y, 0.115); ped.add(p); }
    scene.add(g); return g;
  }
  function updateSignals(T, night) {
    const list = bridge.world.trafficSignals || [], seen = new Set();
    for (const s of list) { seen.add(s); if (!signals.has(s)) signals.set(s, buildSignal(s)); }
    for (const [s, g] of signals) if (!seen.has(s)) { scene.remove(g); signals.delete(s); }
    if (!list.length || typeof bridge.trafficPhase !== 'function') return;
    const ph = bridge.trafficPhase(T), off = 0x26221e;
    for (const grp of ['main', 'branch']) for (const c of ['red', 'yellow', 'green']) lm(grp + '|' + c).color.set(ph[grp] === c ? col(LIGHT[c]) : new THREE.Color(off));
    lm('ped|walk').color.set(ph.pedestrian === 'walk' ? col(LIGHT.walk) : new THREE.Color(off));
    lm('ped|stop').color.set(ph.pedestrian !== 'walk' && (ph.pedestrian === 'stop' || Math.floor(T * 2) % 2) ? col(LIGHT.stop) : new THREE.Color(off));
  }

  // ======================= meio-fio: degrau entre a rua e a calçada =======================
  // A calçada é o nível do chão (objetos e pessoas pisam nela) e a rua fica 17 cm abaixo: o topo do meio-fio fica
  // rente à calçada, com a quina clara, e a face desce até a sarjeta (mais escura embaixo). Do outro lado da rua a face
  // fica de costas p/ a câmera e só aparece a quina, como num degrau de verdade. Nas entradas de carro o meio-fio
  // é rebaixado (bridge.curbBreak). A sarjeta de concreto é pintada no chão 2D (terrain.js).
  const matCurb = new THREE.MeshLambertMaterial({ vertexColors: true });
  let curbMesh = null; const curbSync = { x: 1e9, y: 1e9, n: -1, roads: null };
  function buildCurbs(cx, cy, R) {
    const C = { lo: col('#4f4b46'), face: col('#a19b90'), nose: col('#e8e2d6'), top: col('#cdc6b8') }, DROP = 0.17;
    const pos = [], nor = [], cl = [], idx = [], roads = bridge.roads || [], RW = bridge.ROAD_W || 3.5;
    for (const rd of roads) {
      if (rd.cls === 'highway' || !rd.pts || rd.pts.length < 3) continue;
      const o = RW + (rd.off || 0);
      for (const side of [1, -1]) {
        let prev = null;
        for (let i = 0; i < rd.pts.length; i += 2) {
          const p = rd.pts[i], nx = p.nx * side, ny = p.ny * side, ex = p.x + nx * o, ey = p.y + ny * o;
          const far = (ex - cx) ** 2 + (ey - cy) ** 2 > R * R, gap = far || bridge.curbBreak(ex + nx * 0.15, ey + ny * 0.15, rd.bigId);
          if (gap) { prev = null; continue; }
          const Nf = [-nx, 0, -ny], Nn = [-nx * 0.7, 0.7, -ny * 0.7], Nu = [0, 1, 0];
          const prof = [[0, -DROP, C.lo, Nf], [0, -0.014, C.face, Nf], [0, -0.014, C.nose, Nn], [0.018, 0.003, C.nose, Nn], [0.018, 0.003, C.top, Nu], [0.19, 0.003, C.top, Nu]];
          const base = pos.length / 3;
          for (const [d, h, c, n] of prof) { pos.push(ex + nx * d, h, ey + ny * d); nor.push(...n); cl.push(c.r, c.g, c.b); }
          if (prev !== null) for (const j of [0, 2, 4]) { const A = prev + j, B = base + j; side > 0 ? idx.push(A, B, A + 1, A + 1, B, B + 1) : idx.push(A, A + 1, B, A + 1, B + 1, B); }
          prev = base;
        }
      }
    }
    if (curbMesh) { scene.remove(curbMesh); curbMesh.geometry.dispose(); curbMesh = null; }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx);
    curbMesh = new THREE.Mesh(g, matCurb); curbMesh.frustumCulled = false; curbMesh.receiveShadow = true; scene.add(curbMesh);
  }

  // ======================= distribuição =======================
  const handles = b => (bridge.props3d ? bridge.props3d(b) : false) && M[b.kind] && b.kind !== 'blanket';
  const upstairsIn = H => H.upper && H.inside && (bridge.player.floor === 1 || (bridge.player.stairTravel && bridge.player.stairTravel.to === 1));
  const state = { objects: 0, furniture: 0, lamps: 0, signals: 0, curbs: 0, ms: 0 };
  const sync = { x: 1e9, y: 1e9, n: -1, v: -1, inside: '' }, mat = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function place(k, i, x, y, z, rot, sx, sy, sz) { ps.set(x, z, y); q.setFromAxisAngle(up, rot); sc.set(sx, sy, sz); mat.compose(ps, q, sc); for (const m of k.meshes) m.setMatrixAt(i, mat); }
  function rebuild(cx, cy, R) {
    const t0 = performance.now();
    for (const k of kinds.values()) k.list.length = 0;
    let furniture = 0, objects = 0;
    for (const b of bridge.boxes || []) {
      if (!handles(b)) continue;
      const dx = b.x - cx, dy = b.y - cy; if (dx * dx + dy * dy > R * R) continue;
      const H = b.house;
      if (H && !b.exteriorFixture) {
       if (!H.inside || (H.architecture?(b.floor||0)!==(bridge.player.stairTravel?.to??bridge.player.floor??0):((b.floor===1)!==!!upstairsIn(H))))continue;
       if(H.unitBuilding&&!window.CityBuildings?.canSeeFurniture(H,b,bridge.player))continue;
       furniture++;
     }else objects++;
      const def = M[b.kind], color = def.tinted ? (def.pick ? def.pick(b) : b.kind === 'cooler' ? b.side : b.top) : null, k = kindOf(b.kind, color);
      if (k.list.length < k.cap) k.list.push(b);
    }
    for (const bin of bridge.urbanBins || []) { const dx = bin.x - cx, dy = bin.y - cy; if (dx * dx + dy * dy > R * R) continue; const k = kindOf('bin', bin.kind === 'metal' ? '#697c82' : '#3b6554'); if (k.list.length < k.cap) k.list.push({ x: bin.x, y: bin.y, z: 0, w: 0.6, d: 0.65, h: 1, rot: (bin.seed || 0) % 6.28, kind: 'bin' }); objects++; }
    for (const d of bridge.urbanLitter || []) {
      const dx = d.x - cx, dy = d.y - cy; if (dx * dx + dy * dy > R * R || !LIT[d.kind]) continue;
      const k = kindOf(d.kind, LIT[d.kind][(d.variant || 0) % 3]), [W, Hn, D] = M[d.kind].dims; if (k.list.length < k.cap) k.list.push({ x: d.x, y: d.y, z: 0, w: W * 1.35, d: D * 1.35, h: Hn * 1.35, rot: d.a || 0, kind: d.kind });   // um pouco maior que o real p/ ler de longe objects++;
    }
    for (const d of bridge.world.decals || []) {
      if (d.kind !== 'towel' || !d.q) continue;
      const q = d.q, x = (q[0][0] + q[2][0]) / 2, y = (q[0][1] + q[2][1]) / 2, dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > R * R) continue;
      const k = kindOf('towel', d.col); if (k.list.length < k.cap) k.list.push({ x, y, z: 0, w: Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), d: Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]), h: 0.012, rot: Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]), kind: 'towel' }); objects++;
    }
    for (const k of kinds.values()) {
      const [W, Hn, D] = k.def.dims;
      k.list.forEach((b, i) => {
        let rot = b.face ? Math.atan2(b.face[0], b.face[1]) : -(b.rot || 0), sx = b.w / W, sz = b.d / D;
        const H = b.house, face = k.def.face;
        if (H && face && !b.homeManaged) {   // vira a frente (+z) p/ o centro do cômodo
          const hx = (b.roomCenter?.[0]??(H.x0 + H.x1) / 2) - b.x, hy = (b.roomCenter?.[1]??(H.y0 + H.y1) / 2) - b.y, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
          const cand = [[0, -s, c], [1, -c, -s], [2, s, -c], [3, c, s]].filter(([qq]) => face === 'any' ? true : face === 'short' ? (b.w >= b.d ? qq % 2 === 0 : qq % 2 === 1) : (b.w >= b.d ? qq % 2 === 1 : qq % 2 === 0));
          let best = cand[0], bd = -Infinity; for (const cd of cand) { const d = cd[1] * hx + cd[2] * hy; if (d > bd) { bd = d; best = cd; } }
          rot -= best[0] * Math.PI / 2; if (best[0] % 2) { sx = b.d / W; sz = b.w / D; }
        }
        // só ajuste leve de proporção (as caixas antigas às vezes reservam espaço a mais em volta do objeto)
        const lim = b.architecture?[.1,8]:H ? [0.65, 1.5] : [0.7, 1.4]; sx = Math.min(lim[1], Math.max(lim[0], sx)); sz = Math.min(lim[1], Math.max(lim[0], sz));
        if(b.architecture){
          const size=k.bounds.getSize(new THREE.Vector3()),center=k.bounds.getCenter(new THREE.Vector3()),odd=Math.abs(Math.round((rot+(b.rot||0))/(Math.PI/2)))%2;
          sx=(odd?b.d:b.w)/size.x;sz=(odd?b.w:b.d)/size.z;
          const ox=Math.cos(rot)*center.x*sx+Math.sin(rot)*center.z*sz,oy=-Math.sin(rot)*center.x*sx+Math.cos(rot)*center.z*sz;
          place(k,i,b.x-ox,b.y-oy,b.z||0,rot,sx,Math.min(1.5,Math.max(.6,(b.h||Hn)/Hn)),sz);return;
        }
        place(k, i, b.x, b.y, b.z || 0, rot, sx, Math.min(1.5, Math.max(0.6, (b.h || Hn) / Hn)), sz);
      });
      for (const m of k.meshes) { m.count = k.list.length; m.instanceMatrix.needsUpdate = true; }
    }
    // postes de luz
    const lamps = (bridge.world.lamps || []).filter(l => (l.x - cx) ** 2 + (l.y - cy) ** 2 < R * R);
    lamps.forEach((l, i) => { ps.set(l.x, 0, l.y); q.setFromAxisAngle(up, -Math.atan2(l.ay || 0, l.ax || 1)); sc.set(1, 1, 1); mat.compose(ps, q, sc); for (const m of lampMeshes) m.setMatrixAt(i, mat); });
    for (const m of lampMeshes) { m.count = lamps.length; m.instanceMatrix.needsUpdate = true; }
    Object.assign(state, { objects, furniture, lamps: lamps.length, ms: +(performance.now() - t0).toFixed(1) });
  }

  // Product photography: render the *same* procedural 3D mesh used in the city.
  // A single offscreen renderer is reused and all temporary geometries are
  // disposed after each shot. Results are cached (bounded) for quick recoloring.
  let photoRenderer=null;
  const photoCache=new Map();
  function thumbnail(name,color){
    const def=M[name];if(!def)return null;
    const tint=def.tinted && /^#[0-9a-f]{6}$/i.test(color||'')?color:null;
    const id=name+'|'+(tint||'original');
    if(photoCache.has(id))return photoCache.get(id);
    const scene2=new THREE.Scene(),geometries=[],materials=[];
    try{
      if(!photoRenderer){
        photoRenderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:true,
          alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
        photoRenderer.setSize(156,124,false);photoRenderer.setPixelRatio(1);
      }
      photoRenderer.setClearColor(0x091827,0);
      const shapes=Kit();def.make(shapes,tint||undefined);
      const meshes=shapes.done();
      for(const [type,geo] of Object.entries(meshes)){
        geometries.push(geo);
        const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,
          roughness:fabricSet.has(name)?.9:ceramicSet.has(name)?.3:metallicSet.has(name)?.42:.7,
          metalness:metallicSet.has(name)?.4:0,
          transparent:type==='glass',opacity:type==='glass'?.36:1,depthWrite:type!=='glass'});
        materials.push(mat);
        scene2.add(new THREE.Mesh(geo,mat));
      }
      const bounds=new THREE.Box3().setFromObject(scene2);
      const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const span=Math.max(.7,size.y*1.15,Math.hypot(size.x,size.z)*.83);
      const camera=new THREE.OrthographicCamera(-span*1.5,span*1.5,span*1.16,-span*1.16,.01,70);
      camera.position.copy(center).add(new THREE.Vector3(span*2.2,span*1.65,span*2.4));
      camera.lookAt(center);
      scene2.add(new THREE.HemisphereLight(0xf7fbff,0x526276,2.35));
      const light=new THREE.DirectionalLight(0xfff4e2,3.4);
      light.position.set(3,7,5);scene2.add(light);
      photoRenderer.render(scene2,camera);
      const url=photoRenderer.domElement.toDataURL('image/png');
      photoCache.set(id,url);
      if(photoCache.size>72)photoCache.delete(photoCache.keys().next().value);
      return url;
    }catch(error){console.warn('Furniture preview failed',name,error);return null;}
    finally{for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();}
  }

  return {
    state,thumbnail,
    update(now, T) {
      const c = bridge.cam, w = bridge.world, night = !!w.night;
      const halfW = c.W / (2 * c.zoom), halfH = c.H / (2 * c.zoom) / (c.tilt || 0.5), R = Math.min(150, Math.hypot(halfW, halfH) + 22);
      const inside = (bridge.houses||[]).filter(H=>H.inside).map(H=>
        (H.seed||0)+':'+(H.architecture?(bridge.player.stairTravel?.to??bridge.player.floor??0):upstairsIn(H)?'u':'')+
        ':'+(H.unitBuilding?window.CityBuildings?.unitAt(H,bridge.player.x,bridge.player.y,bridge.player.floor||0)?.id||'hall':'' )
       ).join(',');
      const n = (bridge.boxes || []).length;
      if (Math.hypot(c.x - sync.x, c.y - sync.y) > 14 || n !== sync.n || w.version !== sync.v || inside !== sync.inside) { Object.assign(sync, { x: c.x, y: c.y, n, v: w.version, inside }); rebuild(c.x, c.y, R); }
      const roads = bridge.roads;
      if (Math.hypot(c.x - curbSync.x, c.y - curbSync.y) > 40 || roads !== curbSync.roads || (roads || []).length !== curbSync.n) { Object.assign(curbSync, { x: c.x, y: c.y, roads, n: (roads || []).length }); buildCurbs(c.x, c.y, 130); state.curbs = curbMesh ? curbMesh.geometry.index.count / 3 : 0; }
      matGlow.color.setScalar(night ? 1.6 : 0.55);
      updateSignals(T, night); state.signals = signals.size;
    },
  };
}

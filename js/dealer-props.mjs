// dealer-props.mjs — móveis da concessionária City Motors (props-3d.mjs os instancia como os outros móveis):
// plataforma giratória com anel de LED, totem de ficha técnica, torre de refletores, parede da marca, mesa de
// vendedor, banner, expositor de pneus, parede de rodas, elevador automotivo, gaveteiro de ferramentas, bancada,
// compressor, pilha de pneus, tambor de óleo e quadro de chaves. Frente = +z, base em y=0.
const TAU = Math.PI * 2;
const RED = '#d32f2f', DARK = '#1e2226', GRAPH = '#3a3f45', CHROME = '#d5dbdf', WHITE = '#f4f5f6', GLOSS = '#eceff1', LED = '#bfe9ff', TIRE = '#16181a';

export const DEALER_STEEL = ['carlift', 'toolchest', 'compressor', 'oildrum', 'rimwall', 'spotbar'];

export function dealerModels(THREE, { chair }) {
  const M = {};
  const tire = (k, x, y, z, r = .32, w = .22, axis = 'z') => {
    const g = new THREE.TorusGeometry(r - .07, .085, 8, 22); if (axis === 'x') g.rotateY(Math.PI / 2); else if (axis === 'y') g.rotateX(Math.PI / 2); g.scale(1, 1, axis === 'z' ? w / .17 : 1); g.translate(x, y, z); k.raw(g, TIRE);
    const rim = new THREE.CylinderGeometry(r - .13, r - .13, w * .7, 14); if (axis === 'z') rim.rotateX(Math.PI / 2); else if (axis === 'x') rim.rotateZ(Math.PI / 2); rim.translate(x, y, z); k.raw(rim, CHROME, 'shiny');
  };
  M.turntable = { dims: [3.3, .12, 5.3], make(k) {
    const disc = new THREE.CylinderGeometry(2.55, 2.6, .1, 48); disc.scale(1.25 / 2.6 * 1, 1, 2.6 / 2.6); disc.translate(0, .05, 0); k.raw(disc, '#e9ecef', 'shiny');
    const ring = new THREE.TorusGeometry(2.58, .025, 6, 64); ring.rotateX(Math.PI / 2); ring.scale(1.25 / 2.6, 1, 1); ring.translate(0, .1, 0); k.raw(ring, LED, 'shiny');
    const base = new THREE.CylinderGeometry(2.62, 2.66, .03, 48); base.scale(1.25 / 2.6, 1, 1); k.raw(base, GRAPH);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box(Math.cos(a) * 1.15 - .015, .1, Math.sin(a) * 2.4 - .015, Math.cos(a) * 1.15 + .015, .105, Math.sin(a) * 2.4 + .015, '#c7ccd1'); }
  } };
  M.infokiosk = { dims: [.5, 1.25, .45], face: 'any', make(k) {
    k.box(-.22, 0, -.2, .22, .04, .2, GRAPH); k.box(-.06, .04, -.06, .06, .9, .06, CHROME);
    const panel = new THREE.BoxGeometry(.46, .62, .05); panel.rotateX(-.35); panel.translate(0, 1.0, .02); k.raw(panel, DARK);
    const scr = new THREE.BoxGeometry(.4, .52, .01); scr.rotateX(-.35); scr.translate(0, 1.0, .05); k.raw(scr, '#1b4f72', 'shiny');
    for (let i = 0; i < 4; i++) { const b = new THREE.BoxGeometry(.3 - i * .05, .03, .012); b.rotateX(-.35); b.translate(-.02, 1.15 - i * .09, .058 + i * .03); k.raw(b, i ? '#9fd3f5' : '#ffffff', 'shiny'); }
    k.box(-.23, .84, -.07, .23, .86, .07, RED);
  } };
  M.spotbar = { dims: [.4, 3.2, .4], face: 'any', make(k) {
    k.cyl(0, 0, 0, .16, .04, GRAPH, 14); k.cyl(0, .04, 0, .025, 3.0, DARK, 8); k.box(-.18, 2.95, -.03, .18, 3.0, .03, DARK);
    for (const s of [-1, 1]) { k.cyl(s * .15, 2.78, .08, .07, 2.96, DARK, 12, .05); k.cyl(s * .15, 2.74, .08, .055, 2.78, '#fff7d6', 12, .055, 'shiny'); }
  } };
  M.brandwall = { dims: [6, 3.4, .35], face: 'short', make(k) {
    k.box(-3, 0, -.17, 3, 3.4, .1, '#262b31', .01); k.box(-2.95, .05, .1, 2.95, .2, .12, RED);
    // logotipo: escudo cromado com o "CM" em barras, e a faixa vermelha com as letras em blocos
    const shield = new THREE.CylinderGeometry(.62, .62, .04, 6); shield.rotateX(Math.PI / 2); shield.translate(0, 2.25, .13); k.raw(shield, CHROME, 'shiny');
    for (const [x0, y0, x1, y1] of [[-.38, 1.95, -.3, 2.55], [-.38, 2.47, -.08, 2.55], [-.38, 1.95, -.08, 2.03], [.05, 1.95, .13, 2.55], [.3, 1.95, .38, 2.55], [.13, 2.4, .3, 2.48]]) k.box(x0, y0, .15, x1, y1, .17, RED);
    k.box(-2.4, 1.1, .1, 2.4, 1.45, .13, RED, .02); for (let i = 0; i < 10; i++) { const x = -2.1 + i * .46; k.box(x, 1.17, .13, x + .3, 1.38, .14, WHITE); }
    for (const x of [-2.9, 2.9]) k.box(x - .03, .2, .1, x + .03, 3.35, .14, LED, 0, 'shiny');
  } };
  M.salesdesk = { dims: [2.2, 1.2, 1.7], face: 'short', make(k) {
    k.box(-1.1, .72, -.4, 1.1, .78, .4, GLOSS, .02, 'shiny'); k.box(-1.05, 0, -.35, -.95, .72, .35, CHROME); k.box(.95, 0, -.35, 1.05, .72, .35, CHROME);
    k.box(-.95, .4, -.38, .95, .72, -.34, RED);
    k.box(-.35, .78, -.3, .35, .8, -.15, DARK); k.box(-.32, .8, -.32, .32, 1.15, -.29, DARK, .01); k.box(-.3, .82, -.29, .3, 1.13, -.285, '#2e6f9e', 'shiny');
    k.box(.5, .78, -.2, .8, .8, .1, '#f8f8f4'); k.cyl(-.75, .78, .1, .04, .86, WHITE, 10); k.box(-.15, .78, .05, .25, .8, .2, '#3a3d42');
    chair(k, 0, -.75, 0, DARK); chair(k, -.45, .78, Math.PI, '#b0b5ba'); chair(k, .45, .78, Math.PI, '#b0b5ba');
  } };
  M.bannerstand = { dims: [.9, 2.1, .4], face: 'short', make(k) {
    k.box(-.42, 0, -.15, .42, .08, .15, CHROME, .02); k.box(-.4, .08, -.02, .4, 2.05, .0, WHITE);
    k.box(-.4, 1.3, .0, .4, 1.9, .005, RED); k.box(-.34, .45, .0, .34, 1.15, .006, '#1e2a36');
    const car = new THREE.BoxGeometry(.5, .14, .01); car.translate(0, .72, .008); k.raw(car, '#d0d4d8', 'shiny'); k.box(-.15, .79, .007, .15, .88, .012, '#9fb3c4', 0, 'shiny');
    for (let i = 0; i < 3; i++) k.box(-.3, 1.75 - i * .12, .006, .3 - i * .1, 1.8 - i * .12, .01, WHITE);
  } };
  M.tirestand = { dims: [1.6, 1.9, .7], face: 'short', make(k) {
    k.box(-.8, 0, -.3, .8, .05, .3, GRAPH); for (const x of [-.78, .74]) k.box(x, 0, -.05, x + .04, 1.9, .05, GRAPH);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tire(k, -.5 + c * .5, .35 + r * .6, 0, .3, .2, 'z');
    k.box(-.8, 1.85, -.08, .8, 1.9, .08, RED);
  } };
  M.rimwall = { dims: [2.4, 2.2, .25], face: 'short', make(k) {
    k.box(-1.2, .3, -.12, 1.2, 2.2, -.08, '#2c3137');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const x = -.9 + c * .6, y = .85 + r * .8; const rim = new THREE.CylinderGeometry(.25, .25, .08, 18); rim.rotateX(Math.PI / 2); rim.translate(x, y, -.03); k.raw(rim, (r + c) % 2 ? CHROME : '#30363c', 'shiny');
      for (let s = 0; s < 5; s++) { const a = s / 5 * TAU; k.box(x + Math.cos(a) * .12 - .02, y + Math.sin(a) * .12 - .02, .01, x + Math.cos(a) * .12 + .02, y + Math.sin(a) * .12 + .02, .02, (r + c) % 2 ? '#8b949b' : '#c9a227'); } }
    k.box(-1.2, 2.1, -.08, 1.2, 2.2, .0, RED);
  } };
  M.carlift = { dims: [3.4, 2.2, 5.2], face: 'long', make(k) {
    for (const x of [-1.55, 1.55]) { k.box(x - .14, 0, -.14, x + .14, 2.2, .14, '#c0392b', .01); k.box(x - .2, 0, -.2, x + .2, .03, .2, GRAPH); k.box(x - .1, 2.1, -.1, x + .1, 2.2, .1, DARK); }
    k.box(-1.5, 2.12, -.08, 1.5, 2.2, .08, '#c0392b');
    for (const x of [-1.42, 1.42]) for (const z of [-1, 1]) { const g = new THREE.BoxGeometry(.08, .06, 1.4); g.rotateY(z * (x < 0 ? -.35 : .35)); g.translate(x * .6, .55, z * .55); k.raw(g, '#7f8c8d'); }
    k.box(-1.7, 0, -2.5, 1.7, .01, 2.5, '#f1c40f'); k.box(-1.6, .011, -2.4, 1.6, .012, 2.4, '#2d3436');
  } };
  M.toolchest = { dims: [1.05, 1.1, .55], face: 'short', make(k) {
    for (const x of [-.42, .42]) for (const z of [-.2, .2]) k.sph(x, .04, z, .04, DARK);
    k.box(-.52, .08, -.27, .52, 1.0, .25, '#c62828', .01);
    for (let i = 0; i < 6; i++) { const y = .14 + i * .14; k.box(-.48, y, .25, .48, y + .12, .26, '#b71c1c'); k.box(-.3, y + .05, .26, .3, y + .07, .28, CHROME); }
    k.box(-.53, 1.0, -.28, .53, 1.03, .27, GRAPH); k.box(-.2, 1.03, -.1, .1, 1.06, .1, '#f39c12'); k.cyl(.3, 1.03, 0, .03, 1.08, '#95a5a6', 8);
  } };
  M.workbench = { dims: [2, 1, .8], face: 'short', make(k) {
    k.box(-1, .85, -.4, 1, .9, .4, '#8d6e63'); for (const x of [-.95, .95]) for (const z of [-.35, .35]) k.box(x - .03, 0, z - .03, x + .03, .85, z + .03, GRAPH);
    k.box(-.95, .2, -.35, .95, .23, .35, GRAPH); k.box(-1, .9, -.42, 1, 1.0, -.38, '#5d4037');
    k.box(-.7, .9, -.1, -.4, .98, .1, '#7f8c8d'); k.cylX(.2, .6, .95, 0, .025, '#c0392b', 8); k.box(.65, .9, -.2, .85, .93, .0, '#f1c40f');
    for (let i = 0; i < 6; i++) k.box(-.9 + i * .3, 1.2, -.42, -.88 + i * .3, 1.55, -.4, '#95a5a6');
    k.box(-1, 1.1, -.44, 1, 1.7, -.42, '#bdc3c7');
  } };
  M.compressor = { dims: [.8, 1, .6], face: 'any', make(k) {
    const tank = new THREE.CylinderGeometry(.24, .24, .7, 16); tank.rotateZ(Math.PI / 2); tank.translate(0, .32, 0); k.raw(tank, '#d35400');
    k.box(-.3, .56, -.15, .2, .78, .15, GRAPH); k.cyl(.25, .56, 0, .07, .9, '#7f8c8d', 10); k.cyl(-.05, .78, 0, .05, .82, CHROME, 10);
    for (const x of [-.28, .28]) k.sph(x, .06, .2, .06, DARK);
  } };
  M.tirestack = { dims: [.8, 1.1, .8], face: 'any', make(k) { for (let i = 0; i < 4; i++) tire(k, 0, .12 + i * .25, 0, .36, .22, 'y'); } };
  M.oildrum = { dims: [.6, .9, .6], face: 'any', make(k) {
    k.cyl(0, 0, 0, .28, .88, '#1f618d', 18); for (const y of [.28, .6]) k.cyl(0, y, 0, .29, y + .03, '#154360', 18); k.cyl(0, .88, 0, .27, .9, '#1a5276', 18);
    k.box(-.12, .4, .27, .12, .52, .29, '#f4f6f6'); k.cyl(.12, .9, .1, .04, .93, '#d5d8dc', 8);
  } };
  M.keybox = { dims: [.8, 1.1, .12], face: 'short', make(k) {
    k.box(-.4, .7, -.06, .4, 1.8, .02, '#5d6d7e', .01); k.box(-.37, .73, .02, .37, 1.77, .025, '#e5e8e8');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = -.3 + c * .12, y = 1.65 - r * .24; k.box(x - .005, y, .025, x + .005, y + .03, .05, CHROME); k.box(x - .025, y - .1, .03, x + .025, y - .02, .04, ['#c0392b', '#2471a3', '#f1c40f', '#27ae60'][(r + c) % 4]); }
  } };
  // Central Logística: palete com caixas embaladas e filme, empilhadeira amarela com garfos
  M.pallet = { dims: [1.3, 1.4, 1.2], face: 'any', make(k) {
    for (const z of [-.55, 0, .55]) k.box(-.65, 0, z - .05, .65, .1, z + .05, '#a07a4f'); k.box(-.65, .1, -.6, .65, .14, .6, '#b88d5c');
    const C = ['#c9a06a', '#b8894f', '#d2ae78'];
    for (let y = 0; y < 3; y++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x0 = -.6 + i * .6, z0 = -.55 + j * .55, yy = .14 + y * .4; k.box(x0, yy, z0, x0 + .58, yy + .38, z0 + .53, C[(y + i + j) % 3], .01); k.box(x0 + .25, yy + .38, z0, x0 + .33, yy + .385, z0 + .53, '#e8dcc0'); }
    k.box(-.62, .14, -.57, .62, 1.36, .57, '#e6f2f5', 0, 'glass');
  } };
  M.forklift = { dims: [1.3, 2.2, 2.4], face: 'long', make(k) {
    k.box(-.6, .25, -1.0, .6, .95, .55, '#f1c40f', .05); k.box(-.55, .95, -.95, .55, 1.25, -.35, '#2d3436', .04); k.box(-.6, .2, -1.15, .6, .7, -.95, '#2d3436');
    for (const x of [-.55, .55]) { k.box(x - .03, .95, -.3, x + .03, 2.1, -.24, '#2d3436'); k.box(x - .03, .95, .45, x + .03, 2.1, .51, '#2d3436'); } k.box(-.6, 2.08, -.32, .6, 2.14, .52, '#2d3436');
    k.box(-.45, .55, -.1, .45, .95, .35, '#2d3436'); chair(k, 0, -.05, Math.PI, '#2d3436');
    for (const x of [-.48, .48]) { k.box(x - .04, .3, .58, x + .04, 2.0, .66, '#636e72'); k.box(x - .06, .05, .62, x + .06, .1, 1.2, '#636e72'); }
    for (const [x, z, r] of [[-.6, .35, .27], [.6, .35, .27], [-.6, -.75, .22], [.6, -.75, .22]]) { const t = new THREE.CylinderGeometry(r, r, .22, 14); t.rotateZ(Math.PI / 2); t.translate(x, r, z); k.raw(t, '#16181a'); }
    k.box(-.15, 1.25, -.4, .15, 1.3, -.3, '#e17055');
  } };
  return M;
}

// police-props.mjs — móveis da Delegacia Central (props-3d.mjs os instancia como os outros móveis): cela (grade,
// divisória, beliche e vaso de aço), mesa de interrogatório, espelho falso, arquivo de aço, câmera no tripé, estante de
// evidências, cofre, balcão do saguão com vidro blindado, bandeira, mural de procurados, troféus, detector de metais,
// mesa de investigador, impressora, parede de monitores, console da central de rádio, rack de rádio, púlpito,
// armário de fuzis, cabideiro de coletes, caixas de munição e mesa do delegado. Frente = +z, base em y=0.
const TAU = Math.PI * 2;
const STEEL = '#9aa4ab', DARKSTEEL = '#59626a', NAVY = '#1f3a64', DARK = '#23262a', CHROME = '#c9d0d4', WOOD = '#6e4a32', WOODL = '#9a7350', SCREEN = '#13283d', GOLD = '#c9a43c';

export const POLICE_FABRIC = ['bunk'];
export const POLICE_STEEL = ['cellbars', 'cellwall', 'steeltoilet', 'filingcab', 'evidenceshelf', 'safe', 'metaldetector', 'gunrack', 'radiorack', 'ammocrate', 'camstand'];

export function policeModels(THREE, { chair }) {
  const M = {};
  // brasão: disco de 6 lados virado p/ frente (+z)
  const disc = (k, x, y, z, r, c) => { const g = new THREE.CylinderGeometry(r, r, .02, 6); g.rotateX(Math.PI / 2); g.translate(x, y, z); k.raw(g, c); };
  const monitor = (k, x, y, z, w = .5, h = .32, c = '#2a5d86') => { k.box(x - .02, y, z - .05, x + .02, y + .14, z - .01, DARK); k.box(x - w / 2, y + .12, z - .04, x + w / 2, y + .12 + h, z, DARK, .01); k.box(x - w / 2 + .02, y + .14, z, x + w / 2 - .02, y + .1 + h, z + .004, c, 0, 'shiny'); };
  const screenLines = (k, x0, y0, x1, y1, z) => { const C = ['#5fd3a0', '#e8c547', '#6fb7ff', '#ff6b5e']; for (let i = 0; i < 4; i++) { const y = y0 + (y1 - y0) * (i + .5) / 4; k.box(x0 + .03, y, z + .005, x0 + (x1 - x0) * (.35 + (i * 23 % 5) * .1), y + .012, z + .008, C[i], 0, 'shiny'); } };

  M.cellbars = { dims: [3, 2.5, .14], make(k) {
    k.box(-1.5, 0, -.06, 1.5, .06, .06, DARKSTEEL); k.box(-1.5, 2.38, -.07, 1.5, 2.5, .07, DARKSTEEL); k.box(-1.5, 1.05, -.05, 1.5, 1.11, .05, DARKSTEEL);
    for (let x = -1.45; x <= 1.46; x += .14) k.cyl(x, .06, 0, .016, 2.38, STEEL, 6);
    k.box(.25, .06, -.065, .29, 2.38, .065, DARKSTEEL); k.box(1.0, .06, -.065, 1.04, 2.38, .065, DARKSTEEL);   // porta da cela
    k.box(.88, 1.0, .05, .98, 1.18, .1, '#30353a'); k.box(.5, 1.6, .06, .8, 1.75, .075, '#e3e0d4');
  } };
  M.cellwall = { dims: [.14, 2.5, 3.4], make(k) { k.box(-.07, 0, -1.7, .07, 2.5, 1.7, '#b7bfc4', .01); k.box(-.075, 1.0, -1.7, .075, 1.12, 1.7, '#8d979e'); } };
  M.bunk = { dims: [.9, 1.6, 2], face: 'long', make(k) {
    for (const x of [-.42, .42]) for (const z of [-.95, .95]) k.box(x - .03, 0, z - .03, x + .03, 1.6, z + .03, DARKSTEEL);
    for (const y of [.35, 1.25]) { k.box(-.45, y, -1, .45, y + .06, 1, DARKSTEEL); k.box(-.42, y + .06, -.97, .42, y + .17, .97, '#5f7380', .04); k.box(-.38, y + .17, -.92, .38, y + .24, -.62, '#d7d3c8', .04); }
    k.box(-.44, 1.4, -1.0, .44, 1.45, -.97, DARKSTEEL); k.box(-.4, .45, .9, .4, .65, .97, '#8a7c66', .03);
  } };
  M.steeltoilet = { dims: [.5, .75, .6], face: 'long', make(k) {
    k.box(-.22, 0, -.28, .22, .42, .22, '#b9c2c7', .05); k.box(-.24, .42, -.3, .24, .46, .25, '#c8d0d4', .05); k.box(-.24, .46, -.3, .24, .75, -.18, '#a9b3b8', .03);
    k.cyl(0, .66, -.15, .05, .72, '#d8dee1', 10); k.box(-.06, .74, -.24, .06, .78, -.12, CHROME);
  } };
  M.itable = { dims: [1.6, .95, 2.2], face: 'long', make(k) {
    k.box(-.6, .72, -.5, .6, .76, .5, '#8d9499'); for (const x of [-.52, .52]) for (const z of [-.42, .42]) k.box(x - .025, 0, z - .025, x + .025, .72, z + .025, DARKSTEEL);
    k.cylX(-.1, .1, .8, 0, .02, CHROME, 8); k.box(-.15, .76, .15, .15, .77, .32, '#f2efe6'); k.box(.3, .76, -.25, .45, .78, -.05, '#c8a03a');
    chair(k, 0, .85, 0, '#4b5258'); chair(k, -.32, -.85, Math.PI, '#4b5258'); chair(k, .32, -.85, Math.PI, '#4b5258');
    k.cyl(.4, .76, .3, .07, .78, DARK, 10); k.cyl(.4, .78, .3, .012, 1.05, DARK, 6); k.cyl(.4, 1.0, .25, .09, 1.1, '#e7e1c5', 12, .04);
  } };
  M.onewaymirror = { dims: [.12, 2.4, 3.4], make(k) {
    k.box(-.06, 0, -1.7, .06, .9, 1.7, '#c6ccd1', .01); k.box(-.06, 2.25, -1.7, .06, 2.4, 1.7, '#c6ccd1');
    for (const z of [-1.7, 1.66]) k.box(-.06, .9, z, .06, 2.25, z + .04, DARKSTEEL);
    k.box(-.03, .9, -1.66, .03, 2.25, 1.66, '#7f96a8', 0, 'shiny');
  } };
  M.filingcab = { dims: [.5, 1.35, .65], face: 'short', make(k) {
    k.box(-.25, 0, -.32, .25, 1.35, .3, '#8e979d', .01);
    for (let i = 0; i < 4; i++) { const y = .05 + i * .325; k.box(-.23, y, .3, .23, y + .3, .315, '#9fa8ae'); k.box(-.08, y + .2, .315, .08, y + .23, .34, CHROME); k.box(-.06, y + .08, .315, .06, y + .14, .318, '#f1efe6'); }
  } };
  M.camstand = { dims: [.5, 1.6, .5], face: 'any', make(k) {
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; const g = new THREE.CylinderGeometry(.012, .012, 1.35, 6); g.rotateX(.18); g.rotateY(a); g.translate(Math.sin(a) * .12, .66, Math.cos(a) * .12); k.raw(g, DARK); }
    k.box(-.12, 1.32, -.07, .12, 1.48, .1, DARK, .02); k.cylZ(0, 1.4, .1, .2, .05, '#111', 12); k.box(.04, 1.45, -.05, .07, 1.47, -.02, '#e33');
  } };
  M.evidenceshelf = { dims: [2.2, 2.1, .6], face: 'short', make(k) {
    for (const x of [-1.1, 1.07]) for (const z of [-.28, .26]) k.box(x, 0, z, x + .03, 2.1, z + .03, DARKSTEEL);
    const C = ['#c9a77d', '#b9946e', '#d7c5a8', '#e9e4da'];
    for (let r = 0, y = .08; r < 5; r++, y += .42) { k.box(-1.1, y, -.28, 1.1, y + .03, .29, STEEL);
      for (let x = -1.02, i = r * 5; x < .95; i++) { const w = .32 + (i * 17 % 4) * .06, h = .2 + (i * 7 % 3) * .05; if (i % 6 === 5) { k.box(x, y + .03, -.1, x + .2, y + .2, .2, '#e8e8e2', .02, 'glass'); x += .26; continue; }
        k.box(x, y + .03, -.24, x + w, y + .03 + h, .24, C[i % 4], .01); k.box(x + .05, y + .06, .241, x + .2, y + .11, .245, '#fffbea'); x += w + .04; } }
  } };
  M.safe = { dims: [.8, 1.2, .7], face: 'short', make(k) {
    k.box(-.4, 0, -.35, .4, 1.2, .33, '#3a3f44', .03); k.box(-.34, .08, .33, .34, 1.12, .345, '#454b51', .01);
    k.cylZ(.0, .7, .345, .38, .09, '#c9ced2', 16); k.cylZ(0, .7, .38, .4, .03, '#2a2e32', 10); k.box(.2, .45, .345, .28, .62, .39, CHROME);
  } };
  M.frontdesk = { dims: [3.6, 1.3, 1.6], face: 'short', make(k) {
    // balcão alto com vidro blindado e passa-documentos; brasão no painel da frente; atrás o tampo baixo com computadores
    k.box(-1.8, 0, .25, 1.8, 1.1, .6, NAVY, .02); k.box(-1.82, 1.08, .2, 1.82, 1.14, .66, '#c7c9c4', .01); k.box(-1.8, .15, .59, 1.8, .23, .61, GOLD);
    k.box(-1.78, 1.14, .38, 1.78, 2.2, .42, '#cfe2ee', 0, 'glass'); for (const x of [-1.8, -.6, .6, 1.76]) k.box(x, 1.14, .36, x + .04, 2.2, .44, DARKSTEEL);
    k.box(-.3, 1.14, .36, .3, 1.24, .44, DARKSTEEL);
    disc(k, 0, .55, .625, .22, GOLD); k.box(-.18, .5, .615, .18, .6, .63, NAVY);
    k.box(-1.7, 0, -.7, 1.7, .74, .2, '#d9dcd8', .02); k.box(-1.72, .72, -.7, 1.72, .76, .22, '#bfc4c2');
    for (const x of [-1, .9]) { monitor(k, x, .76, -.3); k.box(x - .2, .76, -.1, x + .2, .78, .05, '#3a3d42'); }
    k.box(-.1, .76, -.5, .2, .84, -.35, DARK); k.box(1.4, .76, -.5, 1.6, .98, -.3, '#e8e2d4');
    for (const x of [-1, .9]) chair(k, x, -1.05, 0, NAVY);
  } };
  M.flagstand = { dims: [.5, 2.3, .5], face: 'any', make(k) {
    k.cyl(0, 0, 0, .18, .05, GOLD, 14); k.cyl(0, .05, 0, .02, 2.25, '#d8c27a', 8); k.sph(0, 2.28, 0, .04, GOLD);
    for (let i = 0; i < 6; i++) { const y0 = 1.25 + i * .15; k.box(.02 + (i % 2) * .01, y0, -.01, .04 + (i % 2) * .01, y0 + .15, .4, i < 3 ? '#1d6b3a' : '#f2d03a'); }
    k.box(.025, 1.45, .05, .045, 1.75, .35, '#2a4a9a');
  } };
  M.wantedboard = { dims: [2.2, 1.6, .1], face: 'short', make(k) {
    k.box(-1.1, .9, -.05, 1.1, 2.1, .02, '#5b4632', .01); k.box(-1.05, .95, .02, 1.05, 2.05, .025, '#c4a576');
    for (let i = 0; i < 8; i++) { const x = -.95 + (i % 4) * .5, y = 1.05 + ((i / 4) | 0) * .5; k.box(x, y, .025, x + .38, y + .44, .03, '#f1ebd6'); k.box(x + .09, y + .14, .031, x + .29, y + .36, .033, ['#6b5544', '#8a6a52', '#4b3a2e', '#a07c60'][i % 4]); k.box(x + .04, y + .04, .031, x + .34, y + .1, .033, '#b3261e'); }
    k.box(-.7, 1.95, .025, .7, 2.03, .03, '#b3261e');
  } };
  M.trophycase = { dims: [1.6, 1.9, .5], face: 'short', make(k) {
    k.box(-.8, 0, -.25, .8, .7, .23, WOOD, .01); k.box(-.8, 1.85, -.25, .8, 1.9, .23, WOOD); for (const x of [-.8, .77]) k.box(x, .7, -.25, x + .03, 1.85, .23, WOOD);
    k.box(-.77, .7, .2, .77, 1.85, .22, '#dfeef5', 0, 'glass');
    for (const y of [1.08, 1.46]) { k.box(-.77, y, -.22, .77, y + .02, .2, '#e8eef0', 0, 'glass'); }
    for (let i = 0; i < 9; i++) { const x = -.6 + (i % 3) * .55 + (i * 7 % 3) * .04, y = .72 + ((i / 3) | 0) * .38; k.cyl(x, y, 0, .06, y + .04, GOLD, 10); k.cyl(x, y + .04, 0, .015, y + .16, GOLD, 6); k.cyl(x, y + .16, 0, .03, y + .26, GOLD, 10, .07); }
    k.box(-.5, .25, .231, .5, .45, .24, '#c7b17a');
  } };
  M.metaldetector = { dims: [1.1, 2.2, .7], face: 'short', make(k) {
    for (const x of [-.52, .42]) k.box(x, 0, -.3, x + .1, 2.1, .3, '#cfd3d6', .02); k.box(-.55, 2.05, -.32, .55, 2.2, .32, '#cfd3d6', .03);
    k.box(-.42, 2.08, .32, -.2, 2.16, .33, '#2fe07a', 0, 'shiny'); k.box(.2, 2.08, .32, .42, 2.16, .33, '#e33', 0, 'shiny');
    k.box(-.5, 0, -.3, .5, .02, .3, '#2b2d30');
  } };
  M.policedesk = { dims: [1.5, 1.25, 1.3], make(k) {
    // tampo, gaveteiro, computador, papéis, rádio e telefone; cadeira de escritório na frente (+z)
    k.box(-.75, .72, -.65, .75, .76, .05, '#d8d4c6', .01); k.box(-.73, 0, -.63, -.69, .72, .03, DARKSTEEL); k.box(.33, 0, -.63, .73, .72, .03, '#8d969c');
    for (let i = 0; i < 3; i++) k.box(.36, .06 + i * .22, .03, .7, .25 + i * .22, .04, '#a3abb0');
    k.box(-.73, .3, -.65, .33, .7, -.62, '#8d969c');
    monitor(k, -.15, .76, -.35, .52, .32); k.box(-.38, .76, -.12, .08, .78, .02, '#33373c'); k.box(.15, .76, -.1, .25, .78, .0, '#3a3d42');
    for (let i = 0; i < 4; i++) k.box(.3, .76 + i * .02, -.5, .62, .78 + i * .02, -.25, i % 2 ? '#f4f1e6' : '#e1d5b8');
    k.box(.45, .76, -.05, .55, .9, .02, DARK); k.cyl(.53, .9, -.01, .006, 1.05, DARK, 4); k.box(-.65, .76, -.5, -.48, .82, -.36, DARK);
    k.cyl(-.6, .76, -.15, .04, .87, '#f2f2f2', 10);
    k.cyl(-.05, 0, .45, .04, .05, DARK, 6); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.box(-.05 + Math.cos(a) * .22 - .02, .02, .45 + Math.sin(a) * .22 - .02, -.05 + Math.cos(a) * .22 + .02, .05, .45 + Math.sin(a) * .22 + .02, DARK); }
    k.cyl(-.05, .05, .45, .022, .42, '#6a6e72', 8); k.box(-.28, .42, .25, .18, .5, .65, '#2c3440', .04); k.box(-.26, .5, .6, .16, .98, .66, '#2c3440', .04);
  } };
  M.printer = { dims: [.7, 1.1, .6], face: 'short', make(k) {
    k.box(-.35, 0, -.3, .35, .62, .3, '#5b6066', .01); k.box(-.34, .62, -.3, .34, .98, .28, '#e4e6e5', .03); k.box(-.3, .98, -.26, .3, 1.02, .24, '#cfd2d1');
    k.box(-.25, .7, .28, .25, .74, .34, '#f6f6f2'); k.box(.18, .9, .28, .3, .96, .3, '#2fe07a', 0, 'shiny'); for (let i = 0; i < 3; i++) k.box(-.3, .1 + i * .17, .3, .3, .24 + i * .17, .305, '#6a7076');
  } };
  M.videowall = { dims: [3.6, 2.4, .3], face: 'short', make(k) {
    k.box(-1.8, 0, -.15, 1.8, .8, .12, '#3b4148', .02); k.box(-1.82, .8, -.15, 1.82, 2.4, -.05, DARK);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x0 = -1.76 + c * 1.18, y0 = .84 + r * .52; k.box(x0, y0, -.05, x0 + 1.14, y0 + .49, -.04, ['#1d3a52', '#20304a', '#183447'][(r + c) % 3], 0, 'shiny'); screenLines(k, x0, y0, x0 + 1.14, y0 + .49, -.04); if ((r * 3 + c) % 4 === 1) k.box(x0 + .3, y0 + .1, -.035, x0 + .8, y0 + .4, -.03, '#3f6b4a', 0, 'shiny'); }
  } };
  M.consoledesk = { dims: [2.6, 1.3, 1.4], face: 'short', make(k) {
    // mesa curva da central com três monitores, teclado, headset; cadeira atrás (+z)
    for (let i = 0; i < 5; i++) { const a = -.5 + i * .25, x = Math.sin(a) * 1.0, z = -.2 - Math.cos(a) * .25 + .25; const g = new THREE.BoxGeometry(.56, .05, .7); g.rotateY(a); g.translate(x, .74, z); k.raw(g, '#cfcdc4'); const p = new THREE.BoxGeometry(.56, .72, .05); p.rotateY(a); p.translate(x - Math.sin(a) * .35, .36, z - Math.cos(a) * .35); k.raw(p, NAVY); }
    for (const [x, a] of [[-.62, .35], [0, 0], [.62, -.35]]) { const g = new THREE.BoxGeometry(.5, .32, .04); g.rotateY(a); g.translate(x, 1.05, -.35 + Math.abs(x) * .25); k.raw(g, DARK); const s2 = new THREE.BoxGeometry(.46, .28, .01); s2.rotateY(a); s2.translate(x + Math.sin(a) * .025, 1.05, -.33 + Math.abs(x) * .25); k.raw(s2, '#2a5d86'); k.box(x - .02, .76, -.36 + Math.abs(x) * .25, x + .02, .9, -.32 + Math.abs(x) * .25, DARK); }
    k.box(-.25, .76, -.05, .25, .78, .1, '#33373c'); k.box(.4, .76, -.05, .55, .82, .08, DARK);
    chair(k, 0, .5, 0, '#2c3440');
  } };
  M.radiorack = { dims: [.7, 2, .9], face: 'short', make(k) {
    k.box(-.35, 0, -.45, .35, 2, .43, '#24272b', .01);
    for (let i = 0; i < 9; i++) { const y = .12 + i * .2; k.box(-.31, y, .43, .31, y + .16, .44, '#33383d'); for (let j = 0; j < 5; j++) k.box(-.26 + j * .06, y + .06, .44, -.24 + j * .06, y + .08, .445, ['#2fe07a', '#2fe07a', '#e8c547', '#6fb7ff', '#2fe07a'][(i + j) % 5], 0, 'shiny'); k.box(.12, y + .03, .44, .28, y + .12, .445, '#14181c'); }
    k.box(-.3, 1.95, .43, .3, 2, .44, '#3f8fd0');
  } };
  M.lectern = { dims: [.7, 1.25, .6], face: 'short', make(k) {
    k.box(-.3, 0, -.25, .3, .08, .25, WOOD); k.box(-.25, .08, -.2, .25, 1.05, .18, WOODL, .02); const top = new THREE.BoxGeometry(.66, .05, .5); top.rotateX(-.25); top.translate(0, 1.12, -.02); k.raw(top, WOOD);
    k.cyl(-.15, 1.15, -.15, .01, 1.38, DARK, 6); k.sph(-.15, 1.39, -.13, .03, DARK); disc(k, 0, .55, .195, .14, GOLD);
  } };
  M.gunrack = { dims: [1.6, 2, .5], face: 'short', make(k) {
    k.box(-.8, 0, -.25, .8, 2, -.2, '#4a5056'); k.box(-.8, 0, -.25, .8, .3, .22, '#3c4248', .01); k.box(-.8, 1.95, -.25, .8, 2, .1, '#3c4248');
    for (let i = 0; i < 6; i++) { const x = -.62 + i * .25; k.box(x - .03, .3, -.12, x + .03, 1.25, -.04, '#1b1d20'); k.box(x - .04, 1.15, -.14, x + .04, 1.6, -.04, '#24272a'); k.box(x - .015, 1.6, -.11, x + .015, 1.85, -.07, '#1b1d20'); k.box(x - .05, .3, -.15, x + .05, .48, .0, '#2f3236'); }
    k.box(-.8, 1.25, -.2, .8, 1.3, .05, STEEL); k.box(-.8, .9, .18, .8, 1.92, .2, '#d6e6ee', 0, 'glass');
  } };
  M.vestrack = { dims: [1.4, 1.8, .55], face: 'short', make(k) {
    for (const x of [-.68, .64]) { k.box(x, 0, -.05, x + .04, 1.75, .05, CHROME); k.box(x - .1, 0, -.25, x + .14, .04, .25, CHROME); }
    k.cylX(-.68, .68, 1.7, 0, .015, CHROME, 8);
    for (let i = 0; i < 5; i++) { const x = -.52 + i * .26; k.box(x - .11, .95, -.12, x + .11, 1.62, .12, '#1c2430', .04); k.box(x - .1, 1.25, .12, x + .1, 1.35, .125, '#e8e2c8'); k.cyl(x, 1.62, 0, .01, 1.7, CHROME, 4); }
  } };
  M.ammocrate = { dims: [.9, .8, .6], face: 'short', make(k) {
    k.box(-.44, 0, -.29, .44, .38, .29, '#4f5a3a', .01); k.box(-.42, .38, -.27, .42, .74, .27, '#56623f', .01);
    for (const y of [.18, .56]) { k.box(-.12, y, .29, .12, y + .06, .3, '#e3d36f'); k.box(-.44, y - .05, .29, -.38, y + .05, .31, DARKSTEEL); k.box(.38, y - .05, .29, .44, y + .05, .31, DARKSTEEL); }
  } };
  M.execdesk = { dims: [2.2, 1.3, 1.6], face: 'short', make(k) {
    k.box(-1.1, .72, -.45, 1.1, .78, .45, '#4a2e1e', .02); for (const x of [-1.05, .65]) k.box(x, 0, -.42, x + .4, .72, .42, '#5a3a26', .01); k.box(-.65, .35, .4, .65, .72, .42, '#5a3a26');
    k.box(-.5, .78, -.2, .1, .79, .15, '#2e5a3a'); monitor(k, .55, .78, -.25, .5, .3); k.box(-.9, .78, -.3, -.7, .84, -.1, DARK); k.cyl(-.95, .78, .2, .07, .8, GOLD, 10); k.cyl(-.95, .8, .2, .012, 1.1, GOLD, 6); k.cyl(-.95, 1.05, .2, .1, 1.18, '#2e5a3a', 12, .05);
    k.box(.1, .78, .2, .3, .8, .35, '#f4f1e6'); k.box(-.3, .79, .25, -.05, .81, .3, '#c9a43c');
    // poltrona de couro atrás (-z)
    k.box(-.32, .0, -1.1, .32, .5, -.6, '#2b1d16', .05); k.box(-.32, .5, -1.15, .32, 1.25, -1.0, '#2b1d16', .06); for (const s of [-1, 1]) k.box(s * .32 - .06, .5, -1.05, s * .32 + .06, .7, -.65, '#2b1d16', .03);
    for (const x of [-.45, .45]) chair(k, x, .8, Math.PI, '#5a3a26');
  } };
  return M;
}

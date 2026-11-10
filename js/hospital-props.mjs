// hospital-props.mjs — móveis e aparelhos do Hospital City of God (props-3d.mjs os instancia como os outros móveis):
// maca, monitor multiparamétrico, suporte de soro, cortina divisória, posto de enfermagem, carrinho de parada,
// armário de medicamentos, cadeira de rodas, maca de exame, balança, prateleira da farmácia, longarina da recepção,
// balcão da recepção, mural, bebedouro, TV de parede, planta grande, box de banheiro, bancada de pias, raio-X,
// biombo de chumbo, armário de vestiário, estação de café, máquina de lanches, mesa da lanchonete, banco do corredor,
// bancada de laboratório, geladeira de amostras, mesa cirúrgica, foco cirúrgico, aparelho de anestesia, mesa de
// instrumentos, ventilador pulmonar e berço. Frente = +z, base em y=0, centro no meio (como em props-3d.mjs).
const TAU = Math.PI * 2;
const WHITE = '#eef0ec', OFF = '#dfe4e1', STEEL = '#b7c1c5', CHROME = '#cfd5d8', DARK = '#2a2d31', TEAL = '#3f8f8a', MINT = '#cfe6df', BLUE = '#3c6f9c', RED = '#c8302a', SCREEN = '#0f1d18';

export const HOSPITAL_FABRIC = ['curtain', 'hbench', 'waitingrow'];
export const HOSPITAL_STEEL = ['ivstand', 'mayo', 'surglamp', 'scale', 'locker', 'wheelchair', 'medshelf'];

export function hospitalModels(THREE, { chair }) {
  const M = {};
  // rodízios + base em estrela (soro, monitor, ventilador)
  const star = (k, r = .24, legs = 5) => { k.cyl(0, .05, 0, .045, .11, STEEL, 10); for (let i = 0; i < legs; i++) { const a = i / legs * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r; k.box(Math.min(0, x) - .02, .06, Math.min(0, z) - .02, Math.max(0, x) + .02, .09, Math.max(0, z) + .02, STEEL); k.sph(x, .035, z, .035, DARK); } };
  const wheels = (k, hw, hd, h = .1) => { for (const x of [-hw, hw]) for (const z of [-hd, hd]) { k.cyl(x, h * .4, z, .018, h, CHROME, 6); k.sph(x, .04, z, .045, DARK); } };
  // tela com traços de sinais vitais (verde, amarelo, azul) — z0 = face da tela
  const vitals = (k, x0, y0, x1, y1, z) => {
    k.box(x0, y0, z, x1, y1, z + .006, SCREEN, 0, 'shiny');
    const h = (y1 - y0) / 4;
    for (const [i, c] of [[0, '#44e07a'], [1, '#f0d040'], [2, '#4fc3f0']].entries()) {
      const yy = y1 - h * (i + .8); k.box(x0 + .02, yy, z + .007, x0 + (x1 - x0) * .62, yy + .006, z + .011, c, 0, 'shiny');
      for (let j = 0; j < 4; j++) { const xx = x0 + .04 + j * (x1 - x0) * .15; k.box(xx, yy, z + .007, xx + .008, yy + h * .45, z + .011, c, 0, 'shiny'); }
      k.box(x0 + (x1 - x0) * .7, yy - h * .1, z + .007, x1 - .02, yy + h * .35, z + .011, c, 0, 'shiny');
    }
  };

  M.stretcher = { dims: [.7, .95, 2], face: 'long', make(k) {
    wheels(k, .27, .85, .3); k.box(-.3, .3, -.92, .3, .36, .92, STEEL, .02); k.box(-.08, .1, -.6, .08, .3, .6, STEEL);
    k.box(-.32, .5, -.95, .32, .62, .95, '#2f6f86', .04); k.box(-.3, .62, -.93, .3, .66, .6, '#f4f6f2', .03); k.box(-.28, .62, -.9, .28, .74, -.6, WHITE, .05);
    for (const x of [-.34, .34]) { k.cylZ(x, .82, -.6, .55, .015, CHROME, 8); for (const z of [-.55, .5]) k.cyl(x, .5, z, .013, .82, CHROME, 6); }
    k.box(-.3, .62, .3, .3, .67, .9, '#7fb6c9', .02);
  } };
  M.monitor = { dims: [.5, 1.5, .45], face: 'any', make(k) {
    star(k, .22); k.cyl(0, .1, 0, .022, 1.05, STEEL, 8); k.box(-.12, .98, -.08, .12, 1.04, .08, STEEL);
    k.box(-.23, 1.04, -.09, .23, 1.42, .07, '#dfe3e2', .03); k.box(-.21, 1.06, .07, .21, 1.4, .075, DARK); vitals(k, -.19, 1.08, .19, 1.38, .075);
    k.box(-.06, 1.42, -.04, .06, 1.46, .04, '#c93838'); k.box(.15, 1.02, .07, .2, 1.05, .09, '#2f9a5a');
  } };
  M.ivstand = { dims: [.45, 1.95, .45], face: 'any', make(k) {
    star(k, .21); k.cyl(0, .1, 0, .013, 1.9, CHROME, 8);
    for (const s of [-1, 1]) { k.cylX(Math.min(0, s * .14), Math.max(0, s * .14), 1.86, 0, .008, CHROME, 6); k.sph(s * .14, 1.84, 0, .012, CHROME); }
    k.box(-.2, 1.5, -.035, -.08, 1.78, .035, '#e6f2f6', .015, 'glass'); k.box(-.18, 1.52, -.03, -.1, 1.62, .03, '#f2e27a', .01, 'glass');
    k.cyl(-.14, 1.32, 0, .005, 1.5, '#e8f0f2', 4); k.box(.06, 1.48, -.03, .2, 1.72, .03, '#f0f3f4', .015, 'glass');
    k.box(-.05, 1.1, -.05, .05, 1.24, .06, '#e7eaea', .01); k.box(-.04, 1.12, .06, .04, 1.2, .062, '#2a8a5a', 0, 'shiny');
  } };
  M.curtain = { dims: [.08, 2.05, 2.1], make(k) {
    k.cylZ(0, 2.02, -1.05, 1.05, .015, CHROME, 6); for (const z of [-1.05, 1.05]) k.box(-.012, 2.02, z - .012, .012, 2.08, z + .012, CHROME);
    for (let i = 0; i < 12; i++) { const z0 = -1.02 + i * .17, x = i % 2 ? .02 : -.02; k.box(x - .012, .28, z0, x + .012, 1.98, z0 + .175, i % 2 ? '#9ccac3' : '#8ab9b2'); }
    k.box(-.03, 1.7, -1.03, .03, 1.73, 1.03, '#7aa9a2');
  } };
  M.nursedesk = { dims: [3, 1.1, 1.2], face: 'short', make(k) {
    k.box(-1.5, 0, .2, 1.5, 1.1, .6, WHITE, .02); k.box(-1.52, 1.06, .15, 1.52, 1.12, .62, '#c9b08a', .015);
    k.box(-1.5, .2, .59, 1.5, .34, .605, TEAL); k.box(-1.5, 0, -.6, -1.15, .76, .2, WHITE, .02); k.box(1.15, 0, -.6, 1.5, .76, .2, WHITE, .02);
    k.box(-1.48, .72, -.6, 1.48, .76, .18, '#d9c4a2', .01);
    for (const x of [-.8, .6]) { k.box(x - .02, .76, -.2, x + .02, .95, -.16, DARK); k.box(x - .28, .92, -.22, x + .28, 1.24, -.18, DARK, .01); k.box(x - .26, .94, -.18, x + .26, 1.22, -.176, '#24506e', 0, 'shiny'); k.box(x - .2, .76, -.05, x + .2, .78, .08, '#3a3d42'); }
    k.box(1.0, .76, -.3, 1.2, .82, -.15, DARK); for (let i = 0; i < 6; i++) k.box(-.3 + i * .05, .76, -.45, -.27 + i * .05, 1.0, -.25, ['#c8302a', '#3c6f9c', '#e0b030', '#3f8f8a'][i % 4]);
    for (const x of [-.8, .6]) chair(k, x, -.95, 0, '#3e5f73');
    k.box(-.4, .9, .61, .4, 1.04, .62, '#3f8f8a'); k.box(-.06, .93, .622, .06, 1.01, .63, WHITE); k.box(-.03, .9, .622, .03, 1.04, .63, WHITE);
  } };
  M.crashcart = { dims: [.75, 1.05, .55], face: 'short', make(k) {
    wheels(k, .3, .2, .1); k.box(-.36, .1, -.26, .36, .92, .26, RED, .02);
    for (let i = 0; i < 5; i++) { const y = .16 + i * .15; k.box(-.33, y, .26, .33, y + .12, .27, '#b0262a'); k.box(-.1, y + .05, .27, .1, y + .07, .29, CHROME); }
    k.box(-.37, .92, -.27, .37, .95, .27, '#e4e6e5'); k.box(-.3, .95, -.18, .05, 1.08, .12, '#e8c42e', .02); k.box(-.27, 1.0, .12, .02, 1.06, .125, SCREEN, 0, 'shiny');
    for (const s of [-1, 1]) k.box(s * .1 + .1, .95, -.05, s * .1 + .17, .99, .08, '#d3d6d5'); k.cylX(-.38, .38, .9, -.29, .012, CHROME, 6);
  } };
  M.medcabinet = { dims: [1, 1.95, .45], face: 'short', make(k) {
    k.box(-.5, 0, -.22, .5, 1.95, .2, WHITE, .01); k.box(-.48, .08, .2, .48, .82, .21, OFF);
    for (let y = .95; y < 1.85; y += .3) { k.box(-.46, y, -.18, .46, y + .015, .18, '#c8d0d0'); for (let x = -.42; x < .42; x += .09) { const c = ['#f2f2f2', '#e8a43a', '#3c6f9c', '#e7e2d6', '#c8302a'][((x * 31 + y * 17) | 0) % 5 >= 0 ? ((x * 31 + y * 17) | 0) % 5 : 0]; k.cyl(x + .04, y + .015, .02, .028, y + .1 + (x * 7 % .05), c, 8); } }
    k.box(-.48, .9, .19, .48, 1.9, .21, '#dfeff2', 0, 'glass'); k.box(-.005, .9, .2, .005, 1.9, .215, STEEL);
    k.box(-.08, .45, .21, -.03, .55, .23, CHROME); k.box(.03, .45, .21, .08, .55, .23, CHROME); k.box(-.18, 1.7, .21, .18, 1.78, .215, '#3f8f8a');
  } };
  M.wheelchair = { dims: [.65, .95, .95], face: 'any', make(k) {
    for (const s of [-1, 1]) {
      const x = s * .3, ring = new THREE.TorusGeometry(.29, .022, 6, 24); ring.rotateY(Math.PI / 2); ring.translate(x, .3, -.08); k.raw(ring, DARK);
      const hand = new THREE.TorusGeometry(.25, .01, 4, 20); hand.rotateY(Math.PI / 2); hand.translate(x + s * .03, .3, -.08); k.raw(hand, CHROME);
      k.cylX(x - .005, x + .005, .3, -.08, .05, CHROME, 8); k.sph(s * .2, .06, .32, .06, DARK);
      k.cyl(s * .22, .06, .32, .012, .5, CHROME, 6); k.cyl(s * .22, .3, -.3, .014, .95, CHROME, 6); k.cylZ(s * .22, .88, -.3, -.42, .02, DARK, 6);
      k.box(s * .22 - .02, .62, -.3, s * .22 + .02, .66, .2, DARK);
    }
    k.box(-.21, .46, -.28, .21, .52, .2, BLUE, .02); k.box(-.21, .52, -.3, .21, .9, -.26, BLUE, .02); k.box(-.15, .1, .3, .15, .13, .44, DARK);
  } };
  M.exambed = { dims: [.75, .95, 1.9], face: 'long', make(k) {
    k.box(-.35, 0, -.85, .35, .62, .85, WHITE, .02); for (let i = 0; i < 3; i++) k.box(-.33, .1 + i * .17, .85, .33, .24 + i * .17, .86, OFF);
    k.box(-.37, .62, -.93, .37, .76, .93, TEAL, .05); k.box(-.37, .7, -.93, .37, .95, -.55, TEAL, .05);
    k.box(-.24, .765, -.5, .24, .772, .9, '#f6f6f1'); k.cylX(-.26, .26, .78, .93, .045, '#f6f6f1', 10);
    k.box(-.25, 0, .9, .25, .2, 1.05, STEEL, .02);
  } };
  M.scale = { dims: [.45, 1.7, .45], face: 'any', make(k) {
    k.box(-.21, 0, -.2, .21, .07, .2, WHITE, .02); k.box(-.18, .07, -.17, .18, .075, .17, DARK); k.box(-.03, .07, -.2, .03, 1.55, -.16, STEEL);
    k.box(-.12, 1.15, -.21, .12, 1.32, -.14, WHITE, .01); k.box(-.1, 1.18, -.14, .1, 1.29, -.135, SCREEN, 0, 'shiny'); k.box(-.02, 1.55, -.2, .2, 1.57, -.17, STEEL);
  } };
  M.medshelf = { dims: [2.2, 1.95, .45], face: 'short', make(k) {
    for (const x of [-1.1, 1.06]) k.box(x, 0, -.22, x + .04, 1.95, .22, STEEL); k.box(-1.1, 0, -.22, 1.1, 1.95, -.2, '#e8ecea');
    const C = ['#e74c3c', '#3c6f9c', '#f2f2f2', '#2f9a5a', '#e8a43a', '#8a5aa8', '#f0d040', '#5ab0d8'];
    for (let r = 0, y = .05; r < 5; r++, y += .38) { k.box(-1.1, y, -.22, 1.1, y + .025, .22, '#dce3e3');
      for (let x = -1.04, i = r * 7; x < 1.0; i++) { const w = .07 + (i * 37 % 5) * .02, h = .12 + (i * 13 % 4) * .04; k.box(x, y + .025, -.14, x + w, y + .025 + h, .16, C[i % C.length]); k.box(x + .01, y + .05, .161, x + w - .01, y + .07, .163, '#ffffff'); x += w + .012; } }
    k.box(-.3, 1.83, .2, .3, 1.93, .22, '#3f8f8a');
  } };
  M.waitingrow = { dims: [2.3, .85, .68], face: 'short', make(k) {
    k.box(-1.15, .32, -.05, 1.15, .37, .05, STEEL); for (const x of [-1.05, 1.05]) { k.box(x - .03, 0, -.25, x + .03, .37, .25, STEEL); k.box(x - .06, 0, -.27, x + .06, .02, .27, STEEL); }
    for (let i = 0; i < 4; i++) { const x = -.84 + i * .56;
      k.box(x - .24, .4, -.2, x + .24, .47, .26, '#2f7f9a', .04); k.box(x - .23, .47, -.27, x + .23, .84, -.2, '#2f7f9a', .04);
      k.box(x + .27, .55, -.12, x + .29, .6, .2, DARK); k.box(x + .27, .37, -.1, x + .29, .55, -.08, STEEL); }
  } };
  M.receptiondesk = { dims: [3.4, 1.15, 1.1], face: 'short', make(k) {
    // frente curva (+z) em gomos, tampo de madeira, faixa teal e cruz; atrás o tampo baixo com dois computadores
    for (let i = 0; i < 10; i++) { const a0 = -.55 + i * .11, x = Math.sin(a0 + .055) * 1.75, z = .15 + Math.cos(a0 + .055) * .38; const g = new THREE.BoxGeometry(.36, 1.1, .1); g.rotateY(a0 + .055); g.translate(x, .55, z); k.raw(g, i % 2 ? WHITE : '#e9ece9'); const s = new THREE.BoxGeometry(.37, .16, .11); s.rotateY(a0 + .055); s.translate(x, .3, z); k.raw(s, TEAL); }
    k.box(-1.7, 1.08, .05, 1.7, 1.15, .55, '#c9a97c', .02); k.box(-1.6, 0, -.55, 1.6, .74, .05, WHITE, .02); k.box(-1.62, .72, -.55, 1.62, .76, .1, '#d9c4a2');
    for (const x of [-.9, .7]) { k.box(x - .02, .76, -.3, x + .02, .95, -.26, DARK); k.box(x - .28, .92, -.32, x + .28, 1.22, -.28, DARK, .01); k.box(x - .26, .94, -.28, x + .26, 1.2, -.276, '#2c5d80', 0, 'shiny'); k.box(x - .2, .76, -.12, x + .2, .78, 0, '#3a3d42'); }
    k.box(.15, .76, -.45, .35, .84, -.33, DARK); k.cyl(-1.35, .76, -.3, .09, .9, '#b06a3a', 10); for (let i = 0; i < 5; i++) k.sph(-1.35 + Math.cos(i * 1.3) * .07, 1.0, -.3 + Math.sin(i * 1.3) * .07, .07, '#4e9a62');
    k.box(-.09, .62, .55, .09, .98, .57, RED); k.box(-.22, .71, .55, .22, .89, .57, RED);
    for (const x of [-.9, .7]) chair(k, x, -.85, 0, '#3e5f73');
  } };
  M.infoboard = { dims: [1.6, 1.5, .08], face: 'short', make(k) {
    k.box(-.8, .9, -.04, .8, 1.9, .02, '#7a5a3e', .01); k.box(-.76, .94, .02, .76, 1.86, .025, '#c8a878');
    const P = ['#ffffff', '#f6e7a1', '#cfe6df', '#f3c6c6', '#d6e4f5'];
    for (let i = 0; i < 9; i++) { const x = -.68 + (i % 4) * .36 + (i * 7 % 3) * .02, y = 1.0 + ((i / 4) | 0) * .28 + (i % 2) * .04; k.box(x, y, .025, x + .26, y + .22, .03, P[i % P.length]); k.sph(x + .13, y + .2, .033, .015, RED); }
    k.box(-.5, 1.7, .025, .5, 1.82, .03, TEAL);
  } };
  M.watercooler = { dims: [.35, 1.25, .35], face: 'any', make(k) {
    k.box(-.16, 0, -.16, .16, .92, .16, WHITE, .03); k.box(-.1, .7, .16, .1, .82, .17, '#d8dddc'); k.box(-.06, .74, .17, -.02, .78, .2, '#2f7fd0'); k.box(.02, .74, .17, .06, .78, .2, RED);
    k.cyl(0, .92, 0, .14, 1.22, '#8fc6ea', 16, .13, 'glass'); k.cyl(0, 1.22, 0, .05, 1.25, '#6aa9d8', 10); k.box(-.12, .3, .16, .12, .32, .2, '#c9cfcf');
  } };
  M.tvwall = { dims: [1.3, 2, .12], face: 'short', make(k) {
    k.box(-.65, 1.45, -.05, .65, 2.0, .02, DARK, .01); k.box(-.62, 1.48, .02, .62, 1.97, .025, '#2a5f86', 0, 'shiny');
    k.box(-.5, 1.55, .026, -.1, 1.85, .03, '#e8f0f5', 0, 'shiny'); k.box(.0, 1.6, .026, .5, 1.68, .03, '#f0d040', 0, 'shiny'); k.box(.0, 1.72, .026, .4, 1.78, .03, '#cfe6df', 0, 'shiny');
    k.box(-.1, 1.4, -.06, .1, 1.45, -.03, DARK);
  } };
  M.bigplant = { dims: [.7, 1.6, .7], face: 'any', make(k) {
    k.cyl(0, 0, 0, .26, .42, '#e9e4da', 16, .3); k.cyl(0, .4, 0, .29, .44, '#d8d1c3', 16); k.cyl(0, .43, 0, .26, .45, '#4a3a2a', 14);
    for (let i = 0; i < 6; i++) { const a = i * 1.05, x = Math.cos(a) * .07, z = Math.sin(a) * .07; k.cyl(x, .44, z, .014, .72 + (i % 3) * .1, '#4a5a32', 5); }   // galhos; folhas: vegetation-3d
  } };
  M.toiletstall = { dims: [1.1, 2.05, 1.6], face: 'short', make(k) {
    for (const x of [-.55, .53]) k.box(x, .15, -.8, x + .025, 2.0, .78, '#7fa7a6', .005); k.box(-.55, 1.95, .76, .55, 2.0, .8, STEEL);
    const door = new THREE.BoxGeometry(.66, 1.8, .025); door.translate(.33, 0, 0); door.rotateY(-.5); door.translate(-.33, 1.05, .78); k.raw(door, '#86b1b0');
    k.box(-.2, 0, -.78, .2, .42, -.45, '#f4f4f2', .05); k.box(-.21, .42, -.78, .21, .46, -.3, '#f4f4f2', .08); k.box(-.18, .46, -.8, .18, .82, -.68, '#f0f0ee', .03);
    k.cyl(.36, .7, -.78, .06, .8, '#f0f0ee', 10); k.box(.34, .55, -.78, .5, .58, -.6, STEEL);
  } };
  M.sinkrow = { dims: [2.4, 1.95, .6], face: 'short', make(k) {
    k.box(-1.2, .75, -.3, 1.2, .86, .3, '#e7e9e6', .02); k.box(-1.2, 0, -.3, 1.2, .75, .25, '#c5cfcf', .01);
    for (const x of [-.75, 0, .75]) { k.box(x - .22, .82, -.15, x + .22, .87, .16, '#9aa4a6'); k.cyl(x, .86, -.24, .018, 1.05, CHROME, 8); k.cylZ(x, 1.04, -.24, -.08, .014, CHROME, 6); k.box(x + .28, .86, -.26, x + .36, 1.0, -.2, '#7cc2d8', .01); }
    k.box(-1.15, 1.1, -.3, 1.15, 1.9, -.27, '#9eb4bb', 0, 'shiny'); k.box(-1.18, 1.08, -.31, 1.18, 1.1, -.25, STEEL); k.box(-1.18, 1.9, -.31, 1.18, 1.92, -.25, STEEL);
  } };
  M.xray = { dims: [1.2, 2.2, 2.4], face: 'long', make(k) {
    k.box(-.3, 0, -.7, .3, .55, .7, '#e3e7e6', .03); k.box(-.45, .55, -1.05, .45, .7, 1.05, '#f2f4f2', .04); k.box(-.4, .7, -.95, .4, .74, .95, '#8db8c0', .02);
    k.box(-.6, 0, -1.2, -.42, 2.2, -1.0, '#dfe3e2', .02); k.box(-.6, 2.0, -1.2, .1, 2.12, -1.0, '#dfe3e2', .02); k.box(-.05, 2.0, -1.15, .05, 2.08, .2, STEEL);
    k.box(-.25, 1.55, -.15, .25, 1.95, .25, '#e9ecea', .06); k.cyl(0, 1.45, .05, .14, 1.56, DARK, 14); k.box(-.18, 1.7, .25, .18, 1.84, .27, '#f0d040'); k.box(-.06, 1.73, .27, .06, 1.81, .28, DARK);
    k.box(-.5, .9, -1.18, -.44, 1.6, -.6, '#d6dcdb'); k.box(-.43, 1.0, -1.15, -.42, 1.5, -.7, SCREEN, 0, 'shiny');
  } };
  M.leadscreen = { dims: [1.1, 1.9, .12], face: 'short', make(k) {
    for (const x of [-.5, .5]) { k.sph(x, .05, 0, .045, DARK); k.box(x - .02, .05, -.04, x + .02, 1.88, .04, STEEL); }
    k.box(-.5, .2, -.03, .5, 1.88, .03, '#8e9aa0', .01); k.box(-.3, 1.3, -.035, .3, 1.7, .035, '#a7d0e0', 0, 'glass'); k.box(-.2, .6, .031, .2, .66, .035, '#f0d040');
  } };
  M.locker = { dims: [1.2, 1.95, .5], face: 'short', make(k) {
    for (let i = 0; i < 3; i++) { const x = -.6 + i * .4; k.box(x + .005, .05, -.24, x + .395, 1.95, .24, '#5d87a6', .005);
      for (let v = 0; v < 4; v++) k.box(x + .1, 1.7 - v * .04, .24, x + .3, 1.715 - v * .04, .245, '#3d6582');
      k.box(x + .32, .95, .24, x + .35, 1.1, .26, CHROME); k.box(x + .12, 1.8, .24, x + .28, 1.86, .245, '#f2f2f2'); }
    k.box(-.6, 0, -.24, .6, .05, .24, DARK);
  } };
  M.coffeestation = { dims: [1.4, 1.25, .6], face: 'short', make(k) {
    k.box(-.7, 0, -.3, .7, .86, .28, '#c9b08a', .01); k.box(-.72, .86, -.31, .72, .9, .3, '#3a3a3a');
    k.box(-.6, .9, -.25, -.15, 1.3, .1, DARK, .02); k.box(-.55, 1.0, .1, -.2, 1.22, .11, '#3d3f44'); k.box(-.45, .92, .0, -.3, .97, .15, '#5a5c60'); k.cyl(-.38, .97, .07, .035, 1.05, WHITE, 10);
    for (let i = 0; i < 4; i++) k.cyl(.0 + i * .09, .9, -.05, .035, .99, i % 2 ? WHITE : '#c8302a', 10);
    k.box(.3, .9, -.2, .65, 1.15, .12, '#e4e6e5', .02); k.box(.33, .95, .12, .55, 1.11, .125, DARK);
  } };
  M.vending = { dims: [.95, 1.9, .8], face: 'short', make(k) {
    k.box(-.47, 0, -.4, .47, 1.9, .36, RED, .02); k.box(-.4, .3, .36, .2, 1.8, .37, '#d6eef5', 0, 'glass');
    const C = ['#e74c3c', '#2f7fd0', '#f0d040', '#2f9a5a', '#f2f2f2', '#e8a43a'];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) k.cyl(-.33 + c * .12, .4 + r * .24, .2, .04, .55 + r * .24, C[(r + c * 2) % C.length], 8);
    k.box(.24, .9, .36, .42, 1.6, .38, DARK, .01); k.box(.27, 1.35, .38, .39, 1.5, .385, '#2fe07a', 0, 'shiny'); k.box(-.38, .08, .36, .38, .24, .38, '#2a2a2a');
    k.box(-.45, 1.8, .36, .45, 1.88, .38, '#f2f2f2');
  } };
  M.cafetable = { dims: [1.5, .95, 1.5], face: 'any', make(k) {
    k.cyl(0, 0, 0, .22, .03, DARK, 16); k.cyl(0, .03, 0, .03, .72, CHROME, 8); k.cyl(0, .72, 0, .42, .75, '#f2efe6', 24);
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; chair(k, Math.cos(a) * .6, Math.sin(a) * .6, Math.PI / 2 - a + Math.PI, i % 2 ? '#3f8f8a' : '#e0a33a'); }
    k.cyl(.1, .75, .05, .04, .84, WHITE, 10); k.cyl(-.12, .75, -.08, .035, .82, '#c8302a', 10);
  } };
  M.hbench = { dims: [.5, .85, 1.8], face: 'long', make(k) {
    for (const z of [-.8, .8]) k.box(-.22, 0, z - .03, .22, .42, z + .03, STEEL);
    k.box(-.24, .42, -.9, .24, .48, .9, '#3f8f8a', .03); k.box(-.24, .48, -.9, -.18, .85, .9, '#3f8f8a', .03);
  } };
  M.labbench = { dims: [2.4, 1, .75], face: 'short', make(k) {
    k.box(-1.2, 0, -.37, 1.2, .86, .33, WHITE, .01); k.box(-1.22, .86, -.38, 1.22, .9, .37, '#2b2f33');
    for (const x of [-.8, 0, .8]) { k.box(x - .36, .1, .33, x + .36, .82, .335, OFF); k.box(x - .08, .6, .335, x + .08, .62, .345, CHROME); }
    // microscópio, estante de tubos, centrífuga e monitor
    k.box(-.95, .9, -.15, -.7, .93, .1, DARK); k.cyl(-.88, .93, -.08, .025, 1.2, DARK, 8); k.cyl(-.8, 1.12, -.02, .03, 1.28, '#e9ecea', 10, .02); k.box(-.88, 1.0, -.02, -.76, 1.03, .08, DARK);
    k.box(-.4, .9, -.1, .0, .96, .05, WHITE); for (let i = 0; i < 6; i++) k.cyl(-.37 + i * .065, .93, -.03, .014, 1.06, ['#c8302a', '#f0d040', '#5ab0d8', '#9a5ab8'][i % 4], 6);
    k.cyl(.35, .9, -.05, .14, 1.05, '#dfe3e2', 18); k.cyl(.35, 1.05, -.05, .12, 1.07, '#9fb4bd', 18, .1, 'glass');
    k.box(.7, .9, -.25, 1.1, 1.22, -.21, DARK, .01); k.box(.72, .92, -.21, 1.08, 1.2, -.205, '#2c5d80', 0, 'shiny');
  } };
  M.labfridge = { dims: [.75, 1.95, .7], face: 'short', make(k) {
    k.box(-.37, 0, -.35, .37, 1.95, .32, WHITE, .02); k.box(-.33, .1, .32, .33, 1.85, .33, '#d8eef4', 0, 'glass');
    for (let y = .25; y < 1.8; y += .32) { k.box(-.3, y, -.28, .3, y + .015, .3, '#c9d3d4'); for (let x = -.26; x < .26; x += .1) k.box(x, y + .015, -.2, x + .08, y + .12, .2, ['#5ab0d8', '#f2f2f2', '#c8302a', '#2f9a5a'][Math.abs((x * 41 + y * 13) | 0) % 4]); }
    k.box(.27, .9, .33, .31, 1.3, .36, CHROME); k.box(-.15, 1.86, .33, .15, 1.92, .335, '#2fe07a', 0, 'shiny');
  } };
  M.ortable = { dims: [.75, 1, 2.1], face: 'long', make(k) {
    k.box(-.3, 0, -.55, .3, .08, .55, '#dfe3e2', .02); k.box(-.12, .08, -.2, .12, .78, .2, STEEL, .02);
    k.box(-.32, .78, -1.0, .32, .88, 1.0, '#c7d0d0', .02); k.box(-.3, .88, -.98, .3, .98, .98, '#2f6f78', .04); k.box(-.28, .98, -.96, .28, 1.0, .4, '#7fbfb0', .02);
    for (const s of [-1, 1]) k.box(s * .45, .86, -.2, s * .45 + s * .2, .9, .05, '#2f6f78', .02);
  } };
  M.surglamp = { dims: [1.6, 2.7, 1], make(k) {
    k.cyl(-.65, 0, 0, .3, .06, '#d6dbdb', 18); k.cyl(-.65, .06, 0, .05, 2.45, '#e4e8e7', 10); k.box(-.7, 2.42, -.06, .5, 2.52, .06, '#e4e8e7', .03);
    for (const [x, y] of [[.15, 2.05], [.6, 2.15]]) { k.cyl(x, y + .32, 0, .015, 2.45, CHROME, 6); k.cyl(x, y, 0, .32, y + .14, '#eef1f0', 20, .22); k.cyl(x, y - .01, 0, .28, y, '#fffbe6', 20, .28, 'shiny');
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; k.sph(x + Math.cos(a) * .16, y - .015, Math.sin(a) * .16, .045, '#ffffff', .4, 'shiny'); } }
  } };
  M.anesthesia = { dims: [.75, 1.55, .65], face: 'any', make(k) {
    wheels(k, .3, .25, .1); k.box(-.35, .1, -.3, .35, 1.0, .28, '#e6eae9', .03); for (let i = 0; i < 3; i++) k.box(-.32, .2 + i * .22, .28, .32, .38 + i * .22, .29, '#d3d9d8');
    k.box(-.36, 1.0, -.31, .36, 1.03, .3, '#b8c2c4'); k.box(-.25, 1.03, -.15, .25, 1.4, -.1, '#dfe3e2', .02); k.box(-.23, 1.05, -.1, .23, 1.38, -.095, SCREEN, 0, 'shiny');
    vitals(k, -.21, 1.07, .21, 1.36, -.094);
    for (const [x, c] of [[-.42, '#2f7fd0'], [-.42, '#f2f2f2']].map((v, i) => [v[0], v[1], i])) k.cyl(x, .1, c === '#2f7fd0' ? -.1 : .1, .07, 1.0, c, 12);
    for (let i = 0; i < 3; i++) k.cyl(.2 + i * .05, 1.03, .15, .015, 1.25, ['#2fe07a', '#f2f2f2', '#2f7fd0'][i], 6, .015, 'glass');
    k.cylX(.35, .55, .85, .1, .025, '#9fb4bd', 8);
  } };
  M.mayo = { dims: [.6, 1, .45], face: 'any', make(k) {
    k.box(-.25, 0, -.2, .25, .04, .2, STEEL); k.cyl(-.2, .04, 0, .02, .95, CHROME, 8); k.box(-.28, .95, -.21, .28, .97, .21, CHROME);
    k.box(-.26, .97, -.19, .26, .975, .19, '#3f7f8a'); for (let i = 0; i < 7; i++) k.box(-.2 + i * .06, .975, -.12, -.19 + i * .06, .985, .12, '#e9eef0', 0, 'shiny');
    k.cyl(.15, .975, .1, .05, 1.0, '#e9eef0', 12);
  } };
  M.ventilator = { dims: [.5, 1.45, .5], face: 'any', make(k) {
    star(k, .22); k.cyl(0, .1, 0, .025, .8, STEEL, 8); k.box(-.2, .8, -.15, .2, 1.3, .12, '#e9ecea', .03); k.box(-.18, .95, .12, .18, 1.25, .125, SCREEN, 0, 'shiny');
    vitals(k, -.16, .97, .16, 1.23, .126); for (const s of [-1, 1]) k.cylX(Math.min(s * .2, s * .32), Math.max(s * .2, s * .32), .9, 0, .025, '#9fd0e0', 8, 'glass');
    k.box(-.1, 1.3, -.06, .1, 1.36, .06, '#2f7fd0');
  } };
  M.crib = { dims: [.6, 1, .9], face: 'long', make(k) {
    wheels(k, .22, .35, .1); k.box(-.25, .1, -.38, .25, .55, .38, '#e2e6e5', .02); k.box(-.26, .55, -.4, .26, .58, .4, STEEL);
    k.box(-.25, .58, -.39, .25, .92, .39, '#e8f4f8', .03, 'glass'); k.box(-.21, .6, -.33, .21, .66, .33, '#f8f8f4', .03); k.box(-.18, .66, -.05, .18, .7, .3, '#f3c6d4', .03); k.sph(0, .7, -.18, .07, '#f2d6c0');
  } };
  return M;
}

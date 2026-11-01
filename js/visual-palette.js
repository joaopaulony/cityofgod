// CITY OF GOD — paleta oficial baseada na imagem de referencia do usuario,
// recebida em 23/10/2026: cidade ilustrada isometrica ao sol (2025 na HUD).
// Nao representa um pedido para copiar sprites, texturas ou construcoes.
// Ajustar tonalidades aqui, nao a forma das folhas, bitmaps ou GLBs.
'use strict';
const VISUAL_REFERENCE=Object.freeze({
  id:'cityofgod-illustrated-daylight-v1',
  name:'Cidade ilustrada — sol quente, vegetacao viva e sombras profundas',
  source:'Imagem de referencia fornecida pelo criador, 23/10/2026',
  anchors:Object.freeze({
    asphalt:'#393536',roadPatch:'#302e31',sidewalk:'#c5b6a5',
    concreteShadow:'#86796d',grass:'#52782e',grassSun:'#789c3d',
    leafDeep:'#192b19',leafMid:'#4a7936',leafSun:'#a3bc65',
    warmWall:'#dcc3a9',coolWall:'#bec4b8',terracotta:'#a6543e',
    roofShadow:'#523d3b',outline:'#201b1b',sunlight:'#ffe3b2'
  }),
  terrain:Object.freeze({
    lush:'#527a30',dry:'#91894e',moss:'#456538',litter:'#654a35',
    dirt:'#87684e',mud:'#4b352d',puddle:'#536264',
    trail:'#94765b',sand:'#c4ae84',wsand:'#957d5e',
    shallow:'#769481',deep:'#24464d',foam:'#d4d1bd',
    asph:'#3a3739',patch:'#302e31',gutter:'#484039',
    curbF:'#71685e',curbT:'#c7b8a5',walk:'#bdafa0'
  }),
  canopy:Object.freeze([
    {deep:'#182a19',shade:'#274c26',body:'#417333',mid:'#629342',sun:'#91b052',glint:'#b5ca70'},
    {deep:'#242d18',shade:'#3b5228',body:'#607c34',mid:'#829a45',sun:'#a8b657',glint:'#c6cf79'},
    {deep:'#173425',shade:'#27603c',body:'#40874a',mid:'#66a458',sun:'#91bf6f',glint:'#bad58c'},
    {deep:'#282e1b',shade:'#455529',body:'#647a34',mid:'#879b45',sun:'#b0b95c',glint:'#c8d080'}
  ]),
  needles:Object.freeze([
    ['#13231c','#204032','#2e5c43','#397753','#6b9260'],
    ['#1a281d','#304630','#3c5c38','#557448','#8a9b61'],
    ['#192a22','#2b4d3b','#3b6049','#548064','#93a77d'],
    ['#15271c','#224333','#2c6047','#478267','#85a27d']
  ]),
  architecture:Object.freeze({
    plasters:['#e0cbb1','#d6c0a4','#ead8c4','#bac9b6','#d3bca4',
      '#dec5ac','#b8c9ce','#dfc7ac','#cabbab'],
    trims:['#fff0d9','#f5e9d9','#e8d7bf','#e4d9cc'],
    roofs:Object.freeze({
      ceramic:['#b65a40','#a8523b','#c16d48','#944b3a'],
      shingle:['#514d53','#70524b','#424a4f'],
      metal:['#8b9292','#707e76','#8a735e']
    }),
    concrete:'#97918b'
  }),
  grade:Object.freeze({
    // Alteracao de cores apenas — a geometria, sprites procedurais,
    // alpha dos carros GLB e bitmaps do mapa permanecem intactos.
    saturation:1.12,contrast:1.075,brightness:1.015,
    vehicleSaturation:1.085,vehicleContrast:1.045,vehicleBrightness:1.0
  })
});

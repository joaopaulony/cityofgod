// Catálogo das imagens do jogo. Cada item vira UM prompt completo (style.mjs + regras do tipo + descrição + escala + cores).
//   kind     texture | wall | roof | facade | sprite  (regras em style.mjs)
//   meters   largura real coberta pela imagem (textura) ou altura do objeto (sprite): dá a escala dos detalhes
//   game     tamanho final no jogo (px do lado maior), gerado a partir do original 2K
//   tint     true = material neutro claro, o jogo pinta por cima com as cores de reboco/telha da paleta
//   colors   chaves de PALETTE (style.mjs) citadas no prompt
// Ordem = ordem de prioridade (o que mais aparece na tela primeiro).

export const CATALOG = [
  // ---------------- chão ----------------
  { id: 'ground-asphalt', kind: 'texture', group: 'chão', title: 'Asfalto de rua', meters: 4, game: 512, colors: ['asphalt', 'roadPatch'],
    desc: 'Aged city street asphalt in a warm charcoal tone. Fine dense aggregate (2–8 mm stones) slightly polished by traffic, a few faint darker oil drips, one or two thin sealed tar crack lines that wander naturally, very subtle lighter tire-worn areas. NO lane markings, NO manholes, NO curbs, NO debris.' },
  { id: 'ground-sidewalk', kind: 'texture', group: 'chão', title: 'Calçada de concreto', meters: 3, game: 512, colors: ['sidewalk', 'concreteShadow'],
    desc: 'Light beige broom-finished poured concrete sidewalk. Exactly 2 × 2 square slabs fill the image (each slab 1.5 m), separated by straight, thin, slightly darker tooled expansion joints that run edge to edge so the grid continues when tiled. Faint fine broom texture, a few tiny pores, soft sun-bleached stains, one small hairline crack. Clean, not dirty.' },
  { id: 'ground-lawn', kind: 'texture', group: 'chão', title: 'Gramado cuidado', meters: 4, game: 512, colors: ['grass', 'grassSun'],
    desc: 'Manicured Florida St. Augustine grass lawn seen from above: dense broad blades (about 5–8 mm wide, 6–10 cm long), healthy natural green with gentle variation between sun-warmed yellow-green tufts and slightly deeper green patches. Very subtle mowing texture, no stripes, no flowers, no bare soil, no objects.' },
  { id: 'ground-weeds', kind: 'texture', group: 'chão', title: 'Terreno com mato ralo', meters: 4, game: 512, colors: ['grass', 'dirt', 'sand'],
    desc: 'Neglected vacant-lot ground: patchy dry and green grass clumps and small weeds over sandy light-brown soil, about 40% bare soil, scattered tiny pebbles and a few dry leaves. Natural irregular clumps, no trash, no objects, no paths.' },
  { id: 'ground-dirt', kind: 'texture', group: 'chão', title: 'Terra batida', meters: 4, game: 512, colors: ['dirt'],
    desc: 'Packed dry reddish-brown dirt yard trodden by people: compacted soil with fine cracks, small pebbles (5–20 mm), faint footprint and tire impressions, slight dust. No grass, no puddles, no objects.' },
  { id: 'ground-sand', kind: 'texture', group: 'chão', title: 'Areia de praia', meters: 4, game: 512, colors: ['sand'],
    desc: 'Fine pale coral beach sand, dry, softly rippled by wind, scattered faint footprints and a few tiny shell fragments. Warm cream color with gentle variation. No water, no wet sand line, no objects, no seaweed.' },
  { id: 'ground-pavers', kind: 'texture', group: 'chão', title: 'Praça de piso intertravado', meters: 3, game: 512, colors: ['sidewalk', 'warmWall'],
    desc: 'Upscale Miami plaza paving: rectangular concrete pavers (20 × 10 cm) in a herringbone pattern, two close warm tones of sand and light terracotta-beige, thin fine-sand joints, very light wear. The pattern must align so it continues seamlessly across all edges.' },
  { id: 'ground-hedge', kind: 'texture', group: 'chão', title: 'Folhagem de cerca viva', meters: 2, game: 512, colors: ['leafDeep', 'leafMid', 'leafSun'],
    desc: 'Dense clipped ficus hedge foliage surface (used for the tops and sides of trimmed hedges): thousands of small glossy oval leaves (2–4 cm) packed tightly, deep shaded gaps between sun-lit leaf clusters, natural green variation. Uniform, no branches visible, no flowers.' },

  // ---------------- paredes (o jogo tinge com a cor da casa) ----------------
  { id: 'wall-stucco', kind: 'wall', group: 'paredes', title: 'Reboco liso pintado', meters: 3, game: 512, tint: true, colors: ['warmWall'],
    desc: 'Smooth painted exterior stucco wall in a NEUTRAL very light warm off-white (the game tints it), with subtle hand-troweled texture, very faint hairline cracks and light rain streaks fading downward from the top. Even, clean, well-kept Miami house wall.' },
  { id: 'wall-stucco-worn', kind: 'wall', group: 'paredes', title: 'Reboco gasto', meters: 3, game: 512, tint: true, colors: ['warmWall', 'concreteShadow'],
    desc: 'Old rough sprayed stucco wall in a NEUTRAL light grey-beige (the game tints it): coarse texture, patched areas with slightly different texture, dirt and water stains near the bottom, a few small chipped spots showing grey cement. Poor neighborhood, weathered but standing.' },
  { id: 'wall-block', kind: 'wall', group: 'paredes', title: 'Bloco de concreto pintado', meters: 3, game: 512, tint: true, colors: ['coolWall'],
    desc: 'Painted concrete masonry block wall (CMU, 40 × 20 cm blocks, running bond) in a NEUTRAL light grey (the game tints it), several coats of paint softening the block texture, mortar joints visible as shallow grooves, mild weathering stains. Typical Florida public housing.' },
  { id: 'wall-brick', kind: 'wall', group: 'paredes', title: 'Tijolo de galpão', meters: 3, game: 512, colors: ['terracotta', 'roofShadow'],
    desc: 'Industrial red-brown brick wall (standard bricks 22 × 7 cm, running bond) with slightly recessed grey mortar joints, natural color variation between bricks, faint efflorescence and soot. Warehouse district, old but solid.' },

  // ---------------- telhados ----------------
  { id: 'roof-clay', kind: 'roof', group: 'telhados', title: 'Telha de barro (capa e canal)', meters: 3, game: 512, colors: ['terracotta', 'roofShadow'],
    desc: 'Spanish/Mission barrel clay roof tiles, the classic Miami Mediterranean roof: alternating convex and concave terracotta tiles forming vertical channels, horizontal rows overlapping downward, warm sun-faded terracotta with natural tile-to-tile variation and light dark weathering in the channels.' },
  { id: 'roof-shingle', kind: 'roof', group: 'telhados', title: 'Telha asfáltica', meters: 3, game: 512, tint: true, colors: ['roofShadow'],
    desc: 'Asphalt architectural shingles in a NEUTRAL mid grey (the game tints it): laminated tabs in horizontal staggered rows, granular mineral surface, subtle shadow lines under each row, mild sun fading.' },
  { id: 'roof-metal', kind: 'roof', group: 'telhados', title: 'Telha de zinco enferrujada', meters: 3, game: 512, colors: ['roofShadow', 'dirt'],
    desc: 'Corrugated galvanized metal roofing sheets, ribs running vertically (ridge at top, eave at bottom), overlapping sheet joints, patchy orange-brown rust, dirt streaks along the ribs, a few nail heads in rows. Poor neighborhood roof.' },
  { id: 'roof-flat', kind: 'roof', group: 'telhados', title: 'Laje com manta', meters: 4, game: 512, colors: ['sidewalk', 'concreteShadow'],
    desc: 'Flat commercial roof: light grey-white reflective membrane in wide strips with slightly raised heat-welded seams, faint dirt pooling marks, a few small patches. No equipment, no drains, no edges.' },

  // ---------------- fachadas (um andar, empilhável) ----------------
  { id: 'facade-office', kind: 'facade', group: 'fachadas', title: 'Torre de escritórios (vidro azul)', meters: 6, game: 1024, ratio: '16:9', colors: ['outline'],
    desc: 'Modern Brickell office tower facade, one floor (3.4 m tall) by 6 m wide: blue-green tinted reflective curtain-wall glass with slim dark aluminum mullions every 1.5 m, a thin grey spandrel band at the floor slab, soft sky and cloud reflection, a few interior blinds half lowered.' },
  { id: 'facade-condo', kind: 'facade', group: 'fachadas', title: 'Condomínio com varandas', meters: 6, game: 1024, ratio: '16:9', colors: ['warmWall', 'outline'],
    desc: 'Miami luxury condo facade, one floor (3.2 m tall) by 6 m wide: white concrete slab edge, full-width balcony with frameless glass railing, floor-to-ceiling sliding glass doors with light blue reflections, a thin white sun-shade fin between units.' },
  { id: 'facade-deco', kind: 'facade', group: 'fachadas', title: 'Hotel art déco (South Beach)', meters: 6, game: 1024, ratio: '16:9', tint: true, colors: ['warmWall', 'sunlight'],
    desc: 'Art Deco hotel facade, one floor (3.2 m tall) by 6 m wide, Ocean Drive style: smooth stucco in a NEUTRAL light off-white (the game tints it pastel), two square windows with "eyebrow" sun-shade ledges above them, thin horizontal racing-stripe grooves, a small vertical decorative relief between windows.' },

  // ---------------- vegetação e objetos (recorte em magenta) ----------------
  { id: 'tree-coconut', kind: 'sprite', group: 'vegetação', title: 'Coqueiro', meters: 9, game: 512, ratio: '3:4', colors: ['leafDeep', 'leafMid', 'leafSun'],
    desc: 'One tall coconut palm (9 m): slender slightly curved grey-brown ringed trunk, a full crown of long arching feathery fronds radiating in all directions (some drooping, a few dry brown ones underneath), a small cluster of green coconuts under the crown.' },
  { id: 'tree-royal', kind: 'sprite', group: 'vegetação', title: 'Palmeira imperial', meters: 11, game: 512, ratio: '3:4', colors: ['leafDeep', 'leafMid', 'leafSun'],
    desc: 'One Florida royal palm (11 m): smooth straight pale grey concrete-like trunk slightly swollen at the base, a bright green glossy crownshaft at the top, and a symmetrical crown of long arching pinnate fronds.' },
  { id: 'bush-hibiscus', kind: 'sprite', group: 'vegetação', title: 'Arbusto de hibisco', meters: 1.4, game: 256, colors: ['leafDeep', 'leafMid', 'leafSun'],
    desc: 'One rounded hibiscus shrub (1.4 m tall, 1.6 m wide): dense glossy dark-green leaves with several large scarlet-red and a few orange hibiscus flowers (no pink) on the outer surface.' },
  { id: 'bush-croton', kind: 'sprite', group: 'vegetação', title: 'Arbusto de cróton', meters: 1, game: 256, colors: ['leafDeep', 'leafSun'],
    desc: 'One compact croton shrub (1 m tall): thick leathery leaves variegated in green, yellow, orange and deep red, upright bushy shape.' },
];

export const catalogIds = Object.freeze(CATALOG.map(a => a.id));
export const byId = id => CATALOG.find(a => a.id === id) || null;

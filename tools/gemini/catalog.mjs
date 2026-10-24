// Catálogo das imagens do jogo. Cada item vira UM prompt completo (style.mjs + regras do tipo + descrição + escala + cores).
//   kind     texture | wall | roof | facade | mural | sprite  (regras em style.mjs)
//   meters   largura real coberta pela imagem (textura/fachada/mural) ou altura do objeto (sprite): dá a escala dos detalhes
//   game     tamanho final no jogo (px do lado maior), reduzido a partir do original 2K
//   tint     true = material neutro claro, o jogo pinta por cima com as cores de reboco/telha da paleta
//   colors   chaves de PALETTE (style.mjs) citadas no prompt
//   refs     referências de estilo (assets/references/) anexadas a ESTE item; --refs na execução substitui
//   anchor   cor média final da textura (o pós-processamento puxa o tom p/ ela)
//   pattern  textura com padrão de propósito (piso intertravado): dispensa a regra de superfície isotrópica
//   desat    fração do croma mantida (tira manchas coloridas: asfalto)
//   level    nivela manchas maiores que 30 cm (fração do contraste removida)
//   despot   apaga pontinhos escuros isolados que viram grade ao repetir (calçadas)
//   key      fundo de recorte dos sprites (magenta padrão; blue p/ plantas com flor rosa)
//   graffiti true = permite letras de grafite abstratas (sem palavras legíveis)
// Ordem = ordem de prioridade (o que mais aparece na tela primeiro).
// Referências: 01 orla South Beach · 02 gueto/quadra · 03 gueto painel · 04 favela de tijolo · 05 chinatown · 06 bairro de casas
// 07 lojas · 08 porto · 09 indústria · 10 centro comercial · 11 viadutos · 12 bombeiros · 13 polícia · 14 hospital
// 15 aeroporto · 16 estação de trem · 17 fazendas · 18 esquina do centro · 19 praia/estacionamento · 20 esquina do gueto

const R = {
  orla: '01-southbeach-orla.webp', gueto: '02-gueto-quadra.webp', guetoP: '03-gueto-painel.webp', favela: '04-favela-tijolo.webp',
  casas: '06-bairro-casas.webp', lojas: '07-comercio-lojas.webp', industria: '09-centro-industrial.png', comercial: '10-centro-comercial.png',
  trem: '16-estacao-trem.png', centro: '18-centro-esquina.webp', praia: '19-praia-estacionamento.webp', esquina: '20-gueto-esquina.webp',
};

export const CATALOG = [
  // ---------------- chão ----------------
  { id: 'ground-asphalt', kind: 'texture', group: 'chão', title: 'Asfalto de rua', meters: 4, game: 512, anchor: '#3d3a3a', desat: 0.3, despot: { thr: 12, radius: 0.04, strength: 0.75 }, colors: ['asphalt', 'roadPatch'], refs: [],
    desc: 'Aged Miami city street asphalt in a NEUTRAL dark charcoal grey (#393536), even brightness and even texture everywhere. FINE-grained asphalt concrete: aggregate stones only 2–8 mm (1–3 px each at 2048 px = 4 m; NOT pebbles, NOT chip seal, NOT gravel), tightly bound in black binder so the surface reads as smooth fine grit from a few meters away. Grey only: NO brown, reddish or tan stains, NO smooth binder-rich zones. Only very low-contrast, non-directional mottling spread evenly. Perfectly uniform fine-grained asphalt surface: NO cracks, NO spots, NO stains, NO patches, NO blotches of any kind (the game adds cracks and stains as separate decals). Only the fine 2–8 mm aggregate grain and a very subtle, even, low-contrast mottling. NO repaired patch, NO pothole, NO puddle, NO tire tracks, NO lane markings, NO manholes, NO curbs, NO debris.' },
  { id: 'ground-sidewalk', kind: 'texture', level: 0.5, group: 'chão', title: 'Calçada de concreto', meters: 3, game: 512, anchor: '#c5b6a5', despot: true, colors: ['sidewalk', 'concreteShadow'], refs: [R.centro, R.casas],
    desc: 'Real exterior poured sidewalk concrete as in a top-down photo scan: matte, uniform light warm grey (#c5b6a5), fine exposed sand grit and tiny pinholes everywhere, very faint straight broom lines; NOT plaster, NOT stucco, NOT a painted wall, NO trowel swirls or brush strokes, NO cloudy or watercolor stains, NO vertical streaks. One continuous surface WITHOUT any joints or slab edges (the game draws them). Wear only as very faint, small (10–30 cm) scuffs spread evenly; overall brightness variation under 5%. NO gum spots, NO dark dots.' },
  { id: 'ground-sidewalk-pink', kind: 'texture', group: 'chão', title: 'Calçada rosa (South Beach)', meters: 3, game: 512, anchor: '#dcaaa0', despot: true, colors: ['sidewalk'], refs: [R.orla, R.centro],
    desc: 'Miami Beach tinted concrete sidewalk in a sun-faded dusty flamingo pink (#d8a59c to #e3b5aa) — soft rose, NOT orange, NOT salmon, NOT terracotta tile. Exterior poured tinted concrete with fine sand grit (NOT plaster or stucco), one continuous surface WITHOUT any joints or slab edges (the game draws them), very fine broom finish with no strong direction. Sun-bleaching only as soft, large, low-contrast variations spread evenly. NO gum spots, NO dark dots, NO water-stain tide lines, NO hard-edged lighter patches.' },
  { id: 'ground-concrete-worn', kind: 'texture', level: 0.5, group: 'chão', title: 'Concreto gasto (lotes e estacionamentos)', meters: 4, game: 512, anchor: '#9a9389', desat: 0.6, despot: { thr: 25, strength: 0.8 }, colors: ['concreteShadow', 'asphalt'], refs: [R.esquina, R.gueto],
    desc: 'Worn grey concrete floor of a poor-neighborhood parking lot / yard, seen from directly above, one continuous surface without joints. Weathering made ONLY of small, evenly spread, low-contrast elements: a network of many fine thin cracks (hairline to 5 mm) spread over the whole image with tiny weeds in a few of them, oil stains and grime that are SMALL (10–30 cm), numerous and faint, with natural crisp edges — NO large soft cloudy, smoky or watercolor-like dark blotches; fine grime speckle; overall brightness even within ±5%. NO shapes that look like letters, symbols, footprints or shoe soles (no L, T, J or U shapes), NO scuff or skid marks, NO tire marks, NO vertical streaks or drips, NO single long crack crossing the image, NO single very dark spot, NO painted lines, NO objects.' },
  { id: 'ground-lawn', kind: 'texture', group: 'chão', title: 'Gramado cuidado', meters: 4, game: 512, anchor: '#638a36', colors: ['grass', 'grassSun'], refs: [R.casas, R.praia],
    desc: 'Florida St. Augustine grass lawn seen straight down from about 4 m above, at game scale: a dense, fine, velvety turf where each blade is tiny (5–8 mm wide, 6–10 cm long = only 3–4 px wide and 30–50 px long in this 2048 px image of 4 m). Thousands of overlapping blades in random directions with dark shaded gaps, reading as a fine carpet, NOT as individual large leaves. Low-contrast irregular patches 0.5–1.5 m wide alternating sun-warmed yellow-green (#789c3d) and deeper green (#52782e), two or three faint straw-colored dry spots. No stripes, no flowers, no bare soil, no objects.' },
  { id: 'ground-weeds', kind: 'texture', group: 'chão', title: 'Terreno com mato ralo', meters: 4, game: 512, anchor: '#8f8455', despot: { thr: 55, strength: 0.6 }, colors: ['grass', 'dirt', 'sand'], refs: [],
    desc: 'Neglected vacant-lot ground seen STRAIGHT DOWN (orthographic top-down), rendered like a photogrammetry ground scan with a light painterly grade: NO line art, NO ink or dark outlines around leaves, stones or clumps, NO illustration or botanical-drawing look; soft natural edges and real light falloff inside each clump. Sandy light-brown soil (#87684e to #c4ae84) between a random, isotropic scatter of dry yellowed and green grass clumps that vary strongly in size (10–70 cm), shape and density (some sparse, some dense, some just a few blades), never evenly spaced star shapes, never in bands or alignments, the same amount of vegetation in each quadrant. Pebbles 0.5–2 cm, a few dry leaves. Warm golden-hour light. No trash, no objects, no paths. NO twigs, NO sticks, NO wood pieces, NO dark debris; only grass clumps, small weeds, sand and pebbles.' },
  { id: 'ground-dirt', kind: 'texture', level: 0.35, group: 'chão', title: 'Terra batida', meters: 4, game: 512, anchor: '#87684e', despot: { thr: 16, radius: 0.006, strength: 0.45 }, colors: ['dirt'], refs: [R.favela, R.guetoP],
    desc: 'Packed dry reddish-brown dirt yard trodden by people: compacted soil, only very subtle shallow shoe scuffs (no tread patterns, no tire tracks, no ladder-like marks), fine dried-mud cracks spread thinly and evenly, never in clusters, pebbles 5–20 mm (3–10 px), slight dust. No grass, no puddles, no objects.' },
  { id: 'ground-sand', kind: 'texture', group: 'chão', title: 'Areia de praia', meters: 4, game: 512, anchor: '#d4c09a', colors: ['sand'], refs: [R.praia, R.orla],
    desc: 'Fine pale cream coral beach sand, dry, softly rippled by wind, scattered faint footprints and a few tiny shell fragments, exactly the warm cream sand of references 19 and 01. No water, no wet sand line, no objects, no seaweed.' },
  { id: 'ground-hedge', kind: 'texture', group: 'chão', title: 'Folhagem de cerca viva', meters: 2, game: 512, anchor: '#46702f', colors: ['leafDeep', 'leafMid', 'leafSun'], refs: [R.praia, R.orla],
    desc: 'Dense clipped tropical hedge foliage surface (used for the tops and sides of trimmed hedges): thousands of small glossy oval leaves (2–4 cm) packed tightly, deep shaded gaps between golden sun-lit leaf clusters, natural green variation. Uniform, no branches visible, no flowers.' },

  // ---------------- paredes (o jogo tinge as neutras com a cor da casa) ----------------
  { id: 'wall-stucco', kind: 'wall', group: 'paredes', title: 'Reboco liso pintado', meters: 3, game: 512, tint: true, colors: ['warmWall'], refs: [R.orla, R.centro],
    desc: 'Smooth painted exterior stucco wall of a Miami Art Deco building in a NEUTRAL very light warm off-white (the game tints it pastel), subtle hand-troweled texture, very faint hairline cracks and light rain streaks fading downward from the top. Clean and well kept.' },
  { id: 'wall-stucco-worn', kind: 'wall', group: 'paredes', title: 'Reboco gasto e sujo', meters: 3, game: 512, tint: true, colors: ['warmWall', 'concreteShadow'], refs: [R.gueto, R.esquina, R.guetoP],
    desc: 'Old sun-bleached sprayed stucco wall in a NEUTRAL light grey-beige (the game tints it): coarse texture, patched areas with slightly different texture, heavy dirt and dark water stains running down, grime near the bottom, small chipped spots showing grey cement, faint ghost marks of painted-over graffiti. The grimy poor-neighborhood walls of references 02 and 20.' },
  { id: 'wall-block', kind: 'wall', group: 'paredes', title: 'Bloco de concreto pintado', meters: 3, game: 512, tint: true, colors: ['coolWall'], refs: [R.gueto, R.esquina],
    desc: 'Painted concrete masonry block wall (CMU, 40 × 20 cm blocks, running bond) in a NEUTRAL light grey (the game tints it), several coats of paint softening the block texture, mortar joints as shallow grooves, rust-colored drip stains and dirt. Florida public housing.' },
  { id: 'wall-brick', kind: 'wall', group: 'paredes', title: 'Tijolo aparente', meters: 3, game: 512, colors: ['terracotta', 'roofShadow'], refs: [R.favela, R.industria],
    desc: 'Exposed orange-red clay brick wall (bricks 22 × 7 cm, running bond) with rough grey mortar joints, natural color variation between bricks, some chipped bricks, dark soot and dirt stains, faint efflorescence. Like the brick houses of reference 04 and the old warehouses of reference 09.' },
  { id: 'wall-graffiti', kind: 'wall', group: 'paredes', title: 'Muro grafitado', meters: 4, game: 1024, graffiti: true, colors: ['concreteShadow'], refs: [R.gueto, R.esquina, R.guetoP],
    desc: 'Weathered grey concrete perimeter wall densely covered with colorful layered street graffiti: abstract wildstyle tags and throw-ups in teal, yellow, orange, purple, white and black outlines, overlapping and partly faded by the sun, drips, dirt at the bottom, exactly the graffiti walls of references 02 and 20. Must tile horizontally and vertically.' },
  { id: 'mural-woman', kind: 'mural', group: 'paredes', title: 'Mural: mulher e palmeiras', meters: 6, game: 1024, ratio: '4:3', graffiti: true, colors: ['sunlight'], refs: [R.esquina, R.orla],
    desc: 'Large vibrant street-art mural: an original stylized portrait of a young Latina woman with flowing hair, framed by palm silhouettes and a sunset sky in hot pink, orange, turquoise and purple, bold painterly strokes, in the spirit of the mural in reference 20 (create an original face, do not copy). Faded by sun, small cracks of the wall showing.' },
  { id: 'mural-man', kind: 'mural', group: 'paredes', title: 'Mural: homem de óculos escuros', meters: 6, game: 1024, ratio: '4:3', graffiti: true, colors: ['sunlight'], refs: [R.gueto, R.guetoP],
    desc: 'Large vibrant street-art mural: an original stylized portrait of a young Black man with sunglasses and a golden crown above his head, on a bright pink and yellow background with abstract graffiti shapes around, bold painterly strokes, in the spirit of the murals in references 02 and 03 (original face, do not copy). Faded by sun, cracks of the wall showing.' },

  // ---------------- telhados ----------------
  { id: 'roof-flat', kind: 'roof', group: 'telhados', title: 'Laje suja (telhado plano)', meters: 4, game: 512, colors: ['concreteShadow', 'sidewalk'], refs: [R.esquina, R.gueto, R.centro],
    desc: 'Flat roof of an old Miami building, the most common roof in the references: grey-beige sealed concrete / bitumen surface with large irregular dark water-pooling stains, cracks with black tar repairs, sun-bleached patches, dirt and a few small leaves. No AC units, no vents, no parapet, no edges (the game adds them).' },
  { id: 'roof-flat-clean', kind: 'roof', group: 'telhados', title: 'Laje com manta branca', meters: 4, game: 512, colors: ['sidewalk', 'concreteShadow'], refs: [R.centro, R.orla],
    desc: 'Flat roof of a newer condo / hotel: light grey-white reflective membrane in wide strips with slightly raised heat-welded seams, faint dirt pooling marks, a few small patches. No equipment, no drains, no edges.' },
  { id: 'roof-shingle', kind: 'roof', group: 'telhados', title: 'Telha asfáltica', meters: 3, game: 512, tint: true, colors: ['roofShadow'], refs: [R.casas, R.esquina],
    desc: 'Asphalt architectural shingles in a NEUTRAL mid grey (the game tints it brown/grey): laminated tabs in horizontal staggered rows, granular mineral surface, subtle shadow lines under each row, mild sun fading, a few darker algae streaks, like the hip roofs of the houses in references 06 and 20.' },
  { id: 'roof-clay', kind: 'roof', group: 'telhados', title: 'Telha de barro (capa e canal)', meters: 3, game: 512, colors: ['terracotta', 'roofShadow'], refs: [R.trem, R.casas],
    desc: 'Spanish/Mission barrel clay roof tiles, the classic Miami Mediterranean roof: alternating convex and concave terracotta tiles forming vertical channels, horizontal rows overlapping downward, warm sun-faded terracotta with natural tile-to-tile variation and dark weathering in the channels.' },
  { id: 'roof-metal', kind: 'roof', group: 'telhados', title: 'Telha de zinco enferrujada', meters: 3, game: 512, colors: ['roofShadow', 'dirt'], refs: [R.favela, R.guetoP],
    desc: 'Corrugated galvanized metal roofing sheets, ribs running vertically (ridge at top, eave at bottom), overlapping sheet joints, patchy orange-brown rust, dirt streaks along the ribs, a few nail heads in rows. Poor neighborhood roof.' },

  // ---------------- fachadas (um andar, empilhável) ----------------
  { id: 'facade-office', kind: 'facade', group: 'fachadas', title: 'Torre de escritórios (vidro)', meters: 6, game: 1024, ratio: '16:9', colors: ['outline'], refs: [R.comercial, R.centro],
    desc: 'Modern Brickell office tower facade, one floor (3.4 m tall) by 6 m wide: teal-green tinted reflective curtain-wall glass with slim dark aluminum mullions every 1.5 m, a thin grey spandrel band at the floor slab, warm golden sky reflection, a few interior blinds half lowered.' },
  { id: 'facade-condo', kind: 'facade', group: 'fachadas', title: 'Condomínio com varandas', meters: 6, game: 1024, ratio: '16:9', colors: ['warmWall', 'outline'], refs: [R.centro],
    desc: 'Miami luxury condo tower facade, one floor (3.2 m tall) by 6 m wide, like the white tower in reference 18: white concrete slab edge, full-width balcony with frameless glass railing, floor-to-ceiling sliding glass doors with teal reflections, a thin white sun-shade fin between units.' },
  { id: 'facade-deco', kind: 'facade', group: 'fachadas', title: 'Hotel art déco (South Beach)', meters: 6, game: 1024, ratio: '16:9', tint: true, colors: ['warmWall', 'sunlight'], refs: [R.orla, R.praia],
    desc: 'Art Deco hotel facade, one floor (3.2 m tall) by 6 m wide, Ocean Drive style like references 01 and 19: smooth stucco in a NEUTRAL light off-white (the game tints it pastel), two square windows with "eyebrow" sun-shade ledges above them, thin horizontal racing-stripe grooves, a small vertical decorative relief between windows.' },

  // ---------------- vegetação (recorte do fundo) ----------------
  { id: 'tree-coconut', kind: 'sprite', group: 'vegetação', title: 'Coqueiro', meters: 9, game: 512, ratio: '3:4', colors: ['leafDeep', 'leafMid', 'leafSun'], refs: [R.orla, R.praia],
    desc: 'One tall coconut palm (9 m), exactly the palms of references 01 and 19: slender slightly curved grey-brown ringed trunk, a full crown of long arching feathery fronds radiating in all directions, sunlit fronds glowing yellow-green in golden light and deeper green underneath, a few dry brown fronds hanging, a small cluster of green coconuts under the crown.' },
  { id: 'tree-royal', kind: 'sprite', group: 'vegetação', title: 'Palmeira imperial', meters: 11, game: 512, ratio: '3:4', colors: ['leafDeep', 'leafMid', 'leafSun'], refs: [R.centro, R.trem],
    desc: 'One Florida royal palm (11 m): smooth straight pale grey concrete-like trunk slightly swollen at the base, a bright green glossy crownshaft at the top, and a symmetrical crown of long arching pinnate fronds lit by golden sun.' },
  { id: 'bush-bougainvillea', kind: 'sprite', group: 'vegetação', title: 'Buganvília', meters: 1.8, game: 384, key: 'blue', colors: ['leafMid'], refs: [R.orla, R.praia],
    desc: 'One loose mounded bougainvillea shrub (1.8 m tall, 2 m wide) covered in vivid magenta-pink papery bracts over green leaves, airy irregular silhouette with a few arching stems, like the flowering bushes on Ocean Drive in reference 01.' },
  { id: 'bush-hibiscus', kind: 'sprite', group: 'vegetação', title: 'Arbusto de hibisco', meters: 1.4, game: 256, colors: ['leafDeep', 'leafMid', 'leafSun'], refs: [R.praia],
    desc: 'One rounded hibiscus shrub (1.4 m tall, 1.6 m wide): dense glossy dark-green leaves with several large scarlet-red and a few orange hibiscus flowers (no pink) on the outer surface.' },
  { id: 'bush-seagrape', kind: 'sprite', group: 'vegetação', title: 'Uva-da-praia (duna)', meters: 1.5, game: 256, colors: ['leafMid', 'leafSun'], refs: [R.praia, R.orla],
    desc: 'One low sprawling sea grape and dune shrub clump (1.5 m tall, 2.5 m wide): large round leathery leaves (10–20 cm) in olive and yellow-green with a few reddish veins, mixed with tufts of sea oats grass, like the dune vegetation of reference 19.' },
  { id: 'bush-croton', kind: 'sprite', group: 'vegetação', title: 'Arbusto de cróton', meters: 1, game: 256, colors: ['leafDeep', 'leafSun'], refs: [R.praia],
    desc: 'One compact croton shrub (1 m tall): thick leathery leaves variegated in green, yellow, orange and deep red, upright bushy shape.' },
];

export const catalogIds = Object.freeze(CATALOG.map(a => a.id));
export const byId = id => CATALOG.find(a => a.id === id) || null;

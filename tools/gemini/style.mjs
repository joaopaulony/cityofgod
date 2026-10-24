// Bíblia de estilo do City of God: o texto que TODO prompt repete, para todas as imagens saírem do mesmo jogo.
// Cores vêm de js/visual-palette.js (VISUAL_REFERENCE); a câmera vem de js/core.js (TILT 0.5 = olhar de cima a 30°).

export const STYLE_BIBLE = [
  'ART DIRECTION — "City of God", an original isometric open-world crime game set in a sunny, fictional Miami-like coastal city.',
  'Look: beautiful SEMI-REALISTIC game art. Believable real-world materials and proportions, rich hand-painted detail, crisp and clean at game scale. NOT photorealistic photo, NOT cartoon, NOT flat vector, NOT pixel art, NOT low-poly, NOT voxel, NOT plastic 3D render.',
  'Mood (matches the reference images in assets/references/): late-afternoon GOLDEN-HOUR Florida light, warm orange-gold sun, rich saturated but natural colors, a slight warm atmospheric haze, crisp miniature-like detail. Pastel Art Deco tones (mint, flamingo pink, cream, turquoise) in rich areas; sun-bleached, grimy, stained stucco, rust and graffiti in poor areas. A lived-in city: wear, dirt, patches and stains everywhere, never brand-new and never ruined unless asked.',
  'Consistency: every asset must look like it belongs to the same game: same sun color, same saturation, same level of detail and the same palette.',
].join('\n');

// âncoras de cor (js/visual-palette.js); os prompts citam as do grupo de cada imagem
export const PALETTE = {
  asphalt: '#393536', roadPatch: '#302e31', sidewalk: '#c5b6a5', concreteShadow: '#86796d',
  grass: '#52782e', grassSun: '#789c3d', leafDeep: '#192b19', leafMid: '#4a7936', leafSun: '#a3bc65',
  warmWall: '#dcc3a9', coolWall: '#bec4b8', terracotta: '#a6543e', roofShadow: '#523d3b',
  sand: '#c4ae84', wetSand: '#957d5e', dirt: '#87684e', sunlight: '#ffe3b2', outline: '#201b1b',
};

// regras técnicas por tipo de imagem
export const KIND_RULES = {
  texture: [
    'TECHNICAL FORMAT — SEAMLESS TILEABLE MATERIAL TEXTURE, viewed straight from above (orthographic, camera exactly perpendicular to the surface).',
    'The image must tile with NO visible seams: content crossing the left edge continues on the right edge, the top edge continues on the bottom edge.',
    'Flat, even, diffuse light with the warm golden color grade of the references: NO cast shadows from outside objects, NO vignetting, NO light gradient or hotspot across the image, NO perspective, NO horizon, NO depth of field.',
    'Uniform detail density over the whole square: no single focal object, no border, no frame, no objects cut in half at a single spot that would repeat obviously; avoid strong unique landmarks that reveal the repetition.',
  ],
  wall: [
    'TECHNICAL FORMAT — SEAMLESS TILEABLE WALL MATERIAL, front elevation view (orthographic, camera exactly perpendicular to the wall, no perspective).',
    'Must tile horizontally AND vertically with NO visible seams. Material surface only: NO windows, NO doors, NO roof, NO ground, NO sky, NO vegetation, NO edges of the wall.',
    'Flat, even, diffuse daylight: NO cast shadows, NO vignetting, NO light gradient across the image.',
  ],
  roof: [
    'TECHNICAL FORMAT — SEAMLESS TILEABLE ROOF MATERIAL, viewed straight from above (orthographic, perpendicular to the roof plane).',
    'The slope runs from the TOP of the image (ridge) to the BOTTOM (eave): rows of tiles/shingles are horizontal, overlapping downward. Must tile with NO visible seams in both directions.',
    'Flat, even, diffuse daylight: NO cast shadows from outside objects, NO vignetting, NO light gradient, NO ridge caps, NO gutters, NO chimneys, NO roof edges.',
  ],
  facade: [
    'TECHNICAL FORMAT — ONE-STOREY BUILDING FACADE MODULE, front elevation (orthographic, camera perpendicular to the facade, no perspective, no vanishing points).',
    'The module must tile HORIZONTALLY with no visible seam (left edge continues on the right edge) and stack VERTICALLY floor over floor (top edge continues on the bottom edge).',
    'Fill the whole image with facade: no sky, no ground, no street, no roof, no building corners, no people, no signs, no text.',
    'Daylight from upper-left, soft and consistent; glass shows a believable soft sky reflection.',
  ],
  mural: [
    'TECHNICAL FORMAT — ONE STREET-ART MURAL painted on a weathered stucco wall, front elevation (orthographic, camera perpendicular to the wall, no perspective).',
    'The painted wall fills the whole image edge to edge: no sky, no ground, no wall corners, no people, no objects in front. Flat even light, no cast shadows; the paint shows sun fading, small cracks and grime of the wall underneath.',
  ],
  sprite: [
    'TECHNICAL FORMAT — ONE ISOLATED GAME SPRITE for an isometric game.',
    'Camera: orthographic (no perspective), looking down at the subject from 30 degrees above the horizon, exactly like the game camera.',
    'Golden-hour sun from the upper-left; shading on the subject only. Do NOT draw a cast shadow on the ground and do NOT draw ground, grass base, soil disc, pot or pedestal unless the description asks for it: the game draws its own shadows and ground.',
    'Subject centered, complete (nothing cropped), with a clear margin of background on every side. One single view: not a sprite sheet, not a collage, not multiple variations.',
  ],
};

// cor de fundo p/ recorte dos sprites: magenta por padrão; azul p/ o que tem rosa/roxo (buganvília)
export const KEYS = {
  magenta: { hex: '#FF00FF', rgb: [255, 0, 255], name: 'magenta', avoid: 'magenta, pink or purple' },
  blue: { hex: '#0000FF', rgb: [0, 0, 255], name: 'pure blue', avoid: 'saturated pure blue' },
};
export const keyRule = k => `Background MUST be one perfectly uniform flat solid ${k.name} ${k.hex} (RGB ${k.rgb.join(',')}) covering all four edges, with no gradient, texture, glow or shadow. The subject must NOT contain ${k.avoid} colors, and no ${k.name} reflections or rim light on the subject.`;

export const NEGATIVE = 'Never include: text, letters, numbers, logos, brand names, watermarks, signatures, UI, frames, borders, captions, people (unless asked), real company trademarks.';
// grafite precisa de letras: só formas abstratas, sem palavras legíveis
export const NEGATIVE_GRAFFITI = 'Never include: readable words, real names, logos, brand names, watermarks, signatures of real artists, UI, frames, borders, captions, people in front of the wall. Graffiti lettering must be abstract wildstyle shapes that do NOT spell any real word.';

export const REFERENCE_NOTE = 'Attached images are STYLE references for color, lighting, material quality and level of detail. Match their look and quality, but create an original asset: do not copy their exact objects, layout or any logos.';

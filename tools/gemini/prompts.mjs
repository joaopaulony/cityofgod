// Image prompts deliberately describe one original, coherent game asset.
// No prompts imply a perfect sprite sheet or counterfeit licensed source.
export const assetTypes = Object.freeze(['car', 'character', 'prop', 'building']);
export const directions = Object.freeze([
  'front-left', 'front-right', 'rear-left', 'rear-right',
  'front', 'rear', 'left', 'right'
]);
export const models = Object.freeze([
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image'
]);
export const imageSizes = Object.freeze(['1K', '2K']);
export const ratios = Object.freeze(['1:1', '4:3', '3:4', '16:9']);

export function slug(value) {
  return String(value ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 56) || 'asset';
}

export function validate(options) {
  if (!assetTypes.includes(options.type)) throw Error('Tipo invalido: car, character, prop ou building');
  if (!directions.includes(options.direction)) throw Error('Direcao invalida');
  if (!models.includes(options.model)) throw Error('Modelo do Gemini nao permitido');
  if (!imageSizes.includes(options.size)) throw Error('Tamanho nao permitido');
  if (!ratios.includes(options.ratio)) throw Error('Aspect ratio nao permitido');
  if (!String(options.name || '').trim() || String(options.name).length > 90) {
    throw Error('Informe nome de 1 a 90 caracteres');
  }
  if (String(options.details || '').length > 1800) throw Error('Detalhes longos demais (maximo 1800 caracteres)');
}

const directionsText = {
  'front-left': 'three-quarter front-left perspective; front bumper and the left side clearly visible',
  'front-right': 'three-quarter front-right perspective; front bumper and the right side clearly visible',
  'rear-left': 'three-quarter rear-left perspective; rear bumper and the left side clearly visible',
  'rear-right': 'three-quarter rear-right perspective; rear bumper and the right side clearly visible',
  front: 'front-facing vehicle view, camera elevated consistently',
  rear: 'rear-facing vehicle view, camera elevated consistently',
  left: 'left profile view, consistent elevated camera',
  right: 'right profile view, consistent elevated camera'
};

const specifics = {
  car: 'Produce a complete, physically believable vehicle with a recognizable and individualized silhouette: front and rear overhangs, hood, windshield, passenger cabin, rear profile, mirrors, visible wheel depth and tread, tire shoulders, correct fender occlusion, 3D rim geometry, grille, lamps and panel gaps. No floating or flattened tires. Keep all four wheels aligned with the ground plane, only naturally visible wheels shown. Preserve every distinctive design cue in any attached reference. A single car only, stationary with no driver.',
  character: 'Produce exactly one full-body adult character, with coherent human anatomy, expressive face, clothing folds, both hands and both legs, stable feet planted on the ground; silhouette easy to read at in-game scale. No cropped limbs.',
  prop: 'Produce exactly one realistic urban-world prop with believable texture, construction details and contact shadow, faithfully matching any supplied reference. Small object, clearly readable in an isometric game.',
  building: 'Produce one complete urban building with coherent roof geometry, realistic windows and doors, foundation and architecture consistent with a lived-in town. No detached facade pieces.'
};

export function buildPrompt(o) {
  validate(o);
  const backdrop = o.cutout
    ? 'Background MUST be a perfectly uniform solid chroma key green #00FF00 (RGB 0,255,0), absolutely no shadows or green reflections on the background. The subject must NOT contain green materials. The green area must cover the four edges completely.'
    : 'Use a plain neutral medium-gray studio background, visually separated from the subject; subtle natural contact shadow allowed.';
  return [
    'CITY OF GOD / ORIGINAL ISOMETRIC GAME ASSET / one image.',
    'Art direction: high-end 2D isometric urban survival game art, believable 1990s street-scale realism; precise crisp contour work; richly shaded panels and physically correct materials; stylized hand-painted texture (NOT voxel blocks, NOT wireframe, NOT cheap procedural cuboids).',
    'Camera: elevated approximately 35 degrees, orthographic/no perspective vanishing points. Orientation: ' + directionsText[o.direction] + '.',
    'Asset: ' + o.name + '.',
    specifics[o.type],
    'Consistent scale and lighting: soft daylight coming from upper-left. Shadows must correspond to the geometry.',
    'Full silhouette visible, padding around whole subject. One single view, not a collage or sprite sheet.',
    backdrop,
    'No typography, watermarks, captions, labels, game menus, UI, people in background or extra objects.',
    o.details ? 'CUSTOM REQUIREMENTS: ' + o.details : '',
    'Any supplied image is visual reference; maintain its unique outline, wheelbase, colors and styling rather than inventing a generic replacement.'
  ].filter(Boolean).join('\n');
}

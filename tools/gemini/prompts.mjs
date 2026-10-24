// Monta o prompt completo de um item do catálogo e valida as opções de uma execução.
import { STYLE_BIBLE, PALETTE, KIND_RULES, KEYS, keyRule, NEGATIVE, NEGATIVE_GRAFFITI, REFERENCE_NOTE } from './style.mjs';
import { CATALOG, byId } from './catalog.mjs';

export const models = Object.freeze(['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image']);
export const imageSizes = Object.freeze(['1K', '2K']);
export const ratios = Object.freeze(['1:1', '4:3', '3:4', '16:9']);
export const MAX_PER_RUN = 8;      // teto duro de imagens (e chamadas pagas) por execução
export const MAX_REFS = 3;         // referências de estilo por imagem

// US$ por imagem (tabela oficial do Gemini API, out/2026); só p/ estimar o gasto antes de rodar
export const PRICE_USD = {
  'gemini-nano-banana-2.1': { '1K': 0.0336, '2K': 0.0504 },
  'gemini-3.1-flash-image': { '1K': 0.067, '2K': 0.101 },
  'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134 },
  'gemini-3.1-flash-lite-image': { '1K': 0.0336, '2K': 0.0336 },
};
export const estimateUSD = (model, size, n) => +(PRICE_USD[model][size] * n).toFixed(4);

export function slug(value) {
  return String(value ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 56) || 'asset';
}

export function parseAssets(list) {
  const ids = String(list || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  if (!ids.length) throw Error('Informe ao menos um asset do catálogo (ex.: ground-asphalt)');
  if (new Set(ids).size !== ids.length) throw Error('Asset repetido na lista');
  if (ids.length > MAX_PER_RUN) throw Error(`No máximo ${MAX_PER_RUN} imagens por execução`);
  for (const id of ids) if (!byId(id)) throw Error('Asset fora do catálogo: ' + id);
  return ids;
}

export function validate(o) {
  parseAssets(o.assets);
  if (!models.includes(o.model)) throw Error('Modelo do Gemini não permitido');
  if (!imageSizes.includes(o.size)) throw Error('Tamanho não permitido (1K ou 2K)');
  if (String(o.details || '').length > 1200) throw Error('Detalhes longos demais (máximo 1200 caracteres)');
  if ((o.references || []).length > MAX_REFS) throw Error(`No máximo ${MAX_REFS} referências`);
}

const scaleLine = a => a.kind === 'sprite'
  ? `SCALE: the subject is about ${a.meters} m tall in the real world; keep believable real-world proportions.`
  : a.kind === 'facade' || a.kind === 'mural'
    ? `SCALE: the image shows exactly ${a.meters} m of wall width; keep real-world proportions.`
    : `SCALE: the whole image covers exactly ${a.meters} × ${a.meters} m of real surface, so at 2048 px 1 m = ${Math.round(2048 / a.meters)} px and 1 cm = ${(2048 / a.meters / 100).toFixed(1)} px; size every detail accordingly (do not make stones, blades, leaves or tiles oversized).`;

export function buildPrompt(a, o = {}) {
  if (typeof a === 'string') a = byId(a);
  if (!a) throw Error('Asset desconhecido');
  const colors = (a.colors || []).map(k => `${k} ${PALETTE[k]}`).join(', ');
  return [
    `CITY OF GOD — GAME ASSET "${a.id}" (${a.title}). Generate exactly ONE image.`,
    STYLE_BIBLE,
    ...KIND_RULES[a.kind].filter(r => !(a.pattern && r.startsWith('ISOTROPIC'))),
    a.kind === 'sprite' ? keyRule(KEYS[a.key || 'magenta']) : '',
    'SUBJECT: ' + a.desc,
    scaleLine(a),
    colors ? `PALETTE ANCHORS (stay close to these, natural variation allowed): ${colors}.` : '',
    a.tint ? 'COLOR NOTE: keep the material NEUTRAL and light (almost unsaturated) so the game can tint it; all the detail must live in the light and shade of the surface, not in the hue.' : '',
    o.details ? 'EXTRA REQUIREMENTS FROM THE ART DIRECTOR: ' + o.details : '',
    o.hasRefs ? REFERENCE_NOTE : '',
    a.graffiti ? NEGATIVE_GRAFFITI : NEGATIVE,
    'QUALITY BAR: flawless professional game-ready asset, sharp fine detail at full resolution, no blur, no smudges, no AI artifacts, no repeated stamp patterns, no melted or nonsensical shapes.',
  ].filter(Boolean).join('\n');
}

export { CATALOG };

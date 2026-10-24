import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slug, validate, buildPrompt, parseAssets, models, estimateUSD, MAX_PER_RUN, PRICE_USD } from '../prompts.mjs';
import { CATALOG, catalogIds } from '../catalog.mjs';
import { KIND_RULES, PALETTE } from '../style.mjs';
import { loadReference } from '../generate-assets.mjs';
import { makeSeamless, magentaCutout, flattenLighting } from '../postprocess.mjs';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opts = (o = {}) => ({ assets: 'ground-asphalt', model: models[0], size: '2K', details: '', references: [], ...o });

test('catálogo: ids únicos, tipos conhecidos, escala, tamanho do jogo e cores da paleta', () => {
  assert.equal(new Set(catalogIds).size, catalogIds.length);
  for (const a of CATALOG) {
    assert.ok(KIND_RULES[a.kind], a.id);
    assert.ok(a.meters > 0 && a.game >= 128 && a.desc.length > 120, a.id);
    for (const c of a.colors || []) assert.ok(PALETTE[c], a.id + ' cor ' + c);
  }
});
test('todo prompt traz estilo, regras do tipo, escala, cores, proibições e barra de qualidade', () => {
  for (const a of CATALOG) {
    const p = buildPrompt(a);
    assert.match(p, /City of God/i); assert.match(p, /SEMI-REALISTIC/); assert.match(p, /SCALE:/); assert.match(p, /Never include/); assert.match(p, /QUALITY BAR/);
    for (const rule of KIND_RULES[a.kind]) assert.equal(p.includes(rule), !(a.pattern && rule.startsWith('ISOTROPIC')), a.id);
    if (a.kind === 'sprite') assert.match(p, a.key === 'blue' ? /#0000FF/ : /#FF00FF/); else assert.doesNotMatch(p, /#FF00FF|#0000FF/);
    if (a.graffiti) assert.match(p, /do NOT spell any real word/); else assert.match(p, /Never include: text/);
    if (['texture', 'wall', 'roof', 'facade'].includes(a.kind)) assert.match(p, /seam/i);
    if (a.tint) assert.match(p, /NEUTRAL/);
  }
  assert.match(buildPrompt(CATALOG[0], { hasRefs: true }), /STYLE references/);
  assert.match(buildPrompt(CATALOG[0], { details: 'mais sujo' }), /mais sujo/);
});
test('sprites com fundo magenta não pedem nada magenta/rosa que o recorte apagaria', () => {
  for (const a of CATALOG.filter(a => a.kind === 'sprite' && (a.key || 'magenta') === 'magenta')) assert.doesNotMatch(a.desc.replace(/no pink/gi, ''), /pink|magenta|purple/i, a.id);
});
test('referências de cada item existem e não passam de 3', () => {
  for (const a of CATALOG) {
    assert.ok((a.refs || []).length <= 3, a.id);
    for (const f of a.refs || []) assert.ok(fs.existsSync(path.resolve(dir, '../../assets/references', f)), a.id + ' -> ' + f);
  }
});
test('lista de assets: valida catálogo, repetição e teto por execução', () => {
  assert.deepEqual(parseAssets('ground-asphalt, ground-lawn'), ['ground-asphalt', 'ground-lawn']);
  assert.throws(() => parseAssets(''), /ao menos um/);
  assert.throws(() => parseAssets('ground-asphalt,ground-asphalt'), /repetido/);
  assert.throws(() => parseAssets('nao-existe'), /fora do catálogo/);
  assert.throws(() => parseAssets(catalogIds.slice(0, MAX_PER_RUN + 1).join(',')), /No máximo/);
});
test('rejeita modelo, tamanho, detalhes longos e referências demais', () => {
  for (const o of [{ model: 'hack' }, { size: '8K' }, { details: 'x'.repeat(1201) }, { references: ['a', 'b', 'c', 'd'] }]) assert.throws(() => validate(opts(o)));
  assert.doesNotThrow(() => validate(opts()));
});
test('estimativa de custo usa a tabela de preços', () => {
  assert.equal(estimateUSD('gemini-nano-banana-2.1', '2K', 10), +(PRICE_USD['gemini-nano-banana-2.1']['2K'] * 10).toFixed(4));
  for (const m of models) assert.ok(PRICE_USD[m]['1K'] > 0 && PRICE_USD[m]['2K'] > 0, m);
});
test('slug impede caminho fora da pasta', () => {
  assert.equal(slug('../../Original Character!'), 'original-character');
  assert.equal(slug('  Éclipse azul  '), 'eclipse-azul');
});
test('referências só de assets/references', async () => {
  await assert.rejects(() => loadReference('../.git/config'), /assets\/references/);
  await assert.rejects(() => loadReference('README.md'), /assets\/references/);
  await assert.rejects(() => loadReference('assets/references/../../README.md'), /fora da pasta/);
  await assert.rejects(() => loadReference('assets/references/no-such.png'), /ENOENT/);
});

// imagem de teste: degradês suaves (bordas opostas bem diferentes, vizinhos parecidos)
function noisy(w, h) { const px = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; px[i * 4] = (x * 255 / w) | 0; px[i * 4 + 1] = (y * 255 / h) | 0; px[i * 4 + 2] = (128 + 100 * Math.sin(x * 0.11 + y * 0.07)) | 0; px[i * 4 + 3] = 255; } return px; }
const diff = (px, w, h, a, b) => { let d = 0; for (let k = 0; k < (a === 'x' ? h : w); k++) { const i = a === 'x' ? (k * w) * 4 : k * 4, j = a === 'x' ? (k * w + w - 1) * 4 : ((h - 1) * w + k) * 4; for (let c = 0; c < 3; c++) d += Math.abs(px[i + c] - px[j + c]); } return d / ((a === 'x' ? h : w) * 3); };
test('emenda: bordas opostas passam a casar (repete sem costura)', () => {
  const w = 64, h = 48, px = noisy(w, h), s = makeSeamless(px, w, h);
  assert.ok(diff(px, w, h, 'x') > 50);
  assert.ok(s.w < w && s.h < h);
  assert.ok(diff(s.px, s.w, s.h, 'x') < 12, 'esquerda x direita');
  assert.ok(diff(s.px, s.w, s.h, 'y') < 12, 'topo x base');
  // miolo intacto (sem fantasma): fora da faixa a imagem é a original
  assert.equal(s.px[(20 * s.w + 30) * 4], px[(20 * w + 30) * 4]);
});
test('luz uniforme: tira o degradê grande e mantém a média', () => {
  const w = 96, h = 96, px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const x = i % w, v = 60 + x * 120 / w; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
  const out = flattenLighting(px, w, h, 1), col = x => out[(48 * w + x) * 4];
  assert.ok(Math.abs(col(10) - col(85)) < Math.abs(px[(48 * w + 10) * 4] - px[(48 * w + 85) * 4]) * 0.5);
});
test('recorte magenta: fundo some, objeto fica, sem halo rosa; recusa fundo errado', () => {
  const w = 40, h = 40, px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0, inObj = x > 12 && x < 28 && y > 10 && y < 30; px.set(inObj ? [60, 120, 40, 255] : [255, 0, 255, 255], i * 4); }
  const { px: out, box } = magentaCutout(px, w, h);
  assert.equal(out[3], 0); assert.equal(out[(20 * w + 20) * 4 + 3], 255);
  assert.deepEqual(box, [13, 11, 27, 29]);
  const blue = px.map((v, i) => i % 4 === 3 ? 255 : (i % 4 === 2 ? (v === 255 && px[i - 1] === 0 ? 255 : v) : (px[i - (i % 4)] === 255 && px[i - (i % 4) + 1] === 0 ? 0 : v)));
  assert.equal(magentaCutout(blue, w, h, 'blue').px[3], 0);
  const gray = new Uint8Array(w * h * 4).fill(128);
  assert.throws(() => magentaCutout(gray, w, h), /magenta/);
});
test('dry run não precisa da chave nem chama o Gemini', () => {
  const env = { ...process.env, GEMINI_API_KEY: '', DRY_RUN: 'true', ASSETS: 'ground-asphalt,tree-coconut', GITHUB_RUN_ID: 'ci-dry-run' };
  const r = spawnSync(process.execPath, ['generate-assets.mjs'], { cwd: dir, env, encoding: 'utf8', timeout: 15000 });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /DRY RUN/);
  const runDir = path.resolve(dir, '../../assets/generated/ci-dry-run'), sum = JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8'));
  assert.equal(sum.status, 'dry-run'); assert.equal(sum.estimatedUSD, 0); assert.ok(sum.plannedUSD > 0);
  assert.ok(fs.existsSync(path.join(runDir, 'tree-coconut/prompt.txt'))); assert.ok(!fs.existsSync(path.join(runDir, 'tree-coconut/original.png')));
  fs.rmSync(runDir, { recursive: true, force: true });
});
test('geração de verdade recusa rodar sem a chave, antes de qualquer chamada paga', () => {
  const r = spawnSync(process.execPath, ['generate-assets.mjs', '--assets', 'ground-asphalt'], { cwd: dir, env: { ...process.env, GEMINI_API_KEY: '', DRY_RUN: 'false' }, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /GEMINI_API_KEY nao esta definida/);
});

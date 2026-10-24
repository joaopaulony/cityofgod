#!/usr/bin/env node
// Geração manual e com custo controlado das imagens do City of God (catalog.mjs).
// O jogo NUNCA importa este script nem recebe a chave do Gemini.
//   node generate-assets.mjs --assets ground-asphalt,ground-lawn [--size 2K] [--model ...] [--refs assets/references/a.png] [--details "..."] [--dry-run true]
// Cada asset = UMA chamada paga, sem repetição automática; no máximo MAX_PER_RUN por execução.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompt, validate, parseAssets, slug, models, estimateUSD, MAX_REFS } from './prompts.mjs';
import { byId } from './catalog.mjs';
import { processAsset } from './postprocess.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const referenceBase = path.join(repoRoot, 'assets/references');
const outputBase = path.join(repoRoot, 'assets/generated');
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

function argValue(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const chosen = (flag, envName, fallback) => argValue(flag) ?? process.env[envName] ?? fallback;
const asBool = v => ['yes', 'true', '1', 'on'].includes(String(v || '').toLowerCase());
function inside(base, target) {
  const rel = path.relative(base, target);
  return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
const mimeFromPath = file => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file).toLowerCase()] || null;

export function optionsFromEnvironment() {
  return {
    assets: chosen('assets', 'ASSETS', ''),
    model: chosen('model', 'GEMINI_MODEL', models[0]),
    size: chosen('size', 'IMAGE_SIZE', '2K'),
    details: chosen('details', 'ASSET_DETAILS', ''),
    references: String(chosen('refs', 'REFERENCE_PATHS', '')).split(',').map(s => s.trim()).filter(Boolean),
    dryRun: asBool(chosen('dry-run', 'DRY_RUN', false)),
    runId: slug(process.env.GITHUB_RUN_ID || 'local-' + new Date().toISOString().slice(0, 19)),
  };
}

export async function loadReference(relative) {
  const name = String(relative).replace(/\\/g, '/');
  if (name.length > 190 || !name.startsWith('assets/references/')) throw Error('Imagem de referencia deve estar dentro de assets/references/');
  const absolute = path.resolve(repoRoot, name);
  if (!inside(referenceBase, absolute)) throw Error('Caminho da referencia fora da pasta permitida');
  const real = await fs.realpath(absolute);
  if (!inside(referenceBase, real)) throw Error('Referencia resolve para fora da pasta');
  const mime_type = mimeFromPath(real);
  if (!mime_type) throw Error('Referencia deve ser PNG, JPG ou WebP');
  const stat = await fs.stat(real);
  if (!stat.isFile() || stat.size > MAX_REFERENCE_BYTES || stat.size < 80) throw Error('Referencia invalida: arquivo de imagem entre 80 bytes e 10 MB');
  return { mime_type, data: (await fs.readFile(real)).toString('base64'), relative: name };
}

function imageBlock(interaction) {
  if (interaction?.output_image?.data) return interaction.output_image;
  for (const step of interaction?.steps || []) {
    if (step.type !== 'model_output') continue;
    for (const item of step.content || []) if (item.type === 'image' && item.data) return item;
  }
  throw Error('Gemini nao devolveu imagem; consulte o uso e as permissoes do modelo');
}

export async function run(o = optionsFromEnvironment()) {
  validate(o);
  if (o.references.length > MAX_REFS) throw Error('Referencias demais');
  const ids = parseAssets(o.assets), cliRefs = [], refCache = new Map();
  if (!o.dryRun && !process.env.GEMINI_API_KEY) throw Error('GEMINI_API_KEY nao esta definida: configure o Secret no GitHub');
  for (const r of o.references) cliRefs.push(await loadReference(r));
  // referências de cada item (catalog.mjs) ou as da execução, se informadas
  const refsFor = async a => {
    if (cliRefs.length) return cliRefs;
    const out = [];
    for (const f of a.refs || []) { const rel = 'assets/references/' + f; if (!refCache.has(rel)) refCache.set(rel, await loadReference(rel)); out.push(refCache.get(rel)); }
    return out;
  };
  const runDir = path.join(outputBase, o.runId);
  if (!inside(outputBase, runDir)) throw Error('Caminho de saida invalido');
  await fs.mkdir(runDir, { recursive: true });
  const summary = { run: o.runId, status: o.dryRun ? 'dry-run' : 'generated', model: o.model, size: o.size, references: cliRefs.length ? cliRefs.map(r => r.relative) : 'por item (catalog.mjs)',
    estimatedUSD: o.dryRun ? 0 : estimateUSD(o.model, o.size, ids.length), plannedUSD: estimateUSD(o.model, o.size, ids.length), assets: [] };
  console.log(`${o.dryRun ? 'DRY RUN (sem chamada e sem custo)' : 'GERANDO'}: ${ids.length} imagem(ns), ${o.model} ${o.size}, estimativa US$ ${summary.plannedUSD}`);
  let ai = null;
  if (!o.dryRun) {
    const { GoogleGenAI } = await import('@google/genai');
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  for (const id of ids) {
    const a = byId(id), dir = path.join(runDir, id), refs = await refsFor(a), prompt = buildPrompt(a, { details: o.details, hasRefs: refs.length > 0 });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'prompt.txt'), prompt, 'utf8');
    const item = { id, kind: a.kind, title: a.title, ratio: a.ratio || '1:1', refs: refs.map(r => r.relative), status: o.dryRun ? 'dry-run' : 'pending' };
    summary.assets.push(item);
    if (o.dryRun) continue;
    try {
      // exatamente UMA chamada por asset; erro não repete (registra e segue p/ o próximo)
      const input = refs.length ? [{ type: 'text', text: prompt }, ...refs.map(r => ({ type: 'image', mime_type: r.mime_type, data: r.data }))] : prompt;
      const interaction = await ai.interactions.create({ model: o.model, input, response_format: { type: 'image', aspect_ratio: item.ratio, image_size: o.size } });
      const bytes = Buffer.from(imageBlock(interaction).data, 'base64');
      if (bytes.length < 1000 || bytes.length > 25 * 1024 * 1024) throw Error('Resposta da imagem invalida');
      await fs.writeFile(path.join(dir, 'original.png'), bytes);
      item.status = 'paid';
      const p = await processAsset(bytes, a);
      await fs.writeFile(path.join(dir, 'asset.png'), p.full);
      await fs.writeFile(path.join(dir, `${id}.webp`), p.game);
      Object.assign(item, p.info, { status: 'ok' });
      console.log(`  ok  ${id}: ${p.info.width}x${p.info.height} -> ${p.info.gameWidth}x${p.info.gameHeight} webp (${(p.info.gameBytes / 1024).toFixed(0)} KB) [${p.info.steps.join(', ')}]`);
    } catch (error) {
      const key = process.env.GEMINI_API_KEY || '\0';
      item.error = String(error?.message || error).replaceAll(key, '[REDACTED]').slice(0, 400);
      if (item.status !== 'paid') item.status = 'failed';
      console.error(`  ERRO ${id}: ${item.error}`);
    }
  }
  await fs.writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  if (summary.assets.some(a => a.error)) process.exitCode = 1;
  console.log('Saida: ' + runDir);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    const key = process.env.GEMINI_API_KEY || '\0';
    console.error('Falha na geracao: ' + String(error?.message || error).replaceAll(key, '[REDACTED]'));
    process.exitCode = 1;
  });
}

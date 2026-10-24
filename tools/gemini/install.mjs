#!/usr/bin/env node
// Instala no jogo as texturas aprovadas pelo juiz (grátis: reprocessa o original já pago):
//   node install.mjs <pasta-da-execução> ground-lawn ground-sand~v2 ...
// Copia o .webp para assets/textures/<asset>.webp e grava em assets/textures/manifest.json a largura real
// coberta pela imagem (depois do recorte da beirada e do corte da costura), que textures.js usa como escala.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { byId } from './catalog.mjs';
import { processAsset } from './postprocess.mjs';
import { assetIdOf } from './sheet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), texDir = path.resolve(here, '../../assets/textures'), manFile = path.join(texDir, 'manifest.json');
const [runDir, ...dirs] = process.argv.slice(2);
if (!runDir || !dirs.length) { console.error('uso: node install.mjs <pasta-da-execução> <asset[~vN]> ...'); process.exit(1); }
await fs.mkdir(texDir, { recursive: true });
let man = {}; try { man = JSON.parse(await fs.readFile(manFile, 'utf8')); } catch { }
for (const dir of dirs) {
  const id = assetIdOf(dir), a = byId(id);
  if (!a) throw Error('asset fora do catálogo: ' + id);
  const p = await processAsset(await fs.readFile(path.resolve(runDir, dir, 'original.png')), a);
  await fs.writeFile(path.join(texDir, id + '.webp'), p.game);
  man[id] = { meters: p.info.coverage, px: p.info.gameWidth, from: path.basename(path.resolve(runDir)) + '/' + dir };
  console.log(`${id}: ${p.info.coverage} m em ${p.info.gameWidth} px (${(p.info.gameBytes / 1024).toFixed(0)} KB)`);
}
await fs.writeFile(manFile, JSON.stringify(man, null, 2) + '\n');

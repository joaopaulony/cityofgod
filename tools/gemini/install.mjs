#!/usr/bin/env node
// Instala no jogo as texturas aprovadas pelo juiz (grátis: reprocessa o original já pago):
//   node install.mjs <pasta-da-execução> ground-lawn ground-sand~v2 ...
//   node install.mjs <pasta> ground-sidewalk~v2:ground-sidewalk-pink:#dcaaa0   (deriva outra textura recolorindo)
// Copia o .webp para assets/textures/<asset>.webp e grava em assets/textures/manifest.json a largura real
// coberta pela imagem (depois do recorte da beirada e do corte da costura), que textures.js usa como escala.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { byId } from './catalog.mjs';
import { processAsset, tintLuma, hexRgb } from './postprocess.mjs';
import { assetIdOf } from './sheet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), texDir = path.resolve(here, '../../assets/textures'), manFile = path.join(texDir, 'manifest.json');
const [runDir, ...specs] = process.argv.slice(2);
if (!runDir || !specs.length) { console.error('uso: node install.mjs <pasta-da-execução> <asset[~vN][:destino:#cor]> ...'); process.exit(1); }
await fs.mkdir(texDir, { recursive: true });
let man = {}; try { man = JSON.parse(await fs.readFile(manFile, 'utf8')); } catch { }
const { default: sharp } = await import('sharp');
for (const spec of specs) {
  const [dir, target, tint] = spec.split(':'), id = assetIdOf(dir), a = byId(id), out = target || id;
  if (!a || !byId(out)) throw Error('asset fora do catálogo: ' + (a ? out : id));
  let rt = null; try { rt = JSON.parse(await fs.readFile(path.resolve(runDir, dir, 'retouch.json'), 'utf8')); } catch { }   // retoques do juiz
  const p = await processAsset(await fs.readFile(path.resolve(runDir, dir, 'original.png')), a, { retouch: rt });
  let game = p.game;
  if (tint) {   // variação de cor do mesmo material
    const { data, info } = await sharp(game).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = tintLuma(new Uint8Array(data.buffer, data.byteOffset, data.length), hexRgb(tint));
    game = await sharp(Buffer.from(px.buffer), { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 90 }).toBuffer();
  }
  await fs.writeFile(path.join(texDir, out + '.webp'), game);
  man[out] = { meters: p.info.coverage, px: p.info.gameWidth, from: path.basename(path.resolve(runDir)) + '/' + dir + (tint ? ' tint ' + tint : ''), ...(rt ? { retouch: rt } : {}) };
  console.log(`${out}: ${p.info.coverage} m em ${p.info.gameWidth} px (${(game.length / 1024).toFixed(0)} KB)${tint ? ' recolorida ' + tint : ''}`);
}
await fs.writeFile(manFile, JSON.stringify(man, null, 2) + '\n');

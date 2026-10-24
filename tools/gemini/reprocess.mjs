#!/usr/bin/env node
// Refaz o pós-processamento (grátis) dos originais já pagos de uma execução baixada:
//   node reprocess.mjs <pasta-da-execução>   (a que tem summary.json e uma subpasta por asset com original.png)
import fs from 'node:fs/promises';
import path from 'node:path';
import { byId } from './catalog.mjs';
import { processAsset } from './postprocess.mjs';
import { contactSheet, assetIdOf } from './sheet.mjs';

const runDir = path.resolve(process.argv[2] || '.');
for (const dir of await fs.readdir(runDir)) {
  const id = assetIdOf(dir), a = byId(id), orig = path.join(runDir, dir, 'original.png');
  if (!a) continue;
  try { await fs.access(orig); } catch { continue; }
  const p = await processAsset(await fs.readFile(orig), a);
  await fs.writeFile(path.join(runDir, dir, 'asset.png'), p.full);
  await fs.writeFile(path.join(runDir, dir, id + '.webp'), p.game);
  console.log(`${dir}: ${p.info.gameWidth}x${p.info.gameHeight} [${p.info.steps.join(', ')}] cobre ${p.info.coverage} m`);
}
console.log('Folha de contato: ' + await contactSheet(runDir));

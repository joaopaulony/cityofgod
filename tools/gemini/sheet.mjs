// Folha de contato de uma execução: cada imagem processada com o nome embaixo; texturas repetidas 2×2
// (para ver costura e carimbo), sprites e fachadas inteiros. Salva <execução>/folha.jpg.
import fs from 'node:fs/promises';
import path from 'node:path';
import { byId } from './catalog.mjs';

export const assetIdOf = dir => dir.split('~')[0];   // "ground-asphalt~v2" -> "ground-asphalt"

export async function contactSheet(runDir) {
  const { default: sharp } = await import('sharp');
  const cells = [];
  for (const dir of (await fs.readdir(runDir)).sort()) {
    const a = byId(assetIdOf(dir)), file = path.join(runDir, dir, 'asset.png');
    if (!a) continue;
    try { await fs.access(file); } catch { continue; }
    const tiled = ['texture', 'wall', 'roof'].includes(a.kind), S = 480, t = await sharp(file).resize(tiled ? S / 2 : S, tiled ? S / 2 : S, { fit: 'inside' }).png().toBuffer();
    const parts = tiled ? [0, 1, 2, 3].map(k => ({ input: t, left: (k % 2) * S / 2, top: (k >> 1) * S / 2 })) : [{ input: t, left: 0, top: 0 }];
    const label = Buffer.from(`<svg width="${S}" height="28"><rect width="100%" height="100%" fill="#111"/><text x="8" y="19" font-family="Arial" font-size="15" fill="#fff">${dir}</text></svg>`);
    cells.push(await sharp({ create: { width: S, height: S + 28, channels: 4, background: '#2a2a2a' } }).composite([...parts, { input: label, left: 0, top: S }]).png().toBuffer());
  }
  if (!cells.length) return null;
  const cols = Math.min(4, cells.length), rows = Math.ceil(cells.length / cols), out = path.join(runDir, 'folha.jpg');
  await sharp({ create: { width: cols * 490, height: rows * 518, channels: 4, background: '#1a1a1a' } })
    .composite(cells.map((c, i) => ({ input: c, left: (i % cols) * 490, top: Math.floor(i / cols) * 518 }))).jpeg({ quality: 88 }).toFile(out);
  return out;
}

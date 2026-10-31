// tools/import-weapons.mjs — armas e acessórios do "Ultimate Gun Pack" (Quaternius, CC0) → assets/weapons/.
// Gera, via Blender (tools/weapons-blender.py): um GLB por item (origem na empunhadura, cano em +Z, nós muzzle/rail/
// under) e um ícone (WebP, perfil com luz de estúdio e contorno); depois grava assets/weapons/models.json com as
// medidas (o js/weapons.js tem nomes, calibres, atributos e quem pode usar cada arma).
// AKs (AssaultRifle_*) ficam de fora do jogo. Escala: cada família tem o tamanho real da maior arma dela e as outras
// mantêm a proporção do pack.
// Uso: node tools/import-weapons.mjs "PASTA/Ultimate Gun Pack - July 2019"
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'FBX'))) throw Error('Uso: node tools/import-weapons.mjs "PASTA/Ultimate Gun Pack - July 2019"');
const BLENDER = process.env.BLENDER || 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe';
const OUT = 'assets/weapons', TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-weapons-'));
// família: prefixo no pack, id no jogo, maior comprimento real (m), empunhadura (fração do comprimento a partir da
// traseira, fração da altura a partir de baixo), trilho e "embaixo do cano" (fração do comprimento)
const FAMILIES = [
  { prefix: 'Pistol_', id: 'pistol', len: .22, grip: [.2, .62], rail: .55, under: .62 },
  { prefix: 'Revolver_', id: 'revolver', len: .30, grip: [.12, .6], rail: .55, under: .7 },
  { prefix: 'SubmachineGun_', id: 'smg', len: .62, grip: [.42, .55], rail: .55, under: .72 },
  { prefix: 'AssaultRifle2_', id: 'rifle_ar', len: .92, grip: [.36, .55], rail: .45, under: .66 },
  { prefix: 'Bullpup_', id: 'bullpup', len: .76, grip: [.5, .5], rail: .55, under: .72 },
  { prefix: 'Shotgun_', id: 'shotgun', len: 1.05, grip: [.24, .55], rail: .45, under: .62 },
  { prefix: 'SniperRifle_', id: 'sniper', len: 1.2, grip: [.3, .55], rail: .45, under: .7 }
];
// ajustes por modelo (empunhadura medida nos ícones de conferência)
const GRIP = {};
// modelos em que a heurística do lado do cano erra (coronha grande e baixa; bipé pendurado na frente)
const FLIP = new Set(['rifle_ar_2', 'rifle_ar_4', 'sniper_5']);
const ACCESSORIES = [
  ['Silencer_Short', 'suppressor_short', 'muzzle'], ['Silencer_1', 'suppressor', 'muzzle'], ['Silencer_long', 'suppressor_long', 'muzzle'],
  ['Scope_1', 'scope_long', 'rail'], ['Scope_2', 'scope_tactical', 'rail'], ['Scope_3', 'scope_short', 'rail'],
  ['Flashlight', 'flashlight', 'under'], ['Grip', 'foregrip', 'under']
];

const fbx = f => path.join(SRC, 'FBX', f + '.fbx');
const runBlender = (script, list) => {
  const listFile = path.join(TMP, 'list.json'); fs.writeFileSync(listFile, JSON.stringify(list));
  return execFileSync(BLENDER, ['-b', '--factory-startup', '-P', path.resolve(script), '--', listFile, TMP], { encoding: 'utf8', maxBuffer: 1 << 26 });
};
// 1) comprimentos no pack
const files = fs.readdirSync(path.join(SRC, 'FBX')).filter(f => f.endsWith('.fbx')).map(f => f.slice(0, -4));
const weapons = [];
for (const fam of FAMILIES) for (const f of files.filter(f => f.startsWith(fam.prefix)).sort()) weapons.push({ fam, file: f, id: fam.id + '_' + f.slice(fam.prefix.length).toLowerCase() });
const probe = path.join(TMP, 'probe.py');
fs.writeFileSync(probe, `import bpy, sys, json
a = sys.argv[sys.argv.index('--') + 1:]; out = {}
for f in json.load(open(a[0])):
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.fbx(filepath=f)
    xs = [(o.matrix_world @ v.co).x for o in bpy.context.scene.objects if o.type == 'MESH' for v in o.data.vertices]
    out[f] = max(xs) - min(xs)
json.dump(out, open(a[1] + '/lengths.json', 'w'))
`);
runBlender(probe, weapons.map(w => fbx(w.file)));
const lengths = JSON.parse(fs.readFileSync(path.join(TMP, 'lengths.json'), 'utf8'));
// 2) conversão + ícones
fs.mkdirSync(path.join(TMP, 'icons'), { recursive: true }); fs.mkdirSync(path.join(TMP, 'models'), { recursive: true });
const list = [];
for (const fam of FAMILIES) {
  const mine = weapons.filter(w => w.fam === fam), k = fam.len / Math.max(...mine.map(w => lengths[fbx(w.file)]));
  for (const w of mine) list.push({ kind: 'weapon', id: w.id, fbx: fbx(w.file), scale: +k.toFixed(5), flip: FLIP.has(w.id), grip: GRIP[w.id] || fam.grip, rail: fam.rail, under: fam.under });
}
for (const [file, id, mount] of ACCESSORIES) list.push({ kind: 'accessory', id, fbx: path.join(SRC, 'FBX', 'Accessories', file + '.fbx'), mount });
const log = runBlender('tools/weapons-blender.py', list);
// o Blender sai com código 0 mesmo se o script falhar: mostra o erro dele
if (!fs.existsSync(path.join(TMP, 'report.json'))) { console.error(log.split('\n').filter(l => /Error|Traceback|line \d+/.test(l)).join('\n')); process.exit(1); }
const report = JSON.parse(fs.readFileSync(path.join(TMP, 'report.json'), 'utf8'));
// 3) assets do jogo
fs.mkdirSync(path.join(OUT, 'models'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
for (const r of report) {
  fs.copyFileSync(path.join(TMP, 'models', r.id + '.glb'), path.join(OUT, 'models', r.id + '.glb'));
  await sharp(path.join(TMP, 'icons', r.id + '.png')).trim({ threshold: 1 }).resize(480, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 95 }).toFile(path.join(OUT, 'icons', r.id + '.webp'));
}
fs.writeFileSync(path.join(OUT, 'models.json'), JSON.stringify({ schema: 1, source: 'Ultimate Gun Pack (Quaternius, CC0)', items: Object.fromEntries(report.map(r => [r.id, r])) }, null, 1));
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'Modelos: "Ultimate Gun Pack" por Quaternius (quaternius.com), licença CC0 1.0 (domínio público).\nÍcones e conversão: tools/import-weapons.mjs + tools/weapons-blender.py.\n');
console.log(report.length + ' itens em ' + OUT, '(' + log.split('\n').filter(l => l.startsWith('ARMA')).length + ' convertidos)');
fs.rmSync(TMP, { recursive: true, force: true });

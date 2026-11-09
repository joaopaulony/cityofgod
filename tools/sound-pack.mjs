// sound-pack.mjs — tira dos .zip do pacote Sonniss (GDC) só os sons escolhidos e gera versões leves para o jogo.
// Lê o diretório central de cada zip direto do disco (não descompacta o pacote inteiro), pega cada arquivo que bate com
// as receitas de tools/sound-recipes.json, decodifica o WAV (16/24/32 bits, inteiro ou float), mistura p/ mono (ou mantém
// estéreo), recorta, reamostra (sinc com janela), normaliza, faz fade (ou emenda sem costura nos loops) e grava em
// assets/sounds/. Com ffmpeg no PATH (ou FFMPEG=...) converte p/ .ogg (Opus); sem ele grava .wav 16 bits.
// Escreve assets/sounds/manifest.json: { id: [{ src, loop, gain }] }, que o js/city-audio.js carrega.
//
// Uso:
//   node tools/sound-pack.mjs <pasta-dos-zips>                 gera tudo
//   node tools/sound-pack.mjs <pasta-dos-zips> --list <regex>  só lista os arquivos dos zips que batem (p/ ajustar receitas)
//   node tools/sound-pack.mjs <pasta-dos-zips> --only <regex>  gera só as receitas cujo id bate
//
// Licença Sonniss GDC: livre p/ uso comercial dentro do jogo, sem atribuição; proibido redistribuir os sons soltos
// e usá-los p/ treinar IA. Por isso o repositório deve ficar privado e os arquivos só vão dentro do jogo.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'sounds');

// ---------------- zip (diretório central, ZIP64) ----------------
function readAt(fd, pos, len) { const b = Buffer.alloc(len); let got = 0; while (got < len) { const n = fs.readSync(fd, b, got, len - got, pos + got); if (!n) break; got += n; } return b.subarray(0, got); }
export function zipIndex(file) {
  const fd = fs.openSync(file, 'r'), size = fs.fstatSync(fd).size, tailLen = Math.min(size, 128 * 1024), tail = readAt(fd, size - tailLen, tailLen);
  try {
    let eocd = -1; for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw Error('fim do zip não achado (arquivo incompleto?)');
    let n = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16);
    const loc = eocd - 20;
    if (loc >= 0 && tail.readUInt32LE(loc) === 0x07064b50) {
      const z = readAt(fd, Number(tail.readBigUInt64LE(loc + 8)), 56);
      n = Number(z.readBigUInt64LE(32)); cdSize = Number(z.readBigUInt64LE(40)); cdOff = Number(z.readBigUInt64LE(48));
    }
    const cd = readAt(fd, cdOff, cdSize), files = [];
    for (let p = 0, k = 0; k < n && p + 46 <= cd.length; k++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break;
      const method = cd.readUInt16LE(p + 10); let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
      const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32); let off = cd.readUInt32LE(p + 42);
      const name = cd.toString('utf8', p + 46, p + 46 + nl);
      let e = p + 46 + nl; const end = e + el;
      while (e + 4 <= end) {
        const id = cd.readUInt16LE(e), sz = cd.readUInt16LE(e + 2);
        if (id === 1) { let q = e + 4; if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; } if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; } if (off === 0xffffffff) { off = Number(cd.readBigUInt64LE(q)); q += 8; } }
        e += 4 + sz;
      }
      if (!name.endsWith('/')) files.push({ zip: file, name, method, csize, usize, off });
      p = end + cl;
    }
    return files;
  } finally { fs.closeSync(fd); }
}
export function zipRead(entry) {
  const fd = fs.openSync(entry.zip, 'r');
  try {
    const h = readAt(fd, entry.off, 30); if (h.readUInt32LE(0) !== 0x04034b50) throw Error('cabeçalho local inválido: ' + entry.name);
    const data = readAt(fd, entry.off + 30 + h.readUInt16LE(26) + h.readUInt16LE(28), entry.csize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return zlib.inflateRawSync(data);
    throw Error(`compressão ${entry.method} não suportada: ${entry.name}`);
  } finally { fs.closeSync(fd); }
}

// ---------------- WAV ----------------
export function decodeWav(buf, { from = 0, len = Infinity } = {}) {   // from/len em segundos: só decodifica esse trecho
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw Error('não é WAV');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4); let len = buf.readUInt32LE(p + 4);
    if (id === 'data' && (len === 0 || p + 8 + len > buf.length)) len = buf.length - p - 8;
    if (id === 'fmt ') { let tag = buf.readUInt16LE(p + 8); if (tag === 0xfffe) tag = buf.readUInt16LE(p + 32); fmt = { tag, ch: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) }; }
    else if (id === 'data') data = buf.subarray(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw Error('WAV sem fmt/data');
  const bps = fmt.bits / 8, total = Math.floor(data.length / (bps * fmt.ch)), f0 = Math.min(total, Math.max(0, from * fmt.rate | 0)), frames = Math.min(total - f0, Number.isFinite(len) ? Math.ceil(len * fmt.rate) : total), chans = [];
  for (let c = 0; c < fmt.ch; c++) chans.push(new Float32Array(frames));
  for (let i = 0, o = f0 * bps * fmt.ch; i < frames; i++) for (let c = 0; c < fmt.ch; c++, o += bps) {
    let v;
    if (fmt.tag === 3) v = bps === 8 ? data.readDoubleLE(o) : data.readFloatLE(o);
    else if (bps === 2) v = data.readInt16LE(o) / 32768;
    else if (bps === 3) v = data.readIntLE(o, 3) / 8388608;
    else if (bps === 4) v = data.readInt32LE(o) / 2147483648;
    else v = (data[o] - 128) / 128;
    chans[c][i] = v;
  }
  return { rate: fmt.rate, chans };
}
export function encodeWav(chans, rate) {
  const n = chans[0].length, ch = chans.length, b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * 32767))), o);
  return b;
}

// ---------------- processamento ----------------
// reamostragem com sinc janelado (Blackman); corta acima de ~0.9 × Nyquist do destino p/ não dobrar agudos
export function resample(x, from, to) {
  if (from === to) return x;
  const ratio = to / from, n = Math.floor(x.length * ratio), y = new Float32Array(n), fc = Math.min(1, ratio) * .9, half = 16 / Math.min(1, ratio) | 0;
  for (let i = 0; i < n; i++) {
    const t = i / ratio, c = Math.floor(t); let s = 0, w = 0;
    for (let k = c - half + 1; k <= c + half; k++) {
      if (k < 0 || k >= x.length) continue;
      const d = t - k, a = d === 0 ? 1 : Math.sin(Math.PI * fc * d) / (Math.PI * fc * d), win = .42 + .5 * Math.cos(Math.PI * d / half) + .08 * Math.cos(2 * Math.PI * d / half);
      const h = a * Math.max(0, win); s += x[k] * h; w += h;
    }
    y[i] = w ? s / w : 0;
  }
  return y;
}
const peak = chans => chans.reduce((m, c) => { for (const v of c) { const a = Math.abs(v); if (a > m) m = a; } return m; }, 0);
const rms = chans => { let s = 0, n = 0; for (const c of chans) for (const v of c) { s += v * v; n++; } return Math.sqrt(s / Math.max(1, n)); };
// golpes (tiros, passos, latidos): acha os inícios pelo envelope de energia e devolve trechos [a, b) em amostras
export function onsets(x, rate, { thresh = .12, minGap = .25, maxDur = 1.5 } = {}) {
  const hop = Math.max(1, rate / 200 | 0), env = []; let pk = 0;
  for (let i = 0; i < x.length; i += hop) { let m = 0; for (let j = i; j < Math.min(x.length, i + hop); j++) m = Math.max(m, Math.abs(x[j])); env.push(m); pk = Math.max(pk, m); }
  const cuts = []; let quiet = true, last = -1e9;
  for (let k = 0; k < env.length; k++) {
    const v = env[k] / (pk || 1);
    if (quiet && v > thresh && (k - last) * hop / rate > minGap) { cuts.push(Math.max(0, k * hop - hop * 2)); last = k; quiet = false; }
    else if (!quiet && v < thresh * .3) quiet = true;
  }
  return cuts.map((a, i) => [a, Math.min(cuts[i + 1] ?? x.length, a + maxDur * rate | 0)]);
}
function fade(chans, rate, fin, fout) { const n = chans[0].length, a = Math.min(n / 2, fin * rate | 0), b = Math.min(n / 2, fout * rate | 0); for (const c of chans) { for (let i = 0; i < a; i++) c[i] *= i / a; for (let i = 0; i < b; i++) c[n - 1 - i] *= i / b; } }
// loop sem costura: o fim cruza com o começo (potência constante) e o trecho cruzado sai do início
function seamless(chans, rate, xf) {
  const n = chans[0].length, m = Math.min(n / 3 | 0, xf * rate | 0);
  return chans.map(c => { const y = c.slice(m); for (let i = 0; i < m; i++) { const t = i / m, j = y.length - m + i; y[j] = c[m + j] * Math.cos(t * Math.PI / 2) + c[i] * Math.sin(t * Math.PI / 2); } return y; });
}
// recorta o silêncio do fim (cauda abaixo de −50 dB) dos efeitos curtos
function trimTail(chans, rate) { const n = chans[0].length; let e = n; while (e > rate * .05 && chans.every(c => Math.abs(c[e - 1]) < .003)) e--; return chans.map(c => c.slice(0, Math.min(n, e + (rate * .02 | 0)))); }

export function render(src, R) {
  const rate = R.rate || (R.loop ? 32000 : 44100);
  let chans = src.chans;
  if (!R.stereo || chans.length === 1) { const m = new Float32Array(chans[0].length); for (const c of chans) for (let i = 0; i < m.length; i++) m[i] += c[i] / chans.length; chans = [m]; }
  else chans = chans.slice(0, 2);
  const s = R.starts || R.split || R.dur ? 0 : Math.floor((R.start || 0) * src.rate), e = R.dur && !R.starts && !R.split ? Math.min(chans[0].length, s + Math.floor(R.dur * src.rate)) : chans[0].length;
  chans = chans.map(c => resample(c.subarray(s, e), src.rate, rate));
  if (R.loop) chans = seamless(chans, rate, R.xfade ?? 1.5); else { chans = trimTail(chans, rate); fade(chans, rate, R.fadeIn ?? .002, R.fadeOut ?? .03); }
  const target = R.loop ? (R.rms ?? .12) / Math.max(1e-6, rms(chans)) : (R.peak ?? .89) / Math.max(1e-6, peak(chans));
  const k = Math.min(target, .97 / Math.max(1e-6, peak(chans)));
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= k;
  return { chans, rate };
}

function ffmpegBin() {
  for (const b of [process.env.FFMPEG, 'ffmpeg'].filter(Boolean)) { try { execFileSync(b, ['-version'], { stdio: 'ignore' }); return b; } catch (_) {} }
  return null;
}

// ---------------- principal ----------------
async function main() {
  const [dir, ...rest] = process.argv.slice(2);
  if (!dir) { console.log('uso: node tools/sound-pack.mjs <pasta-dos-zips> [--list regex | --only regex]'); process.exit(1); }
  const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
  const zips = fs.readdirSync(dir).filter(f => /\.zip$/i.test(f)).map(f => path.join(dir, f));
  const all = [];
  for (const z of zips) { try { all.push(...zipIndex(z)); } catch (e) { console.warn('pulei', path.basename(z), '-', e.message); } }
  const wavs = all.filter(f => /\.wav$/i.test(f.name));
  console.log(`${zips.length} zips, ${wavs.length} wavs`);
  if (opt('--list') != null) { const re = new RegExp(opt('--list'), 'i'); for (const f of wavs) if (re.test(f.name)) console.log(`${(f.usize / 1048576).toFixed(1).padStart(7)} MB  ${path.basename(f.zip)} :: ${f.name}`); return; }

  const recipes = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'sound-recipes.json'), 'utf8')).sounds;
  const only = opt('--only') ? new RegExp(opt('--only'), 'i') : null;
  const ff = ffmpegBin(); console.log(ff ? 'ffmpeg: saída .ogg (Opus)' : 'sem ffmpeg: saída .wav 16 bits (instale o ffmpeg p/ arquivos ~10× menores)');
  fs.mkdirSync(OUT, { recursive: true });
  const mfPath = path.join(OUT, 'manifest.json'), manifest = fs.existsSync(mfPath) ? JSON.parse(fs.readFileSync(mfPath, 'utf8')) : {};
  const missing = [];
  for (const R of recipes) {
    if (only && !only.test(R.id)) continue;
    const re = new RegExp(R.file, 'i'), zre = R.zip ? new RegExp(R.zip, 'i') : null, ex = R.exclude ? new RegExp(R.exclude, 'i') : null;
    const hits = wavs.filter(f => re.test(f.name) && (!zre || zre.test(path.basename(f.zip))) && (!ex || !ex.test(f.name))).sort((a, b) => a.name.localeCompare(b.name));
    if (!hits.length) { missing.push(R.id); continue; }
    const variants = [], want = R.variants || 1;
    for (const f of hits) {
      if (variants.length >= want) break;
      const win = R.starts ? { from: Math.min(...R.starts), len: Math.max(...R.starts) - Math.min(...R.starts) + (R.dur || 5) } : !R.split && R.dur ? { from: R.start || 0, len: R.dur } : {};
      let src; try { src = decodeWav(zipRead(f), win); } catch (e) { console.warn('  falhou', f.name, e.message); continue; }
      const pieces = [];
      if (R.split) {
        const mono = src.chans[0]; for (const [a, b] of onsets(mono, src.rate, R.split).slice(R.skip || 0)) pieces.push({ rate: src.rate, chans: src.chans.map(c => c.subarray(a, b)) });
      } else if (R.starts) {   // vários trechos do mesmo arquivo longo (carros passando, etc.)
        for (const st of R.starts) { const a = (st - Math.min(...R.starts)) * src.rate | 0, b = Math.min(src.chans[0].length, a + (R.dur || 5) * src.rate | 0); if (b - a > src.rate) pieces.push({ rate: src.rate, chans: src.chans.map(c => c.subarray(a, b)) }); }
      } else pieces.push(src);
      for (const pc of pieces) { if (variants.length >= want) break; if (pc.chans[0].length < src.rate * .03) continue; variants.push(render(pc, R)); }
    }
    manifest[R.id] = [];
    variants.forEach((v, i) => {
      const base = `${R.id}${variants.length > 1 ? '_' + (i + 1) : ''}`, wav = path.join(OUT, base + '.wav');
      fs.writeFileSync(wav, encodeWav(v.chans, v.rate));
      let file = base + '.wav';
      if (ff) {
        const ogg = path.join(OUT, base + '.ogg'), br = R.loop ? (v.chans.length > 1 ? '96k' : '64k') : '80k';
        execFileSync(ff, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', br, ogg]); fs.unlinkSync(wav); file = base + '.ogg';
      }
      manifest[R.id].push({ src: 'assets/sounds/' + file, loop: !!R.loop, gain: R.gain ?? 1 });
    });
    console.log(`${R.id.padEnd(22)} ${variants.length}/${want}  ← ${hits.slice(0, 2).map(h => path.basename(h.name)).join(' | ')}`);
  }
  fs.writeFileSync(mfPath, JSON.stringify(manifest, null, 1) + '\n');
  if (missing.length) console.log('\nsem arquivo no pacote (o jogo usa o som sintetizado):', missing.join(', '));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });

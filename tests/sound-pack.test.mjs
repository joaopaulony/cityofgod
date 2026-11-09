import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { zipIndex, zipRead, decodeWav, encodeWav, resample, onsets, render } from '../tools/sound-pack.mjs';

// WAV 24 bits estéreo escrito à mão (como os do pacote)
function wav24(chans, rate) {
  const n = chans[0].length, ch = chans.length, b = Buffer.alloc(44 + n * ch * 3);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 3, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * ch * 3, 28); b.writeUInt16LE(ch * 3, 32); b.writeUInt16LE(24, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 3, 40);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 3) b.writeIntLE(Math.round(chans[c][i] * 8388607), o, 3);
  return b;
}
// zip mínimo: um arquivo guardado e outro comprimido (deflate)
function makeZip(entries) {
  const locals = [], central = []; let off = 0;
  for (const { name, data, deflate } of entries) {
    const body = deflate ? zlib.deflateRawSync(data) : data, nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, body); central.push(ch, nm); off += 30 + nm.length + body.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}

test('lê WAV 24 bits e escreve 16 bits sem perder o sinal', () => {
  const L = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10) * .5), R = L.map(v => -v);
  const d = decodeWav(wav24([L, R], 48000));
  assert.equal(d.rate, 48000); assert.equal(d.chans.length, 2);
  assert.ok(Math.abs(d.chans[0][37] - L[37]) < 1e-5 && Math.abs(d.chans[1][37] + L[37]) < 1e-5);
  const back = decodeWav(encodeWav(d.chans, 48000));
  assert.ok(Math.abs(back.chans[0][100] - L[100]) < 1e-4);
});

test('acha e extrai arquivos dentro do zip (guardado e comprimido)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-')), a = wav24([new Float32Array(100).fill(.25)], 44100);
  fs.writeFileSync(path.join(dir, 'p.zip'), makeZip([{ name: 'Guns/Colt Python 357 Shot 01.wav', data: a }, { name: 'Amb/City Rain.wav', data: a, deflate: true }]));
  const idx = zipIndex(path.join(dir, 'p.zip'));
  assert.deepEqual(idx.map(f => f.name), ['Guns/Colt Python 357 Shot 01.wav', 'Amb/City Rain.wav']);
  for (const f of idx) assert.ok(Math.abs(decodeWav(zipRead(f)).chans[0][50] - .25) < 1e-5);
});

test('reamostra 96 kHz → 44,1 kHz mantendo duração e tom', () => {
  const x = Float32Array.from({ length: 96000 }, (_, i) => Math.sin(2 * Math.PI * 440 * i / 96000)), y = resample(x, 96000, 44100);
  assert.equal(y.length, 44100);
  let cross = 0; for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) cross++;
  assert.ok(Math.abs(cross - 440) <= 2, `cruzamentos ${cross}`);
});

test('separa uma rajada de tiros em golpes individuais', () => {
  const rate = 44100, x = new Float32Array(rate * 3);
  for (const t of [.2, 1.1, 2.0]) for (let i = 0; i < 4000; i++) x[(t * rate | 0) + i] = Math.exp(-i / 600) * (i % 2 ? 1 : -1);
  const cuts = onsets(x, rate, { thresh: .2, minGap: .3, maxDur: .6 });
  assert.equal(cuts.length, 3);
  assert.ok(Math.abs(cuts[1][0] / rate - 1.1) < .03);
});

test('loop sai sem costura e efeito curto normalizado', () => {
  const rate = 32000, x = Float32Array.from({ length: rate * 4 }, () => Math.random() * 2 - 1);
  const L = render({ rate, chans: [x] }, { loop: true, xfade: .5, rms: .1 });
  assert.equal(L.rate, 32000); assert.ok(L.chans[0].length < x.length);
  const r = Math.sqrt(L.chans[0].reduce((s, v) => s + v * v, 0) / L.chans[0].length); assert.ok(Math.abs(r - .1) < .02);
  const S = render({ rate: 48000, chans: [x.map(v => v * .1)] }, {});
  assert.equal(S.rate, 44100); assert.ok(Math.abs(Math.max(...S.chans[0].map(Math.abs)) - .89) < .02);
});

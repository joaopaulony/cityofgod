// URBAN INK (js/urban-ink.mjs): configurações, instalação única dos shaders e estilo original preservado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { sanitizeInk, inkParamsFrom, installInkShaders, INK, INK_DEFAULTS } from '../js/urban-ink.mjs';

const require = createRequire(import.meta.url);

test('configurações: padrão, limites e qualidade inválida', () => {
  assert.deepEqual(sanitizeInk({}), { ...INK_DEFAULTS });
  const s = sanitizeInk({ ink: false, inkOutline: 7, inkToon: -1, inkQuality: 'ultra', inkSaturation: 'x' });
  assert.equal(s.ink, false); assert.equal(s.inkOutline, 1); assert.equal(s.inkToon, 0);
  assert.equal(s.inkQuality, 'balanced'); assert.equal(s.inkSaturation, INK_DEFAULTS.inkSaturation);
  const p = inkParamsFrom({ inkThickness: 1, inkSaturation: 0, inkContrast: 1 });
  assert.equal(p.thicknessPx, 2); assert.equal(p.saturation, -0.2); assert.ok(p.contrast > 0 && p.contrast <= 0.5);
  assert.ok(inkParamsFrom({}).thicknessPx <= 1.1, 'traço padrão fino (~1 px)');
});

test('menu: front-state salva as chaves do Urban Ink com os mesmos limites', () => {
  const S = require('../js/front-state.js');
  const d = S.settings({});
  assert.equal(d.ink, true); assert.equal(d.inkQuality, 'balanced');
  const s = S.settings({ ink: false, inkOutline: 2, inkQuality: 'quality', inkThickness: -3 });
  assert.equal(s.ink, false); assert.equal(s.inkOutline, 1); assert.equal(s.inkQuality, 'quality'); assert.equal(s.inkThickness, 0);
  for (const k of ['inkOutline', 'inkThickness', 'inkToon', 'inkSaturation', 'inkContrast', 'inkQuality'])
    assert.equal(d[k], INK_DEFAULTS[k], k);
});

test('shaders: instalação única nos materiais iluminados, uniform compartilhado por referência', () => {
  installInkShaders(THREE); installInkShaders(THREE);
  for (const id of ['lambert', 'phong', 'toon', 'standard', 'physical']) {
    const lib = THREE.ShaderLib[id];
    assert.equal(lib.fragmentShader.split('uniform vec4 inkParams;').length, 2, id + ': declarado uma vez');
    assert.ok(lib.fragmentShader.includes('if ( inkParams.x > 0.0 )'), id + ': toon só com força > 0');
    assert.equal(lib.uniforms.inkParams.value, INK.params, id);
    // o clone feito por material mantém a referência (liga/desliga sem recompilar)
    assert.equal(THREE.UniformsUtils.clone(lib.uniforms).inkParams.value, INK.params, id + ': clone');
  }
  // basic (sem luz) e personagens não são tocados por definição: só materiais iluminados ganham o trecho
  assert.ok(!THREE.ShaderLib.basic.fragmentShader.includes('inkParams'));
});

test('estilo original: fora do passe do Urban Ink todos os termos ficam neutros', () => {
  // valores no repouso (fora de urbanInk.render): nada quantiza, sem viés de textura, sem marca de classe
  assert.equal(INK.params.x, 0); assert.equal(INK.params.z, 0); assert.equal(INK.params.w, 0); assert.equal(INK.mark.x, 0);
  const f = THREE.ShaderLib.physical.fragmentShader;
  assert.ok(f.includes('if ( inkParams.z > 0.0 ) sampledDiffuseColor.rgb'), 'viés só na cor e só ligado');
  assert.ok(f.includes('if ( inkMark.x != 0.0 )'), 'marca só ligada');
});

test('integração: renderizador usa o Urban Ink sem duplicar a cena', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../js/vehicle-webgl.mjs', import.meta.url), 'utf8');
  assert.match(src, /if\(!urbanInk\?\.render\(\)\)renderer\.render\(scene,viewCamera\)/);
  // sombra refeita um quadro sim, um não só no Urban Ink a pé; estilo original e direção: todo quadro
  assert.match(src, /if\(!urbanInk\?\.enabled\)\{sm\.autoUpdate=true;return;\}/);
  assert.match(src, /const every=system\.driver\?1:/);
  const ch = await readFile(new URL('../js/character-webgl.mjs', import.meta.url), 'utf8');
  assert.match(ch, /root\.userData\.inkHuman=true/);
});

test('desempenho: placa de vídeo fraca é reconhecida e começa no perfil leve', () => {
  const S = require('../js/front-state.js');
  for (const weak of ['ANGLE (AMD, AMD Radeon(TM) Vega 3 Graphics (0x000015DD) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', 'Mali-G52', 'Google SwiftShader'])
    assert.ok(S.weakGPU(weak), weak);
  for (const strong of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11)', 'Apple M2'])
    assert.ok(!S.weakGPU(strong), strong);
  assert.equal(S.settings({}).perfTuned, false);
  assert.equal(S.settings({ perfTuned: true }).perfTuned, true);
});

// Testes do gerador do mundo grande (nível 1) e do streaming (nível 2). Sem navegador.
// Rodar: node --test tests/worldgen.test.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
global.COG = require(path.join(__dirname, '..', 'js', 'worldgen', 'geo.js'));
require(path.join(__dirname, '..', 'js', 'worldgen', 'roads.js'));
require(path.join(__dirname, '..', 'js', 'worldgen', 'stream.js'));
const COG = global.COG, D = COG.D;

const t0 = Date.now();
const world = COG.buildWorld();
const buildMs = Date.now() - t0;
const geo = world.geo;
const km2 = n => n * geo.C * geo.C / 1e6;

test('mundo fixo: a semente oficial gera sempre o mesmo mapa', () => {
  const again = COG.buildWorld();
  assert.deepEqual(Buffer.from(again.geo.dist), Buffer.from(geo.dist));
  assert.equal(JSON.stringify(again.roads.map(r => r.pts)), JSON.stringify(world.roads.map(r => r.pts)));
  assert.deepEqual(again.landmarks, world.landmarks);
  const other = COG.buildWorld(12345);   // tecla G / ?wseed: outra semente = outro mapa
  assert.notDeepEqual(Buffer.from(other.geo.dist), Buffer.from(geo.dist));
});

test('tamanho: mapa compacto, ~5 km² de terra firme', () => {
  const land = km2(geo.land.reduce((a, b) => a + b, 0));
  assert.ok(land > 4.6 && land < 5.8, 'terra = ' + land.toFixed(2) + ' km²');
});

test('todos os biomas e distritos existem, com proporções plausíveis', () => {
  const area = new Array(COG.D_NAMES.length).fill(0);
  for (const d of geo.dist) area[d]++;
  for (const [name, id] of Object.entries(D)) assert.ok(area[id] > 0, 'falta ' + name);
  assert.ok(km2(area[D.AIRPORT]) < 1.0, 'aeroporto grande demais');
  assert.ok(km2(area[D.DOWNTOWN]) > 0.25, 'centro pequeno demais');
  assert.ok(km2(area[D.INDUSTRIAL]) < 0.12 && km2(area[D.PORT]) < 0.12, 'industrial/porto deveriam ter ~1/3 do antigo');
  assert.ok(km2(area[D.FOREST]) > 0.4 && km2(area[D.FARM]) > 0.6, 'faltam florestas/fazendas');
  // menos área rural: a cidade (centro, bairros, favelas, conjuntos, vilas) ocupa mais que o campo aberto
  const city = [D.DOWNTOWN, D.URBAN, D.FAVELA, D.GHETTO, D.TOWN].reduce((a, d) => a + km2(area[d]), 0);
  assert.ok(city > km2(area[D.RURAL]) * 4, 'campo aberto grande demais');
});

test('regras de layout: mar ao sul, centro na baía, porto no litoral', () => {
  const A = geo.anchors;
  assert.ok(!geo.isLand(geo.W * 0.5, geo.H - 20), 'sul deveria ser mar');
  assert.ok(!geo.isLand(geo.W - 20, geo.H * 0.5), 'leste deveria ser mar');
  assert.ok(Math.hypot(A.downtown.x - geo.bay.x, A.downtown.y - geo.bay.y) < 1600, 'centro longe da baía');
  assert.ok(geo.coastDist(A.port.x, A.port.y) < 600, 'porto longe do mar');
});

test('um só aeroporto: pista inteira em terra, longe da costa e das cidades', () => {
  const A = geo.anchors, keepOff = [A.downtown, ...A.towns, ...A.favelas];
  assert.equal(A.airports.length, 1);
  for (const ap of A.airports) {
    assert.ok(ap.ok, ap.name + ' sem local válido');
    for (let t = -0.5; t <= 0.5; t += 0.05) {
      const x = ap.x + Math.cos(ap.ang) * ap.len * t, y = ap.y + Math.sin(ap.ang) * ap.len * t;
      assert.ok(geo.isLand(x, y) && geo.coastDist(x, y) > 140, ap.name + ': pista na água/costa');
      for (const a of keepOff) assert.ok(Math.hypot(x - a.x, y - a.y) > a.r + 160, ap.name + ': pista sobre área urbana');
    }
  }
});

test('rodovias ligam todos os núcleos (rede conexa) e só tocam água em pontes', () => {
  const hw = world.roads.filter(r => r.cls === 'highway'), parent = new Map();
  const find = k => { while (parent.get(k) !== k) k = parent.get(k); return k; };
  for (const r of hw) for (const k of [r.from, r.to]) if (!parent.has(k)) parent.set(k, k);
  for (const r of hw) parent.set(find(r.from), find(r.to));
  const roots = new Set([...parent.keys()].map(find));
  assert.equal(roots.size, 1, 'rede de rodovias desconexa');
  for (const r of world.roads) r.pts.forEach((p, i) => {
    if (geo.isLand(p[0], p[1])) return;
    assert.ok(r.bridges.some(([a, b]) => i >= a && i <= b), r.cls + ' entra no mar fora de ponte');
  });
});

test('malha urbana em grade: ruas retas, cruzamentos em ângulo reto, larguras por hierarquia', () => {
  const turn = r => { let t = 0, n = 0; for (let i = 2; i < r.pts.length; i++) { const [a, b, c] = [r.pts[i - 2], r.pts[i - 1], r.pts[i]]; const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]); n++; if (Math.abs(Math.atan2(Math.sin(t2 - t1), Math.cos(t2 - t1))) > 0.005) t++; } return [t, n]; };
  const grid = world.roads.filter(r => r.grid);
  assert.ok(grid.length > 30, 'grade pequena demais: ' + grid.length);
  for (const r of grid) {
    assert.equal(turn(r)[0], 0, 'rua da grade com curva');
    const [a, b] = [r.pts[0], r.pts[r.pts.length - 1]];
    assert.ok(Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6, 'rua da grade fora dos eixos');
  }
  // rodovias continuam fazendo curvas largas pelo campo
  let t = 0, n = 0; for (const r of world.roads.filter(r => r.cls === 'highway')) { const [a, b] = turn(r); t += a; n += b; }
  assert.ok(t / n > 0.3, 'rodovias retas demais: ' + (t / n).toFixed(2));
  // hierarquia: rua local estreita (2 faixas), avenida com 4 faixas, rodovia a mais larga
  assert.ok(COG.ROAD.street.w <= 7 && COG.ROAD.avenue.w > COG.ROAD.street.w && COG.ROAD.highway.w >= COG.ROAD.avenue.w);
  assert.equal(COG.ROAD.avenue.lanes, 2);
  assert.ok(world.roads.some(r => r.park > 0), 'centro sem ruas com vaga paralela');
  assert.ok(world.junctions.length > 80, 'poucos cruzamentos: ' + world.junctions.length);
});

test('desempenho: mundo inteiro gerado rápido (cabe num Web Worker no celular)', () => {
  assert.ok(buildMs < 2500, 'geração levou ' + buildMs + ' ms');
});

test('índice espacial: consulta igual à força bruta', () => {
  const idx = new COG.SpatialIndex(32), r = COG.rng(9), items = [];
  for (let i = 0; i < 2000; i++) { const x = r() * 1000, y = r() * 1000, w = r() * 40; const o = { i }; items.push([o, [x, y, x + w, y + w]]); idx.insert(o, [x, y, x + w, y + w]); }
  for (let k = 0; k < 200; k += 2) idx.remove(items[k][0]);
  for (let q = 0; q < 50; q++) {
    const x = r() * 1000, y = r() * 1000, b = [x, y, x + r() * 200, y + r() * 200], got = [];
    idx.query(b, o => got.push(o.i));
    const want = items.filter(([o, bb], k) => !(k < 200 && k % 2 === 0) && bb[0] <= b[2] && bb[2] >= b[0] && bb[1] <= b[3] && bb[3] >= b[1]).map(([o]) => o.i);
    assert.deepEqual(got.sort((a, b2) => a - b2), want.sort((a, b2) => a - b2));
  }
});

test('setores: fichas determinísticas e vias recortadas dentro do setor', () => {
  const dc = geo.anchors.downtown, sx = Math.floor(dc.x / COG.SECTOR), sy = Math.floor(dc.y / COG.SECTOR);
  const a = COG.sectorInfo(world, sx, sy), b = COG.sectorInfo(world, sx, sy);
  assert.deepEqual(a, b);
  assert.equal(a.districtName, 'centro');
  assert.ok(a.roads.length > 0, 'setor do centro sem vias');
  const [x0, y0, x1, y1] = a.bounds;
  for (const rd of a.roads) for (const [x, y] of rd.pts) assert.ok(x >= x0 - 25 && x <= x1 + 25 && y >= y0 - 25 && y <= y1 + 25);
});

test('streaming: carrega em volta do jogador, descarrega com folga', () => {
  const loaded = new Set(); let unloads = 0;
  const st = new COG.SectorStreamer({ world, radius: 420, hysteresis: 200, maxPerUpdate: 99,
    gen: (sx, sy) => COG.sectorInfo(world, sx, sy), onLoad: i => loaded.add(i.sx + ',' + i.sy), onUnload: i => { loaded.delete(i.sx + ',' + i.sy); unloads++; } });
  st.update(1800, 1800);
  const n0 = loaded.size; assert.ok(n0 >= 7 && n0 <= 16, 'setores carregados: ' + n0);   // raio 420 m ≈ 8 setores de 256 m
  st.update(1900, 1800); assert.equal(unloads, 0, 'não deve descarregar com passos pequenos (histerese)');
  for (let x = 1800; x <= 3600; x += 50) st.update(x, 1800);
  assert.ok(unloads > 0, 'deveria descarregar o que ficou para trás');
  assert.ok(loaded.size <= 24, 'memória limitada: ' + loaded.size + ' setores');
  for (const k of loaded) { const [i, j] = k.split(',').map(Number); assert.ok(Math.hypot((i + 0.5) * 256 - 3600, (j + 0.5) * 256 - 1800) <= 620); }
});

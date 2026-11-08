import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Routing = require('../js/city-road-routing.js');
globalThis.window = {};
const { buildLines, makeLine, posAt, ahead, destinations, busLane, LINE_STYLE } = await import('../js/city-bus.mjs');

// cidade em grade: ruas a cada 200 m (avenidas nas bordas do centro), como a malha OW.cw.roads
function grid() {
  const roads = [];
  for (let k = 0; k <= 6; k++) {
    const c = k * 200, cls = k === 3 ? 'avenue' : 'street', w = cls === 'avenue' ? 13 : 6.6;
    roads.push({ cls, w, streetName: 'Rua H' + k, pts: Array.from({ length: 13 }, (_, i) => [i * 100, c]) });
    roads.push({ cls, w, streetName: 'Rua V' + k, pts: Array.from({ length: 13 }, (_, i) => [c, i * 100]) });
  }
  return { roads, net: Routing.build(roads, 1) };
}
const sites = [
  { kind: 'cityhall', name: 'Prefeitura', x: 600, y: 610 }, { kind: 'hospital', name: 'Hospital', x: 1010, y: 210 },
  { kind: 'police', name: 'Delegacia', x: 990, y: 1010 }, { kind: 'school', name: 'Escola', x: 210, y: 1000 },
  { kind: 'university', name: 'Universidade', x: 190, y: 190 }, { kind: 'restaurant', name: 'Restaurante', x: 1190, y: 600 },
  { kind: 'military', name: 'Quartel', x: 400, y: 400 }
];
const landmarks = [{ kind: 'stadium', name: 'Estádio', x: 610, y: 1190 }, { kind: 'mall', name: 'Shopping', x: 10, y: 600 }, { kind: 'hospital', name: 'Hospital (marco)', x: 1000, y: 200 }];

test('destinos: só lugares públicos, sem repetir prédio e marco no mesmo lugar', () => {
  const d = destinations(sites, landmarks);
  assert.ok(!d.some(x => x.kind === 'military'), 'quartel não é ponto de ônibus');
  assert.equal(d.filter(x => /Hospital/.test(x.name)).length, 1);
  assert.ok(d.some(x => x.name === 'Estádio') && d.some(x => x.name === 'Shopping'));
});

test('linhas: públicas coloridas passam pelo terminal; escolar liga escola e universidade', () => {
  const { roads, net } = grid(), hub = sites[0];
  const lines = buildLines({ net, roads, sites, landmarks, hub });
  const pub = lines.filter(l => !l.school), sch = lines.find(l => l.school);
  assert.ok(pub.length >= 3, pub.length + ' linhas públicas');
  assert.equal(new Set(pub.map(l => l.color)).size, pub.length, 'cada linha uma cor');
  for (const l of pub) assert.ok(l.stops.some(s => s.name === 'Terminal Centro'), l.num + ' passa no terminal');
  assert.ok(sch && sch.stops.some(s => s.name === 'Escola') && sch.stops.some(s => s.name === 'Universidade'), 'escolar');
  assert.equal(sch.num, 'E1');
});

test('percurso fechado na faixa da direita, pontos em ordem e abrigo na calçada', () => {
  const { roads, net } = grid(), lines = buildLines({ net, roads, sites, landmarks, hub: sites[0] });
  for (const l of lines) {
    const a = l.path[0], b = l.path[l.path.length - 1];
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 6, l.num + ' fecha o circuito');
    for (let i = 1; i < l.stops.length; i++) assert.ok(l.stops[i].s >= l.stops[i - 1].s);
    for (const st of l.stops) {
      // ônibus na faixa: perto do eixo (entre ~1,4 e ~5 m); abrigo fora do asfalto, além da meia-largura
      const lane = Math.min(...roads.flatMap(r => r.pts).map(p => Math.hypot(p[0] - st.x, p[1] - st.y)));
      const curb = Math.min(...roads.flatMap(r => r.pts).map(p => Math.hypot(p[0] - st.sx, p[1] - st.sy)));
      assert.ok(Math.hypot(st.sx - st.x, st.sy - st.y) > 2, 'abrigo ao lado do ônibus, não em cima');
      assert.ok(curb > 3.2 || lane < 60, 'abrigo na calçada');
    }
  }
});

test('posição na linha é contínua e circular; distância até o ponto é sempre p/ frente', () => {
  const { roads, net } = grid(), l = buildLines({ net, roads, sites, landmarks, hub: sites[0] })[0];
  let prev = posAt(l, 0);
  for (let s = 1; s < l.len + 5; s += 1) { const p = posAt(l, s); assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 2.5, 'sem saltos em s=' + s); prev = p; }
  assert.ok(ahead(l, 10, 5) > l.len - 6, 'ponto que ficou p/ trás fica a uma volta');
  assert.equal(ahead(l, 5, 10), 5);
});

test('faixa do ônibus: junto ao meio-fio e antes das vagas', () => {
  assert.ok(Math.abs(busLane({ cls: 'street', w: 6.6 }) - 1.7) < .01);
  assert.ok(Math.abs(busLane({ cls: 'avenue', w: 13 }) - 4.9) < .01);
  assert.ok(Math.abs(busLane({ cls: 'street', w: 11 }) - 1.7) < .01, 'rua com vagas');
});

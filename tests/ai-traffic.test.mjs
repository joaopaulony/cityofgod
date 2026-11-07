import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window = {};
const { createTraffic, signalStop, junctionStop, gapAhead, lanePath, LANE, LIMIT } = await import('../js/ai-traffic.mjs');

const car = (x, y, a = 0, speed = 10) => ({ x, y, a, speed, length: 4.5, width: 1.9 });

test('semáforo: para no vermelho, segue no verde, amarelo só para se der', () => {
  const sig = [{ x: 30, y: 2, ax: 1, ay: 0, group: 'main' }];
  const d = signalStop(car(0, 0), sig, { main: 'red' });
  assert.ok(d > 25 && d < 28, 'para antes do sinal (' + d + ')');
  assert.equal(signalStop(car(0, 0), sig, { main: 'green' }), null);
  assert.ok(signalStop(car(0, 0, 0, 8), sig, { main: 'yellow' }) !== null, 'amarelo longe: para');
  assert.equal(signalStop(car(25, 0, 0, 14), sig, { main: 'yellow' }), null, 'amarelo em cima: não freia no susto');
  assert.equal(signalStop(car(0, 0, Math.PI), sig, { main: 'red' }), null, 'sinal da outra mão não vale');
});

test('cruzamento sem sinal: um carro por vez', () => {
  const J = { x: 0, y: 0, key: 'j' }, owners = new Map(), A = car(-8, 0), B = car(0, -12, Math.PI / 2);
  assert.equal(junctionStop(A, J, owners, []), null, 'A chega primeiro e pega a vez');
  assert.equal(owners.get('j'), A);
  assert.ok(junctionStop(B, J, owners, []) !== null, 'B espera');
  A.x = 30;   // A saiu do cruzamento
  assert.equal(junctionStop(B, J, owners, []), null, 'agora é a vez de B');
});

test('carro da frente e pedestre na faixa freiam; pedestre na calçada não', () => {
  const me = car(0, 0);
  assert.ok(Math.abs(gapAhead(me, [{ x: 12, y: .2, half: .95, len: 2.25 }], 30) - 7.5) < .01);
  assert.ok(gapAhead(me, [{ x: 8, y: 0, half: .35, len: .3 }], 30) !== null, 'pessoa na faixa');
  assert.equal(gapAhead(me, [{ x: 8, y: 2.9, half: .35, len: .3 }], 30), null, 'pessoa na calçada');
  assert.equal(gapAhead(me, [{ x: -8, y: 0, half: .95, len: 2.25 }], 30), null, 'atrás não conta');
});

test('faixa da direita fica ao lado da linha central', () => {
  const p = lanePath([[0, 0], [10, 0], [20, 0]]);
  assert.ok(p.every(q => Math.abs(Math.abs(q[1]) - LANE) < 1e-9));
});

function world(junctions = []) {
  const w = { aiCars: [], segs: [], circles: [], mapSize: 2000 };
  return { world: w, houses: [], boxes: [], mapSize: 2000, player: { x: 210, y: 130 }, junctions };
}
function run(bridge, T, seconds, watch) {
  for (let i = 0; i < seconds * 30; i++) { T.update(1 / 30); watch?.(); }
}

test('dois carros chegando ao mesmo cruzamento não batem e os dois passam', () => {
  const bridge = world([{ x: 200, y: 200 }]), T = createTraffic(THREE, new THREE.Scene(), bridge, { max: () => 2 });
  const A = T.add({ x: 140, y: 200, a: 0, path: [[140, 200], [200, 200], [300, 200]] });
  const B = T.add({ x: 200, y: 142, a: Math.PI / 2, path: [[200, 142], [200, 200], [200, 300]] });
  let min = 99;
  run(bridge, T, 30, () => { min = Math.min(min, Math.hypot(A.x - B.x, A.y - B.y)); });
  assert.ok(min > 4, 'nunca encostam (mínimo ' + min.toFixed(1) + ' m)');
  assert.ok(A.x > 240 && B.y > 240, 'os dois atravessaram (A.x=' + A.x.toFixed(0) + ', B.y=' + B.y.toFixed(0) + ')');
});

test('fila: o de trás guarda distância do da frente parado', () => {
  const bridge = world(), T = createTraffic(THREE, new THREE.Scene(), bridge, { max: () => 2 });
  const lead = T.add({ x: 160, y: 100, a: 0, path: [[160, 100], [161, 100], [162, 100]] });   // parado (fim da rota)
  const back = T.add({ x: 100, y: 100, a: 0, path: [[100, 100], [250, 100], [400, 100]] });
  back.speed = LIMIT.street;
  run(bridge, T, 15);
  const gap = lead.x - back.x - 4.5;
  assert.ok(gap > 1 && gap < 6, 'parou atrás com folga de ' + gap.toFixed(1) + ' m');
});

test('para p/ pedestre atravessando na frente', () => {
  const bridge = world(), walker = { x: 160, y: 100 };
  const T = createTraffic(THREE, new THREE.Scene(), bridge, { max: () => 1, people: () => [walker] });
  const c = T.add({ x: 100, y: 100, a: 0, path: [[100, 100], [250, 100], [400, 100]] }); c.speed = LIMIT.street;
  run(bridge, T, 12);
  assert.ok(c.x < walker.x - 2.25 - .3, 'parou antes da pessoa (x=' + c.x.toFixed(1) + ')');
  walker.y = 106;   // terminou de atravessar
  run(bridge, T, 6);
  assert.ok(c.x > 170, 'seguiu depois');
});

test('carro estacionado invadindo a faixa: ultrapassa pela esquerda e volta p/ a faixa', () => {
  const bridge = world(); bridge.boxes = [{ x: 160, y: 100, w: 4.4, d: 1.9, h: 1.4, kind: 'parkedcar', solid: true }];
  const T = createTraffic(THREE, new THREE.Scene(), bridge, { max: () => 1 });
  const c = T.add({ x: 100, y: 100, a: 0, path: [[100, 100], [250, 100], [400, 100]] }); c.speed = LIMIT.street;
  let minGap = 99;
  for (let i = 0; i < 30 * 25; i++) { T.update(1 / 30); minGap = Math.min(minGap, Math.hypot(c.x - 160, c.y - 100)); }
  assert.ok(c.x > 200, 'passou do carro parado (x=' + c.x.toFixed(0) + ')');
  assert.ok(Math.abs(c.y - 100) < .6, 'voltou p/ a faixa (y=' + c.y.toFixed(2) + ')');
  assert.ok(minGap > 1.9, 'sem encostar (' + minGap.toFixed(2) + ')');
});

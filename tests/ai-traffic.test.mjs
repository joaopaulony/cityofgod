import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window = {};
const { createTraffic, signalStop, junctionStop, gapAhead, lanePath, continuation, laneOffset, LANE, LIMIT } = await import('../js/ai-traffic.mjs');

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

// rua reta de (x0,y0) a (x1,y1), pontos a cada 0,5 m como as do jogo
function road(x0, y0, x1, y1, cls = 'street') {
  const L = Math.hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L, pts = [];
  for (let s = 0; s <= L; s += .5) pts.push({ x: x0 + tx * s, y: y0 + ty * s, tx, ty, nx: -ty, ny: tx });
  return { pts, cls, off: -.2, lanes: 1 };
}
function city(roads, junctions = []) {
  const w = { aiCars: [], segs: [], circles: [], mapSize: 2000, roads };
  return { world: w, roads, houses: [], boxes: [], mapSize: 2000, player: { x: 150, y: 150 }, junctions, ROAD_W: 3.5 };
}
const run = (T, s, f) => { for (let i = 0; i < s * 30; i++) { T.update(1 / 30); f?.(); } };
// distância do carro até o eixo da rua (deve ficar na faixa: ~1,65 m)
const lateral = (c, r) => Math.min(...r.pts.map(p => Math.hypot(c.x - p.x, c.y - p.y)));

test('fim da rua: escolhe a continuação, nunca a meia-volta', () => {
  const A = road(0, 100, 100, 100), B = road(100, 100, 220, 100), C = road(100, 0, 100, 220);
  for (let k = 0; k < 40; k++) {
    const n = continuation([A, B, C], A, A.pts.length - 1, 1, Math.random);
    const p = n.road.pts[n.i];
    assert.ok(p.tx * n.dir * 1 + p.ty * n.dir * 0 > -.17, 'sem voltar p/ trás');
  }
  assert.equal(continuation([A], A, A.pts.length - 1, 1), null, 'beco sem saída: nada');
  assert.equal(continuation([A, B, C], A, A.pts.length - 1, 1, () => 0).road, B, 'reto vem primeiro / pesa mais');
});

test('segue a rua na faixa e vira na esquina (L), sem sair da faixa', () => {
  const A = road(0, 100, 100, 100), B = road(100, 100, 100, 260), b = city([A, B]);
  const T = createTraffic(THREE, new THREE.Scene(), b, { max: () => 1 }), c = T.add({ road: A, i: 20, dir: 1 }); c.speed = 8;
  let worst = 0;
  run(T, 30, () => { const lat = c.road === A ? Math.abs(c.y - 100) : Math.abs(c.x - 100); if (Math.hypot(c.x - 100, c.y - 100) > 9) worst = Math.max(worst, Math.abs(lat - laneOffset(A))); });
  assert.equal(c.road, B, 'virou p/ a rua B');
  assert.ok(c.y > 180, 'seguiu na rua B (y=' + c.y.toFixed(0) + ')');
  assert.ok(worst < .6, 'ficou na faixa (desvio máx. ' + worst.toFixed(2) + ' m)');
  assert.ok(c.x < 100, 'na mão certa da rua B');
});

test('beco sem saída: reduz antes do fim, faz o retorno e volta pela outra faixa (não fica parado)', () => {
  const A = road(0, 100, 120, 100), b = city([A]);
  const T = createTraffic(THREE, new THREE.Scene(), b, { max: () => 1 }), c = T.add({ road: A, i: 40, dir: 1 }); c.speed = 9;
  let maxX = 0; run(T, 14, () => { maxX = Math.max(maxX, c.x); });
  assert.ok(maxX < 120 && maxX > 100, 'chegou perto do fim sem passar dele (x máx. ' + maxX.toFixed(1) + ')');
  run(T, 9);
  assert.ok(Math.cos(c.a) < -.9, 'virou para trás (ângulo ' + c.a.toFixed(2) + ')');
  assert.ok(c.x < 95, 'voltou pela rua (x=' + c.x.toFixed(1) + ')');
  assert.ok(c.y < 100, 'na mão certa: indo para oeste fica ao norte do eixo (y=' + c.y.toFixed(1) + ')');
  assert.ok(c.speed > 1, 'andando, não parado');
});

test('fila no sinal vermelho: o de trás guarda distância e fica na faixa', () => {
  const A = road(0, 100, 400, 100), b = city([A]); b.trafficPhase = () => ({ main: 'red' }); b.world.trafficSignals = [{ x: 170, y: 104, ax: 1, ay: 0, group: 'main' }];
  const T = createTraffic(THREE, new THREE.Scene(), b, { max: () => 2 });
  const lead = T.add({ road: A, i: 300, dir: 1 }), back = T.add({ road: A, i: 160, dir: 1 }); back.speed = LIMIT.street;
  run(T, 20);
  const gap = lead.x - back.x - 4.5;
  assert.ok(lead.x < 170, 'o da frente parou no sinal');
  assert.ok(gap > 1 && gap < 6, 'folga de ' + gap.toFixed(1) + ' m');
  assert.ok(Math.abs(back.y - 100 - laneOffset(A)) < .3, 'continuou na faixa, atrás');
});

test('para p/ pedestre atravessando e segue depois', () => {
  const A = road(0, 100, 400, 100), walker = { x: 150, y: 101.6 }, b = city([A]);
  const T = createTraffic(THREE, new THREE.Scene(), b, { max: () => 1, people: () => [walker] });
  const c = T.add({ road: A, i: 160, dir: 1 }); c.speed = LIMIT.street;
  run(T, 12);
  assert.ok(c.x < walker.x - 2.5, 'parou antes da pessoa (x=' + c.x.toFixed(1) + ')');
  walker.y = 106; run(T, 8);
  assert.ok(c.x > 170, 'seguiu depois');
});

test('cruzamento: dois carros em ruas que se cruzam não batem e os dois passam', () => {
  const A = road(0, 200, 400, 200), B = road(200, 0, 200, 400), b = city([A, B], [{ x: 200, y: 200 }]);
  const T = createTraffic(THREE, new THREE.Scene(), b, { max: () => 2 });
  const c1 = T.add({ road: A, i: 270, dir: 1 }), c2 = T.add({ road: B, i: 275, dir: 1 }); c1.speed = c2.speed = 8;
  let min = 99; run(T, 25, () => { min = Math.min(min, Math.hypot(c1.x - c2.x, c1.y - c2.y)); });
  assert.ok(min > 3, 'nunca encostam (' + min.toFixed(1) + ' m)');
  assert.ok(c1.x > 240 && c2.y > 240, 'os dois atravessaram');
});

test('rua com vagas: a faixa fica fora da faixa de estacionamento', () => {
  const r = { off: 2, lanes: 1, park: 2.2 }, lane = laneOffset(r);
  assert.ok(Math.abs(lane - 1.65) < .01);
  assert.ok(lane + 1.9 / 2 < 3.5 + 2 - 2.2 + .01, 'o carro inteiro cabe antes das vagas');
});

test('rua sem saída: o carro faz o retorno (único lugar permitido) em vez de ficar parado para sempre', async () => {
  const { turnAround } = await import('../js/ai-traffic.mjs');
  const u = { dir: 1, next: { road: {} }, deadEnd: true, deadT: 2, why: 'sem saida' };
  turnAround(u);
  assert.equal(u.dir, -1); assert.equal(u.deadEnd, false); assert.equal(u.next, null); assert.equal(u.why, 'retorno');
  turnAround(u); assert.equal(u.dir, 1); assert.equal(u.turns, 2);
});

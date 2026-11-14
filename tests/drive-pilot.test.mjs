import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
const { planLane, curveSpeed } = await import('../js/drive-pilot.mjs');

const lane = () => ({ off: 1.6, cls: 'street' });

test('faixa da direita: indo para leste fica ao sul do eixo (y para baixo), indo para norte fica a leste', () => {
  const east = planLane([[0, 0], [50, 0]], lane);
  assert.ok(east.every(p => Math.abs(p.y - 1.6) < 1e-6), 'leste → y = +1,6');
  const north = planLane([[0, 0], [0, -50]], lane);
  assert.ok(north.every(p => Math.abs(p.x - 1.6) < 1e-6), 'norte → x = +1,6');
  assert.ok(Math.abs(east.at(-1).s - 50) < .01, 'distância acumulada');
});

test('reta não limita a velocidade; antes da curva freia só o necessário', () => {
  const straight = planLane([[0, 0], [200, 0]], lane);
  assert.equal(curveSpeed(straight, 0), Infinity);
  const turn = planLane([[0, 0], [100, 0], [100, 100]], lane);
  const at = s => turn.findIndex(p => p.s >= s);
  const near = curveSpeed(turn, at(92)), mid = curveSpeed(turn, at(75)), far = curveSpeed(turn, at(40));
  assert.ok(near < 7, 'na boca da curva: devagar (' + near.toFixed(1) + ' m/s)');
  assert.ok(mid > near, 'mais longe da curva pode ir mais rápido');
  assert.equal(far, Infinity, 'a 60 m da curva ainda não freia');
});

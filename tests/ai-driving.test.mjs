import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// ambiente mínimo: canvas de mentira p/ o decalque da ambulância, sem áudio
const ctx2d = new Proxy({}, { get: () => () => {} });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
globalThis.window = {};
const { createAIVehicles } = await import('../js/ai-vehicles.mjs');

const parked = (x, y, rot = 0) => ({ x, y, w: 4.4, d: 1.9, h: 1.4, rot, kind: 'parkedcar', solid: true });
async function drive(boxes, goal, seconds = 14) {
  const world = { aiCars: [], segs: [], circles: [], mapSize: 400 };
  const bridge = { world, houses: [], boxes, mapSize: 400, pondVal: () => 9, player: { x: 300, y: 300 } };
  const fleet = createAIVehicles(THREE, new THREE.Scene(), bridge);
  const u = await fleet.spawn('ambulance', 20, 50, 0);
  u.siren = false; u.direct = true; u.goal = goal; u.arrive = 2;
  let hits = 0, prev = 0, minGap = 99;
  for (let i = 0; i < seconds * 60; i++) {
    fleet.update(1 / 60, i / 60);
    if (prev > 1 && u.speed < 0 && u.reverseT <= 0) hits++;   // ricochete = bateu
    prev = u.speed;
    for (const b of boxes) minGap = Math.min(minGap, Math.hypot(b.x - u.x, b.y - u.y));
  }
  return { u, hits, minGap };
}

test('IA desvia de carro parado na faixa sem bater e segue até o destino', async () => {
  const { u, hits } = await drive([parked(60, 50)], { x: 110, y: 50 });
  assert.equal(hits, 0, 'não pode bater no carro parado');
  assert.ok(u.x > 95, 'passou do obstáculo e chegou perto do destino (x=' + u.x.toFixed(1) + ')');
});

test('IA freia antes de uma barreira sem desvio e não encosta nela', async () => {
  // rua fechada: carros lado a lado de y=40 a y=60
  const wall = [40, 42.2, 44.4, 46.6, 48.8, 51, 53.2, 55.4, 57.6, 59.8].map(y => parked(60, y, Math.PI / 2));
  const { u, hits } = await drive(wall, { x: 110, y: 50 }, 8);
  assert.equal(hits, 0, 'freou a tempo, sem ricochete');
  assert.ok(u.x < 60 - 1 - u.length / 2, 'parou antes da barreira (x=' + u.x.toFixed(1) + ')');
});

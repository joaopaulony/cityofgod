// worldgen/worker.js — gera o mundo (nível 1) e as fichas de setor fora da thread principal.
'use strict';
importScripts('geo.js', '../city-districts.js', 'roads.js', 'stream.js');
let world = null;
onmessage = e => {
  const m = e.data;
  if (m.type === 'init') {
    const t0 = Date.now();
    world = COG.buildWorld(m.seed || COG.WORLD_SEED); COG.indexRoads(world);
    postMessage({ type: 'ready', ms: Date.now() - t0, timing: world.timing });
  } else if (m.type === 'sector') {
    postMessage({ type: 'sector', id: m.id, info: COG.sectorInfo(world, m.sx, m.sy) });
  }
};

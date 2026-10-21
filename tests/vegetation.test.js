// node tests/vegetation.test.js
// Smoke test for procedural Canvas foliage without browser or external deps.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const worldSource = fs.readFileSync(path.join(__dirname, '../js/world.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');
const start = worldSource.indexOf('// ---- Vegetação orgânica:');
const end = worldSource.indexOf('function makeRock() {', start);
assert.ok(start >= 0 && end > start, 'foliage module boundary');
let drawCalls = 0;
const context2d = new Proxy({}, {
  get(_t, key) {
    if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
    return () => { drawCalls++; };
  },
  set() { return true; },
});
const makeCanvas = (w,h) => ({
  width: Math.max(1,Math.ceil(w)), height: Math.max(1,Math.ceil(h)),
  getContext: () => context2d,
});
let seed=24567;
const rand=()=>{ seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296; };
const R=(a,b)=>a+rand()*(b-a);
const poly=(_g,pts)=>assert.ok(Array.isArray(pts)&&pts.length>=3);
const world={groundCtx:context2d};
const sandbox=vm.createContext({Math,TAU:Math.PI*2,SPR:40,PPM:28,SUN:[-.55,-.75,.9],rng:rand,R,
  makeCanvas,poly,world});
vm.runInContext(worldSource.slice(start,end)+'\nthis.testApi={makeTree,makeBush};',sandbox);
const sprites=['oak','oak','yard','street','pine','pine'].map(kind=>sandbox.testApi.makeTree(kind));
for (const sp of sprites) {
  assert.ok(sp.trunk.width>0&&sp.trunk.height>0&&sp.crown.width>0&&sp.crown.height>0);
  assert.ok(sp.trunkH>1&&sp.r>0&&sp.leafColors.length>0);
  assert.ok(sp.cay>0&&sp.cay<=sp.crown.height);
}
for (let i=0;i<8;i++) {
  const bush=sandbox.testApi.makeBush();
  assert.ok(bush.img.width>0&&bush.img.height>0&&bush.r>.3);
}
const shadowStart=worldSource.indexOf('function bakeTreeShadow(');
const shadowEnd=worldSource.indexOf('// ---------- sprites pintados uma vez',shadowStart);
assert.ok(shadowStart>=0&&shadowEnd>shadowStart);
vm.runInContext(worldSource.slice(shadowStart,shadowEnd)+'\nthis.bakeTreeShadow=bakeTreeShadow',sandbox);
sandbox.bakeTreeShadow(10,12,sprites[0]);
assert.ok(gameSource.includes("function spawnAmbientLeaves(dt)"));
assert.ok(gameSource.includes("kind:'falling-leaf'"));
assert.ok(gameSource.includes("spawnAmbientLeaves(dt);"));
assert.ok(gameSource.includes("active < 48"));
assert.ok(drawCalls>1000,'detailed pre-rendered foliage should produce many draw calls');
console.log('OK: 6 trees, 8 shrubs, world shadows, bounded falling leaves');

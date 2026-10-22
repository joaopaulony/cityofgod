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
const foliageSource = worldSource.slice(start,end);
assert.ok(!/function blobCluster\(/.test(foliageSource),'the round blob renderer must not return');
const leafCanopy = foliageSource.slice(foliageSource.indexOf('function leafCanopy('),foliageSource.indexOf('function spruceNeedles('));
assert.ok(!/\.ellipse\(|\.arc\(/.test(leafCanopy),'crowns must be leaf-by-leaf, not filled green discs');
assert.ok(foliageSource.includes('const LEAF_BATCH_SIZE = 256;'), 'large Canvas paths must be split into batches');
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
vm.runInContext(worldSource.slice(start,end)+'\nthis.testApi={makeTree,makeBush,leafBatch};',sandbox);
const sprites=['oak','oak','yard','street','pine','pine'].map(kind=>sandbox.testApi.makeTree(kind));
for (const sp of sprites) {
  assert.ok(sp.trunk.width>0&&sp.trunk.height>0&&sp.crown.width>0&&sp.crown.height>0);
  assert.ok(sp.trunkH>.85&&sp.r>0&&sp.leafColors.length>0);
  assert.ok(sp.cay>0&&sp.cay<=sp.crown.height);
  assert.ok(sp.trunkH<1.8,'tree trunks must remain short and natural');
  if(sp.kind==='pine') {
    assert.ok(sp.needleCount>=60000,'pine must render 10x needles');
    assert.equal(sp.trunkProfile,undefined,'pine trunk implementation must remain unchanged');
  } else {
    assert.ok(sp.leafCount>=100000,'broadleaf trees must render 10x individual leaves');
    const profile=sp.trunkProfile;
    assert.ok(profile && profile.baseWidth>0,'broadleaf trunk exposes real geometry');
    assert.ok(profile.baseWidth<=12.1,'broadleaf trunk must be slender at base');
    assert.ok(Math.abs(profile.midWidth/profile.baseWidth-.955)<1e-6,'mid trunk remains uniform');
    assert.ok(Math.abs(profile.topWidth/profile.baseWidth-.89)<1e-6,'top width stays near base width');
  }
}
// Broadleaf decoration variants are generated from actual branch tips.
const variants=['common','flowering','fruiting','mixed'];
for (const variant of variants) {
  const tree=sandbox.testApi.makeTree('oak',variant);
  assert.equal(tree.decoration,variant,'explicit appearance must be stable');
  assert.equal(tree.branchCount,6,'six main branches');
  assert.ok(tree.twigCount>=12,'at least twelve secondary twigs');
  assert.ok(tree.trunkProfile,'branch and trunk geometry available for diagnostics');
  assert.ok(tree.branchAngles.some(a=>Math.abs(Math.cos(a))>.94),
    'some branches must grow almost horizontally');
  assert.ok(tree.branchAngles.some(a=>Math.abs(Math.sin(a))>.93),
    'some branches must rise nearly vertically');
  assert.ok(tree.leafCount>=100000,'organic scaffold must retain dense canopy');
  if(variant==='common')assert.equal(tree.flowers+tree.fruits,0);
  if(variant==='flowering')assert.ok(tree.flowers>=30&&tree.fruits===0);
  if(variant==='fruiting')assert.ok(tree.fruits>=20&&tree.flowers===0);
  if(variant==='mixed')assert.ok(tree.flowers>=10&&tree.fruits>=10);
}
assert.ok(!worldSource.includes("makeTree('pine','flowering')"),
  'pine trees must remain unchanged by broadleaf decoration');

for (let i=0;i<8;i++) {
  const bush=sandbox.testApi.makeBush();
  assert.ok(bush.img.width>0&&bush.img.height>0&&bush.r>.3);
  assert.ok(bush.leafCount>=14000,'bushes need 10x individual leaves');
}
const shadowStart=worldSource.indexOf('function bakeTreeShadow(');
const shadowEnd=worldSource.indexOf('// ---------- sprites pintados uma vez',shadowStart);
assert.ok(shadowStart>=0&&shadowEnd>shadowStart);
vm.runInContext(worldSource.slice(shadowStart,shadowEnd)+'\nthis.bakeTreeShadow=bakeTreeShadow',sandbox);
sandbox.bakeTreeShadow(10,12,sprites[0]);
assert.ok(gameSource.includes("function spawnAmbientLeaves(dt)"));
assert.ok(gameSource.includes("kind:'falling-leaf'"));
assert.ok(gameSource.includes('function spawnTreeShotLeaves(hit)'),'shot foliage needs real leaves');
assert.ok(gameSource.includes('paintLeaf(g,p.x,p.y,len,angle,q.col'),'shot and ambient leaves use canopy shape');
const terrainSource=fs.readFileSync(path.join(__dirname,'..','js','terrain.js'),'utf8');
assert.ok(/n = CH \* CH \* (\d+)/.test(terrainSource)&&Number(terrainSource.match(/n = CH \* CH \* (\d+)/)[1])>=10,'ground grass has microblades (terrain chunks, >=10 per m2)');
assert.ok(terrainSource.includes("t: 'blade'"),'terrain detail pass paints individual grass blades');
assert.ok(worldSource.includes('for(let i=0;i<40;i++'),'grass tufts use several layers of blades');
assert.ok(gameSource.includes("spawnAmbientLeaves(dt);"));
assert.ok(gameSource.includes("active < 48"));
// Regression: no fill may accumulate over 256 leaf outlines.
let maxLeaves=0,leavesInPath=0,fills=0;
const guard=new Proxy({},{get:(_t,k)=>{
  if(k==='beginPath')return()=>{leavesInPath=0;};
  if(k==='moveTo')return()=>{leavesInPath++;};
  if(k==='fill')return()=>{maxLeaves=Math.max(maxLeaves,leavesInPath);fills++;};
  return()=>{};
},set:()=>true});
sandbox.testApi.leafBatch(guard,[Array.from({length:4096*4},(_,i)=>i%4===2?1.5:.6)],['#2b6a37']);
assert.ok(maxLeaves<=256,'Canvas path exceeds safe 256-leaf batch');
assert.ok(fills>=16,'leaf batching should submit several safe fills');
assert.ok(drawCalls>1000,'detailed pre-rendered foliage should produce many draw calls');
console.log('OK: slender broadleaf trunks with uniform girth, thinner branches, pine preservation, flowering/fruiting variants and leaf batch safety');

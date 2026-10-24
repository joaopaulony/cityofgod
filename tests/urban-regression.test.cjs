const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const G=require('../js/street-layout.js');
const roadWidth=3.5,sidewalkWidth=2,road=(_x,y)=>Math.abs(y);
test('curb fixtures remain on public sidewalk, not road or lawns',()=>{
 assert.equal(G.curbFixture(0,4.3,.16,road,roadWidth,sidewalkWidth),true);
 assert.equal(G.curbFixture(0,3.3,.16,road,roadWidth,sidewalkWidth),false);
 assert.equal(G.curbFixture(0,6.5,.16,road,roadWidth,sidewalkWidth),false);
});
test('buildings cannot touch curved pavement at their corners',()=>{
 assert.equal(G.clearBuilding([0,7,8,14],road,roadWidth,sidewalkWidth,.6),true);
 assert.equal(G.clearBuilding([0,4.8,8,14],road,roadWidth,sidewalkWidth,.6),false);
});
test('buildings follow straight, road-facing segments instead of diagonals',()=>{
 const pts=Array.from({length:65},(_,i)=>({x:i*.5,y:0,tx:1,ty:0}));
 assert.equal(G.alignedFront({pts},30,10),true);
 for(let i=24;i<=36;i++)pts[i]={...pts[i],tx:.55,ty:.835};
 assert.equal(G.alignedFront({pts},30,10),false);
});
test('tree crowns cannot penetrate the outer walls of buildings',()=>{
 const H={x0:12,y0:12,x1:20,y1:20};
 assert.equal(G.clearVegetation(8,15,2.7,[H],.5),true);
 assert.equal(G.clearVegetation(10.5,15,2.7,[H],.5),false);
});
test('only real intersecting roads suppress lane lines',()=>{
 const idx={cell:16,map:new Map([[0,[{id:'other',ax:0,ay:-9,bx:0,by:9,off:0}]]])};
 assert.equal(G.nearOtherRoad(1,2,'main',idx,5),true);
 assert.equal(G.nearOtherRoad(1,2,'other',idx,5),false);
 assert.equal(G.nearOtherRoad(14,2,'main',idx,5),false);
});
test('building apron stops before the sidewalk on a curve',()=>{
 const w=(x,y)=>Math.min(Math.abs(y),Math.hypot(x-3,y-4));
 const d=G.safeFrontDepth(0,12,[0,-1],3,10,w,roadWidth,sidewalkWidth);
 assert.ok(d>=0&&d<7);
});
test('cars ignore obsolete decorative box segments and road colliders',async()=>{
 const {carCollision}=await import('../js/vehicle-collision.mjs');
 const car={x:50,y:50,angle:0,length:4,width:1.8},opts={mapSize:200,houses:[],boxes:[]};
 const world={segs:[{x1:49,y1:49,x2:51,y2:49,kind:'bench'}],circles:[],roadDistFn:()=>99};
 assert.equal(carCollision(world,car,opts),null);
 world.segs=[{x1:50,y1:48,x2:50,y2:52,kind:'fence'}];
 assert.equal(carCollision(world,car,opts).kind,'fence');
 world.segs=[];world.circles=[{x:50,y:50,r:.5,kind:'rock'}];
 assert.equal(carCollision(world,car,opts),null);
 world.circles=[{x:50,y:50,r:.5,kind:'lamp'}];world.roadDistFn=()=>0;
 assert.equal(carCollision(world,car,opts),null);
});
test('regression: terrain worklist is sector-local and no duplicate fallback lines',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../js/terrain.js'),'utf8');
 const ow=fs.readFileSync(path.join(__dirname,'../js/openworld.js'),'utf8');
 assert.match(src,/const near=houses\.filter/);
 assert.match(src,/nearOtherRoad/);
 assert.doesNotMatch(ow,/for \(const rd of S\.roads\) line\(rd, 0\.3/);
});

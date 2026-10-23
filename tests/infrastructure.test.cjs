'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context=vm.createContext({Math,console});
vm.runInContext(read('js/traffic-signals.js'),context);
const phase=t=>vm.runInContext('trafficPhase('+t+')',context);
test('traffic signals implement protected main/side red yellow green cycles',()=>{
 assert.equal(phase(0).main,'green');
 assert.equal(phase(0).branch,'red');
 assert.equal(phase(20.9).main,'green');
 assert.equal(phase(21).main,'yellow');
 assert.equal(phase(24).main,'red');
 assert.equal(phase(24).branch,'red');
 assert.equal(phase(25).branch,'green');
 assert.equal(phase(41.99).branch,'green');
 assert.equal(phase(42).branch,'yellow');
 assert.equal(phase(45).branch,'red');
 assert.equal(phase(54).main,'green');
 for(let sec=0;sec<54;sec+=.25){
   const p=phase(sec);
   assert.ok(!(p.main==='green'&&p.branch==='green'),'conflict '+sec);
   assert.ok(!(p.main==='yellow'&&p.branch==='green'));
   assert.ok(!(p.branch==='yellow'&&p.main==='green'));
 }
});
test('pedestrians only walk when corresponding car traffic is red',()=>{
 for(let t=0;t<54;t+=.25){
   const p=phase(t);
   if(p.pedestrianMain)assert.equal(p.main,'red');
   if(p.pedestrianBranch)assert.equal(p.branch,'red');
 }
});
test('both pedestrian phases have exclusive walk window after yellow clearance',()=>{
 assert.equal(phase(46).main,'red');
 assert.equal(phase(46).branch,'red');
 assert.equal(phase(46).pedestrian,'wait');
 assert.equal(phase(48).pedestrian,'walk');
 assert.equal(phase(48).countdown,5);
 assert.equal(phase(52).countdown,1);
 assert.equal(phase(53).pedestrian,'stop');
 for(let sec=0;sec<54;sec+=.1){
   const p=phase(sec);
   if(p.pedestrianMain||p.pedestrianBranch){
     assert.equal(p.main,'red');
     assert.equal(p.branch,'red');
     assert.equal(p.pedestrian,'walk');
   }
 }
});
test('overhead L reaches lane center and signal faces approaching vehicles',()=>{
 const obj={x:20,y:30,ax:1,ay:0,ix:0,iy:-1,armSpan:4.45,
   armHeight:4.14,headHeight:3.45};
 const g=vm.runInContext('trafficSignalGeometry('+JSON.stringify(obj)+')',context);
 assert.equal(g.tip.x,20);
 assert.ok(Math.abs(g.tip.y-25.55)<1e-9);
 assert.ok(g.face.x===-obj.ax&&g.face.y===-obj.ay);
 assert.ok(g.pedFront.y===1);
 assert.ok(Math.abs(g.span-4.45)<1e-8);
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const c=Math.cos(yaw),si=Math.sin(yaw);
   const proj=(x,y)=>[c*x-si*y,si*x+c*y];
   const d=proj(g.tip.x-obj.x,g.tip.y-obj.y);
   assert.ok(Math.abs(Math.hypot(...d)-g.span)<1e-8);
 }
});
test('state stays periodic and safe across long play sessions',()=>{
 for(const t of [0,1,20,22,24,25,35,43,45,48,53]){
   assert.equal(phase(t).main,phase(t+54*1200).main);
   assert.equal(phase(t).branch,phase(t+54*1200).branch);
 }
});
test('streetlamp maintains occluder coordinates and night light source',()=>{
 const world=read('js/world.js'),oc=read('js/vehicle-occlusion.mjs'),
  vis=read('js/vision-light.js'),game=read('js/game.js');
 assert.match(world,/drawLamp\(g,l,night\)/);
 assert.match(world,/quadraticCurveTo/);
 assert.match(world,/galvaniz|metalico/i);
 assert.match(world,/generateTrafficSignals\(\)/);
 assert.match(game,/drawTrafficSignal\(ctx,signal,T,st\.night\)/);
 assert.match(oc,/bridge\.world\.trafficSignals/);
 assert.match(vis,/function drawLampBeam/);
 assert.match(game,/drawLampBeam\(g,lamp,T\)/);
});
test('farmhouse access is dirt and pebbles, urban walks unchanged',()=>{
 const houses=read('js/houses.js'),rural=read('js/rural-paths.js'),index=read('index.html');
 assert.match(houses,/if\(H\.rural\)\{paintRuralAccess\(g,M,H\);continue;\}/);
 assert.match(houses,/if\(H\.rural\)t=Math\.min\(t,/);
 assert.match(rural,/function paintRuralAccess/);
 assert.match(rural,/mulberry\(p\.seed/);
 assert.match(rural,/parallel|tyre|worn|gravel|cascalho/i);
 assert.match(index,/js\/rural-paths\.js/);
 assert.match(index,/js\/traffic-signals\.js/);
 assert.ok(index.indexOf('traffic-signals.js')<index.indexOf('js/game.js'));
});

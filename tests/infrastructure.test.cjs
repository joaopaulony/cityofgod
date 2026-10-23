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
 assert.equal(phase(46).main,'green');
 for(let sec=0;sec<46;sec+=.25){
   const p=phase(sec);
   assert.ok(!(p.main==='green'&&p.branch==='green'),'conflict '+sec);
   assert.ok(!(p.main==='yellow'&&p.branch==='green'));
   assert.ok(!(p.branch==='yellow'&&p.main==='green'));
 }
});
test('pedestrians only walk when corresponding car traffic is red',()=>{
 for(let t=0;t<46;t+=.25){
   const p=phase(t);
   if(p.pedestrianMain)assert.equal(p.main,'red');
   if(p.pedestrianBranch)assert.equal(p.branch,'red');
 }
});
test('state stays periodic and safe across long play sessions',()=>{
 for(const t of [0,1,20,22,24,25,35,43,45]){
   assert.equal(phase(t).main,phase(t+46*1200).main);
   assert.equal(phase(t).branch,phase(t+46*1200).branch);
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

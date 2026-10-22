'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/vehicle-sprites.js'),'utf8');
const driving=fs.readFileSync(path.join(root,'js/vehicle-drive.js'),'utf8');
const game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('Game loads sprite renderer AFTER car art but BEFORE gameplay',()=>{
 assert.ok(html.indexOf('js/vehicle-art.js')<html.indexOf('js/vehicle-sprites.js'));
 assert.ok(html.indexOf('js/vehicle-sprites.js')<html.indexOf('js/vehicle-drive.js'));
});
test('Pilot has fallback to procedural car bodies on missing assets',()=>{
 const art=fs.readFileSync(path.join(root,'js/vehicle-art.js'),'utf8');
 assert.match(art,/vehicleDrawSprite\(g,b,time\)/);
 assert.match(art,/function carDraw\(g,b,time=0,night=false\)/);
});
test('Only Diablo pilot gets the sprite renderer; other 8 models unchanged',()=>{
 assert.match(source,/if\(b\.model!=='supercar'/);
 assert.match(source,/vehicleSpriteAtlas\.ready/);
 assert.match(source,/fetch\('assets\/vehicles\/diablo\/manifest\.json'/);
});
test('Direction mapping works as camera rotates through all eight bins',()=>{
 const context=vm.createContext({
  fetch:()=>Promise.reject(new Error('fixture')),
  Image:class{},TAU:Math.PI*2,
  cam:{ang:Math.PI/4},console
 });
 vm.runInContext(source,context);
 const list=[];
 for(let i=0;i<8;i++){
  context.cam.ang=i*Math.PI/4;
  list.push(vm.runInContext('vehicleSpriteDirection({rot:0})',context));
 }
 assert.deepEqual(list,['right','front-right','front','front-left',
  'left','rear-left','rear','rear-right']);
});
test('All paint colors have at least six distinct hues',()=>{
 const context=vm.createContext({fetch:()=>Promise.reject(0),Image:class{},TAU:Math.PI*2,
  cam:{ang:0},console});
 vm.runInContext(source,context);
 const hues=vm.runInContext('VEHICLE_PAINTS.map(p=>vehicleRgbToHsv(...p.hex.slice(1).match(/../g).map(x=>parseInt(x,16)))[0])',context);
 assert.equal(hues.length,8);
 assert.ok(new Set(hues.map(x=>x.toFixed(2))).size>=6);
});
test('Diablo panel controls and animations are wired to tick and HUD',()=>{
 for(const key of ['o','u','p','j','[',']'])
  assert.ok(driving.includes("input.hit('"+key+"')") || driving.includes(key+":'"));
 assert.match(driving,/vehicleAccessoryInteraction/);
 assert.match(driving,/vehicleVisualUpdate/);
 assert.match(game,/vehicleAccessoryInteraction\(player\)/);
 assert.match(game,/vehicleVisualUpdate\(dt\)/);
 assert.match(driving,/Math\.abs\(car\.speed\)>\.15/);
});
test('Paid workflow cannot run on normal gameplay pushes',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/diablo-pilot.yml'),'utf8');
 assert.match(wf,/paths:\s*-\s*tools\/gemini\/trigger-diablo-once\.txt/);
 assert.match(wf,/diablo-pilot-7-calls-approved/);
 assert.match(wf,/test ! -f assets\/vehicles\/diablo\/manifest\.json/);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const art=file('js/vehicle-art.js');
const drive=file('js/vehicle-drive.js');
const game=file('js/game.js');
const html=file('index.html');
const workflow=file('.github/workflows/vegetation.yml');

test('all visible cars are the nine original Canvas 2D procedural models',()=>{
 const before=art.slice(0,art.indexOf('function carModel('));
 const ctx=vm.createContext({});
 const vehicles=vm.runInContext(before+'; CAR_MODELS.map(({id,name})=>({id,name}));',ctx);
 assert.equal(vehicles.length,9);
 assert.equal(new Set(vehicles.map(x=>x.id)).size,9);
 assert.deepEqual(Array.from(vehicles,x=>x.id),[
  'supercar','eclipse','skyline','mustang','explorer',
  'daytona','challenger','pickup','sedan']);
 assert.equal(vehicles[0].name,'Superesportivo roxo');
 assert.ok(vehicles.every(x=>!x.name.includes('Lamborghini')&&!x.name.includes('Diablo')));
});

test('the game does not load Diablo AI image sheets or runtime modules',()=>{
 assert.doesNotMatch(html,/vehicle-sprites\.js|assets\/vehicles\/diablo/);
 assert.doesNotMatch(art,/vehicleDrawSprite|vehicleSpriteAtlas|Lamborghini Diablo/);
 assert.doesNotMatch(game,/vehicleAccessoryInteraction|vehicleVisualUpdate/);
 assert.ok(!fs.existsSync(path.join(root,'js/vehicle-sprites.js')));
});

test('driving and lighting remain available on the procedural cars',()=>{
 for(const s of ['function vehicleUpdate(', 'function vehicleHorn(',
  'function vehicleDrivingHUD(', 'function vehicleInteraction(']){
  assert.ok(drive.includes(s),s);
 }
 assert.match(art,/function carTire\(/);
 assert.match(art,/function carDrawFender\(/);
 assert.match(art,/function carDraw\(/);
 assert.match(game,/vehicleUpdate\(dt,player\)/);
 assert.match(html,/js\/vehicle-art.js/);
 assert.match(html,/js\/vehicle-drive.js/);
});

test('remove Diablo-only controls and obsolete art acceptance checks',()=>{
 assert.doesNotMatch(drive,/Pintura da Diablo|vehicleVisualUpdate|vehicleAccessoryInteraction|VEHICLE_PAINTS/);
 assert.doesNotMatch(workflow,/node tests\/diablo-pilot\.test\.cjs|validate-diablo\.mjs/);
 assert.match(workflow,/node tests\/vegetation-browser\.cjs/);
});

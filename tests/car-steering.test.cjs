'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const drive=fs.readFileSync(path.join(__dirname,'../js/vehicle-drive.js'),'utf8');
const art=fs.readFileSync(path.join(__dirname,'../js/vehicle-art.js'),'utf8');
const inputState=new Set(),hits=new Set();
function createScene(camAngle,reverse=false){
 const input={down:k=>inputState.has(k),hit:k=>hits.has(k)};
 const car={model:'supercar',x:40,y:40,rot:-camAngle,speed:reverse?-5:5,steer:0,
   engine:true,headlights:false,indicator:0,hazards:false,odometer:0,seed:19,brake:false};
 const player={x:40,y:40};
 const sandbox={
  Math,console,input,world:{night:false},ROAD_W:2,
  clamp:(x,lo,hi)=>Math.min(hi,Math.max(lo,x)),
  lerp:(a,b,t)=>a+(b-a)*t,
  roadDist:()=>0,
  carModel:()=>({acc:7,max:24,len:4.6,w:1.8}),
  carPoint:(car,u,v,z)=>[car.x+Math.cos(car.rot)*u-Math.sin(car.rot)*v,
   car.y+Math.sin(car.rot)*u+Math.cos(car.rot)*v,z],
  vehicleAudioInit:()=>null,
  window:{},houses:[],boxes:[],fences:[],actors:[],player,
  MAP:160,pondVal:()=>2,TAU:2*Math.PI
 };
 vm.createContext(sandbox);
 vm.runInContext(drive,sandbox);
 sandbox.vehicleCanOccupy=()=>true;
 sandbox.vehicleSound=()=>{};
 sandbox.__car=car;
 vm.runInContext('vehicleSystem.driver=__car;vehicleSystem.cars=[__car];',sandbox);
 return {scene:sandbox,car,player};
}
test('correct A/D world yaw for ANY camera orientation',()=>{
 for(const camera of [0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI,Math.PI*1.5]){
  for(const [key,expected] of [['a',-1],['d',1]]){
   inputState.clear();hits.clear();inputState.add(key);
   const {scene,car}=createScene(camera);
   const initial=car.rot;
   scene.vehicleUpdate(.10,scene.player);
   assert.ok(Math.sign(car.rot-initial)===expected,
      'incorrect '+key+' turn at camera '+camera);
   const before=Math.sin(initial+camera),after=Math.sin(car.rot+camera);
   assert.ok(Math.sign(after-before)===expected,
      'screen-space '+key+' direction inverted at camera '+camera);
  }
 }
 inputState.clear();hits.clear();
});
test('reverse gear naturally reverses rotation sign (not key mapping)',()=>{
 inputState.clear();hits.clear();inputState.add('d');
 let {scene,car}=createScene(Math.PI/4,true);
 const prior=car.rot;scene.vehicleUpdate(.10,scene.player);
 assert.ok(car.rot<prior,'in reverse, steering right must pivot opposite');
 inputState.clear();
});
test('Z lights physical LEFT, C lights physical RIGHT and HUD agrees',()=>{
 for(const [key,expected] of [['z',-1],['c',1]]){
  inputState.clear();hits.clear();hits.add(key);
  const {scene,car}=createScene(Math.PI/4);
  scene.vehicleUpdate(.05,scene.player);
  assert.equal(car.indicator,expected);
 }
 inputState.clear();hits.clear();
 assert.ok(drive.includes("b.indicator===-1?'ESQ':'DIR'"));
});
test('nine procedural models use unique physical wheels and no Gemini sprites',()=>{
 const before=art.slice(0,art.indexOf('function carModel('));
 const ctx=vm.createContext({});
 const names=vm.runInContext(before+'; CAR_MODELS.map(m=>m.id);',ctx);
 assert.equal(names.length,9);
 for(const symbol of ['five-hole','offroad','steel','alloy',
   'function carFinish','function carWindow','function carLamp','function carTire'])
  assert.ok(art.includes(symbol),'missing '+symbol);
 assert.doesNotMatch(art,/vehicleDrawSprite/);
});

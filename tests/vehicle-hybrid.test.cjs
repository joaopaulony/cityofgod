'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/vehicle-hybrid.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(
 path.join(root,'assets/vehicles/skyline-1992/manifest.json'),'utf8'));

function scene(responseManifest={...manifest,enabled:true}){
 const draws=[],loaded=[],warnings=[],lamps=[];
 let failBody=false;
 class FakeImage{
  constructor(){this.naturalWidth=1536;this.naturalHeight=1536;}
  set src(value){
   this._src=value;loaded.push(value);
   queueMicrotask(()=>value.endsWith('/body.png')&&failBody
     ?this.onerror():this.onload());
  }
  get src(){return this._src;}
 }
 const context={
  Math,Number,Object,Map,URLSearchParams,location:{search:''},
  console:{warn:(...x)=>warnings.push(x)},
  Image:FakeImage,
  fetch:async()=>({ok:true,json:async()=>responseManifest}),
  cam:{zoom:76,ang:Math.PI/4},
  proj:(x,y)=>({x:x*10,y:y*10}),
  carLamp:(...args)=>lamps.push(args),
  carModel:()=>({len:4.6,w:1.8,hood:1.03,deck:1.02,noseW:.9,tailW:1}),
  carProject:()=>({x:0,y:0})
 };
 vm.createContext(context);
 vm.runInContext(source,context);
 const ctx={
  save(){},restore(){},
  drawImage(...args){draws.push(args);},
  createRadialGradient(){return {addColorStop(){}};},
  transform(){},beginPath(){},arc(){},fill(){},
  imageSmoothingEnabled:false
 };
 return {context,ctx,draws,loaded,warnings,lamps,
  setFailBody(v){failBody=v;},
  run(code){return vm.runInContext(code,context);}
 };
}

test('frame selection follows actual camera + car yaw and wraps cleanly',()=>{
 const s=scene();
 const frame=(a,c,n=16,o=0)=>s.run(
  'vehicleHybridFrameIndex('+[a,c,n,o].join(',')+')');
 assert.equal(frame(0,0),0);
 assert.equal(frame(0,Math.PI/4),2);
 assert.equal(frame(Math.PI/2,Math.PI/2),8);
 assert.equal(frame(0,-Math.PI/2),12);
 assert.equal(frame(Math.PI*2,0),0);
 assert.equal(frame(0,Math.PI*2-Math.PI/32),0);
 assert.equal(frame(0,0,16,Math.PI/2),4);
});

test('pilot manifest is disabled until authentic licensed 3D renders arrive',()=>{
 const s=scene();
 assert.equal(manifest.enabled,false);
 assert.equal(manifest.directions,16);
 assert.equal(manifest.columns*manifest.rows,16);
 assert.equal(manifest.frameWidth*manifest.columns,1536);
 assert.equal(s.run('vehicleHybridValidate('+JSON.stringify(manifest)+').model'),'skyline');
 assert.throws(()=>s.run("vehicleHybridLayerURL('a/b.json','../escape.png')"),/Invalid/);
});

test('manifest disabled means fallback and no missing images downloaded',async()=>{
 const s=scene({...manifest,enabled:false});
 const enabled=await s.run("vehicleHybridLoad('skyline','assets/vehicles/skyline-1992/manifest.json')");
 assert.equal(enabled,false);
 assert.equal(s.loaded.length,0);
 assert.equal(s.run("vehicleHybrid.states.get('skyline')"),'procedural-fallback');
 assert.equal(s.run("vehicleHybridDraw({},{model:'skyline'},0)"),false);
});

test('loads 16-frame PNG layers and draws correct source cell and pivot',async()=>{
 const s=scene();
 const ok=await s.run("vehicleHybridLoad('skyline','assets/vehicles/skyline-1992/manifest.json')");
 assert.equal(ok,true);
 assert.equal(s.run("vehicleHybrid.states.get('skyline')"),'spritesheet-ready');
 const drawn=s.context.vehicleHybridDraw(s.ctx,{
  model:'skyline',x:10,y:20,rot:0,headlights:false,brake:false,
  indicator:0,hazards:false},0);
 assert.equal(drawn,true);
 assert.equal(s.draws.length,2); // shadow + body
 assert.equal(s.draws[1][1],768); // camera 45°, frame 2
 assert.equal(s.draws[1][2],0);
 assert.equal(s.draws[1][3],384);
 assert.equal(s.draws[1][4],384);
 assert.equal(s.draws[1][5],-92); // x=100 - pivot 192
 assert.equal(s.draws[1][6],8); // y=200 - pivot 192
 assert.equal(s.draws[1][7],384);
 assert.equal(s.draws[1][8],384);
 assert.equal(s.lamps.length,0);
});

test('lights are composited only when active and body errors fall back',async()=>{
 const s=scene();
 await s.run("vehicleHybridLoad('skyline','assets/vehicles/skyline-1992/manifest.json')");
 s.context.vehicleHybridDraw(s.ctx,{
  model:'skyline',x:0,y:0,rot:0,headlights:true,brake:true,
  indicator:-1,hazards:false},0);
 assert.equal(s.draws.length,5); // shadow + body + headlights + brake + left
 assert.ok(s.loaded.some(x=>x.endsWith('/right.png')));
 const missing=scene();
 missing.setFailBody(true);
 const ok=await missing.run("vehicleHybridLoad('skyline','assets/vehicles/skyline-1992/manifest.json')");
 assert.equal(ok,false);
 assert.equal(missing.run("vehicleHybrid.atlases.has('skyline')"),false);
 assert.equal(missing.run("vehicleHybrid.states.get('skyline')"),'procedural-fallback');
});

test('HTML and game route car rendering through the hybrid layer',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const houses=fs.readFileSync(path.join(root,'js/houses.js'),'utf8');
 const game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
 assert.ok(html.indexOf('js/vehicle-art.js')<html.indexOf('js/vehicle-hybrid.js'));
 assert.ok(html.indexOf('js/vehicle-hybrid.js')<html.indexOf('js/vehicle-drive.js'));
 assert.match(houses,/if\(vehicleHybridDraw\(g,b,T\)\)return/);
 assert.match(houses,/return carDraw\(g,b,T,world\.night\)/);
 assert.match(game,/vehicleHybridInit\(\)/);
 assert.match(source,/function vehicleHybridBuildDemo\(/);
});

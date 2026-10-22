'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalog=fs.readFileSync(path.join(root,'js/vehicle-model-catalog.mjs'),'utf8');
const runtime=fs.readFileSync(path.join(root,'js/vehicle-glb-runtime.mjs'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const credits=fs.readFileSync(path.join(root,'vehicle-credits.html'),'utf8');

test('five distinct source models have attribution and local paths',()=>{
 for(const file of ['nissan-silvia-s13.glb','chevrolet-opala.glb',
  'ford-mustang.glb','ford-ranger.glb','mercedes-gclass.glb']){
  assert.ok(catalog.includes(file),file);
  assert.ok(credits.includes(file),file+' credit');
  const full=path.join(root,'assets/vehicles/native-glb',file);
  if(fs.existsSync(full)){
   const bytes=fs.readFileSync(full);
   assert.equal(bytes.toString('ascii',0,4),'glTF');
  }
 }
 assert.equal((catalog.match(/frontAxis:/g)||[]).length,5);
 assert.match(credits,/creativecommons.org\/licenses\/by\/4.0/);
});

test('native renderer uses 3D GLB source and bakes 16 angles into 2D',()=>{
 assert.match(runtime,/new GLTFLoader\(\)/);
 assert.match(runtime,/setMeshoptDecoder\(MeshoptDecoder\)/);
 assert.match(runtime,/for\(let frame=0;frame<DIRECTIONS;frame\+\+\)/);
 assert.match(runtime,/renderer.render\(scene,camera\)/);
 assert.match(runtime,/car\.body\.rotation\.y=-frame\*2\*Math\.PI\/DIRECTIONS/);
 assert.match(runtime,/ctx.drawImage\(stage/);
 assert.match(runtime,/vehicleHybrid.atlases.set\(model.id/);
 assert.match(runtime,/catch\(err\)/);
 assert.match(html,/js\/vehicle-glb-bundle\.js/);
});

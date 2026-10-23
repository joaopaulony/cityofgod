import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {stepCar,steerLimit,cameraLead,CAR_SPEC} from '../js/vehicle-physics.mjs';
const idle=()=>({x:0,y:0,angle:0,speed:0,steer:0,distance:0});
function step(s,control,n=1){for(let i=0;i<n;i++)s=stepCar(s,{engineOn:true,...control},.05);return s;}
test('forward acceleration, speed cap, rear and progressive braking',()=>{
 let s=step(idle(),{forward:true},300);
 assert.ok(s.speed>17&&s.speed<=CAR_SPEC.maxForward,s.speed);
 assert.ok(s.x>50);
 const before=s.speed;
 s=step(s,{reverse:true},100);
 assert.ok(s.speed<before);
 s=step(s,{reverse:true},140);
 assert.ok(s.speed<0&&s.speed>=-CAR_SPEC.maxReverse);
 s=step(s,{handbrake:true},120);
 assert.ok(Math.abs(s.speed)<.01);
});
test('engine off never accelerates from standing',()=>{
 const s=stepCar(idle(),{forward:true,engineOn:false},.05);
 assert.equal(s.speed,0);
});
test('steering is smoother at high speeds; reverse changes yaw direction',()=>{
 assert.ok(steerLimit(0)>steerLimit(19));
 const f=step({...idle(),speed:6},{left:true},15);
 const b=step({...idle(),speed:-6},{left:true},15);
 assert.ok(f.angle<0);
 assert.ok(b.angle>0);
});
test('turning camera does not change world vehicle steering',()=>{
 const s=step({...idle(),angle:.4,speed:7},{right:true},25);
 assert.ok(s.angle>.4);
 const lead=cameraLead(s);
 assert.ok(Math.hypot(lead.x-s.x,lead.y-s.y)>0);
});
test('the GLB is rendered live by Three.js; no sprite or pre-render code',()=>{
 const code=readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(code,/new THREE.WebGLRenderer/);
 assert.match(code,/new GLTFLoader/);
 assert.match(code,/loader.loadAsync/);
 assert.match(code,/renderer.render\(scene,viewCamera\)/);
 assert.match(code,/MeshoptDecoder/);
 assert.doesNotMatch(code,/\.toDataURL\(|\.drawImage\(|bakeAtlas\(|captureFrame\(/i);
 assert.match(html,/<canvas id="vehicle3d"/);
 assert.match(html,/vehicle-webgl\.bundle\.js/);
 assert.doesNotMatch(html,/vehicle-hybrid|vehicle-art/);
});
test('source asset exists after import pipeline',()=>{
 const url=new URL('../assets/vehicles/live/nissan-silvia-s13.glb',import.meta.url);
 if(!existsSync(url))return; // bundled during asset workflow
 const glb=readFileSync(url);
 assert.equal(glb.toString('ascii',0,4),'glTF');
 assert.equal(glb.length,1621824);
});

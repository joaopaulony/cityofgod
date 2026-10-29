import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createVehicleDamage,registerCrash,damageTier,collisionPanel,engineEfficiency,repairVehicleDamage} from '../js/vehicle-damage.mjs';
import {createVehicleDeformation} from '../js/vehicle-deformation.mjs';
import {sweepCar} from '../js/vehicle-collision.mjs';

test('low-speed parking taps do not damage, higher-speed impacts consume integrity',()=>{
 const state=createVehicleDamage();
 assert.equal(registerCrash(state,{kind:'object'},1,1,'front'),null);
 assert.equal(state.integrity,1);
 const hit=registerCrash(state,{kind:'object'},14,2,'front');
 assert.ok(hit.lost>.1&&hit.lost<.4);
 assert.ok(state.integrity<1);
 assert.ok(state.front>0);
 assert.equal(state.rear,0);
 assert.equal(state.impacts,1);
});
test('collision cooldown prevents repeated damage from a bumper touching a wall',()=>{
 const state=createVehicleDamage();
 const first=registerCrash(state,{kind:'house'},14,2,'front');
 assert.ok(first);
 assert.equal(registerCrash(state,{kind:'house'},14,2.08,'front'),null);
 assert.equal(state.impacts,1);
 assert.ok(registerCrash(state,{kind:'house'},14,3,'front'));
 assert.equal(state.impacts,2);
});
test('damage zones depend on obstacle direction and rear impacts',()=>{
 const car={x:10,y:10,angle:0,length:4.7,width:1.9,speed:10};
 assert.equal(collisionPanel(car,{object:{x:15,y:10}}),'front');
 assert.equal(collisionPanel(car,{object:{x:5,y:10}}),'rear');
 assert.equal(collisionPanel(car,{object:{x:10,y:15}}),'left');
 assert.equal(collisionPanel(car,{object:{x:10,y:5}}),'right');
 assert.equal(collisionPanel({...car,speed:-5},{kind:'house'}),'rear');
});
test('progressive engine wear and full breakdown below threshold',()=>{
 const dmg=createVehicleDamage();
 assert.equal(damageTier(dmg),'healthy');
 assert.equal(engineEfficiency(dmg),1);
 dmg.integrity=.3;
 assert.equal(damageTier(dmg),'smoking');
 assert.ok(engineEfficiency(dmg)<1);
 dmg.integrity=.2;
 assert.equal(damageTier(dmg),'critical');
 assert.equal(engineEfficiency(dmg),.26);
 dmg.integrity=.05;
 assert.equal(damageTier(dmg),'destroyed');
 assert.equal(engineEfficiency(dmg),0);
 repairVehicleDamage(dmg);
 assert.equal(dmg.integrity,1);
 assert.equal(dmg.front,0);
 assert.equal(dmg.impacts,0);
});
test('real swept car collisions continue stopping on solid parked cars',()=>{
 const w={segs:[],circles:[],mapSize:160};
 const parked={kind:'parkedcar',x:22,y:20,w:4.6,d:2,rot:0,solid:true};
 const opts={boxes:[parked],houses:[],mapSize:160};
 const from={x:15,y:20,angle:0,length:4.6,width:2,speed:13};
 const to={...from,x:26};
 const c=sweepCar(w,from,to,opts);
 assert.equal(c.impact.kind,'object');
 assert.equal(c.impact.object,parked);
 assert.ok(c.position.x<22);
});
test('crumple GLB body, preserve tyres and shared source mesh, then undo deformation',()=>{
 const root=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.5,4.5,6,3,10),new THREE.MeshStandardMaterial());
 body.name='BodyShell';root.add(body);
 const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.2,12),new THREE.MeshStandardMaterial());
 wheel.name='Wheel_FL';wheel.position.set(.82,-.4,1.55);root.add(wheel);
 const originalBody=body.geometry,orig=new Float32Array(originalBody.attributes.position.array);
 const originalWheel=wheel.geometry,wheelOrig=new Float32Array(wheel.geometry.attributes.position.array);
 const deform=createVehicleDeformation(THREE,root,{id:'sedan',front:'+Z'});
 assert.ok(deform.meshes>=1);
 assert.notEqual(body.geometry,originalBody);
 const changed=deform.apply({front:.75,rear:0,left:0,right:0});
 assert.ok(changed>0);
 assert.notDeepEqual([...body.geometry.attributes.position.array],[...orig]);
 assert.deepEqual([...originalBody.attributes.position.array],[...orig]);
 assert.equal(wheel.geometry,originalWheel);
 assert.deepEqual([...wheel.geometry.attributes.position.array],[...wheelOrig]);
 deform.apply({front:0,rear:0,left:0,right:0});
 assert.ok([...body.geometry.attributes.position.array].every((v,i)=>Math.abs(v-orig[i])<1e-5));
 deform.dispose();
 assert.equal(body.geometry,originalBody);
});
test('front-state strips untrusted save fields and preserves only bounded vehicle damage',()=>{
 const state=readFileSync(new URL('../js/front-state.js',import.meta.url),'utf8');
 const source=state.slice();
 const fn=new Function('window','globalThis','module',source);
 const window={};fn(window,{}, {exports:{}});
 const data={version:1,mode:'open',seed:123,x:20,y:20,floor:0,clock:80,
  vehicle:{key:'unit',modelId:'sedan',angle:0,fuel:.6,
   damage:{integrity:.31,impacts:300,front:.8,rear:.15,left:0,right:0,poison:'forbidden'}}};
 const out=window.CityFrontState.checkpoint(data);
 assert.equal(out.vehicle.damage.integrity,.31);
 assert.equal(out.vehicle.damage.impacts,300);
 assert.equal(out.vehicle.damage.front,.8);
 assert.equal('poison' in out.vehicle.damage,false);
});
test('driving, parked car smoke and repair are connected without disabling 3D wheels/lights',()=>{
 const source=readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 const park=readFileSync(new URL('../js/parked-3d.mjs',import.meta.url),'utf8');
 for(const re of [/registerCrash\(/,/engineEfficiency\(/,/refreshDeformation\(/,/damageFX\?\.crash\(/,
  /damageFX\?\.smoke\(/,/system\.repairVehicle=/,/parkAndExit\(/,/damage:\{integrity:damage\.integrity/])
  assert.match(source,re);
 for(const re of [/createVehicleDeformation\(/,/entry\.damageView\?\.dispose\(/,/damageFX\?\.smoke\(/])
  assert.match(park,re);
});

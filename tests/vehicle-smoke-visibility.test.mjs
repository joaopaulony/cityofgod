import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createVehicleDamageEffects,smokeIntensityForIntegrity,hoodSmokeEmitters} from '../js/vehicle-damage-effects.mjs';
import {damageTier} from '../js/vehicle-damage.mjs';

test('smoke starts at 72%, increases progressively and becomes thick under 25%',()=>{
 assert.equal(smokeIntensityForIntegrity(1),0);
 assert.equal(smokeIntensityForIntegrity(.73),0);
 assert.ok(smokeIntensityForIntegrity(.72)>.05);
 assert.equal(damageTier({integrity:.72}),'smoking');
 assert.ok(smokeIntensityForIntegrity(.5)>.4);
 assert.ok(smokeIntensityForIntegrity(.25)>.8);
 assert.equal(smokeIntensityForIntegrity(.1),1);
 assert.equal(smokeIntensityForIntegrity({integrity:.1}),1);
 assert.equal(smokeIntensityForIntegrity(Number.NaN),0);
});

test('emission positions stay at front of vehicle and mirror across bonnet',()=>{
 const p=hoodSmokeEmitters(10,20,0,5);
 assert.equal(p.length,2);
 assert.ok(Math.abs(p[0][0]-11.45)<.001);
 assert.ok(Math.abs(p[1][0]-11.45)<.001);
 assert.ok(p[0][1]>20&&p[1][1]<20);
 assert.ok(Math.abs(p[0][1]+p[1][1]-40)<.001);
 const turns=hoodSmokeEmitters(10,20,Math.PI/2,5);
 assert.ok(Math.abs(turns[0][1]-21.45)<.001);
 assert.ok(Math.abs(turns[1][1]-21.45)<.001);
 assert.notDeepEqual(turns[0],turns[1]);
});

test('two smoke emitters actually create dense, visible GPU sprites without unlimited allocation',()=>{
 const doc=globalThis.document;
 globalThis.document={createElement:()=>({
  width:96,height:96,
  getContext:()=>({fillStyle:null,createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})
 })};
 try{
  const scene=new THREE.Scene(),fx=createVehicleDamageEffects(THREE,scene);
  assert.equal(fx.stats().capacity,160);
  for(let i=0;i<55;i++){
   fx.update(.06);
   fx.smoke('left',0,0,1,.06,1.1);
   fx.smoke('right',.5,0,1,.06,1.1);
  }
  const stats=fx.stats();
  assert.ok(stats.visibleSmoke>=35,JSON.stringify(stats));
  assert.ok(stats.visibleSmoke<=160);
  assert.equal(stats.visibleSparks,0);
  assert.equal(stats.emitters,2);
  const sprites=scene.children.filter(s=>s.isSprite&&s.visible);
  assert.ok(sprites.length>=35);
  assert.ok(sprites.some(s=>s.scale.x>.9));
  assert.ok(sprites.some(s=>s.material.opacity>.4));
  assert.ok(sprites.every(s=>s.material.depthWrite===false));
  fx.dispose();
  assert.equal(scene.children.length,0);
 }finally{globalThis.document=doc;}
});
test('both playable and parked cars use dual hood emitters and preserved GPU budget',()=>{
 const drive=readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 const park=readFileSync(new URL('../js/parked-3d.mjs',import.meta.url),'utf8');
 assert.match(drive,/smokeIntensityForIntegrity\(damage.integrity\)/);
 assert.match(drive,/hoodSmokeEmitters\(state.x,state.y,state.angle,activeModel.length\)/);
 assert.match(drive,/smoke\('driver:hood:'\+i/);
 assert.match(park,/smokeIntensityForIntegrity\(b.damage.integrity\)/);
 assert.match(park,/hoodSmokeEmitters\(b.x,b.y,b.rot\|\|0/);
 assert.match(park,/smokingCars<4/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CIVIL_PACK_EXPECTED,VEHICLE_MODELS} from '../js/vehicle-catalog.mjs';
import {computeVehicleLightState,vehicleLightPositions} from '../js/vehicle-lights.mjs';
test('ten civil-service vehicle specs have unique IDs and remain disabled until GLBs exist',()=>{
 assert.equal(CIVIL_PACK_EXPECTED.length,10);
 assert.equal(new Set(CIVIL_PACK_EXPECTED.map(x=>x.id)).size,10);
 for(const v of CIVIL_PACK_EXPECTED){
  assert.ok(v.file.endsWith('.glb'));assert.ok(v.length>=4&&v.width>1&&v.height>1);
  assert.ok(v.sourceTriangles>0);
  if(!existsSync(new URL('../assets/vehicles/live/'+v.file,import.meta.url)))
   assert.equal(VEHICLE_MODELS.some(x=>x.id===v.id),false);
 }
});
test('low/high beam, brake, tail and reverse work independently',()=>{
 const a=computeVehicleLightState({headlights:true},0);
 assert.equal(a.lowBeam,true);assert.equal(a.tail,true);assert.equal(a.brake,false);
 const b=computeVehicleLightState({braking:true,reversing:true},0);
 assert.equal(b.tail,false);assert.equal(b.brake,true);assert.equal(b.reverse,true);
 assert.equal(computeVehicleLightState({headlights:true,highBeams:true},0).highBeam,true);
 assert.equal(computeVehicleLightState({highBeams:true},0).highBeam,false);
});
test('left, right, hazard flash in sync and roof beacons alternate',()=>{
 assert.equal(computeVehicleLightState({signal:'left'},0).left,true);
 assert.equal(computeVehicleLightState({signal:'left'},0).right,false);
 assert.equal(computeVehicleLightState({signal:'left'},.35).left,false);
 assert.equal(computeVehicleLightState({signal:'hazard'},0).right,true);
 assert.equal(computeVehicleLightState({signal:'hazard'},.35).right,false);
 assert.equal(computeVehicleLightState({emergencyLights:true},0,'red-blue').beaconLeft,true);
 assert.equal(computeVehicleLightState({emergencyLights:true},.18,'red-blue').beaconRight,true);
 assert.equal(computeVehicleLightState({emergencyLights:true},0,'none').beaconLeft,false);
});
test('front/rear and roof mounts use correct 3D orientation',()=>{
 const p=vehicleLightPositions({length:5},2,1.5);
 assert.ok(p.frontLeft[0]>0&&p.rearLeft[0]<0);
 assert.ok(p.frontLeft[2]<0&&p.frontRight[2]>0);
 assert.ok(p.roofLeft[1]>1.5);
});

test('Three.js fixtures change lamps independently and parked cars use no SpotLights',async()=>{
 const THREE=await import('three');
 const {createVehicleLights}=await import('../js/vehicle-lights.mjs');
 const car=new THREE.Group();
 const fx=createVehicleLights(THREE,car,{length:4.8,beacon:'red-blue'},{width:1.9,height:1.5});
 assert.equal(car.children.length,1);
 assert.equal(fx.group.children.filter(x=>x.isSpotLight).length,2);
 const active=fx.apply({headlights:true,braking:true,signal:'hazard',emergencyLights:true},0);
 assert.equal(active.left,true);assert.equal(active.right,true);
 assert.equal(fx.lamps.frontMainLeft.material.color.getHex(),0xffeed0);
 assert.equal(fx.lamps.rearMainLeft.material.color.getHex(),0xff2020);
 assert.equal(fx.lamps.frontTurnRight.material.color.getHex(),0xffb021);
 assert.equal(fx.lamps.beaconLeft.material.color.getHex(),0xff2424);
 fx.apply({headlights:false,signal:'off',braking:false},.35);
 assert.equal(fx.lamps.rearMainLeft.material.color.getHex(),0x491414);
 fx.dispose();assert.equal(car.children.length,0);
 const parked=new THREE.Group();
 const stop=createVehicleLights(THREE,parked,{length:5,beacon:'amber'},{width:2,height:1.5,parked:true});
 assert.equal(stop.group.children.filter(x=>x.isSpotLight).length,0);
 stop.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {createVehicleLights,vehicleLightPositions} from '../js/vehicle-lights.mjs';
import {POLICE_SUV_EXPECTED,CIVIL_PACK_EXPECTED} from '../js/vehicle-catalog.mjs';
const cfg=POLICE_SUV_EXPECTED;
test('police SUV emergency lights use the artist original lens coordinates',()=>{
 const p=vehicleLightPositions(cfg,cfg.width,cfg.height);
 assert.deepEqual(p.roofLeft,[-.259,1.74,-.402]);
 assert.deepEqual(p.roofRight,[-.259,1.74,.407]);
 assert.equal(cfg.front,'+Z');assert.equal(cfg.wheelCount,4);
 assert.equal(cfg.beacon,'red-blue');
});
test('artist beacon lenses flash independently without modifying shared materials',()=>{
 const root=new THREE.Group();
 const red=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xdd1515}));
 const blue=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x146aff}));
 red.name=cfg.beaconNativeMeshes.red;blue.name=cfg.beaconNativeMeshes.blue;
 root.add(red,blue);
 const originalRed=red.material,originalBlue=blue.material;
 const body=new THREE.Group();body.add(root);
 const lights=createVehicleLights(THREE,body,cfg,{root,width:cfg.width,height:cfg.height});
 assert.equal(lights.lamps.beaconLeft,undefined,'Do not cover original red lens with a fake bar');
 assert.equal(lights.lamps.beaconRight,undefined,'Do not cover original blue lens with a fake bar');
 assert.equal(lights.group.children.filter(x=>x.isPointLight).length,2);
 assert.notEqual(red.material,originalRed);
 let state=lights.apply({emergencyLights:true},0);
 assert.equal(state.beaconLeft,true);assert.equal(state.beaconRight,false);
 assert.ok(red.material.emissiveIntensity>0);assert.equal(blue.material.emissiveIntensity,0);
 state=lights.apply({emergencyLights:true},.18);
 assert.equal(state.beaconLeft,false);assert.equal(state.beaconRight,true);
 assert.equal(red.material.emissiveIntensity,0);assert.ok(blue.material.emissiveIntensity>0);
 assert.equal(originalRed.emissiveIntensity,1,'Shared original material must be unchanged');
 lights.dispose();
 assert.equal(red.material,originalRed);assert.equal(blue.material,originalBlue);
});
test('prior emergency/service models use independently measured optic positions',()=>{
 const ids=['police-sedan','fire-truck','ambulance','tow-truck','garbage-truck','school-bus','service-truck'];
 for(const id of ids){
  const model=CIVIL_PACK_EXPECTED.find(v=>v.id===id);
  assert.ok(model?.beaconAnchors,id);
  const pos=vehicleLightPositions(model,model.width,model.height);
  assert.deepEqual(pos.roofLeft,model.beaconAnchors.left);
  assert.deepEqual(pos.roofRight,model.beaconAnchors.right);
 }
});
test('uploaded police SUV GLB must retain four wheel rigs and native siren geometry',()=>{
 const path=new URL('../assets/vehicles/live/police-suv.glb',import.meta.url);
 if(!existsSync(path))return;
 const buf=readFileSync(path);
 assert.equal(buf.toString('ascii',0,4),'glTF');
 const doc=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString('utf8'));
 assert.equal(doc.asset.extras.wheelCount,4);
 assert.equal(doc.asset.extras.cityOfGodModelId,'police-suv');
 assert.ok(doc.nodes.some(n=>n.extras?.beaconLens==='red'));
 assert.ok(doc.nodes.some(n=>n.extras?.beaconLens==='blue'));
});

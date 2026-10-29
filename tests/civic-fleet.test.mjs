import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CIVIC_FLEET_POLICY,preferredCivicModel,syncCivicFleetParking} from '../js/civic-fleet.mjs';
import {getVehicleAssignment} from '../js/vehicle-classification.mjs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED,POLICE_SUV_EXPECTED} from '../js/vehicle-catalog.mjs';

function makeCampus(kind){
 const campus={kind,id:'civic-'+kind,x:100,y:200,
  floors:2,color:'#abc',reserved:'TESTE',spaces:kind==='military'?4:kind==='police'?3:2,
  bb:[73,136,127,200]};
 const boxes=[],houses=[],world={civicSites:[campus],paved:[],decals:[],lamps:[]};
 const context={
  COG:{},world,boxes,houses,
  addHouse:spec=>{const H={...spec,style:{},doorPt:[100,spec.y1]};houses.push(H);return H;},
  remodelProperty:()=>{},owSeed:()=>12345,
  addBox:b=>{boxes.push(b);return b;},miaCar:()=>null,
  chainLine:()=>{},owIndexOwnedLive:()=>{},Math
 };
 vm.runInNewContext(readFileSync(new URL('../js/civic.js',import.meta.url),'utf8'),context);
 vm.runInContext('civicPlaceSector({bounds:[0,0,256,256]})',context);
 return {boxes,houses,world,campus,slots:boxes.filter(b=>b.civicFleetBay)};
}
test('all campus parking spawns are inside actual existing campus sites with stable location',()=>{
 const groups={police:3,hospital:1,cityhall:1,school:1,military:0};
 for(const [kind,count] of Object.entries(groups)){
  const first=makeCampus(kind),second=makeCampus(kind);
  assert.equal(first.houses.length,1,kind+' must really exist before vehicles');
  assert.equal(first.slots.length,count,kind);
  assert.deepEqual(first.slots.map(v=>[v.x,v.y,v.vehicleKey]),second.slots.map(v=>[v.x,v.y,v.vehicleKey]));
  for(const b of first.slots){
   assert.equal(b.kind,'parkedcar');
   assert.equal(b.fleetHidden,true,'never draw an unimported vehicle');
   assert.equal(b.street,true,'protected civic parking bay during street cleanup');
   assert.ok(b.x>first.campus.bb[0]&&b.x<first.campus.bb[2]);
   assert.ok(b.y>first.campus.bb[1]&&b.y<first.campus.bb[3]);
   assert.equal(b.emergencyLights,undefined,'stationary siren off by default');
   assert.equal(b.modelId,null,'asset is only selected after active manifest loads');
   assert.equal(b.vehicleKey,'civic:'+first.campus.id+':'+b.civicBayIndex);
  }
 }
});
test('only ACTIVE matching department GLBs spawn; missing facilities do not spawn generic cars',()=>{
 const active=VEHICLE_MODELS.filter(m=>m.id==='police-suv');
 assert.equal(active.length,1,'SUV asset must actually be installed');
 for(const kind of ['police','hospital','cityhall','school','military']){
  const world=makeCampus(kind),fleet={taken:new Set()};
  const result=syncCivicFleetParking(world.boxes,active,fleet);
  assert.equal(result.activated,kind==='police'?3:0,kind);
  for(const b of world.slots){
   if(kind==='police'){
    assert.equal(b.modelId,'police-suv');
    assert.equal(b.fleetHidden,false);
    assert.equal(b.solid,true);
    assert.equal(getVehicleAssignment(b.modelId).department,'police');
   }else{
    assert.equal(b.modelId,null);
    assert.equal(b.fleetHidden,true);
   }
  }
 }
 assert.equal(preferredCivicModel('fire','civic-fire',0,new Set(['fire-truck'])),null);
 assert.equal(preferredCivicModel('tow','civic-tow',0,new Set(['tow-truck'])),null);
 assert.equal(preferredCivicModel('military','civic-military',0,new Set()),null);
});
test('hospital, school and city hall activate the correct kind when corresponding original GLBs are imported',()=>{
 const available=[POLICE_SUV_EXPECTED,...CIVIL_PACK_EXPECTED];
 for(const [kind,expected] of [['hospital','ambulance'],['cityhall','service-truck'],['school','school-bus']]){
  const campus=makeCampus(kind);
  syncCivicFleetParking(campus.boxes,available,{taken:new Set()});
  assert.equal(campus.slots[0].modelId,expected);
  assert.equal(campus.slots[0].fleetHidden,false);
  assert.equal(campus.slots[0].emergencyLights,false,'spawns with siren off');
 }
});
test('claimed unit stays hidden across sector unload and regeneration and does not respawn',()=>{
 const first=makeCampus('police'),available=[POLICE_SUV_EXPECTED];
 const fleet={taken:new Set()};
 syncCivicFleetParking(first.boxes,available,fleet);
 const taken=first.slots[0];
 assert.equal(taken.fleetHidden,false);
 fleet.taken.add(taken.vehicleKey);
 let result=syncCivicFleetParking(first.boxes,available,fleet);
 assert.equal(result.hidden,1);assert.equal(taken.fleetHidden,true);assert.equal(taken.solid,false);
 const newSector=makeCampus('police');
 result=syncCivicFleetParking(newSector.boxes,available,fleet);
 assert.equal(result.activated,2);
 assert.equal(newSector.slots[0].fleetHidden,true);
 assert.equal(newSector.slots[0].modelId,null);
 assert.equal(newSector.slots[1].modelId,'police-suv');
 assert.equal(syncCivicFleetParking(newSector.boxes,available,fleet).activated,0,'no duplication on subsequent frames');
});
test('police sedans and SUVs alternate reproducibly once both GLBs are ready',()=>{
 const set=new Set(['police-suv','police-sedan']);
 const ids=[0,1,2].map(i=>preferredCivicModel('police','civic-police',i,set));
 assert.ok(ids.includes('police-suv'));assert.ok(ids.includes('police-sedan'));
 assert.deepEqual(ids,[0,1,2].map(i=>preferredCivicModel('police','civic-police',i,set)));
 assert.equal(CIVIC_FLEET_POLICY.police.department,'police');
 assert.equal(CIVIC_FLEET_POLICY.hospital.department,'health');
});

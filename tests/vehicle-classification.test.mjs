import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED,VEHICLE_DIRECTORY} from '../js/vehicle-catalog.mjs';
import {CIVILIAN_VEHICLE_IDS,PROFESSIONAL_VEHICLE_ROLES,
 getVehicleAssignment,buildVehicleDirectory} from '../js/vehicle-classification.mjs';

test('all 21 cars have a unique and explicit civilian / profession classification',()=>{
 assert.deepEqual(VEHICLE_DIRECTORY.unknown,[]);
 assert.equal(VEHICLE_DIRECTORY.total,21);
 assert.equal(VEHICLE_DIRECTORY.civilian,11);
 assert.equal(VEHICLE_DIRECTORY.professional,10);
 assert.equal(new Set(CIVILIAN_VEHICLE_IDS).size,11);
 assert.equal(Object.keys(PROFESSIONAL_VEHICLE_ROLES).length,10);
 const all=VEHICLE_DIRECTORY.groups.flatMap(g=>g.vehicles);
 assert.equal(new Set(all.map(v=>v.id)).size,21);
 for(const entry of all){
  assert.equal(entry.ownership,entry.department==='civil'?'private':'employer');
  assert.equal(entry.forSale,entry.department==='civil'&&entry.ready);
  assert.equal(entry.professionEnabled,false);
 }
});
test('public safety, roadside, municipal and transportation are distinctly assigned',()=>{
 const department=id=>getVehicleAssignment(id)?.department;
 assert.equal(department('police-sedan'),'police');
 assert.equal(department('fire-truck'),'fire');
 assert.equal(department('ambulance'),'health');
 assert.equal(department('tow-truck'),'roadside');
 assert.equal(department('service-truck'),'roadside');
 assert.equal(department('garbage-truck'),'municipal');
 assert.equal(department('postal-van'),'logistics');
 for(const id of ['taxi','city-bus','school-bus'])assert.equal(department(id),'transport');
 assert.equal(department('silvia'),'civil');
 assert.equal(getVehicleAssignment('unreviewed-police-car'),null);
});
test('professional vehicles do not become civilian when imported',()=>{
 const police=CIVIL_PACK_EXPECTED.find(x=>x.id==='police-sedan');
 const d=buildVehicleDirectory([...VEHICLE_MODELS,police],CIVIL_PACK_EXPECTED);
 const p=d.groups.find(g=>g.id==='police').vehicles[0];
 assert.equal(p.ready,true);assert.equal(p.forSale,false);
 assert.equal(p.ownership,'employer');assert.equal(d.total,21);
});
test('retail remains private and the app shows profession directory without buy buttons',()=>{
 const apps=readFileSync(new URL('../js/city-apps.js',import.meta.url),'utf8');
 const sim=readFileSync(new URL('../js/city-sim.js',import.meta.url),'utf8');
 const view=apps.slice(apps.indexOf("if(app==='cars')"),apps.indexOf("if(app==='settings')"));
 assert.match(view,/Object.entries\(CitySim.CARS\)/);
 assert.match(view,/fleetDirectory/);
 assert.match(view,/não são vendidas aqui/);
 const retail=sim.slice(sim.indexOf('const CARS = {'),sim.indexOf('const SERVICES = {'));
 for(const v of CIVIL_PACK_EXPECTED){
  assert.equal(retail.includes(v.id+':'),false,'Profession sold through AutoShow: '+v.id);
 }
});

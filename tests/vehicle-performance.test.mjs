import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VEHICLE_MODELS} from '../js/vehicle-catalog.mjs';
import {chooseVehicleLOD,classifyVehicleDetail,trianglesForGeometry} from '../js/vehicle-lod.mjs';
import {analyzeGLB} from '../tools/audit-vehicle-assets.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('LOD mantém rodas e carroceria GLB originais, sem troca por caixas',()=>{
 assert.equal(chooseVehicleLOD(10),'high');
 assert.equal(chooseVehicleLOD(40),'medium');
 assert.equal(chooseVehicleLOD(90),'low');
 assert.equal(classifyVehicleDetail('wheel_fl',0.00001),0);
 assert.equal(classifyVehicleDetail('Body',0.00001),0);
 assert.equal(classifyVehicleDetail('door_handle',0.0001),2);
 assert.equal(classifyVehicleDetail('exhaust',0.002),1);
 assert.equal(trianglesForGeometry({index:{count:300}}),100);
});
test('cada GLB tem métricas reais de triângulos e tamanho',()=>{
 for(const cfg of VEHICLE_MODELS){
  const buffer=readFileSync(new URL('../assets/vehicles/live/'+cfg.file,import.meta.url));
  const result=analyzeGLB(buffer,cfg.file);
  assert.equal(result.bytes,buffer.length);
  assert.ok(result.triangles>0,cfg.id+' não tem triângulos');
  assert.ok(result.drawCalls>0,cfg.id+' não tem meshes');
 }
});
test('estacionados não pré-carregam a frota nem desenham carros 2D sob GLB',()=>{
 const parked=read('../js/parked-3d.mjs');
 const miami=read('../js/miami-city.js');
 const active=read('../js/vehicle-webgl.mjs');
 assert.match(parked,/loadVehicleGLB\(/);
 assert.match(parked,/chooseVehicleLOD\(/);
 assert.doesNotMatch(parked,/for\s*\(const id of POOL\)/);
 assert.match(miami,/vehicle\?\.renderer/);
 assert.match(miami,/b\.vehicleModelFailed/);
 assert.match(active,/loadVehicleGLB\(choice\)/);
});

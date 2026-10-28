import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {setNPCRegions,createNPCPaletteMaterial,applyNPCVisual} from '../js/cas-npc-visual.mjs';

const code=readFileSync(new URL('../js/npc-population.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(code,context);
const population=context.CityPopulation;
test('generator is deterministic and supports many distinct residents',()=>{
 const a=Array.from({length:120},(_,i)=>population.makeResidentSpec(i,'same-block'));
 const b=Array.from({length:120},(_,i)=>population.makeResidentSpec(i,'same-block'));
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
 assert.equal(new Set(a.map(x=>x.id)).size,a.length);
 assert.ok(new Set(a.map(x=>x.name)).size>70);
 assert.ok(new Set(a.map(x=>x.top)).size>=8);
 assert.ok(new Set(a.map(x=>x.skin)).size>=6);
 assert.ok(new Set(a.map(x=>x.height)).size>35);
 assert.ok(a.some(x=>x.sex==='female')&&a.some(x=>x.sex==='male'));
 for(const x of a){
  assert.ok(x.age>=18&&x.age<=70);
  assert.ok(x.height>=.89&&x.height<=1.11);
  assert.ok(x.build>=.86&&x.build<=1.15);
  for(const k of ['skin','top','bottom','shoes','accent'])assert.match(x[k],/^#[0-9a-f]{6}$/i);
 }
});
test('resident spawner uses home positions, caps crowd and does not mutate houses',()=>{
 const houses=Array.from({length:20},(_,i)=>({front:[12+i*4,28+i*3],doorN:[1,0]}));
 const snapshot=JSON.stringify(houses);
 const makeActor=x=>({...x});
 const args={count:100,seed:'test-city',houses,fallback:[10,10],makeActor};
 const crowd=population.createResidents(args);
 assert.equal(crowd.length,24);
 assert.equal(new Set(crowd.map(n=>n.population.id)).size,24);
 for(const resident of crowd){
  assert.ok(Array.isArray(resident.home)&&resident.home.length===4);
  assert.equal(resident.armed,false);
  assert.equal(resident.name,resident.population.name);
  assert.ok(resident.x>=0&&resident.y>=0);
 }
 assert.equal(JSON.stringify(houses),snapshot);
 const repeat=population.createResidents(args);
 assert.deepEqual(JSON.parse(JSON.stringify(crowd)),JSON.parse(JSON.stringify(repeat)));
});
test('palette region attribute uses shared geometry, valid weights and separate materials',()=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,1,1,0,0,1,0],3));
 geometry.setIndex([0,1,2,0,2,3]);
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0, 1,0,0,0, 2,0,0,0, 3,0,0,0],4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
 const bones=['Head','Spine','LeftUpLeg','LeftFoot'].map(name=>{const b=new THREE.Bone();b.name=name;return b});
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());
 mesh.bind(new THREE.Skeleton(bones));
 assert.equal(setNPCRegions(mesh),true);
 const masks=geometry.getAttribute('npcRegions');
 assert.equal(masks.count,4);
 for(let i=0;i<4;i++)assert.equal(masks.array[i*4+i],1);
 assert.equal(setNPCRegions(mesh),true);
 const one=population.makeResidentSpec(1);
 const original=mesh.material;
 const material=createNPCPaletteMaterial(original,one);
 assert.notEqual(material,original);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};
 material.onBeforeCompile(shader);
 assert.ok(shader.vertexShader.includes('npcRegions'));
 assert.ok(shader.fragmentShader.includes('npcTint'));
 assert.equal(Object.keys(shader.uniforms).filter(k=>k.startsWith('npc')).length,4);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Three from 'three';
import {createRequire} from 'node:module';
import {createArchitecture3D} from '../js/architecture-3d.mjs';
const A=createRequire(import.meta.url)('../js/architecture-plan.js');

test('actual 3D sash instances slide vertically, and furnished balconies survive cutaway',()=>{
 const old=globalThis.window;globalThis.window={};
 try{
  // Network-free geometry test: the real Three geometry/matrices are retained.
  const THREE={...Three,TextureLoader:class{load(){return new Three.Texture();}}};
  const plan=A.makePlan({width:18,depth:14,kind:'mansion',floors:2,seed:71});
  Object.assign(plan,{angle:0,toWorld:(x,y)=>[x,y]});
  const openings=plan.levels.flatMap(l=>l.walls.filter(w=>w.ext).flatMap(w=>w.openings));
  for(const o of openings)o.segment=o.kind==='window'?{windowAnim:{open:0}}:{doorAnim:{open:0}};
  const H={x0:0,x1:18,y0:0,y1:14,architecture:plan,inside:false,lightOn:true},scene=new Three.Scene();
  const bridge={cam:{x:9,y:7,W:900,H:700,zoom:40,tilt:.5,ang:0},houses:[H],player:{floor:0},world:{night:false}};
  const render=createArchitecture3D(THREE,scene,bridge);
  for(let i=0;i<6;i++)render.update();assert.deepEqual(render.state.errors,[]);assert.equal(render.state.properties,1);
  const meshes=[];scene.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);if(o.isMesh){assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...o.geometry.attributes.uv.array].every(Number.isFinite));}});
  assert.equal(meshes.length,2,'all windows share two draw batches');
  const window=openings.find(o=>o.kind==='window'),before=new Three.Matrix4(),after=new Three.Matrix4();meshes[0].getMatrixAt(0,before);
  window.segment.windowAnim.open=1;render.update();meshes[0].getMatrixAt(0,after);
  assert.ok(Math.abs(after.elements[13]-before.elements[13]-window.height*.46)<1e-5);
  assert.equal(after.elements[12],before.elements[12]);assert.equal(after.elements[14],before.elements[14]);
  H.inside=true;bridge.player.floor=1;render.update();assert.deepEqual(render.state.errors,[]);
  const root=scene.children[0];assert.equal(root.children[0].visible,false);assert.equal(root.children[1].visible,false);assert.equal(root.children[2].visible,true);
  assert.ok(plan.levels[1].outdoor.some(r=>r.rear),'mansion rear loggia belongs to real upper floor');
  const geometries=[];root.traverse(o=>{if(o.isMesh){o.geometry.addEventListener('dispose',()=>geometries.push(o.geometry));}});
  bridge.houses=[];render.update();assert.equal(scene.children.length,0);assert.ok(geometries.length>0,'streamed property releases its meshes');
 }finally{globalThis.window=old;}
});

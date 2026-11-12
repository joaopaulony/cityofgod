import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import {createLivingGrass,GRASS_BUDGET,GRASS_PALETTES} from '../js/living-grass-3d.mjs';

const game=fs.readFileSync('js/game.js','utf8');
const vehicle=fs.readFileSync('js/vehicle-webgl.mjs','utf8');

function fixture(grassAt=()=>({cover:1,profile:'wild',height:1.05}),quality='balanced'){
 const scene=new THREE.Scene();
 const bridge={cam:{x:1024,y:1024,W:1200,H:800,zoom:67,tilt:.62},
  player:{x:1024,y:1024,floor:0,floorZ:0},world:{paved:[]},houses:[],grassAt,quality:()=>quality};
 const g=createLivingGrass(THREE,scene,bridge);
 return {scene,bridge,g};
}
function finish(g,quality='balanced'){
 for(let i=0;i<200;i++){g.update(1+i*.016,null,quality);if(!g.state.pending&&i>0)break;}
 return g.state;
}
test('quality presets enforce bounded grass counts and differentiated palettes',()=>{
 assert.deepEqual(Object.keys(GRASS_PALETTES).sort(),['dry','lawn','meadow','shade','wet','wild']);
 assert.ok(GRASS_BUDGET.low<GRASS_BUDGET.balanced);
 assert.ok(GRASS_BUDGET.balanced<GRASS_BUDGET.high);
 const {g}=fixture();
 const s=finish(g,'low');
 assert.ok(s.active>0&&s.active<=GRASS_BUDGET.low,s);
 assert.equal(s.bladesPerClump,4);
 assert.equal(s.drawCalls,1);
 assert.equal(s.trianglesPerClump,24);
 g.dispose();
});
test('wild fields form tall, moving clumps without extra meshes',()=>{
 const {g,scene}=fixture();const stats=finish(g);
 assert.ok(stats.active>2000,stats);
 assert.ok(stats.tall>stats.medium,stats);
 assert.ok(stats.biomes.wild>2000,stats);
 assert.equal(scene.children.filter(c=>c.name==='CityOfGodLivingGrass').length,1);
 assert.ok(g.mesh.instanceMatrix.count>=stats.active);
 g.dispose();
 assert.equal(scene.children.filter(c=>c.name==='CityOfGodLivingGrass').length,0);
});
test('yard lawns are mostly low/medium while wetlands grow tall grass',()=>{
 const city=fixture(()=>({cover:.85,profile:'lawn',height:.32}));
 const s=finish(city.g);assert.ok(s.low+s.medium>Math.max(1,s.tall)*3);
 city.g.dispose();
 const wet=fixture(()=>({cover:.88,profile:'wet',height:1.18}));
 const w=finish(wet.g);assert.ok(w.tall>w.medium);
 wet.g.dispose();
});
test('water, paving and occupied house footprints never spawn turf',()=>{
 const sea=fixture(()=>null);assert.equal(finish(sea.g).active,0);sea.g.dispose();
 const paved=fixture();paved.bridge.world.paved=[[950,950,1100,1100]];
 assert.equal(finish(paved.g).active,0);paved.g.dispose();
 const house=fixture();house.bridge.houses=[{x0:970,x1:1080,y0:970,y1:1080}];
 assert.equal(finish(house.g).active,0);house.g.dispose();
 assert.match(game,/f\.rd < ROAD_W \+ SIDE \+ \.9/);
 assert.match(game,/w\.paved>\.1\|\|w\.water>\.02/);
});
test('wind, player motion and snow animate solely through shader uniforms',()=>{
 const {g,bridge}=fixture();
 const old=globalThis.ENV;
 try{
  globalThis.ENV={windNow:.9,gust:.65,windDir:[-.5,.86],day:.75,snowCover:.4};
  g.update(1);g.update(1.04);
  bridge.player.x+=.14;g.update(1.08);
  const u=g.mesh.material.uniforms;
  assert.ok(u.uFoot.value>.2,u.uFoot.value);
  assert.ok(u.uWind.value>1.7,u.uWind.value);
  assert.equal(u.uSnow.value,.4);
  assert.deepEqual(u.uActor.value.toArray(),[bridge.player.x,bridge.player.y]);
  bridge.player.floor=1;g.update(1.12);
  assert.equal(u.uFoot.value,0);
 }finally{globalThis.ENV=old;g.dispose();}
});
test('procedural generation streams in 2.4ms slices and integrates existing world systems',()=>{
 const src=fs.readFileSync('js/living-grass-3d.mjs','utf8');
 assert.match(src,/performance\.now\(\)-t0<2\.4/);
 assert.match(src,/gl_Position=projectionMatrix\*viewMatrix\*modelMatrix\*world/);
 assert.match(src,/uActor,uVelocity,uWindDir,uCam/);
 assert.match(src,/#include <colorspace_fragment>/);
 assert.match(vehicle,/createLivingGrass/);
 assert.match(vehicle,/livingGrass\?\.update/);
 assert.match(game,/weightsAt\(f\)/);
});

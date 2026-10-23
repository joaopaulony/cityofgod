import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectVehiclePoint,cameraSurfaceDepth,roofCoverageForCar,
 selectVehicleRoofCutaways} from '../js/vehicle-roof-visibility.mjs';
const H={x0:10,y0:10,x1:16,y1:16,h:3.0,inside:false,roofKind:'hip'};
const roof={faces:[
 {p:[[9.7,9.7,2.9],[16.3,9.7,2.9],[13,13,4.1]]},
 {p:[[16.3,9.7,2.9],[16.3,16.3,2.9],[13,13,4.1]]},
 {p:[[16.3,16.3,2.9],[9.7,16.3,2.9],[13,13,4.1]]},
 {p:[[9.7,16.3,2.9],[9.7,9.7,2.9],[13,13,4.1]]}
]};
const car=(x,y,a=0)=>({x,y,angle:a,length:4.5,width:1.8});
test('car stays visible in the open and distant roofs never fade',()=>{
 const cam={x:13,y:13,ang:Math.PI/4,zoom:34,W:1280,H:800};
 assert.equal(roofCoverageForCar(cam,car(40,40),H,roof),0);
 assert.equal(selectVehicleRoofCutaways(cam,car(40,40),[H],()=>roof).size,0);
});
test('projected GLB and roofing share exact same dynamic camera at 4 rotations',()=>{
 let overlapAngles=0;
 for(const angle of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){
  const cam={x:13,y:13,ang:angle,zoom:40,W:1280,H:800};
  const center=projectVehiclePoint(cam,13,13,3);
  assert.ok(Math.abs(center.x-640)<1e-7);
  assert.ok(Math.abs(center.y-(400-3*.86*40))<1e-7);
  assert.ok(Number.isFinite(cameraSurfaceDepth(cam,[13,13,3])));
  let best={coverage:0,x:0,y:0};
  for(let x=5;x<=21;x+=.4)for(let y=5;y<=21;y+=.4){
   if(x>H.x0-1.3&&x<H.x1+1.3&&y>H.y0-1.3&&y<H.y1+1.3)continue;
   const coverage=roofCoverageForCar(cam,car(x,y),H,roof);
   if(coverage>best.coverage)best={coverage,x,y};
  }
  assert.ok(best.coverage>=.13,'roof should cover an outside vehicle in camera '+angle+' '+JSON.stringify(best));
  const active=selectVehicleRoofCutaways(cam,car(best.x,best.y),[H],()=>roof);
  assert.ok(active.has(H),'3D roof depth and Canvas fade must agree');
  overlapAngles++;
 }
 assert.equal(overlapAngles,4);
});
test('existing wall collider remains present when roof cutaway is enabled',()=>{
 const s=fs.readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 const houses=fs.readFileSync(new URL('../js/houses.js',import.meta.url),'utf8');
 const game=fs.readFileSync(new URL('../js/game.js',import.meta.url),'utf8');
 assert.match(s,/const walls=\[\],slopes=\[\]/);
 assert.match(s,/roofOccluders\.set\(H,roofMesh\)/);
 assert.match(s,/mesh\.visible=!H\.inside&&!H\.vehicleRoofFade/);
 assert.match(s,/system\.roofCutaways=cutaways\.size/);
 assert.match(houses,/H\.fade=!!H\.vehicleRoofFade&&!H\.inside/);
 assert.match(game,/window\.cityVehicles\?\.prepareScene\?\.\(\);\s*render\(\);/);
});
test('porch roof cannot paint above main house tiles',()=>{
 const s=fs.readFileSync(new URL('../js/houses.js',import.meta.url),'utf8');
 assert.match(s,/roofDepthByHouse\.set\(H,roofDepth\)/);
 assert.match(s,/d=Math\.min\(d,mainRoof-\.12\)/);
});

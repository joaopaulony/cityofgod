import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=(file)=>readFileSync(new URL('../js/'+file,import.meta.url),'utf8');
const roofs=read('roofs.js'),houses=read('houses.js'),webgl=read('vehicle-webgl.mjs');
function proceduralRoof(H){
 const vec={
  add:(a,b)=>a.map((v,i)=>v+b[i]),
  sub:(a,b)=>a.map((v,i)=>v-b[i]),
  mul:(a,t)=>a.map(v=>v*t),
  dot:(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],
    a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm(a){const l=Math.hypot(...a)||1;return a.map(v=>v/l)}
 };
 const context={V:vec,makeCanvas:()=>({getContext:()=>({})}),Math};
 vm.runInNewContext(roofs,context);
 return vm.runInNewContext('buildRoofGeom('+JSON.stringify(H)+')',context);
}
test('gable ends are triangles, not a high solid rectangular wall',()=>{
 const H={roofKind:'gable',h:2.7,x0:10,x1:20,y0:10,y1:16};
 const g=proceduralRoof(H);
 assert.equal(g.faces.filter(f=>f.gable).length,2);
 assert.equal(g.faces.filter(f=>f.slope).length,2);
 for(const f of g.faces.filter(f=>f.gable)){
  const z=f.p.map(v=>v[2]);
  assert.equal(z.length,3);
  assert.ok(Math.max(...z)>H.h);
  assert.ok(z.filter(h=>h<H.h).length>=2);
 }
 assert.match(webgl,/const h=H\.roofKind==='flat'\?\(side\.Hc\|\|H\.h\):H\.h/);
 assert.match(webgl,/face\(f\.p,f\.gable\?walls:slopes\)/);
});
test('hip roof uses four true triangular/trapezoid faces',()=>{
 const H={roofKind:'hip',h:3.1,x0:10,x1:21,y0:7,y1:13};
 const g=proceduralRoof(H);
 assert.equal(g.faces.length,4);
 assert.equal(g.faces.filter(f=>f.gable).length,0);
 assert.ok(g.faces.every(f=>f.p.length>=3));
});
test('porch and canopy are painted strictly before primary roof tiles',()=>{
 assert.match(houses,/roofDepthByHouse\.set\(H,roofDepth\)/);
 assert.match(houses,/\['porchroof','canopy'\]\.includes\(b\.kind\)/);
 assert.match(houses,/d=Math\.min\(d,mainRoof-\.12\)/);
});
test('no full roof transparency or green empty interior while driving behind house',()=>{
 assert.match(houses,/H\.fade=false/);
 assert.doesNotMatch(webgl,/selectVehicleRoofCutaways|vehicleRoofFade/);
 const game=read('game.js');
 assert.doesNotMatch(game,/window\.cityVehicles\?\.prepareScene/);
 assert.match(webgl,/mesh\.visible=\(system\.driver\|\|!H\.inside\)&&H!==reveal/);
});
test('GLB has independent wall and tile depth so edges match exact roof shape',()=>{
 assert.match(webgl,/const walls=\[\],slopes=\[\]/);
 assert.match(webgl,/roofOccluders\.set\(H,roofMesh\)/);
 assert.match(webgl,/const wallMesh=make\(walls\),roofMesh=make\(slopes\)/);
 assert.match(webgl,/side\.Hc\|\|H\.h/);
});

// Smoke tests for the procedural architecture (no browser, assets or packages).
// Run: node tests/architecture.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const V = {
  add: (a,b)=>a.map((n,i)=>n+b[i]),
  sub: (a,b)=>a.map((n,i)=>n-b[i]),
  mul: (a,k)=>a.map(n=>n*k),
  dot: (a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),
  norm: a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);},
  cross: (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len: a=>Math.hypot(...a),
};
const ctx = vm.createContext({
  console, Math, V, world: {seed: 42, segs: [], yards: [], buildHouses: null},
  makeCanvas:()=>({width:1,height:1,getContext:()=>({})}),
  clamp:(v,a,b)=>Math.max(a,Math.min(v,b)),
  mulberry:seed=>()=>{seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;},
});
for (const file of ['roofs.js','houses.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',file),'utf8'),ctx,{filename:file});
}
const A=vm.runInContext('({buildRoofGeom,ROOF_O,PITCH,TPL,layoutFurniture,furnitureBounds,furnitureRoomRect,updateHouseOpenings,houses})',ctx);
let roofs=0, rotations=0;
for (const [w,d] of [[10,8],[8,8],[7,12],[6,6]]) {
  for (const kind of ['gable','hip','flat']) {
    const H={x0:20,y0:15,x1:20+w,y1:15+d,h:2.7,roofKind:kind}, R=A.buildRoofGeom(H);
    if (kind!=='flat') {
      assert.equal(R.faces.filter(f=>f.slope).length,kind==='gable'?2:4);
      assert.ok(Math.abs(R.top-H.h-Math.min(w,d)*A.PITCH/2)<1e-6);
      for (const f of R.faces.filter(f=>f.slope)) {
        assert.ok(f.amax>f.amin && f.bmax>f.bmin,'non-degenerate roof texture plane');
        assert.ok([f.amin,f.amax,f.bmin,f.bmax].every(Number.isFinite));
      }
      if (kind==='gable') for (const f of R.faces.filter(f=>f.gable)) {
        assert.ok(Math.abs(f.p[2][2]-(R.top-0.025))<1e-6,'gable touches ridge');
      }
    }
    roofs++;
  }
}
for (const kind of ['A','B','SHOP']) {
  const T=A.TPL[kind], objects=A.layoutFurniture(T);
  assert.equal(objects.length,T.furn.length);
  for (const item of objects) {
    const group=['blanket','bed'].includes(item.kind)?objects.filter(f=>['blanket','bed'].includes(f.kind)):
      ['tv','screen'].includes(item.kind)?objects.filter(f=>['tv','screen'].includes(f.kind)):
      item.kind==='sofa'?objects.filter(f=>f.kind==='sofa'):[item];
    const b=A.furnitureBounds(group),r=A.furnitureRoomRect(T,group);
    assert.ok(b.x0>=r.x0-1e-6&&b.x1<=r.x1+1e-6&&b.y0>=r.y0-1e-6&&b.y1<=r.y1+1e-6);
  }
  for(let k=0;k<4;k++){
    const c=Math.round(Math.cos(k*Math.PI/2)),s=Math.round(Math.sin(k*Math.PI/2));
    const W=k%2?T.d:T.w,D=k%2?T.w:T.d;
    for(const item of objects){
      const x=W/2+c*(item.x-T.w/2)-s*(item.y-T.d/2);
      const y=D/2+s*(item.x-T.w/2)+c*(item.y-T.d/2);
      const a=(item.rot||0)+k*Math.PI/2;
      const rx=(Math.abs(Math.cos(a))*item.w+Math.abs(Math.sin(a))*item.d)/2;
      const ry=(Math.abs(Math.sin(a))*item.w+Math.abs(Math.cos(a))*item.d)/2;
      assert.ok(x-rx>=0.25&&x+rx<=W-0.25&&y-ry>=0.25&&y+ry<=D-0.25);
    }
    rotations++;
  }
}
const door={x1:0,y1:0,x2:1,y2:0,doorAnim:{open:0,target:0}};
const win={x1:0,y1:0,x2:1,y2:0,windowAnim:{open:0,target:0,timer:.1,rand:()=>.1}};
A.houses.push({segs:[door,win]});
for(let i=0;i<50;i++)A.updateHouseOpenings(.05,[{x:.5,y:0}],false);
assert.ok(door.doorAnim.open>.95 && win.windowAnim.open>.2,'opening animation');
for(let i=0;i<150;i++)A.updateHouseOpenings(.05,[{x:20,y:20}],true);
assert.ok(door.doorAnim.open<.01 && win.windowAnim.open<.01,'closing animation');
console.log('PASS: '+roofs+' roofs, '+rotations+' furniture rotations, door/window opening and closing');

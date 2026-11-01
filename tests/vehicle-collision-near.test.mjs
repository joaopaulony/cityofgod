// A colisão do carro consultando só a vizinhança (options.query, grade de world.js) tem de dar o mesmo resultado
// que varrer o mundo inteiro.
import test from 'node:test';
import assert from 'node:assert/strict';
import {carCollision,sweepCar} from '../js/vehicle-collision.mjs';

function rng(seed){return ()=>((seed=Math.imul(seed^seed>>>15,2246822507)+0x9e3779b9|0)>>>0)/4294967296;}
function world(seed){
 const r=rng(seed),segs=[],circles=[],boxes=[];
 for(let i=0;i<300;i++){const x=r()*200,y=r()*200,a=r()*6.28,l=1+r()*8;segs.push({x1:x,y1:y,x2:x+Math.cos(a)*l,y2:y+Math.sin(a)*l,kind:r()<.5?'fence':'garage'});}
 for(let i=0;i<300;i++)circles.push({x:r()*200,y:r()*200,r:.1+r()*.5,kind:'lamp'});
 for(let i=0;i<200;i++){const b={x:r()*200,y:r()*200,w:.5+r()*4,d:.5+r()*2,rot:r()*6.28,z:0,h:1,kind:'bench'};boxes.push(b);
  const c=Math.cos(b.rot),s=Math.sin(b.rot),p=[[1,1],[1,-1],[-1,-1],[-1,1]].map(([u,v])=>[b.x+u*b.w/2*c-v*b.d/2*s,b.y+u*b.w/2*s+v*b.d/2*c]);
  for(let k=0;k<4;k++)segs.push({x1:p[k][0],y1:p[k][1],x2:p[(k+1)%4][0],y2:p[(k+1)%4][1],kind:'bench',sourceBox:b});}
 // consulta por retângulo: o que a caixa envolvente toca (como a grade de world.js)
 const hit=(bx0,by0,bx1,by1,x0,y0,x1,y1)=>bx0<=x1&&bx1>=x0&&by0<=y1&&by1>=y0;
 const query=(x0,y0,x1,y1)=>{
  const s=segs.filter(q=>hit(Math.min(q.x1,q.x2),Math.min(q.y1,q.y2),Math.max(q.x1,q.x2),Math.max(q.y1,q.y2),x0,y0,x1,y1));
  return {segs:s,circles:circles.filter(c=>hit(c.x-c.r,c.y-c.r,c.x+c.r,c.y+c.r,x0,y0,x1,y1)),boxes:[...new Set(s.filter(q=>q.sourceBox).map(q=>q.sourceBox))]};
 };
 return {w:{segs,circles,mapSize:200},boxes,query};
}

test('colisão com vizinhança da grade = colisão varrendo o mundo',()=>{
 const {w,boxes,query}=world(7),r=rng(99);let hits=0;
 for(let i=0;i<3000;i++){
  const car={x:5+r()*190,y:5+r()*190,angle:r()*6.28,length:4.4,width:1.9};
  const a=carCollision(w,car,{boxes}),b=carCollision(w,car,{boxes,query});
  assert.equal(b?.object,a?.object);if(a)hits++;
 }
 assert.ok(hits>200,'o teste precisa ter colisões de verdade: '+hits);
});

test('varredura com vizinhança = varredura varrendo o mundo',()=>{
 const {w,boxes,query}=world(3),r=rng(5);
 for(let i=0;i<1500;i++){
  const from={x:5+r()*190,y:5+r()*190,angle:r()*6.28,length:4.4,width:1.9};
  const to={...from,x:from.x+(r()-.5)*1.4,y:from.y+(r()-.5)*1.4,angle:from.angle+(r()-.5)*.3};
  const a=sweepCar(w,from,to,{boxes}),b=sweepCar(w,from,to,{boxes,query});
  assert.equal(b.impact?.object,a.impact?.object);assert.deepEqual(b.position,a.position);
 }
});

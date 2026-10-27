'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const plan=require('../js/architecture-plan.js');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
function multi(kind,w,d,floors){
 const A=plan.makePlan({width:w,depth:d,kind,floors,height:3,seed:43});
 assert.equal(A.audit.passed,true,A.audit.problems.join('; '));
 return A;
}
test('Condominiums, projects and hotels have two actual flats on each residential floor',()=>{
 for(const [kind,w,d,n] of [['condo',18,14,8],['projects',22,10,3],['deco',20,16,6]]){
  const A=multi(kind,w,d,n);
  assert.equal(A.levels[0].units?.length||0,0,'Ground floor remains a public lobby');
  for(const l of A.levels.slice(1)){
   assert.equal(l.units?.length,2,kind+' floor '+l.floor);
   assert.deepEqual(l.units.map(u=>u.side),['left','right']);
   for(const u of l.units){
    const uses=l.rooms.filter(r=>r.unitId===u.id).map(r=>r.use);
    for(const required of ['bedroom','bathroom','kitchen','living'])assert.ok(uses.includes(required),required+' missing');
    const entries=l.walls.flatMap(w=>w.openings).filter(o=>o.unitEntry&&o.unitId===u.id);
    assert.equal(entries.length,1,'Exactly one corridor door per unit');
   }
   assert.equal(l.walls.flatMap(w=>w.openings).some(o=>o.unitId&&o.unitId.includes('E')&&o.rooms?.includes('D')),false);
  }
 }
});
test('Office towers have two commercial suites per upper floor, and stores remain saleable',()=>{
 const office=multi('office',20,18,9);assert.equal(office.levels[1].units.length,2);
 assert.ok(office.levels[1].units.every(u=>u.type==='office'));
 const shop=multi('shop',12,10,2);
 assert.ok(shop.levels.every(l=>l.units?.[0]?.type==='shop'));
 assert.equal(shop.levels[0].units[0].id,shop.levels[1].units[0].id);
});
test('Different flats have no shared internal door and have accessible plan',()=>{
 const A=multi('condo',18,14,8);
 for(const l of A.levels.slice(1))for(const w of l.walls){
  const ids=new Set(w.rooms.map(r=>l.rooms.find(x=>x.id===r)?.unitId).filter(Boolean));
  if(ids.size>1)assert.equal(w.openings.some(o=>o.kind==='door'),false,'Private units cannot connect');
  if(w.rooms.includes('hall')&&[...ids].length)assert.ok(w.openings.every(o=>o.unitEntry),'Only locked unit entries face corridor');
 }
});
function fixture(){
 let bank=500000,db={};
 const ls={getItem:k=>db[k]||null,setItem:(k,v)=>{db[k]=v;}};
 const ctx={console,Date,Math,JSON,Event:class Event{constructor(x){this.type=x;}},localStorage:ls,
  document:{addEventListener:()=>{},getElementById:()=>null,createElement:()=>({}),body:{appendChild:()=>{}}},
  CityLife:{debit:n=>{if(bank<n)return false;bank-=n;return true;},credit:n=>{bank+=n;},money:n=>'R$ '+n,get funds(){return bank;}},
  dispatchEvent:()=>{},houses:[],world:{version:0}};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('js/city-buildings.js'),ctx);
 const A=multi('condo',18,14,3);
 A.toWorld=(x,y)=>[x,y];A.toLocal=(x,y)=>[x,y];A.angle=0;
 for(const l of A.levels){
  l.stair={center:[(A.width)/2,A.depth*.45]};
  l.segments=l.walls.flatMap(w=>w.openings.filter(o=>o.kind==='door').map(o=>{
   const len=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);const x=w.a[0]+(w.b[0]-w.a[0])*o.at/len;
   const y=w.a[1]+(w.b[1]-w.a[1])*o.at/len;
   return {x1:x-.01,y1:y-.01,x2:x+.01,y2:y+.01,doorAnim:{target:0,open:0},unitId:o.unitId,unitEntry:o.unitEntry};
  }));
 }
 const H={seed:43,x0:0,y0:0,x1:18,y1:14,doorPt:[9,11],floorHeight:3,architecture:A,miaKind:'condo',
  contains:(x,y,f=0)=>A.levels[f]?.rooms.some(r=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1)};
 ctx.houses=[H];
 return {ctx,H,A,get bank(){return bank;},db};
}
test('Apartments have separate saved titles and privacy from their neighbours',()=>{
 const {ctx,H,A}=fixture(),B=ctx.CityBuildings;
 const left=A.levels[1].units[0],right=A.levels[1].units[1];
 assert.equal(B.has(H,left),false);
 const lp=A.levels[1].rooms.find(r=>r.unitId===left.id);
 const rp=A.levels[1].rooms.find(r=>r.unitId===right.id);
 const center=r=>[(r.x0+r.x1)/2,(r.y0+r.y1)/2];
 const [lx,ly]=center(lp),[rx,ry]=center(rp);
 assert.equal(B.canSeeRoom(H,lp,1,{x:lx,y:ly,floor:1}),false);
 assert.equal(B.buy(H,left).ok,true);
 assert.equal(B.has(H,left),true);assert.equal(B.has(H,right),false);
 assert.equal(B.canSeeRoom(H,lp,1,{x:lx,y:ly,floor:1}),true);
 assert.equal(B.canSeeRoom(H,rp,1,{x:lx,y:ly,floor:1}),false);
 assert.equal(B.canSeeRoom(H,lp,1,{x:rx,y:ry,floor:1}),false);
 assert.equal(B.canOpenDoor(H,{unitId:right.id}),false);
 assert.equal(B.canOpenDoor(H,{unitId:left.id}),true);
 assert.equal(B.buy(H,left).ok,false,'Double-purchases cannot charge twice');
 const status=B.has(H,right)?'mine':'unsynced';assert.equal(status,'unsynced');
});
test('Elevator only begins from shared hall and arrives on precise upper floor',()=>{
 const {ctx,H}=fixture(),B=ctx.CityBuildings;
 const p={x:9,y:14*.45,floor:0,floorZ:0};
 assert.equal(B.go(H,p,2).ok,true);
 assert.equal(B.go(H,p,1).ok,false,'Reject overlapping trips');
 for(let i=0;i<100;i++)B.tick(.1,p);
 assert.equal(p.floor,2);assert.equal(p.floorZ,6);assert.equal(p.elevatorTravel,null);
 const outsider={x:30,y:30,floor:0};assert.equal(B.go(H,outsider,1).ok,false);
});
test('Unit catalog does not spoof online multiplayer presence',()=>{
 const {ctx,H}=fixture(),B=ctx.CityBuildings;
 assert.equal(typeof B.has,'function');
 assert.equal(B.has(H,H.architecture.levels[1].units[0]),false);
 assert.doesNotMatch(read('js/city-buildings.js'),/Math\.random\(\)\s*>\s*0\.5.*online/i);
});

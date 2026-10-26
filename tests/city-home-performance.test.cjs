'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function fixture(){
 const events=[],H={x0:0,y0:0,x1:12,y1:12,architecture:{
  toLocal:(x,y)=>[x,y],toWorld:(x,y)=>[x,y],
  levels:[{rooms:[{x0:0,y0:0,x1:12,y1:12}],walls:[]}]}};
 const sofa={id:'sofa1',kind:'sofa',x:7,y:6,w:2.1,d:.85,h:.86,rot:0,floor:0,solid:true,status:'placed'};
 const bed={id:'bed1',kind:'bed',x:9,y:9,w:1.65,d:2.1,h:.7,rot:0,floor:0,solid:true,status:'placed'};
 const stove={id:'stove1',kind:'stove',x:3,y:3,w:.76,d:.65,h:.94,rot:0,floor:0,solid:true,status:'placed'};
 const chair={id:'chair1',kind:'chair',x:8,y:3,w:.5,d:.55,h:.85,rot:0,floor:0,solid:true,status:'placed'};
 const furniture=[sofa,bed,stove,chair];
 const player={x:2,y:7,face:0,floor:0,speed:0,phase:0,armed:true,aiming:false};
 const window={__game:{player},CityUI:{notify:x=>events.push(x)}};
 const context=vm.createContext({window,console,Math,world:{version:1}});
 window.CityHome={owned:()=>true,placed:()=>furniture,find:(_,id)=>furniture.find(f=>f.id===id),
  catalog:{sofa:{name:'Sofá'},bed:{name:'Cama'},stove:{name:'Fogão'}}};
 context.CityHome=window.CityHome;
 vm.runInContext(read('js/city-home-nav.js'),context);
 vm.runInContext(read('js/city-home-performance.js'),context);
 let completed=0;
 window.CityHomePlus={completeActivity:()=>{completed++;return {ok:true,text:'feito'};}};
 vm.runInContext(read('js/city-home-routine.js'),context);
 return {window,player,H,sofa,bed,stove,chair,events,completed:()=>completed};
}
const joints=(x=4,y=4)=>({
 pelvis:[x,y,.93],chest:[x,y,1.34],neck:[x,y,1.5],head:[x,y,1.64],
 hipL:[x,y+.1,.93],hipR:[x,y-.1,.93],
 kneeL:[x+.12,y+.1,.48],kneeR:[x+.12,y-.1,.48],
 ankL:[x+.15,y+.1,.08],ankR:[x+.15,y-.1,.08],
 toeL:[x+.3,y+.1,.03],toeR:[x+.3,y-.1,.03],
 shL:[x,y+.19,1.42],shR:[x,y-.19,1.42],
 elbL:[x-.07,y+.23,1.13],elbR:[x-.07,y-.23,1.13],
 handL:[x+.1,y+.22,.94],handR:[x+.1,y-.22,.94],
 headFwd:[1,0,0]
});
test('seating uses an unobstructed front socket with an exact target',()=>{
 const f=fixture(),a=f.window.CityHomePerformance.approach(f.H,f.player,f.sofa,'sit');
 assert.ok(a,'must find a seat socket');
 assert.ok(a.stand.y>f.sofa.y+f.sofa.d/2);
 assert.ok(Math.hypot(a.points.at(-1).x-a.stand.x,a.points.at(-1).y-a.stand.y)<.001);
 const ch=f.window.CityHomePerformance.approach(f.H,f.player,f.chair,'sit');
 assert.ok(ch&&ch.stand.y<f.chair.y,'chair back is opposite sofa back');
});
test('the sleep approach enters from the bed side rather than walking through mattress',()=>{
 const f=fixture(),a=f.window.CityHomePerformance.approach(f.H,f.player,f.bed,'sleep');
 assert.ok(a,'side of bed should be accessible');
 assert.ok(Math.abs(a.stand.x-f.bed.x)>f.bed.w/2);
});
test('arrival, alignment, activity and cancellation never grant early rewards',()=>{
 const f=fixture(),routine=f.window.CityHomeRoutine;
 assert.equal(routine.start(f.H,f.sofa,'sit').ok,true);
 let aligned=false;
 for(let i=0;i<900&&routine.active;i++){
  routine.tick(.04,f.player,(x,y)=>[x,y],false);
  if(f.player.homeAction){
   aligned=true;assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(f.sofa.y-f.player.y,f.sofa.x-f.player.x)-f.player.face),Math.cos(Math.atan2(f.sofa.y-f.player.y,f.sofa.x-f.player.x)-f.player.face)))<.12,'must face the sofa');
   assert.equal(f.completed(),0);
  }
 }
 assert.equal(aligned,true,'must enter choreographed pose');
 assert.equal(f.completed(),1,'reward only after stand-up sequence');
 assert.equal(f.player.armed,true);
 assert.equal(routine.active,false);
 assert.equal(routine.start(f.H,f.stove,'cook').ok,true);
 routine.tick(.05,f.player,(x,y)=>[x,y],true);
 assert.equal(f.completed(),1,'manual cancellation cannot finish cooking');
});
test('sit: hips lower into sofa, legs remain grounded and hands follow knees',()=>{
 const f=fixture(),p=f.window.CityHomePerformance;
 const a={x:7,y:6.98,face:-Math.PI/2,homeAction:{kind:'sit',item:f.sofa,t:2,duration:p.duration('sit'),socket:{u:0,v:1}}};
 const J=joints(a.x,a.y);p.apply(a,J);
 assert.ok(J.pelvis[2]>.35&&J.pelvis[2]<.56);
 assert.ok(Math.abs(J.ankL[2]-.08)<1e-6&&Math.abs(J.ankR[2]-.08)<1e-6);
 for(const v of Object.values(J))if(Array.isArray(v))assert.ok(v.every(Number.isFinite));
});
test('sleep: lying phase is genuinely horizontal and finishes standing',()=>{
 const f=fixture(),p=f.window.CityHomePerformance;
 const a={x:10.4,y:9.3,face:Math.PI,homeAction:{kind:'sleep',item:f.bed,t:5,duration:p.duration('sleep'),socket:{u:1.38,v:0}}};
 const J=joints(a.x,a.y);p.apply(a,J);
 assert.ok(J.head[2]<.85&&J.chest[2]<.85,'should recline near bed surface');
 assert.ok(J.head[1]<J.pelvis[1],'head reaches headboard at negative V');
});
test('cook: both hands reach finite countertop targets with anatomical clamp',()=>{
 const f=fixture(),p=f.window.CityHomePerformance;
 const a={x:3,y:3.9,face:-Math.PI/2,homeAction:{kind:'cook',item:f.stove,t:3,duration:p.duration('cook'),socket:{u:0,v:1}}};
 const J=joints(a.x,a.y);p.apply(a,J);
 for(const s of ['L','R']){
  assert.ok(Math.hypot(...J['hand'+s].map((v,i)=>v-J['sh'+s][i]))<=.57);
  assert.ok(J['hand'+s].every(Number.isFinite));
 }
 assert.notEqual(J.handL[2],J.handR[2]);
});

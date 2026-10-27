import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from 'three';
import {PET_BREEDS} from '../js/pet-catalog.mjs';
import {createPetController,outdoorPetRoute} from '../js/pet-behavior.mjs';

function fixture(storage=new Map()){
 const table={id:'table',kind:'table',x:6,y:5,w:2,d:2,rot:0,floor:0,status:'placed'};
 const door={doorAnim:{open:0,target:0},floor:0,x1:5.3,y1:10,x2:6.7,y2:10};
 const H={x0:0,y0:0,x1:12,y1:10,inside:true,doorPt:[6,10],doorN:[0,1],floorHeight:3,contains:(x,y,f=0)=>f===0&&x>0&&x<12&&y>0&&y<10,
  architecture:{toLocal:(x,y)=>[x,y],toWorld:(x,y)=>[x,y],openingSegments:[door],levels:[{rooms:[{x0:0,y0:0,x1:12,y1:10}],walls:[]}]} };
 const player={x:3,y:3,floor:0,floorZ:0},events=[];
 const free=(x,y,r=.15)=>{
  if(x<-4||x>20||y<-3||y>22)return false;
  if(x>5-r&&x<7+r&&y>4-r&&y<6+r)return false;
  if(y>-r&&y<10+r&&(Math.abs(x)<r||Math.abs(x-12)<r))return false;
  if(x>-r&&x<12+r&&Math.abs(y)<r)return false;
  if(x>-r&&x<12+r&&Math.abs(y-10)<r&&!(x>5.3+r&&x<6.7-r&&door.doorAnim.open>=.72))return false;
  return true;
 };
 const ctx=vm.createContext({window:{},CityHome:{placed:()=>[table]},console,Math});vm.runInContext(fs.readFileSync('js/city-home-nav.js','utf8'),ctx);
 const services={player,houses:()=>[H],owned:()=>true,key:()=> 'fixture:home',nav:ctx.window.CityHomeNav,
  storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},notify:t=>events.push(t),
  collide:(x,y,r)=>free(x,y,r)?[x,y]:[x+2,y+2],
  move:(ox,oy,x,y,r)=>free(x,y,r)?[x,y]:[ox,oy],water:()=>true,driving:()=>false};
 const controller=createPetController(services);
 const tick=()=>{door.doorAnim.open+=(door.doorAnim.target-door.doorAnim.open)*.3;controller.tick(.05);};
 return {H,player,free,controller,tick,services,events,storage,door};
}
test('13 licensed pets remain after retiring six procedural breeds',()=>{
 const f=fixture();assert.equal(PET_BREEDS.length,13);assert.ok(PET_BREEDS.every(b=>b.model));
 for(const b of PET_BREEDS.slice(0,6)){assert.equal(b.colors.length,3);assert.equal(f.controller.adopt(b.id,b.colors[1].id,'<Mel>').ok,true);}
 assert.equal(f.controller.count,6);assert.equal(f.controller.adopt('husky','original','Extra').ok,false);
 assert.equal(f.controller.adopt('husky','invalid','Extra').ok,false);
 assert.ok(f.controller.rows.every(p=>p.name==='Mel'));
 const reloaded=fixture(f.storage);assert.equal(reloaded.controller.count,6);assert.equal(reloaded.controller.pets.length,6);
 f.player.x=18;assert.equal(f.controller.adopt('husky','original','Rua').ok,false);
});
test('retired procedural models cannot be loaded from a saved row',()=>{
 const f=fixture();
 assert.equal(f.controller.adopt('rottweiler','tan','Legacy').ok,false);
 assert.equal(f.controller.adopt('fluffycat','silver','Legacy').ok,false);
});

test('outdoor navigation detours around a wall and refuses an enclosed owner',()=>{
 const wall=(x,y,r)=>!(Math.abs(x-2)<.2+r&&y>-2-r&&y<2+r);
 const route=outdoorPetRoute({x:0,y:0},{x:4,y:0},wall);
 assert.ok(route&&route.some(p=>Math.abs(p.y)>2));
 assert.equal(outdoorPetRoute({x:0,y:0},{x:4,y:0},(x,y,r)=>!(x>3-r&&x<5+r&&y>-1-r&&y<1+r)),null);
});
test('a called pet exits through the door and follows the owner without teleporting through furniture',()=>{
 const f=fixture();assert.equal(f.controller.adopt('shibainu','original','Mel').ok,true);
 const pet=f.controller.pets[0];f.controller.command(pet.id,'wait');
 const destinations=[{x:3,y:7},{x:6,y:7},{x:6,y:11},{x:10,y:12}];
 for(const goal of destinations)for(let i=0;i<90;i++){
  const dx=goal.x-f.player.x,dy=goal.y-f.player.y,d=Math.hypot(dx,dy);
  if(d>.05){f.player.x+=dx/d*Math.min(.1,d);f.player.y+=dy/d*Math.min(.1,d);}f.tick();
 }
 f.controller.command(pet.id,'follow');let crossed=false;
 for(let i=0;i<1400;i++){
  const old={x:pet.x,y:pet.y};f.tick();
  assert.ok(Math.hypot(pet.x-old.x,pet.y-old.y)<.16,'pet teleported');
  assert.ok(f.free(pet.x,pet.y,pet.radius),'walked through a collider');
  if(old.y<10&&pet.y>=10){crossed=true;assert.ok(pet.x>5.3&&pet.x<6.7);}
  if(Math.hypot(pet.x-f.player.x,pet.y-f.player.y)<1.2)break;
 }
 assert.ok(crossed,'pet never went through the front door');
 assert.ok(Math.hypot(pet.x-f.player.x,pet.y-f.player.y)<1.3,JSON.stringify(f.controller.status));
 f.controller.command(pet.id,'wait');const old=[pet.x,pet.y];for(let i=0;i<60;i++)f.tick();assert.deepEqual([pet.x,pet.y],old);
 f.controller.command(pet.id,'home');for(let i=0;i<1400&&!f.H.contains(pet.x,pet.y);i++)f.tick();
 assert.ok(f.H.contains(pet.x,pet.y),'pet did not return home');
});
test('pets wait during a car trip and never snap to a distant owner',()=>{
 const f=fixture();f.controller.adopt('husky','original','Suki');const pet=f.controller.pets[0];f.controller.command(pet.id,'follow');
 f.services.driving=()=>true;const start={x:pet.x,y:pet.y};f.player.x=100;f.player.y=100;for(let i=0;i<100;i++)f.tick();
 assert.equal(pet.x,start.x);assert.equal(pet.y,start.y);assert.equal(pet.action,'sit');
 f.services.driving=()=>false;f.tick();assert.ok(Math.hypot(pet.x-start.x,pet.y-start.y)<.15);
});
test('six pets can follow together through the same doorway',()=>{
 const f=fixture();for(const b of PET_BREEDS.slice(0,6))assert.ok(f.controller.adopt(b.id,b.colors[0].id).ok);
 f.controller.command('all','wait');
 for(const goal of [{x:3,y:7},{x:6,y:7},{x:6,y:11},{x:10,y:12}])for(let i=0;i<90;i++){
  const dx=goal.x-f.player.x,dy=goal.y-f.player.y,d=Math.hypot(dx,dy);
  if(d>.05){f.player.x+=dx/d*Math.min(.1,d);f.player.y+=dy/d*Math.min(.1,d);}f.tick();
 }
 f.controller.command('all','follow');for(let i=0;i<2200;i++)f.tick();
 for(const pet of f.controller.pets){assert.ok(!f.H.contains(pet.x,pet.y),pet.name+' stayed inside');assert.ok(Math.hypot(pet.x-f.player.x,pet.y-f.player.y)<2.5,pet.name+' could not follow');}
});
test('following remains active when the home sector streams out',()=>{
 const f=fixture();f.controller.adopt('husky','original','Suki');const pet=f.controller.pets[0];
 Object.assign(pet,{x:15,y:13});Object.assign(f.player,{x:16,y:13});f.tick();
 f.controller.command(pet.id,'follow');f.services.houses=()=>[];for(let i=0;i<30;i++)f.tick();
 assert.ok(pet.homeHouse===f.H);assert.ok(pet.visible);assert.equal(pet.mode,'follow');
});
test('a pet follows the owner up a stair transition instead of changing floors instantly',()=>{
 const f=fixture();f.H.architecture.levels.push({...f.H.architecture.levels[0]});
 f.H.architecture.levels[0].stair={bottom:[4,7],top:[4,6]};f.H.architecture.levels[1].stair={bottom:[4,7],top:[4,6]};
 f.H.contains=(x,y,floor=0)=>floor<2&&x>0&&x<12&&y>0&&y<10;
 let entered=0;
 f.services.stairs=(pet,dt,activate)=>{
  if(pet.stairTravel){pet.stairTravel.t+=dt;if(pet.stairTravel.t>.3){pet.floor=1;pet.floorZ=3;pet.x=4;pet.y=6;pet.stairTravel=null;}return true;}
  if(activate&&pet.floor===0&&Math.hypot(pet.x-4,pet.y-7)<1.1){pet.stairTravel={t:0};entered++;return true;}return false;
 };
 f.controller.adopt('shibainu','original','Mel');const pet=f.controller.pets[0];f.controller.command(pet.id,'wait');
 f.player.stairTravel={fromX:4,fromY:7,start:0,end:3,to:1};f.tick();f.player.stairTravel=null;Object.assign(f.player,{x:4,y:6,floor:1,floorZ:3});f.tick();
 f.controller.command(pet.id,'follow');for(let i=0;i<1100&&pet.floor!==1;i++)f.tick();
 assert.equal(entered,1);assert.equal(pet.floor,1);assert.equal(pet.floorZ,3);
});

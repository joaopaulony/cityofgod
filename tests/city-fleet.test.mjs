import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VehicleFleet,streetModel} from '../js/vehicle-fleet.mjs';
import {stepCar} from '../js/vehicle-physics.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),A=require('../js/architecture-plan.js');
test('street vehicles keep their model across loading order and a claimed car never respawns at origin',()=>{
 const f=new VehicleFleet(),source={kind:'parkedcar',x:31,y:40,rot:.4,col:'#fff'},regenerated={...source};
 assert.equal(streetModel(source),streetModel(regenerated));
 const key=f.claim(source);assert.equal(f.hideOriginal(regenerated),true);assert.equal(f.nearest([regenerated],31,40),null);
 const saved=f.park(key,{x:100,y:120,modelId:source.modelId,fuel:.2});
 assert.equal(f.nearest([],100,120),saved);assert.equal(saved.fuel,.2);
 f.claim(saved);assert.equal(f.saved.size,0);assert.equal(f.hideOriginal(regenerated),true);
});
test('handbrake induces controlled slip, releasing it restores grip, and no drift occurs while stationary',()=>{
 let car={x:0,y:0,speed:19,angle:0,steer:0};
 for(let i=0;i<30;i++)car=stepCar(car,{engineOn:true,right:true,handbrake:true},1/60);
 assert.ok(car.drifting&&Math.abs(car.slip)>.12);assert.ok(car.speed>6);assert.ok(Number.isFinite(car.x));
 for(let i=0;i<120;i++)car=stepCar(car,{engineOn:true,forward:true},1/60);
 assert.equal(car.slip,0);assert.equal(car.drifting,false);
 const still=stepCar({x:0,y:0,speed:0,angle:0,steer:0},{handbrake:true,right:true},.05);assert.equal(still.drifting,false);
});
test('all public buildings have connected sanitary facilities and their own functional room program',()=>{
 const programs={hospital:['clinic','ward'],police:['holding','office'],military:['armory','barracks'],cityhall:['council','office'],school:['classroom','library']};
 for(const [kind,required] of Object.entries(programs))for(let seed=1;seed<=12;seed++){
  const p=A.makePlan({width:38,depth:32,kind,seed,floors:3});assert.equal(p.audit.passed,true,p.audit.problems.join(','));
  for(const use of required)assert.ok(p.levels.some(l=>l.rooms.some(r=>r.use===use)),kind+' '+use);
  for(const l of p.levels){assert.ok(l.rooms.some(r=>r.use==='bathroom'));for(const room of l.rooms.filter(r=>r.use!=='circulation'))assert.ok(l.furniture.some(f=>f.room===room.id),kind+' '+room.use+' furnished');}
 }
});

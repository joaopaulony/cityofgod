import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseCharacterClip,planLowVault,pointSegmentDistance,stepTraversal} from '../js/character-actions.mjs';
const base={x:0,y:-.75,face:Math.PI/2,speed:0,reloadT:-1,recoilT:9};
const fence={x1:-3,y1:0,x2:3,y2:0,h:1.1,kind:'fence'};
test('combat, stance, locomotion and traversal choose compatible clips',()=>{
 assert.equal(chooseCharacterClip({...base,armed:true,aiming:true}),'rifle_aim');
 assert.equal(chooseCharacterClip({...base,armed:true,recoilT:0}),'rifle_fire');
 assert.equal(chooseCharacterClip({...base,armed:true,reloadT:.7}),'rifle_reload');
 assert.equal(chooseCharacterClip({...base,armed:true,crouching:true,recoilT:0}),'rifle_crouch_fire');
 assert.equal(chooseCharacterClip({...base,armed:true,crouching:true,reloadT:.7}),'rifle_crouch_reload');
 assert.equal(chooseCharacterClip({...base,armed:true,crouching:true,speed:.5}),'rifle_crouch_walk');
 assert.equal(chooseCharacterClip({...base,crouching:true}),'crouch');
 assert.equal(chooseCharacterClip({...base,armed:false,running:true,speed:3}),'run');
 assert.equal(chooseCharacterClip({...base,armed:true,speed:1}),'rifle_walk');
 assert.equal(chooseCharacterClip({...base,armed:false,speed:1}),'walk');
 assert.equal(chooseCharacterClip({...base,jump:{t:.1,duration:.9}}),'jump_start');
 assert.equal(chooseCharacterClip({...base,jump:{t:.5,duration:.9}}),'jump_air');
 assert.equal(chooseCharacterClip({...base,jump:{t:.8,duration:.9}}),'jump_land');
 assert.equal(chooseCharacterClip({...base,traversal:{}}),'vault_low');
});
test('vault crosses a low fence, lands across it and returns to ground',()=>{
 const a={...base},v=planLowVault(a,[fence],()=>true);assert.ok(v);
 assert.ok(v.y>0);a.traversal=v;
 stepTraversal(a,.55,()=>true);assert.ok(a.actionZ>=fence.h);
 stepTraversal(a,.55,()=>true);assert.equal(a.traversal,null);assert.equal(a.actionZ,0);assert.equal(a.y,v.y);
});
test('vault refuses tall walls, house walls, corners, upper floors and blocked landings',()=>{
 for(const s of [{...fence,h:2.2},{...fence,house:{}},{...fence,x1:-.1,x2:.1}])assert.equal(planLowVault(base,[s],()=>true),null);
 assert.equal(planLowVault({...base,floor:1},[fence],()=>true),null);
 assert.equal(planLowVault(base,[fence],(x,y)=>y<.2),null);
 const wall={...fence,y1:.5,y2:.5};
 assert.equal(planLowVault(base,[fence],(x,y)=>pointSegmentDistance(x,y,wall)>.36),null);
});
test('moving obstacle cancels a vault without teleporting through it',()=>{
 const a={...base};a.traversal=planLowVault(a,[fence],()=>true);
 stepTraversal(a,.2,()=>false);assert.equal(a.x,base.x);assert.equal(a.y,base.y);assert.equal(a.actionZ,0);assert.equal(a.traversal,null);
});


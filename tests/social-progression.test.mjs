import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOCIAL_ACTIONS,createSocialSim} from '../js/social-sim.mjs';
import {defineSocialActions,gate,progressionReason} from '../js/social-rules.mjs';
import {actionUnavailable} from '../js/social-pie-model.mjs';
import {createSocialAutonomy} from '../js/social-autonomy.mjs';
const roster=[{id:'aiko-sakura',name:'Aiko Sakura',group:'urbano',trait:'acolhedor'},{id:'jessica-alves',name:'Jessica Alves',group:'urbano',trait:'brincalhão'}];
const make=()=>createSocialSim(roster,{random:()=>0});
const wait=(s,n)=>{for(let i=0;i<n;i++)s.tick(1);};
test('all 106 actions declare gates and future actions without a reviewed gate fail closed',()=>{
 assert.equal(Object.keys(SOCIAL_ACTIONS).length,106);for(const s of Object.values(SOCIAL_ACTIONS))assert.ok(s.gate);
 assert.throws(()=>defineSocialActions({futureDialogue:{label:'Novo'}}),/precisa declarar/);
 assert.throws(()=>defineSocialActions({futureDialogue:{gate:{friend:0}}}),/inválido/);
 assert.throws(()=>defineSocialActions({futureDialogue:{gate:gate({intimacy:-1})}}),/inválido/);
 assert.throws(()=>defineSocialActions({futureDialogue:{gate:gate({intimidade:50})}}),/desconhecido/);
 assert.ok(defineSocialActions({futureDialogue:{gate:gate({romance:80,intimacy:60})}}).futureDialogue.gate);
});
test('clandestine purchase is limited to gang members, requires trust, and charges only after acceptance',()=>{
 const s=createSocialSim([...roster,{id:'king',name:'King',group:'last-kings'},{id:'officer',name:'Officer',group:'policia'}],{random:()=>0});
 const r=s.relation('player','king'),life={funds:200,debit(amount){if(this.funds<amount)return false;this.funds-=amount;return true;}};
 assert.match(s.unavailable('player','king','buyStreetParcel',{cityLife:life}),/Amizade|Confiança/);
 Object.assign(r,{friend:30,trust:40});assert.equal(s.unavailable('player','king','buyStreetParcel',{cityLife:life}), '');
 assert.match(s.unavailable('player','officer','buyStreetParcel',{cityLife:life}),/gangue/);
 const bought=s.interact('player','king','buyStreetParcel',{cityLife:life});assert.equal(bought.accepted,true);assert.equal(life.funds,120);assert.equal(s.criminalInventory.drugParcel,1);assert.equal(s.crimeEvidence.length,1);
});
test('police report needs lived evidence, creates a persistent investigation and never convicts automatically',()=>{
 let data;const storage={getItem:()=>data,setItem:(_,v)=>data=v};
 const s=createSocialSim([...roster,{id:'king',name:'King',group:'last-kings'},{id:'officer',name:'Officer',group:'policia'}],{storage,random:()=>0});
 const police=s.relation('player','officer');Object.assign(police,{friend:10,trust:12});
 assert.match(s.unavailable('player','officer','reportCrime'),/fato vivido/);
 const gang=s.relation('player','king');Object.assign(gang,{friend:30,trust:40});const life={funds:200,debit(amount){this.funds-=amount;return true;}};
 s.interact('player','king','buyStreetParcel',{cityLife:life});
 const result=s.interact('player','officer','reportCrime');assert.ok(result.investigation);assert.equal(result.investigation.status,'Recebida · em apuração');assert.equal(result.investigation.suspectId,'king');
 assert.equal(s.unavailable('player','officer','reportCrime'), 'Você ainda não tem um fato vivido ou uma pista concreta para relatar.');
 s.save();const loaded=createSocialSim([...roster,{id:'king',name:'King',group:'last-kings'},{id:'officer',name:'Officer',group:'policia'}],{storage});
 assert.equal(loaded.investigations[0].status,'Recebida · em apuração');assert.equal(loaded.investigations[0].suspectId,'king');assert.equal(loaded.criminalInventory.drugParcel,1);
});
test('every numeric prerequisite is enforced below its threshold, including accumulated hostility',()=>{
 for(const [id,s] of Object.entries(SOCIAL_ACTIONS)){
  const r={friend:100,trust:100,intimacy:100,romance:100,hostility:s.gate.hostility,dating:!!s.gate.dating,hurt:5,memories:['dreams','secret'].map(action=>({action,accepted:true}))};
  assert.equal(progressionReason(s,r,{hasEvidence:true,hasCase:true}),'',id);
  for(const key of ['friend','trust','intimacy','romance','hostility'])if(s.gate[key]>(['friend','trust','romance'].includes(key)?-100:0)){
   assert.ok(progressionReason(s,{...r,[key]:s.gate[key]-1},{hasEvidence:true,hasCase:true}),`${id}: ${key}`);
  }
  if(s.gate.maxHostility!=null)assert.ok(progressionReason(s,{...r,hostility:s.gate.maxHostility+1},{hasEvidence:true,hasCase:true}),id+' resentment');
 }
});
test('dating stays locked until every strong-bond threshold is met, with no effects while locked',()=>{
 const s=make(),r=s.relation('player','aiko-sakura');Object.assign(r,{friend:90,trust:90,intimacy:80,romance:69});
 const before=JSON.stringify(r);assert.match(actionUnavailable(s,'aiko-sakura','date'),/Romance 69\/70/);assert.equal(s.interact('player','aiko-sakura','date').ok,false);assert.equal(JSON.stringify(r),before);
 r.romance=70;assert.equal(s.unavailable('player','aiko-sakura','date'),'');assert.equal(s.interact('player','aiko-sakura','date').accepted,true);
});
test('intimate and hostile branches require their history, not only high scores',()=>{
 const s=make(),r=s.relation('player','aiko-sakura');assert.match(s.unavailable('player','aiko-sakura','swear'),/Hostilidade/);
 r.hostility=25;assert.equal(s.unavailable('player','aiko-sakura','swear'),'');assert.match(s.unavailable('player','aiko-sakura','humiliate'),/Hostilidade/);
 Object.assign(r,{friend:70,trust:70,intimacy:60,hostility:60});assert.match(s.unavailable('player','aiko-sakura','revealSecret'),/confidência/);assert.match(s.unavailable('player','aiko-sakura','mockDream'),/sonhos/);
 r.memories.push({action:'secret',accepted:true,time:0,text:'Confiança compartilhada.'});assert.equal(s.unavailable('player','aiko-sakura','revealSecret'),'');
});
test('intimacy and hostility grow from experiences and migrate existing saves without wiping bonds',()=>{
 const s=make(),r=s.relation('player','aiko-sakura');s.interact('player','aiko-sakura','greet');assert.ok(r.intimacy>0);wait(s,5);s.interact('player','aiko-sakura','insult');assert.ok(r.hostility>0);
 const old={version:1,time:50,relations:[['aiko-sakura|player',{friend:60,trust:50,romance:45,memories:[]}]]};const migrated=createSocialSim(roster,{storage:{getItem:()=>JSON.stringify(old)}}).relation('player','aiko-sakura');assert.equal(migrated.friend,60);assert.ok(migrated.intimacy>0);assert.equal(migrated.romance,45);
});
test('older offense memories preserve the ability to repair a relationship after migration',()=>{
 const old={version:1,relations:[['aiko-sakura|player',{friend:-16,trust:-12,romance:0,memories:[{action:'insult',actor:'player',accepted:true,time:0,text:'Uma ofensa antiga.'}]}]]};
 const s=createSocialSim(roster,{storage:{getItem:()=>JSON.stringify(old)}});assert.ok(s.relation('player','aiko-sakura').hurt>0);assert.equal(s.unavailable('player','aiko-sakura','apologize'),'');
});
function autonomousFixture(distance=2){
 const sim=make(),npc={lookId:'aiko-sakura',x:distance,y:0,walk:1,speed:0},player={x:0,y:0};let busy=false,offers=0,replies=0,data;
 const ai=createSocialAutonomy({sim:()=>sim,actors:()=>[npc],player:()=>player,eligible:()=>true,blocked:()=>busy,canTalk:n=>Math.hypot(n.x,n.y)<4,speak(){},offer:d=>{data=d;offers++;},reply:(n,action)=>{replies++;sim.interact('player',n.lookId,action);},random:()=>0});
 return {sim,npc,player,ai,set busy(value){busy=value;},get offers(){return offers;},get replies(){return replies;},get data(){return data;}};
}
test('NPC initiates a greeting without choosing an answer or changing player relationships',()=>{
 const f=autonomousFixture();wait(f.sim,11);f.ai.update(0);assert.equal(f.offers,1);assert.equal(f.data.action,'greet');assert.equal(f.replies,0);assert.equal(f.sim.relation('player',f.npc.lookId).friend,0);
 assert.equal(f.ai.respond('reply'),true);assert.equal(f.replies,1);
 assert.ok(f.sim.relation('player',f.npc.lookId).friend>0);
});
test('NPC approaches using normal movement and aborts when the player becomes busy',()=>{
 const f=autonomousFixture(7);wait(f.sim,11);f.ai.update(0);assert.equal(f.ai.approaching,f.npc);assert.deepEqual(f.npc.target,{x:0,y:0});assert.equal(f.npc.x,7);
 f.busy=true;f.ai.update(.1);assert.equal(f.ai.approaching,null);assert.equal(f.npc.target,undefined);assert.equal(f.offers,0);
});
test('an approach becomes a conversation only after reaching talking distance',()=>{
 const f=autonomousFixture(7);wait(f.sim,11);f.ai.update(0);assert.equal(f.offers,0);f.npc.x=3;f.ai.update(.1);assert.equal(f.offers,1);assert.equal(f.ai.approaching,null);assert.equal(f.npc.target,undefined);
});
test('declining, expiration and personal boundaries prevent repeated interruptions',()=>{
 const f=autonomousFixture();wait(f.sim,11);f.ai.update(0);f.ai.respond('ignore');wait(f.sim,40);f.ai.update(0);assert.equal(f.offers,1);assert.equal(f.replies,0);
 wait(f.sim,90);f.ai.update(0);assert.equal(f.offers,2);wait(f.sim,16);f.ai.update(0);assert.equal(f.ai.active,false);
 f.sim.relation('player',f.npc.lookId).blockedUntil=f.sim.time+500;wait(f.sim,130);f.ai.update(0);assert.equal(f.offers,2);
});
test('NPC flirting obeys the same progression gates, so strangers cannot start an intimate conversation',()=>{
 const s=make();for(let i=0;i<10;i++){const intent=s.initiative('aiko-sakura');assert.equal(intent.action,'greet');assert.equal(s.unavailable('aiko-sakura','player',intent.action),'');}
 const r=s.relation('player','aiko-sakura');Object.assign(r,{friend:70,trust:60,intimacy:50,romance:55});const intent=s.initiative('aiko-sakura');assert.equal(intent.action,'warmLook');assert.equal(s.unavailable('aiko-sakura','player',intent.action),'');
});

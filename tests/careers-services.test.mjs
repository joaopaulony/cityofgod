// Polícia e SAMU: chamados do turno (jobs.mjs) e os imóveis liberados pelo cargo (Segurança Privada / Base de Ambulâncias)
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {POLICE_CALLS,SAMU_CALLS,CASES,QUIZ,GREET} from '../js/careers-content.mjs';
import {PROFESSIONS} from '../js/careers-core.mjs';
const require=createRequire(import.meta.url);
const A=require('../js/architecture-plan.js');

const validStep=s=>s.type==='choice'?s.options.length===4&&s.answer>=0&&s.answer<4&&s.q:
 s.type==='timing'?s.zone[0]<s.zone[1]&&s.zone[0]>0&&s.zone[1]<1:s.type==='sequence'&&s.keys.length>=3&&s.keys.every(k=>/^[WASD]$/.test(k));

test('chamados da polícia e do SAMU têm minigame válido e casos leves para o 1º cargo',()=>{
 for(const [list,flag] of [[POLICE_CALLS,'danger'],[SAMU_CALLS,'grave']]){
  assert.ok(list.length>=5);
  assert.ok(list.some(c=>!c[flag]),'há chamados para quem está começando');
  assert.ok(list.some(c=>c[flag]),'há chamados que só liberam com cargo');
  for(const c of list){assert.ok(c.code&&c.ask);assert.ok(c.steps.length>=2&&c.steps.every(validStep),c.code);}
 }
 assert.ok(POLICE_CALLS.some(c=>c.arrest),'algum chamado termina em prisão');
});

test('imóveis da polícia e do SAMU: casos de clientes, saudação e quiz do curso',()=>{
 for(const id of ['police','paramedic']){
  const P=PROFESSIONS[id];
  assert.ok(P.business&&P.career.startsWith('svc:'),id);
  assert.ok(CASES[id].length>=5&&CASES[id].every(c=>c.ask&&c.steps.every(validStep)),id);
  assert.ok(GREET[id]&&QUIZ[id].length>=6,id);
 }
});

test('planta da Segurança Privada e da Base de Ambulâncias tem recepção e o ponto de atendimento',()=>{
 for(const [kind,tag,rooms] of [['security','client',['secwait','secoffice','monitoring','armory','lockers']],['ambulancebase','exam',['ambwait','ambcare','ambgarage','dispatch','medstock']]])
  for(const seed of [1,2,3]){
   const L=A.makePlan({width:24,depth:18,kind,seed,floors:1,height:3}).levels[0];
   for(const r of rooms)assert.ok(L.rooms.some(x=>x.use===r),kind+' sem '+r);
   assert.ok(L.furniture.some(f=>f.service==='desk'),kind+': recepção');
   assert.ok(L.furniture.some(f=>f.service===tag),kind+': '+tag);
  }
});

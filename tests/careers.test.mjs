// Profissões: regras de curso/aula/formatura/negócio (careers-core.mjs), conteúdo e o planejador do piloto automático.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DAY,PERIODS,PROFESSIONS,LESSONS_PER_YEAR,lessonsFor,enrollCourse,classWindow,nextClass,needsPayment,payTuition,finishLesson,
 newBusiness,priceRange,setPrice,clientInterval,servicePay,registerService,levelXP,MAX_LEVEL,scoreTiming,scoreSequence,MIN_ATTEND} from '../js/careers-core.mjs';
import {QUIZ,CASES} from '../js/careers-content.mjs';
const require=createRequire(import.meta.url);
const Plan=require('../js/autopilot.js');

test('oito cursos: seis com negócio próprio e dois serviços públicos (polícia e SAMU); cada ano = meio mês (15 aulas)',()=>{
 assert.equal(Object.keys(PROFESSIONS).length,8);
 for(const [id,p] of Object.entries(PROFESSIONS)){
  assert.equal(lessonsFor(id),p.years*LESSONS_PER_YEAR);
  assert.ok(QUIZ[id].length>=6,'perguntas '+id);
  if(p.business){assert.ok(p.business.price>0&&p.business.min<p.business.base&&p.business.base<p.business.max,id);assert.ok(CASES[id].length>=5,'casos '+id);}
  else assert.ok(p.career==='svc:police'||p.career==='svc:paramedic',id+' sem negócio precisa de carreira pública');
 }
 assert.equal(Math.min(...Object.keys(PROFESSIONS).map(lessonsFor)),15);
 assert.equal(lessonsFor('medic'),90);
});
test('conteúdo: toda pergunta e todo caso têm resposta válida e passos jogáveis',()=>{
 for(const [id,list] of Object.entries(QUIZ))for(const [q,opts,ans] of list){assert.ok(q&&opts.length===4&&ans>=0&&ans<4,id+': '+q);}
 for(const [id,list] of Object.entries(CASES))for(const c of list){
  assert.ok(c.ask&&c.steps.length>=3,id);
  for(const s of c.steps){
   if(s.type==='choice')assert.ok(s.options.length>=3&&s.answer>=0&&s.answer<s.options.length);
   else if(s.type==='timing')assert.ok(s.zone[0]<s.zone[1]&&s.zone[0]>=0&&s.zone[1]<=1);
   else if(s.type==='sequence')assert.ok(s.keys.length>=3&&s.keys.every(k=>'WASD'.includes(k)));
   else assert.fail('passo desconhecido '+s.type);
  }
 }
});
test('matrícula, janela da aula, presença mínima e formatura',()=>{
 const st={course:null,degrees:{}};
 assert.equal(enrollCourse(st,'barber','madrugada',0).ok,false);
 const e=enrollCourse(st,'barber','manha',2);assert.ok(e.ok);assert.equal(e.cost,PROFESSIONS.barber.enroll+PROFESSIONS.barber.tuition);
 assert.equal(enrollCourse(st,'chef','manha',2).ok,false,'um curso por vez');
 const P=PERIODS.manha,day=3,at=m=>day*DAY+m;
 assert.ok(classWindow(st.course,at(P.start-60)).before);
 assert.ok(classWindow(st.course,at(P.start+10)).open);
 assert.ok(classWindow(st.course,at(P.start+90)).after,'entrada fecha 1 h depois');
 assert.equal(nextClass(st.course,at(P.start+90)),at(P.start)+DAY);
 // saiu cedo: não conta
 assert.equal(finishLesson(st,at(P.start+60),{minutes:MIN_ATTEND-1,correct:3,asked:3}).ok,false);
 // aula inteira: conta uma vez por dia
 const r=finishLesson(st,at(P.end),{minutes:P.end-P.start,correct:3,asked:3});
 assert.ok(r.ok&&r.grade===10);
 assert.equal(finishLesson(st,at(P.end),{minutes:240,correct:3,asked:3}).ok,false,'só uma presença por dia');
 // mensalidade: a cada 15 aulas
 for(let d=4;d<4+14;d++)finishLesson(st,d*DAY+P.end,{minutes:240,correct:2,asked:3});
 assert.equal(st.course.attended.length,15);assert.ok(needsPayment(st.course));payTuition(st.course);assert.ok(!needsPayment(st.course));
 let last;for(let d=18;d<18+15;d++)last=finishLesson(st,d*DAY+P.end,{minutes:240,correct:3,asked:3});
 assert.ok(last.graduated,'formou com 30 aulas');assert.equal(st.course,null);assert.ok(st.degrees.barber.gpa>8);
 assert.equal(enrollCourse(st,'barber','tarde',40).ok,false,'já formado');
});
test('negócio: faixa de preço sobe com o nível, preço caro afasta clientes, minigame paga mais que o automático',()=>{
 const st={degrees:{vet:{gpa:9}}},b=newBusiness(st,'vet');
 assert.ok(b.rep>30,'nota alta dá reputação inicial maior');
 const r1=priceRange('vet',1),r9=priceRange('vet',9);assert.ok(r9.max>r1.max&&r9.fair>r1.fair);
 assert.equal(setPrice(b,999999),r1.max);assert.equal(setPrice(b,1),r1.min);
 setPrice(b,r1.fair);const fair=clientInterval(b);setPrice(b,r1.max);assert.ok(clientInterval(b)>fair,'caro = menos clientes');
 setPrice(b,r1.fair);
 assert.ok(servicePay(b,{score:1,auto:false})>servicePay(b,{score:1,auto:true}));
 assert.ok(servicePay(b,{score:0,auto:false})<servicePay(b,{score:1,auto:false}));
 // XP sobe de nível e não passa do máximo
 let lv=1;for(let i=0;i<2000;i++)lv=registerService(b,{score:.9,auto:false}).level;
 assert.equal(lv,MAX_LEVEL);assert.ok(b.xp<=levelXP(MAX_LEVEL));assert.ok(b.rep<=100&&b.rep>=0);
});
test('minigames: pontuação de agulha e sequência',()=>{
 assert.equal(scoreTiming(.5,.4,.6),1);assert.ok(scoreTiming(.6,.4,.6)>=.69);assert.ok(scoreTiming(.95,.4,.6)<.1);
 assert.equal(scoreSequence(4,4,0,8),1);assert.ok(scoreSequence(4,6,0,8)<.7);assert.ok(scoreSequence(4,4,8,8)<1);
});
test('piloto automático: rota vai pela calçada (nunca no asfalto) e marca a travessia',()=>{
 // duas ruas em L: eixo y=0 (x de 0 a 100) e eixo x=100 (y de 0 a 100); ROAD_W=3.5, SIDE=2
 const ROAD_W=3.5,SIDE=2,roadDist=(x,y)=>Math.min(x>=-5&&x<=105?Math.abs(y):99,y>=-5&&y<=105?Math.abs(x-100):99,Math.hypot(x,y),Math.hypot(x-100,y));
 const env={roadDist,ROAD_W,SIDE};
 const dest={x:110,y:90};   // à direita da rua vertical
 const path=Plan.planSidewalk([[0,0],[100,0],[100,90]],dest,env);
 assert.ok(path.length>10);
 for(const q of path){const d=roadDist(q.x,q.y);assert.ok(d>=ROAD_W&&d<=ROAD_W+SIDE+.6,'fora da calçada: '+d.toFixed(2));}
 // lado do destino na rua vertical
 assert.ok(path[path.length-1].x>100);
 Plan.markCrossings([{x:-2,y:-8},...path],env);
 assert.ok(path.some(q=>q.cross),'há travessia na esquina');
});

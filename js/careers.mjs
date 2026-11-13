// careers.mjs — profissões da Universidade City of God, no jogo:
//  · matrícula pelo celular (app Carreira), com período; aula diária na sala do curso, no campus — o jogador senta, o
//    professor dá a aula (colegas na sala), perguntas da matéria valem nota; dá p/ acelerar o tempo da aula;
//  · piloto automático (autopilot.js) até a sala de aula e até o próprio negócio;
//  · formado, compra o estabelecimento da profissão (prédio mobiliado no mapa — civic.js / architecture-plan.js) e atende:
//    clientes NPC chegam e esperam na recepção; atendimento com minigame (paga mais) ou automático (55%); experiência
//    sobe o nível, o teto do preço e a reputação. Com o negócio em "modo automático" a equipe atende sozinha (rende menos).
// Regras puras em careers-core.mjs; perguntas e casos em careers-content.mjs.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createAnimatedPet} from './pet-animated.mjs';
import {DAY,PERIODS,PROFESSIONS,lessonsFor,enrollCourse,classWindow,nextClass,needsPayment,payTuition,finishLesson,dropCourse,
 newBusiness,priceRange,setPrice,clientInterval,registerService,levelXP,MAX_LEVEL,scoreTiming,scoreSequence,average,MIN_ATTEND,dayTime} from './careers-core.mjs';
import {QUIZ,CASES,GREET} from './careers-content.mjs';

const KEY='cityofgod.careers.v1';
const OPEN_FROM=8*60,OPEN_TO=20*60;   // horário comercial
const DOGS=['husky','shibainu','sharpei','benny'];
const CARS=['sedan','hatchback','compact','suv','pickup','wagon'];
const pick=a=>a[(Math.random()*a.length)|0];
const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};
const d2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function installCareers(scene,bridge){
 const G=()=>window.__game,P=()=>bridge.player,clock=()=>G()?.st?.clock||0,chars=()=>window.cityCharacters;
 const money=n=>typeof CityLife!=='undefined'?CityLife.money(n):'R$ '+n;
 const notify=(t,ok=true)=>{window.CityUI?.notify?.(t);window.CityAudio?.ui?.(ok?'confirm':'back');};
 // ---------- estado salvo ----------
 let state={course:null,degrees:{},biz:{},autoT:0};
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&typeof raw==='object')state={...state,...raw,degrees:raw.degrees||{},biz:raw.biz||{}};}catch{}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({course:state.course,degrees:state.degrees,biz:state.biz}));}catch{}};
 // ---------- lugares ----------
 const sites=()=>typeof world!=='undefined'?world.civicSites||[]:[];
 const houseList=()=>bridge.houses||(typeof houses!=='undefined'?houses:[]);
 const campusSite=()=>sites().find(s=>s.kind==='university');
 const campusHouse=()=>houseList().find(H=>H.miaKind==='university'&&H.architecture);
 const bizSite=id=>sites().find(s=>s.profession===id);
 const bizHouse=id=>houseList().find(H=>H.business===id&&H.architecture);
 const A2W=(H,x,y)=>{const w=H.architecture.toWorld(x,y);return {x:w[0],y:w[1]};};
 const roomsOf=(H,use)=>H.architecture.levels[0].rooms.filter(r=>r.use===use);
 const furnOf=(H,room,pred)=>H.architecture.levels[0].furniture.filter(f=>f.room===room.id&&pred(f));
 const inRoom=(H,room,p)=>{const q=H.architecture.toLocal(p.x,p.y);return q[0]>room.x0&&q[0]<room.x1&&q[1]>room.y0&&q[1]<room.y1;};
 // porta (local) entre um cômodo e o corredor, e os pontos no corredor e logo dentro do cômodo
 function roomDoor(H,room){
  const L=H.architecture.levels[0];
  for(const w of L.walls){
   if(!w.rooms.includes(room.id)||!w.rooms.includes('hall'))continue;
   const o=w.openings.find(o=>o.kind==='door');if(!o)continue;
   const len=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),x=w.a[0]+(w.b[0]-w.a[0])*o.at/len,y=w.a[1]+(w.b[1]-w.a[1])*o.at/len;
   const cx=(room.x0+room.x1)/2,cy=(room.y0+room.y1)/2,vertical=Math.abs(w.a[0]-w.b[0])<.01;
   const sx=vertical?Math.sign(cx-x):0,sy=vertical?0:Math.sign(cy-y);
   return {door:A2W(H,x,y),hall:A2W(H,x-sx*1.3,y-sy*1.3),inside:A2W(H,x+sx*1.2,y+sy*1.2)};
  }
  return null;
 }
 const entryPoint=H=>{const e=H.architecture.levels[0].entry;return A2W(H,e[0],e[1]-1.2);};
 // caminho dentro do prédio: entrada → corredor → porta → dentro da sala → alvo
 const pathTo=(H,room,target)=>{const d=roomDoor(H,room);return d?[entryPoint(H),d.hall,d.door,d.inside,target]:[entryPoint(H),target];};

 // ========== AULAS ==========
 let lesson=null,lessonUI=null;
 const roomFor=id=>{const H=campusHouse();if(!H)return null;return roomsOf(H,PROFESSIONS[id].room)[0]||null;};
 // lugares da sala: cadeiras (auditório, sala) ou a frente das bancadas (laboratório); quadro/púlpito p/ o professor
 function classLayout(H,room){
  const A=H.architecture,cx=(room.x0+room.x1)/2;
  const board=A2W(H,cx,room.y0+.4);
  let seats=furnOf(H,room,f=>f.kind==='chair').map(f=>({...A2W(H,f.x,f.y),ly:f.y}));
  // laboratório: a bancada traz a própria cadeira (+0,45 m atrás do tampo, virada p/ a lousa); sala sem cadeiras soltas: atrás da carteira
  if(seats.length<4)seats=furnOf(H,room,f=>f.kind==='policedesk'||f.kind==='studentdesk').map(f=>({...A2W(H,f.x,f.y+(f.kind==='policedesk'?.45:.7)),ly:f.y}));
  seats.sort((a,b)=>a.ly-b.ly||d2(a,board)-d2(b,board));
  const teacherF=furnOf(H,room,f=>f.kind==='lectern'||f.kind==='desk')[0];
  const teacher=teacherF?A2W(H,teacherF.x,teacherF.y+.8):A2W(H,cx,room.y0+1.4);
  return {board,seats,teacher};
 }
 function canStartLesson(p){
  const c=state.course;if(!c)return null;
  const H=campusHouse(),room=roomFor(c.id);if(!H||!room||!H.inside||(p.floor||0)!==0||!inRoom(H,room,p))return null;
  return {H,room,w:classWindow(c,clock())};
 }
 function startLesson(p){
  const ctx=canStartLesson(p);if(!ctx)return null;const c=state.course,w=ctx.w,P0=PERIODS[c.period];
  if(w.attendedToday)return 'Você já assistiu a aula de hoje. Próxima: '+dayTime(w.day+1,P0.start)+'.';
  if(w.before)return 'A aula de '+PROFESSIONS[c.id].title+' começa às '+fmt(P0.start)+'. Chegue até 20 min antes para pegar lugar.';
  if(w.after)return 'A entrada fecha 1 h depois do início ('+fmt(P0.start+60)+'). Volte amanhã às '+fmt(P0.start)+'.';
  if(needsPayment(c)){
   const t=PROFESSIONS[c.id].tuition;
   if(typeof CityLife==='undefined'||!CityLife.debit(t,'Mensalidade · '+PROFESSIONS[c.id].title))return 'Mensalidade em aberto ('+money(t)+'). Pague pelo celular (app Carreira) para assistir.';
   payTuition(c);save();notify('Mensalidade paga: '+money(t)+'.');
  }
  const {H,room}=ctx,lay=classLayout(H,room);if(!lay.seats.length)return 'A sala ainda está sendo arrumada.';
  const seat=lay.seats[Math.min(lay.seats.length-1,3)],face=Math.atan2(lay.board.y-seat.y,lay.board.x-seat.x);
  if(typeof CityLife!=='undefined'&&p.armed)CityLife.equip('unarmed',false);
  p.x=seat.x;p.y=seat.y;p.face=face;p.speed=0;p.homeAction={kind:'sit',t:0,duration:1e9,lesson:true};
  const end=w.start+(P0.end-P0.start),start=Math.max(clock(),w.start);
  lesson={day:w.day,start,end,minutes:0,asked:0,correct:0,quiz:null,quizAt:[.3,.6,.85],seat,face,npcs:[],H,room,topic:PROFESSIONS[c.id].topics[c.attended.length%PROFESSIONS[c.id].topics.length],fast:true,last:clock()};
  if(end-start<MIN_ATTEND)notify('Atrasado: faltam menos de '+Math.round(MIN_ATTEND/60*10)/10+' h de aula — a presença não vai contar hoje.',false);
  window.CityTimeScale=10;
  spawnClass(lay,seat);showLesson();
  return 'Aula de '+PROFESSIONS[c.id].title+': '+lesson.topic+'.';
 }
 async function spawnClass(lay,seat){
  const L=lesson,ch=chars();if(!ch?.spawnExtra)return;
  const prof=await ch.spawnExtra(lay.teacher.x,lay.teacher.y,{face:Math.atan2(seat.y-lay.teacher.y,seat.x-lay.teacher.x)});
  if(lesson!==L){ch.removeExtra(prof);return;}
  if(prof){L.npcs.push(prof);ch.say(prof,'Bom dia, turma! Hoje: '+L.topic+'.','📚');}
  for(const s of lay.seats.filter(s=>s!==seat).sort(()=>Math.random()-.5).slice(0,Math.min(5,lay.seats.length-1))){
   const n=await ch.spawnExtra(s.x,s.y,{face:Math.atan2(lay.board.y-s.y,lay.board.x-s.x)});
   if(lesson!==L){ch.removeExtra(n);return;}
   if(n){n.homeAction={kind:'sit',t:0,duration:1e9};L.npcs.push(n);}
  }
 }
 // levanta da carteira: o assento fica entre a fileira de mesas e a da frente; dá um passo até o corredor livre mais próximo
 // (um ponto de onde se chega à porta da sala), senão o aluno fica preso entre as carteiras
 function standUp(p,L){
  const free=(x,y)=>{if(typeof collide!=='function')return true;const q=collide(x,y,.28,0);return Math.hypot(q[0]-x,q[1]-y)<=.04;};
  const d=roomDoor(L.H,L.room),grid=window.CityAutopilot?.gridPath;if(!d)return;
  for(let r=.5;r<=6;r+=.25)for(let k=0;k<24;k++){
   const a=k/24*Math.PI*2,x=L.seat.x+Math.cos(a)*r,y=L.seat.y+Math.sin(a)*r;
   if(!free(x,y)||!inRoom(L.H,L.room,{x,y}))continue;
   if(grid&&!grid({x,y},d.inside,40000,L.H,.25))continue;
   p.x=x;p.y=y;return;
  }
 }
 function endLesson(reason){
  const L=lesson;if(!L)return;lesson=null;window.CityTimeScale=1;
  const p=P();if(p.homeAction?.lesson){p.homeAction=null;standUp(p,L);}
  for(const n of L.npcs)chars()?.removeExtra(n);
  hideLesson();
  const r=finishLesson(state,L.start+L.minutes,{minutes:L.minutes,correct:L.correct,asked:L.asked});save();
  if(r.graduated){const G0=PROFESSIONS[r.graduated.id];notify('🎓 Formatura! Você agora é '+G0.pro+' (média '+r.graduated.gpa.toFixed(1)+'). '+(G0.career?'Candidate-se a '+G0.pro+' no app Empregos'+(G0.business?'; com experiência (cargo 4) você poderá abrir '+G0.business.name+'.':'.'):G0.business?'Já dá para comprar o ponto — '+G0.business.name+' — pelo app Carreira.':'Entre na carreira de '+G0.pro+' pelo app Carreira.'));window.CityAudio?.ui?.('confirm');}
  else notify((reason?reason+' ':'')+r.text,r.ok);
 }
 function tickLesson(dt){
  const L=lesson;if(!L)return;const p=P(),now=clock();
  // levantou (tecla de andar) ou foi tirado da cadeira
  const inp=G()?.input,moving=inp&&['w','a','s','d'].some(k=>inp.down(k));
  if(moving||p.dead||!p.homeAction?.lesson){endLesson('Você saiu da aula.');return;}
  p.x=L.seat.x;p.y=L.seat.y;p.face=L.face;p.speed=0;
  if(!L.quiz){L.minutes=Math.max(0,Math.min(now,L.end)-L.start);}
  const frac=L.minutes/Math.max(1,L.end-L.start);
  if(!L.quiz&&L.quizAt.length&&frac>=L.quizAt[0]){L.quizAt.shift();askQuiz();}
  if(L.quiz){L.quiz.t-=dt;if(L.quiz.t<=0)answerQuiz(-1);}
  if(now>=L.end&&!L.quiz){L.minutes=L.end-L.start;endLesson('Fim da aula.');return;}
  renderLesson();
 }
 function askQuiz(){
  const L=lesson,c=state.course,bank=QUIZ[c.id],[q,opts,ans]=bank[(c.attended.length*3+L.asked)%bank.length];
  const order=shuffle(opts.map((o,i)=>i));L.quiz={q,options:order.map(i=>opts[i]),answer:order.indexOf(ans),t:25};window.CityTimeScale=1;
  const prof=L.npcs[0];if(prof)chars()?.say(prof,'Pergunta pra turma!','❓');
  renderLesson(true);
 }
 function answerQuiz(i){
  const L=lesson;if(!L?.quiz)return;const ok=i===L.quiz.answer;L.asked++;if(ok)L.correct++;
  const right=L.quiz.options[L.quiz.answer];L.quiz=null;window.CityTimeScale=L.fast?10:1;
  const prof=L.npcs[0];if(prof)chars()?.say(prof,ok?'Isso mesmo, muito bem!':'Não exatamente: é "'+right+'".',ok?'👏':'📖');
  renderLesson(true);
 }
 const fmt=m=>{m=((m%DAY)+DAY)%DAY;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');};

 // ---------- painel da aula ----------
 function ensureStyles(){
  if(document.getElementById('careers-css'))return;
  const css=document.createElement('style');css.id='careers-css';css.textContent=`
.cr-panel{position:fixed;z-index:61;background:#fff;color:#1d2125;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:14px/1.4 "Segoe UI",system-ui,sans-serif}
.cr-panel h3{margin:0 0 2px;font-size:17px}.cr-panel small{color:#6b737a}.cr-panel .cr-bar{height:6px;border-radius:3px;background:#e9ecef;overflow:hidden;margin:10px 0}
.cr-panel .cr-bar i{display:block;height:100%;background:#1d2125;transition:width .3s}.cr-panel button{font:inherit;cursor:pointer;border-radius:10px;border:1px solid #dfe3e7;background:#fff;padding:8px 12px}
.cr-panel button:hover{border-color:#1d2125}.cr-panel button.cr-main{background:#1d2125;color:#fff;border-color:#1d2125}.cr-panel .cr-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#cr-lesson{left:50%;bottom:24px;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));padding:14px 16px}
#cr-lesson .cr-q{margin-top:10px;padding:10px;border-radius:12px;background:#f4f5f6}#cr-lesson .cr-q b{display:block;margin-bottom:8px}
#cr-lesson .cr-opts{display:grid;grid-template-columns:1fr 1fr;gap:6px}#cr-lesson .cr-opts button{text-align:left}
#cr-game,#cr-client{left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));padding:18px 20px}
#cr-game .cr-step{font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#8b939a}#cr-game .cr-ask{margin:6px 0 12px;padding:10px 12px;border-radius:12px;background:#f4f5f6;font-style:italic}
#cr-game .cr-meter{position:relative;height:34px;border-radius:10px;background:#eceff1;margin:12px 0;overflow:hidden}#cr-game .cr-zone{position:absolute;top:0;bottom:0;background:#9ad7b0}
#cr-game .cr-needle{position:absolute;top:-2px;bottom:-2px;width:4px;margin-left:-2px;background:#1d2125;border-radius:2px}
#cr-game .cr-keys{display:flex;gap:8px;justify-content:center;margin:12px 0}#cr-game .cr-keys span{width:44px;height:44px;border-radius:10px;border:2px solid #dfe3e7;display:grid;place-items:center;font-weight:700;font-size:18px}
#cr-game .cr-keys span.ok{background:#1d2125;color:#fff;border-color:#1d2125}#cr-game .cr-keys span.cur{border-color:#e8a33d}#cr-game .cr-score{font-size:28px;font-weight:800}
`;document.head.append(css);
 }
 function showLesson(){ensureStyles();if(!lessonUI){lessonUI=document.createElement('section');lessonUI.id='cr-lesson';lessonUI.className='cr-panel';document.body.append(lessonUI);
  lessonUI.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!lesson)return;
   if(b.dataset.ans)answerQuiz(Number(b.dataset.ans));else if(b.dataset.act==='fast'){lesson.fast=!lesson.fast;window.CityTimeScale=lesson.quiz?1:lesson.fast?10:1;renderLesson(true);}else if(b.dataset.act==='leave'){P().homeAction=null;endLesson('Você saiu da aula.');}});}
  lessonUI.hidden=false;renderLesson(true);}
 function hideLesson(){if(lessonUI)lessonUI.hidden=true;}
 let lessonKey='';
 // a estrutura só é redesenhada quando muda (pergunta nova/respondida, modo); barra e contadores são atualizados no lugar —
 // redesenhar tudo a cada segundo recriava os botões e o clique do jogador se perdia
 function renderLesson(force=false){
  const L=lesson;if(!L||!lessonUI)return;const c=state.course,frac=Math.min(1,L.minutes/Math.max(1,L.end-L.start));
  const key=(L.quiz?L.quiz.q:'-')+'|'+L.fast+'|'+L.asked;
  if(force||key!==lessonKey){lessonKey=key;
   lessonUI.innerHTML=`<small>${PROFESSIONS[c.id].icon} ${esc(PROFESSIONS[c.id].title)} · aula ${c.attended.length+1}/${lessonsFor(c.id)} · <span class="cr-clock"></span></small><h3>${esc(L.topic)}</h3>
    <div class="cr-bar"><i></i></div><small class="cr-progress"></small>
    ${L.quiz?`<div class="cr-q"><b>${esc(L.quiz.q)} <small class="cr-t"></small></b><div class="cr-opts">${L.quiz.options.map((o,i)=>`<button data-ans="${i}">${esc(o)}</button>`).join('')}</div></div>`:''}
    <div class="cr-row"><button data-act="fast" title="${L.fast?'A aula está acelerada (10×)':'A aula está em tempo real'}">${L.fast?'▶ Voltar ao tempo real':'⏩ Acelerar a aula'}</button><button data-act="leave">Sair da aula</button></div>`;}
  lessonUI.querySelector('.cr-clock').textContent=fmt(clock());
  lessonUI.querySelector('.cr-bar i').style.width=Math.round(frac*100)+'%';
  lessonUI.querySelector('.cr-progress').textContent=Math.round(L.minutes)+' de '+Math.round(L.end-L.start)+' min · acertos '+L.correct+'/'+L.asked;
  const t=lessonUI.querySelector('.cr-t');if(t&&L.quiz)t.textContent='('+Math.ceil(L.quiz.t)+' s)';
 }

 // ========== NEGÓCIO ==========
 let work={clients:[],spawnT:6,service:null},gameUI=null,clientUI=null,carLoader=null;
 const ownedBiz=()=>Object.values(state.biz).filter(b=>b.owned);
 const myBizAt=p=>{for(const b of ownedBiz()){const H=bizHouse(b.id);if(H&&H.inside&&(p.floor||0)===0)return {b,H};}return null;};
 const serviceSpots=(H,tag)=>H.architecture.levels[0].furniture.filter(f=>f.service===tag).map(f=>({f,room:H.architecture.levels[0].rooms.find(r=>r.id===f.room),...A2W(H,f.x,f.y)}));
 function waitSpot(H){
  const desk=serviceSpots(H,'desk')[0];if(!desk)return entryPoint(H);
  const r=desk.room,cy=(r.y0+r.y1)/2,q=H.architecture.toLocal(desk.x,desk.y);
  return A2W(H,q[0]+(work.clients.length%2?1:-1)*.8,Math.min(r.y1-.8,q[1]+1.4+(cy>q[1]?0:0)));
 }
 // onde o dono recebe os clientes: em frente ao balcão da recepção, ao lado de quem espera
 function receptionPoint(H){const desk=serviceSpots(H,'desk')[0];if(!desk)return entryPoint(H);const q=H.architecture.toLocal(desk.x,desk.y);return A2W(H,q[0],Math.min(desk.room.y1-.6,q[1]+.75));}
 // onde o cliente fica e onde o profissional trabalha, por profissão
 const STATION={vet:'exam',medic:'exam',lawyer:'client',mechanic:'lift',chef:'table',barber:'chair',police:'client',paramedic:'exam'};
 const careerKey=id=>PROFESSIONS[id]?.career||'uni:'+id;
 function stationFor(b,H){
  const list=serviceSpots(H,STATION[b.id]);if(!list.length)return null;
  const busy=new Set(work.clients.map(c=>c.station?.f));const s=list.find(x=>!busy.has(x.f))||list[0];
  const r=s.room,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,q=H.architecture.toLocal(s.x,s.y);
  const toC=[cx-q[0],cy-q[1]],l=Math.hypot(...toC)||1;
  const worker=b.id==='chef'?(serviceSpots(H,'stove')[0]||s):A2W(H,q[0]+toC[0]/l*1.1,q[1]+toC[1]/l*1.1);
  const client=b.id==='vet'||b.id==='medic'||b.id==='paramedic'?A2W(H,q[0]+toC[0]/l*1.1-toC[1]/l*1.15,q[1]+toC[1]/l*1.1+toC[0]/l*1.15):b.id==='mechanic'?A2W(H,q[0]+toC[0]/l*2.4,q[1]+toC[1]/l*2.4):b.id==='chef'?A2W(H,q[0]-.92,q[1]):{x:s.x,y:s.y};
  return {...s,worker:{x:worker.x,y:worker.y},client,sit:['lawyer','chef','barber'].includes(b.id)};
 }
 async function spawnClient(b,H){
  const ch=chars();if(!ch?.spawnExtra)return;
  const at=entryPoint(H),spot=waitSpot(H);
  const c={b,H,state:'arriving',spot,case:pick(CASES[b.id]),pet:null,car:null};
  work.clients.push(c);
  const n=await ch.spawnExtra(at.x,at.y,{face:Math.atan2(spot.y-at.y,spot.x-at.x)});
  if(!n||!work.clients.includes(c)){if(n)ch.removeExtra(n);work.clients.splice(work.clients.indexOf(c),1);return;}
  c.npc=n;c.name=n.name||'Cliente';walkNPC(c,[spot],()=>{c.state='waiting';c.waitT=0;ch.say(n,GREET[b.id],'🙋');});
  if(b.id==='vet'){const breed=pick(DOGS),m=createAnimatedPet(breed,'original');m.root.userData.noSnow=true;scene.add(m.root);c.pet={m,breed,clock:0};}
  window.CityAudio?.ui?.('confirm');
 }
 // NPC andando por uma lista de pontos dentro do prédio: entre um ponto e outro desvia de paredes e móveis (A* do piloto)
 function walkNPC(c,points,done){
  const G=window.CityAutopilot?.gridPath,out=[];let cur=c.npc?{x:c.npc.x,y:c.npc.y}:null;
  for(const q of points){const g=G&&cur&&c.H&&G(cur,q,40000,c.H,.25);if(g)out.push(...g.slice(0,-1));out.push(q);cur=q;}
  c.walk={points:out,done};
 }
 function tickClient(c,dt){
  const n=c.npc;if(!n)return;
  if(c.walk){
   const q=c.walk.points[0];
   if(!q){const d=c.walk.done;c.walk=null;n.speed=0;d?.();}
   else{const dx=q.x-n.x,dy=q.y-n.y,l=Math.hypot(dx,dy);
    for(const sg of c.H?.architecture?.openingSegments||[])if(sg.door&&!sg.ext&&!(sg.floor>0)&&sg.doorAnim&&sg.doorAnim.target<1&&Math.hypot((sg.x1+sg.x2)/2-n.x,(sg.y1+sg.y2)/2-n.y)<1.5)sg.doorAnim.target=1;   // abre a porta interna à frente
    if(l<.12){c.walk.points.shift();}else{const v=Math.min(l,1.35*dt);n.x+=dx/l*v;n.y+=dy/l*v;n.face=Math.atan2(dy,dx);n.speed=1.35;n.moveA=n.face;}}
   n.socialUntil=1e12;n.target=null;
  }
  if(c.pet){const m=c.pet.m;c.pet.clock+=dt;
   const on=c.state==='service'&&c.station;const pos=on?{x:c.station.x,y:c.station.y}:{x:n.x+Math.cos(n.face+1.9)*.7,y:n.y+Math.sin(n.face+1.9)*.7};
   m.root.position.set(pos.x,on?.92:0,pos.y);m.root.rotation.y=-(n.face||0);m.root.visible=!!c.H.inside;
   m.animate({clock:c.pet.clock,phase:0,speed:c.walk?1:0,action:c.walk?'walk':'idle'},dt);}
  if(c.state==='waiting'){c.waitT+=dt;if(c.waitT>150){chars()?.say(n,'Demorou demais, vou embora.','😤');leave(c,false);}}
 }
 function leave(c,paid){
  const ch=chars(),n=c.npc;c.state='leaving';
  if(c.car){scene.remove(c.car);c.car=null;}
  if(n){n.homeAction=null;const out=c.H.doorPt?{x:c.H.doorPt[0],y:c.H.doorPt[1]+3}:entryPoint(c.H);
   walkNPC(c,[...(c.station?pathBack(c):[]),entryPoint(c.H),out],()=>dropClient(c));}
  else dropClient(c);
  if(!paid)c.b.rep=Math.max(0,c.b.rep-1.5),save();
 }
 // some de vez: NPC, cachorro e a entrada na lista
 function dropClient(c){
  if(c.npc){chars()?.removeExtra(c.npc);c.npc=null;}
  if(c.pet){scene.remove(c.pet.m.root);c.pet.m.dispose();c.pet=null;}
  if(c.car){scene.remove(c.car);c.car=null;}
  const i=work.clients.indexOf(c);if(i>=0)work.clients.splice(i,1);
 }
 const pathBack=c=>{const d=roomDoor(c.H,c.station.room);return d?[d.inside,d.door,d.hall]:[];};
 function tickBusiness(dt){
  const p=P(),here=myBizAt(p),hour=clock()%DAY,openHours=hour>=OPEN_FROM&&hour<OPEN_TO;
  // equipe no modo automático: atende sozinha (sem precisar estar lá), rende 55%
  for(const b of ownedBiz()){
   if(!b.open||!b.auto||!openHours)continue;
   b.autoT=(b.autoT||0)+dt;
   const every=clientInterval(b)*1.6;
   if(b.autoT>=every){b.autoT=0;const r=registerService(b,{score:window.CityCareer?.hasUnlock?.(careerKey(b.id),'rende mais')?.7:.55,auto:true});window.CityCareer?.addXP(careerKey(b.id),r.xp*.5);CityLife?.credit?.(r.pay,PROFESSIONS[b.id].business.name+' · atendimento automático');save();
    if(r.levelUp)notify('⭐ '+PROFESSIONS[b.id].business.name+' subiu para o nível '+r.level+'!');}
  }
  // atendimento presencial: clientes chegam na recepção enquanto você está lá
  if(here&&here.b.open&&!here.b.auto&&openHours){
   work.spawnT-=dt;
   const waiting=work.clients.filter(c=>c.b===here.b&&c.state!=='leaving').length;
   if(work.spawnT<=0&&waiting<2){work.spawnT=clientInterval(here.b)*(.6+Math.random()*.8);spawnClient(here.b,here.H);}
   // cargo 4 (chefe/sócio/dono): um auxiliar NPC atende outros clientes junto com você
   if(window.CityCareer?.hasUnlock?.(careerKey(here.b.id),'NPC')){work.assistT=(work.assistT||0)+dt;
    if(work.assistT>=clientInterval(here.b)*1.8){work.assistT=0;const r=registerService(here.b,{score:.6,auto:true});CityLife?.credit?.(r.pay,PROFESSIONS[here.b.id].business.name+' · auxiliar');save();notify('🤝 Seu auxiliar atendeu um cliente · +'+money(r.pay));}}
  }
  for(const c of work.clients.slice()){
   tickClient(c,dt);
   // o dono foi embora: quem ainda não foi atendido vai embora também; longe da vista, some na hora
   if(c.H&&!c.H.inside&&c.state!=='service'&&c.state!=='leaving'){if(d2(p,c.npc||c.spot)>60)dropClient(c);else leave(c,false);}
   else if(c.state==='leaving'&&d2(p,c.npc||c.spot)>80)dropClient(c);
  }
  if(work.service)tickService(dt);
 }
 // ---------- atendimento ----------
 function nearClient(p){return work.clients.find(c=>c.state==='waiting'&&c.npc&&d2(p,c.npc)<2.4);}
 function offerClient(c){
  ensureStyles();if(!clientUI){clientUI=document.createElement('section');clientUI.id='cr-client';clientUI.className='cr-panel';document.body.append(clientUI);
   clientUI.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const cl=clientUI.cl;clientUI.hidden=true;window.CityUI?.releaseInput?.();
    if(!cl||cl.state!=='waiting')return;if(b.dataset.act==='game')beginService(cl,false);else if(b.dataset.act==='auto')beginService(cl,true);else if(b.dataset.act==='no'){chars()?.say(cl.npc,'Tudo bem, volto outro dia.','🙂');leave(cl,false);}});}
  const b=c.b,P0=PROFESSIONS[b.id];clientUI.cl=c;clientUI.hidden=false;bridge.releaseControls?.();
  clientUI.innerHTML=`<small>${P0.icon} ${esc(P0.business.name)} · nível ${b.level}</small><h3>${esc(c.name)}${c.pet?' e o cachorro':''}</h3><p class="cr-ask" style="font-style:italic;background:#f4f5f6;padding:10px;border-radius:12px">“${esc(c.case.ask)}”</p>
   <small>${esc(P0.business.service)} · valor ${money(b.price)}</small>
   <div class="cr-row"><button class="cr-main" data-act="game">Atender eu mesmo (minigame · até ${money(Math.round(b.price*1.35))})</button><button data-act="auto">Atendimento rápido (${money(Math.round(b.price*.55))})</button><button data-act="no">Dispensar</button></div>`;
 }
 function beginService(c,auto){
  const st=stationFor(c.b,c.H);if(!st){notify('Não encontrei o posto de atendimento.',false);return;}
  c.state='service';c.station=st;c.auto=auto;
  const n=c.npc;n.homeAction=null;
  walkNPC(c,pathTo(c.H,st.room,st.client).slice(1),()=>{
   if(st.sit){n.homeAction={kind:'sit',t:0,duration:1e9};}
   // barbearia: de frente p/ o espelho (o barbeiro fica atrás); restaurante: de frente p/ a mesa; nos outros, p/ o profissional
   const look=c.b.id==='barber'?{x:2*n.x-st.worker.x,y:2*n.y-st.worker.y}:c.b.id==='chef'?{x:st.x,y:st.y}:st.worker;
   n.face=Math.atan2(look.y-n.y,look.x-n.x);
   if(c.b.id==='mechanic')placeCar(c,st);
  });
  // o profissional vai ao posto de trabalho (piloto automático dentro do prédio)
  const p=P(),pts=[...pathTo(c.H,st.room,st.worker)];
  if(inRoom(c.H,st.room,p))pts.splice(0,pts.length-1);
  work.service={c,auto,phase:'going',t:0};
  window.CityAutopilot?.walk?.(pts,P0name(c),()=>{if(work.service?.c===c){work.service.phase='ready';}});
  if(!window.CityAutopilot?.walk)work.service.phase='ready';
 }
 const P0name=c=>PROFESSIONS[c.b.id].business.service;
 function placeCar(c,st){
  if(!carLoader){carLoader=new GLTFLoader();carLoader.setMeshoptDecoder(MeshoptDecoder);}
  const id=pick(CARS);
  carLoader.loadAsync('assets/vehicles/live/'+id+'.glb').then(g=>{
   if(c.state!=='service'){return;}
   const car=g.scene;car.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   const box=new THREE.Box3().setFromObject(car),size=box.getSize(new THREE.Vector3()),s=4.4/Math.max(size.x,size.z);car.scale.setScalar(s);
   const H=c.H,ang=H.architecture.angle||0,along=size.z>=size.x;
   car.position.set(st.x,.95,st.y);car.rotation.y=-ang+(along?0:Math.PI/2);car.userData.noSnow=true;scene.add(car);c.car=car;
  }).catch(()=>{});
 }
 function tickService(dt){
  const S=work.service,c=S.c,p=P();
  if(!c.npc||c.state!=='service'){work.service=null;return;}
  if(S.phase==='going'){S.t+=dt;if(S.t>25){S.phase='ready';p.x=c.station.worker.x;p.y=c.station.worker.y;}return;}
  if(S.phase==='ready'&&!c.walk){
   p.face=Math.atan2(c.station.y-p.y,c.station.x-p.x);
   if(S.auto){S.phase='auto';S.t=0;notify('Atendimento rápido em andamento…');}
   else{S.phase='game';openGame(c);}
  }
  if(S.phase==='auto'){S.t+=dt;p.speed=0;if(S.t>=10)completeService(c,.55,true);}
 }
 function completeService(c,score,auto){
  const b=c.b,r=registerService(b,{score,auto});work.service=null;
  window.CityCareer?.addXP(careerKey(b.id),r.xp);
  CityLife?.credit?.(r.pay,b.id==='chef'?'Restaurante · mesa servida':PROFESSIONS[b.id].business.service);save();
  const happy=score>=.75,line=happy?'Excelente! Muito obrigado(a).':score>=.5?'Obrigado(a).':'Hmm… esperava mais.';
  chars()?.say(c.npc,line,happy?'😄':score>=.5?'🙂':'😕');
  notify('+'+money(r.pay)+' · +'+r.xp+' XP'+(r.levelUp?' · ⭐ nível '+r.level+'!':''));
  setTimeout(()=>leave(c,true),b.id==='chef'?6000:2200);
 }
 // ---------- minigame ----------
 let game=null;
 function openGame(c){
  ensureStyles();if(!gameUI){gameUI=document.createElement('section');gameUI.id='cr-game';gameUI.className='cr-panel';document.body.append(gameUI);
   gameUI.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!game)return;if(b.dataset.opt!=null)chooseOpt(Number(b.dataset.opt));else if(b.dataset.act==='stop')stopNeedle();else if(b.dataset.act==='next')nextStep();});}
  bridge.releaseControls?.();
  game={c,steps:c.case.steps,i:-1,scores:[],t0:performance.now(),needle:0,dir:1,seq:0,raf:0,done:false};gameUI.hidden=false;nextStep();
 }
 function nextStep(){
  const g=game;if(!g)return;g.i++;cancelAnimationFrame(g.raf);
  if(g.i>=g.steps.length){finishGame();return;}
  const s=g.steps[g.i];g.t0=performance.now();g.answered=false;
  const head=`<div class="cr-step">Etapa ${g.i+1} de ${g.steps.length} · ${esc(g.c.pro||PROFESSIONS[g.c.b.id].pro)}</div><div class="cr-ask">“${esc(g.c.case.ask)}”</div>`;
  if(s.type==='choice'){g.order=shuffle(s.options.map((o,i)=>i));
   gameUI.innerHTML=head+`<b>${esc(s.q)}</b><div class="cr-row" style="flex-direction:column">${g.order.map((oi,k)=>`<button data-opt="${k}" style="text-align:left">${esc(s.options[oi])}</button>`).join('')}</div>`;}
  else if(s.type==='timing'){g.needle=Math.random()*.2;g.dir=1;
   gameUI.innerHTML=head+`<b>${esc(s.label)}</b><div class="cr-meter"><div class="cr-zone" style="left:${s.zone[0]*100}%;width:${(s.zone[1]-s.zone[0])*100}%"></div><div class="cr-needle"></div></div><div class="cr-row"><button class="cr-main" data-act="stop">Parar (Espaço)</button></div>`;
   const needle=gameUI.querySelector('.cr-needle');let last=performance.now();
   const loop=t=>{if(!game||game.answered)return;const dt=Math.min(.05,(t-last)/1000);last=t;g.needle+=g.dir*dt*.85*(s.speed||1);if(g.needle>1){g.needle=1;g.dir=-1;}if(g.needle<0){g.needle=0;g.dir=1;}needle.style.left=(g.needle*100)+'%';g.raf=requestAnimationFrame(loop);};
   g.raf=requestAnimationFrame(loop);}
  else if(s.type==='sequence'){g.seq=0;g.miss=0;
   gameUI.innerHTML=head+`<b>${esc(s.label)}</b><div class="cr-keys">${s.keys.map((k,i)=>`<span class="${i===0?'cur':''}">${k}</span>`).join('')}</div><small>Aperte as teclas na ordem. Erro tira pontos.</small>`;}
 }
 function chooseOpt(k){const g=game,s=g.steps[g.i];if(g.answered)return;g.answered=true;const ok=g.order[k]===s.answer;g.scores.push(ok?1:0);
  const bs=gameUI.querySelectorAll('[data-opt]');bs.forEach((b,i)=>{if(g.order[i]===s.answer)b.style.background='#d6f2df';else if(i===k)b.style.background='#f8d7d4';});
  window.CityAudio?.ui?.(ok?'confirm':'back');setTimeout(nextStep,700);}
 function stopNeedle(){const g=game,s=g.steps[g.i];if(!g||g.answered||s.type!=='timing')return;g.answered=true;cancelAnimationFrame(g.raf);
  const sc=scoreTiming(g.needle,s.zone[0],s.zone[1]);g.scores.push(sc);window.CityAudio?.ui?.(sc>.6?'confirm':'back');
  gameUI.querySelector('.cr-needle').style.background=sc>.6?'#1e8449':'#c0392b';setTimeout(nextStep,600);}
 function keySeq(key){const g=game,s=g.steps[g.i];if(!g||s?.type!=='sequence'||g.answered)return false;
  const want=s.keys[g.seq],spans=gameUI.querySelectorAll('.cr-keys span');
  if(key===want.toLowerCase()){spans[g.seq].className='ok';g.seq++;if(spans[g.seq])spans[g.seq].className='cur';}
  else{g.miss++;window.CityAudio?.ui?.('back');}
  if(g.seq>=s.keys.length){g.answered=true;g.scores.push(scoreSequence(s.keys.length,s.keys.length+g.miss,(performance.now()-g.t0)/1000,s.keys.length*1.6));setTimeout(nextStep,350);}
  return true;}
 function finishGame(){
  const g=game,score=average(g.scores);game=null;
  gameUI.innerHTML=`<div class="cr-step">Resultado</div><div class="cr-score">${Math.round(score*100)}%</div><small>${score>=.85?'Atendimento impecável.':score>=.6?'Bom atendimento.':'Dá para melhorar.'}</small>`;
  setTimeout(()=>{gameUI.hidden=true;},1400);
  if(g.c.onDone){window.CityUI?.releaseInput?.();g.c.onDone(score);return;}
  completeService(g.c,score,false);
 }
 window.addEventListener('keydown',e=>{
  if(!game&&!lesson)return;const k=e.key.toLowerCase();
  if(game){const s=game.steps[game.i];
   if(s?.type==='timing'&&(k===' '||k==='enter')){stopNeedle();e.preventDefault();e.stopImmediatePropagation();}
   else if(s?.type==='sequence'&&['w','a','s','d'].includes(k)){keySeq(k);e.preventDefault();e.stopImmediatePropagation();}
   else if(s?.type==='choice'&&/^[1-4]$/.test(k)){chooseOpt(Number(k)-1);e.preventDefault();e.stopImmediatePropagation();}}
 },true);

 // ========== F e aviso na tela ==========
 function prompt(p){
  if(lesson)return null;
  const ls=canStartLesson(p);
  if(ls&&!ls.w.attendedToday)return 'F · Assistir aula de '+PROFESSIONS[state.course.id].title+(ls.w.open||ls.w.running?'':' (fora do horário)');
  if(work.service||game)return null;
  const c=nearClient(p);if(c)return 'F · Atender '+c.name;
  const here=myBizAt(p);if(here&&!here.b.open)return PROFESSIONS[here.b.id].business.name+' (seu) está fechado — abra pelo app Carreira';
  for(const id of Object.keys(PROFESSIONS)){if(!PROFESSIONS[id].business)continue;const H=bizHouse(id);if(H&&H.inside&&!state.biz[id]?.owned)return PROFESSIONS[id].business.name+' à venda · '+money(PROFESSIONS[id].business.price)+' · requer diploma de '+PROFESSIONS[id].title;}
  return null;
 }
 function interact(p){
  if(lesson||game)return null;
  if(canStartLesson(p))return startLesson(p);
  if(work.service)return null;
  const c=nearClient(p);if(c){offerClient(c);return 'Cliente: '+c.name;}
  return null;
 }
 function tick(dt){tickLesson(dt);tickBusiness(dt);}

 // ========== piloto automático até a aula / o negócio ==========
 function goToClass(){
  const c=state.course;if(!c)return {ok:false,text:'Faça a matrícula primeiro.'};
  const site=campusSite();if(!site)return {ok:false,text:'Campus não encontrado no mapa.'};
  const H=campusHouse(),room=roomFor(c.id);
  if(H&&room&&d2(P(),{x:(H.x0+H.x1)/2,y:(H.y0+H.y1)/2})<220){
   if(!(P().floor>0)&&inRoom(H,room,P())){notify('Você já está na sala. Aperte F para assistir à aula.');return {ok:true,text:'Você já está na sala.'};}
   const d=roomDoor(H,room);   // para logo dentro da sala; o F senta o aluno no lugar dele
   return window.CityAutopilot.go({x:site.x,y:site.y,name:'Sala de '+PROFESSIONS[c.id].title,house:H,after:[entryPoint(H),...(d?[d.hall,d.door,d.inside]:[])]},{onArrive:()=>notify('Você está na sala. Aperte F para assistir à aula.')});
  }
  // campus longe/ainda não carregado: vai até a praça e, chegando, continua até a sala
  return window.CityAutopilot.go({x:site.x,y:site.y-6,name:'Universidade City of God'},{onArrive:()=>setTimeout(()=>{const r=goToClass();if(!r.ok)notify(r.text,false);},400)});
 }
 function goToBusiness(id){
  const site=bizSite(id);if(!site)return {ok:false,text:'Estabelecimento não encontrado.'};
  const H=bizHouse(id);
  if(H&&d2(P(),{x:(H.x0+H.x1)/2,y:(H.y0+H.y1)/2})<220)return window.CityAutopilot.go({x:site.x,y:site.y,name:PROFESSIONS[id].business.name,house:H,after:[entryPoint(H),receptionPoint(H)]},{onArrive:()=>{const b=state.biz[id];if(b?.owned)notify(b.open?(b.auto?'A equipe está atendendo no automático. Mude para presencial no app para atender você mesmo.':'Recepção: os clientes chegam aqui. Chegue perto e aperte F para atender.'):'Abra o estabelecimento pelo app Carreira para receber clientes.');}});
  return window.CityAutopilot.go({x:site.x,y:site.y-2,name:PROFESSIONS[id].business.name},{onArrive:()=>setTimeout(()=>goToBusiness(id),400)});
 }

 // ========== app do celular ==========
 function renderApp({card,banner,btn}){
  const c=state.course,now=clock(),html=[];
  html.push(banner('<strong>Carreira</strong><small>Universidade City of God · profissões e negócio próprio</small>'));
  // ---------- escada de carreira (career-ladder.js): até 2 profissões ao mesmo tempo ----------
  const CC=window.CityCareer,LD=window.CityCareerLadder;
  if(CC&&LD){
   const act=CC.active(),enc=id=>id.replace(':','.');
   html.push('<div class="city-phone-label">Minhas profissões ('+act.length+'/'+LD.MAX_ACTIVE+')</div>');
   if(!act.length)html.push(card('Nenhuma profissão ainda','Arrume um emprego no app Empregos, forme-se na Universidade, trabalhe no computador (CityDesk) ou entre para a Polícia / SAMU. Você pode exercer até 2 ao mesmo tempo — o computador conta como uma.','','🧭'));
   for(const i of act){
    const bar='<div style="height:6px;border-radius:3px;background:#0002;overflow:hidden;margin:6px 0"><i style="display:block;height:100%;width:'+Math.round(i.progress*100)+'%;background:currentColor"></i></div>';
    html.push(card(i.title+' · '+i.rankTitle,'Cargo '+(i.rank+1)+'/5 · salário ×'+i.payMult.toFixed(2)+' · '+(i.nextXP?i.xp+'/'+i.nextXP+' XP':'cargo máximo')+bar+
     '<small>Liberado: '+esc(i.unlocked.join(' · '))+'</small>'+(i.nextUnlocks.length?'<br><small>Próximo cargo libera: '+esc(i.nextUnlocks.join(' · '))+'</small>':'')+
     (i.property?'<br><small>🏢 '+esc(i.property.name)+(i.propertyOpen?' · liberado para comprar':' · libera no cargo '+(i.property.minRank+1))+'</small>':''),
     btn('career:leave:'+enc(i.id),'Deixar profissão'),i.icon));
   }
   const groups={job:'Empregos (sem faculdade)',service:'Serviço público (curso na Universidade)',university:'Profissões com negócio próprio',remote:'No computador (CityDesk)'};
   html.push('<div class="city-phone-label">Todas as profissões</div>');
   for(const [g,label] of Object.entries(groups)){
    const list=CC.list().filter(i=>i.group===g);
    html.push('<p class="city-help"><b>'+label+'</b></p>'+list.map(i=>{const req=CC.requirement(i.id),how=g==='job'||g==='service'?'Candidate-se no app Empregos':g==='university'?'Forme-se e compre o ponto':'Aceite um contrato no CityDesk';
     return card(i.title+(i.active?' ✓':''),(i.xp?i.rankTitle+' · '+i.xp+' XP · ':'')+(req.ok?how:esc(req.text)),'',i.icon);}).join(''));
   }
  }
  if(c){
   const P0=PROFESSIONS[c.id],w=classWindow(c,now),total=lessonsFor(c.id),pay=needsPayment(c);
   const when=w.attendedToday?'Aula de hoje concluída ✓ · próxima '+dayTime(w.day+1,PERIODS[c.period].start):w.open||w.running&&!w.after?'Aula AGORA ('+fmt(PERIODS[c.period].start)+'–'+fmt(PERIODS[c.period].end)+')':'Próxima aula: '+dayTime(Math.floor(nextClass(c,now)/DAY),PERIODS[c.period].start);
   html.push(card('Cursando '+P0.title,c.attended.length+'/'+total+' aulas · '+PERIODS[c.period].label+' · '+when+(pay?' · mensalidade em aberto '+money(P0.tuition):''),
    btn('career:class','🚶 Ir para a aula (piloto automático)')+btn('career:gps-class','GPS')+(pay?btn('career:pay','Pagar mensalidade '+money(P0.tuition)):'')+btn('career:drop','Trancar matrícula'),P0.icon));
   html.push('<div class="city-panel"><div class="city-row"><strong>Progresso</strong><strong>'+Math.round(c.attended.length/total*100)+'%</strong></div><div style="height:8px;border-radius:4px;background:#0002;overflow:hidden"><i style="display:block;height:100%;width:'+(c.attended.length/total*100)+'%;background:#2e7d32"></i></div><p class="city-help">Cada ano de curso = 15 aulas (meio mês de jogo). Uma aula por dia, no período escolhido; perguntas em sala valem nota.</p></div>');
  }
  const degrees=Object.entries(state.degrees);
  if(degrees.length)html.push('<div class="city-phone-label">Diplomas</div>'+degrees.map(([id,d])=>card(PROFESSIONS[id].pro,'Formado(a) no dia '+(d.day+1)+' · média '+d.gpa.toFixed(1),'',PROFESSIONS[id].icon)).join(''));
  // negócios
  for(const [id,d] of degrees){
   const P0=PROFESSIONS[id],b=state.biz[id];
   if(!P0.business)continue;
   // policial e socorrista: o imóvel libera pelo cargo na escada de carreira
   const lock=!b?.owned&&P0.career&&window.CityCareer?window.CityCareer.canBuyProperty(P0.business.kind):{ok:true};
   if(!b?.owned){html.push(card(P0.business.name,(lock.ok?'Prédio mobiliado à venda · ':esc(lock.text)+' · ')+money(P0.business.price),btn('career:buy:'+id,'Comprar',!lock.ok||typeof CityLife!=='undefined'&&CityLife.funds<P0.business.price)+btn('career:gps-biz:'+id,'Ver no GPS'),'🏢'));continue;}
   const r=priceRange(id,b.level),xpNeed=levelXP(b.level);
   html.push(card(P0.business.name+' · nível '+b.level,(b.open?(b.auto?'Aberto · equipe atendendo (automático)':'Aberto · atendimento presencial'):'Fechado')+' · '+b.served+' atendimentos · faturou '+money(b.revenue)+' · reputação '+Math.round(b.rep)+'/100',
    btn('career:toggle:'+id,b.open?'Fechar':'Abrir')+btn('career:mode:'+id,b.auto?'Mudar p/ presencial':'Modo automático')+btn('career:biz:'+id,'🚶 Ir até lá'),P0.icon));
   html.push('<div class="city-panel"><div class="city-row"><strong>'+esc(P0.business.service)+'</strong><strong>'+money(b.price)+'</strong></div>'+
    '<p class="city-help">Faixa no nível '+b.level+': '+money(r.min)+' a '+money(r.max)+' · preço justo '+money(r.fair)+'. Acima do justo, os clientes demoram mais a vir; abaixo, a reputação sobe.</p>'+
    '<div class="city-row">'+btn('career:price:'+id+':-1','− '+money(Math.round(P0.business.base*.1)))+btn('career:price:'+id+':0','Preço justo')+btn('career:price:'+id+':1','+ '+money(Math.round(P0.business.base*.1)))+'</div>'+
    '<div class="city-row"><strong>Experiência</strong><strong>'+(b.level>=MAX_LEVEL?'nível máximo':b.xp+'/'+xpNeed+' XP')+'</strong></div>'+
    '<p class="city-help">Minigame: até 135% do preço e mais XP. Automático: 55% do preço. Horário comercial: 08:00–20:00.</p></div>');
  }
  // cursos
  html.push('<div class="city-phone-label">Cursos da Universidade</div>');
  for(const [id,P0] of Object.entries(PROFESSIONS)){
   const total=lessonsFor(id),done=state.degrees[id],cur=c?.id===id;
   html.push(card(P0.title+' · '+P0.years+' anos',total+' aulas ('+(total/30).toFixed(1).replace('.0','')+' '+(total/30>1?'meses':'mês')+' de jogo) · matrícula '+money(P0.enroll)+' + '+money(P0.tuition)+' por ano de curso · depois: '+(P0.business?P0.business.name:'carreira de '+P0.pro),
    done?'<small>Formado ✓</small>':cur?'<small>Cursando</small>':c?'<small>Conclua o curso atual</small>':Object.entries(PERIODS).map(([k,v])=>btn('career:enroll:'+id+':'+k,v.label+' '+fmt(v.start))).join(''),P0.icon));
  }
  html.push('<div class="city-phone-label">Piloto automático</div>'+card('Ir a pé sozinho','Anda pela calçada, espera o sinal verde e os carros. WASD devolve o controle.',
   btn('career:go:university','Universidade')+btn('career:go:hospital','Hospital')+btn('career:go:police','Delegacia')+btn('career:go:cityhall','Prefeitura'),'🚶'));
  return html.join('');
 }
 function action(cmd,arg,arg2){
  const L=typeof CityLife!=='undefined'?CityLife:null,now=clock(),day=Math.floor(now/DAY);
  if(cmd==='leave'){const id=String(arg).replace('.',':');if(!confirm('Deixar de exercer esta profissão? A experiência fica guardada.'))return {ok:false,text:'Cancelado.'};
   {const k=Object.keys(PROFESSIONS).find(k=>careerKey(k)===id),b=k&&state.biz[k];if(b?.open){b.open=false;save();}}
   if(id.startsWith('job:')||id.startsWith('svc:')){const S=typeof CitySim!=='undefined'?CitySim:null;if(S?.data?.job)return S.quitJob();}
   return window.CityCareer?.leave(id)||{ok:false,text:'Indisponível.'};}
  if(cmd==='enroll'){
   const P0=PROFESSIONS[arg];if(!P0)return {ok:false,text:'Curso inválido.'};
   const probe={...state,course:state.course};const r=enrollCourse(probe,arg,arg2,day);if(!r.ok)return r;
   if(!L?.debit(r.cost,'Matrícula · '+P0.title))return {ok:false,text:'Saldo insuficiente: '+money(r.cost)+' (matrícula + primeiro ano).'};
   state.course=probe.course;save();window.CityUI?.togglePhone?.(false);return {ok:true,text:r.text};
  }
  if(cmd==='pay'){const c=state.course;if(!c||!needsPayment(c))return {ok:false,text:'Nada em aberto.'};const t=PROFESSIONS[c.id].tuition;if(!L?.debit(t,'Mensalidade · '+PROFESSIONS[c.id].title))return {ok:false,text:'Saldo insuficiente.'};payTuition(c);save();return {ok:true,text:'Mensalidade paga.'};}
  if(cmd==='drop'){if(!confirm('Trancar a matrícula? As aulas já feitas serão perdidas.'))return {ok:false,text:'Cancelado.'};const r=dropCourse(state);save();return r;}
  if(cmd==='class'){const r=goToClass();if(r.ok)window.CityUI?.togglePhone?.(false);return r;}
  if(cmd==='gps-class'){const s=campusSite();if(!s)return {ok:false,text:'Campus indisponível.'};window.CityGPS?.set({x:s.x,y:s.y,name:'Universidade City of God'});return {ok:true,text:'Rota no GPS.'};}
  if(cmd==='go'){const s=sites().find(x=>x.kind===arg);if(!s)return {ok:false,text:'Destino indisponível.'};
   const r=arg==='university'?window.CityAutopilot.go({x:s.x,y:s.y-6,name:s.name}):window.CityAutopilot.go({x:s.x,y:s.y,name:s.name});if(r.ok)window.CityUI?.togglePhone?.(false);return r;}
  if(cmd==='buy'){
   const P0=PROFESSIONS[arg];if(!P0||!state.degrees[arg])return {ok:false,text:'É preciso o diploma de '+(P0?.title||'')+'.'};
   if(state.biz[arg]?.owned)return {ok:false,text:'Você já é dono(a).'};
   if(!P0.business)return {ok:false,text:P0.pro+' não tem negócio próprio: entre na carreira pelo app Carreira.'};
   const CC=window.CityCareer;if(CC){const slot=CC.activate(careerKey(arg),{quiet:true});if(!slot.ok)return slot;const pr=CC.canBuyProperty(P0.business.kind);if(!pr.ok)return pr;}
   if(!L?.debit(P0.business.price,'Compra · '+P0.business.name))return {ok:false,text:'Saldo insuficiente.'};
   state.biz[arg]=newBusiness(state,arg);save();return {ok:true,text:'Compra feita: '+P0.business.name+' agora é sua propriedade. Abra pelo app e atenda clientes.'};
  }
  if(cmd==='gps-biz'){const s=bizSite(arg);if(!s)return {ok:false,text:'Indisponível.'};window.CityGPS?.set({x:s.x,y:s.y,name:PROFESSIONS[arg].business.name});return {ok:true,text:'Rota no GPS.'};}
  const b=state.biz[arg];if(!b?.owned)return {ok:false,text:'Você não tem esse negócio.'};
  if(cmd==='toggle'){b.open=!b.open;save();if(!b.open)for(const c of work.clients.filter(c=>c.b===b&&c.state==='waiting'))leave(c,false);return {ok:true,text:b.open?'Aberto para clientes.':'Fechado.'};}
  if(cmd==='mode'){b.auto=!b.auto;save();return {ok:true,text:b.auto?'Modo automático: a equipe atende sozinha (55% do valor).':'Atendimento presencial: venha até aqui atender.'};}
  if(cmd==='price'){const step=Math.round(PROFESSIONS[arg].business.base*.1),d=Number(arg2);setPrice(b,d===0?priceRange(arg,b.level).fair:b.price+d*step);save();return {ok:true,text:'Novo preço: '+money(b.price)};}
  if(cmd==='biz'){const r=goToBusiness(arg);if(r.ok)window.CityUI?.togglePhone?.(false);return r;}
  return {ok:false,text:'Ação desconhecida.'};
 }
 const api={get state(){return state;},renderApp,action,prompt,interact,tick,goToClass,goToBusiness,get lesson(){return lesson;},get work(){return work;},
  // minigame de atendimento p/ outros sistemas (jobs.mjs: ocorrências da polícia, chamados do SAMU)
  playCase(pro,kase,onDone){if(game)return false;openGame({pro,case:kase,onDone});return true;},
  get playing(){return !!game;},
  debug:{startLesson,endLesson,spawnClient,offerClient,beginService,save,openGame}};
 window.CityCareers=api;
 return api;
}

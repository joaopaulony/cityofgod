import {NPC_STORIES} from './npc-stories.mjs';
import {ROLEPLAY_ACTIONS,CONTEXT_REPLIES} from './social-content.mjs';
import {defineSocialActions,progressionReason} from './social-rules.mjs';
// Deterministic personalities, bilateral memories and consent-aware social simulation.
export const SOCIAL_ACTIONS = defineSocialActions({
 greet:{label:'👋 Apresentar-se',friend:5,trust:2,line:'Oi! Bom te encontrar por aqui.'},
 chat:{label:'💬 Conversar sobre interesses',friend:7,trust:2,line:'O que você gosta de fazer quando tem um tempo livre?'},
 joke:{label:'😄 Contar uma piada',friend:8,trust:0,line:'Tenho uma história que vai te fazer rir…'},
 listen:{label:'🤝 Ouvir e apoiar',friend:5,trust:8,line:'Pode falar. Estou aqui para te ouvir.'},
 flirt:{label:'💕 Flertar',friend:2,trust:0,romance:9,line:'Gosto de passar esse tempo com você.'},
 date:{label:'🌹 Propor namoro',friend:3,trust:4,romance:12,line:'Quer construir algo comigo?'},
 insult:{label:'⚡ Provocar',friend:-16,trust:-12,romance:-10,line:'Você se acha melhor que todo mundo?'},
 apologize:{label:'🕊 Pedir desculpas',friend:7,trust:5,line:'Eu errei com você. Quero fazer melhor.'},
 peace:{label:'☮ Conversar sobre a rivalidade',friend:6,trust:7,line:'Não precisamos repetir as brigas de todo mundo.'},
 breakup:{label:'💔 Terminar relacionamento',friend:-8,trust:-5,romance:-100,line:'Preciso encerrar nosso namoro.'},
 day:{label:'☀ Perguntar sobre o dia',friend:4,trust:2,line:'Como foi seu dia? Aconteceu alguma coisa boa?'},
 career:{label:'💼 Perguntar sobre o trabalho',friend:4,trust:3,line:'Como é o seu trabalho por aqui?'},
 compliment:{label:'✨ Fazer um elogio sincero',friend:6,trust:3,line:'Gosto do jeito como você cuida do que importa.'},
 encourage:{label:'🌱 Animar o dia',friend:5,trust:5,line:'Você não precisa resolver tudo hoje. Eu acredito em você.'},
 story:{label:'📖 Perguntar sobre sua história',friend:4,trust:5,line:'Quero te conhecer melhor. Qual é a sua história?'},
 memory:{label:'💭 Relembrar um encontro',friend:5,trust:3,line:'Lembra da última vez que conversamos?'},
 dreams:{label:'☁ Conversar sobre sonhos',friend:5,trust:6,line:'O que você ainda sonha realizar?'},
 hobby:{label:'🎨 Perguntar sobre passatempos',friend:5,trust:2,line:'O que você faz para relaxar?'},
 music:{label:'♫ Falar de música',friend:5,trust:1,line:'Que música te acompanha nesses dias?'},
 neighborhood:{label:'🏘 Falar sobre o bairro',friend:4,trust:3,line:'O que você mais gosta neste bairro?'},
 admire:{label:'♡ Demonstrar interesse',friend:3,trust:1,romance:6,line:'Queria te conhecer para além dessas conversas…'},
 funnyStory:{label:'😄 Contar uma história engraçada',friend:7,trust:1,line:'Você não vai acreditar na confusão que eu arrumei outro dia…'},
 disagree:{label:'ϟ Discordar com firmeza',friend:-7,trust:-3,line:'Eu vejo as coisas de outro jeito. Não concordo com isso.'},
 loyalty:{label:'⚑ Perguntar sobre lealdade',friend:2,trust:4,line:'O que significa fazer parte do seu grupo?'},
 ...ROLEPLAY_ACTIONS
});
const clamp=n=>Math.max(-100,Math.min(100,n));
const hash=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
const traits=['acolhedor','reservado','ambicioso','brincalhão','leal','romântico'];
const interests=['música','culinária','fotografia','carros','dança','esportes','arte urbana','jardinagem'];
export function factionAffinity(a,b){
 if(!a||!b||a==='base'||b==='base')return 0;
 const gangs=['last-kings','novelis-crew'];
 if(gangs.includes(a)&&gangs.includes(b))return a===b?28:-48;
 if((gangs.includes(a)&&b==='policia')||(gangs.includes(b)&&a==='policia'))return -38;
 return a===b?12:0;
}
export function createSocialSim(roster,{storage=null,random=Math.random}={}){
 const people=new Map(roster.map(c=>[c.id,{...c,age:c.age||22+hash(c.id)%24,trait:c.trait||traits[hash(c.id)%traits.length],interest:c.interest||interests[hash(c.id+'h')%interests.length]}]));
 people.set('player',{id:'player',name:'Você',group:'base',age:25,trait:'acolhedor',interest:'música'});
 const phoneNumbers=new Map([...people.keys()].filter(id=>id!=='player').sort().map((id,i)=>[id,'555-01'+String(i).padStart(2,'0')]));
 const relations=new Map(),needs=new Map(),emotions=new Map(),variants=new Map(),events=[],crimeEvidence=[],investigations=[];
 const criminalInventory={drugParcel:0};let time=0,dirty=false,saveT=0,serial=0;
 const defaults=()=>({friend:0,trust:0,intimacy:0,romance:0,hostility:0,dating:false,phone:false,social:false,hurt:0,blockedUntil:0,romanceBoundaryUntil:0,memories:[],cooldown:0,lastAction:null});
 try{
  const data=JSON.parse(storage?.getItem('cog-social-v1')||'null');
  if(data?.version===1){
   time=Number.isFinite(data.time)?Math.max(0,data.time):0;
   for(const [key,v] of Array.isArray(data.relations)?data.relations:[])if(key.split('|').length===2&&key.split('|').every(id=>people.has(id))&&[v.friend,v.trust,v.romance].every(Number.isFinite)){
    const row={...defaults(),...v,friend:clamp(v.friend),trust:clamp(v.trust),romance:clamp(v.romance),cooldown:0,lastAction:null};
    row.memories=Array.isArray(v.memories)?v.memories.filter(m=>m&&SOCIAL_ACTIONS[m.action]&&typeof m.text==='string'&&Number.isFinite(m.time)).slice(-48):[];
    row.hurt=Number.isFinite(v.hurt)?Math.max(0,clamp(v.hurt)):row.memories.some(m=>m.accepted&&SOCIAL_ACTIONS[m.action]?.friend<0)?Math.min(100,Math.max(1,-row.trust)):0;
    row.intimacy=Number.isFinite(v.intimacy)?Math.max(0,clamp(v.intimacy)):Math.max(0,Math.min(100,Math.min(row.friend,row.trust)*.65+row.memories.filter(m=>m.accepted).length));
    row.hostility=Number.isFinite(v.hostility)?Math.max(0,clamp(v.hostility)):Math.max(0,-row.friend,row.hurt);
    for(const k of ['hurt','blockedUntil','romanceBoundaryUntil'])if(!Number.isFinite(row[k]))row[k]=0;
    relations.set(key,row);
   }
   for(const [id,e] of Array.isArray(data.emotions)?data.emotions:[])if(people.has(id)&&[e.joy,e.anger,e.sadness,e.energy].every(Number.isFinite))emotions.set(id,{joy:clamp(e.joy),anger:Math.max(0,clamp(e.anger)),sadness:Math.max(0,clamp(e.sadness)),energy:Math.max(0,clamp(e.energy))});
   for(const e of Array.isArray(data.events)?data.events.slice(-40):[])if(e&&people.has(e.actor)&&people.has(e.target)&&typeof e.kind==='string'&&Number.isFinite(e.created))events.push({...e,status:['active','planned'].includes(e.status)?'interrupted':e.status});
   for(const e of Array.isArray(data.crimeEvidence)?data.crimeEvidence.slice(-40):[])if(e&&people.has(e.suspectId)&&['drugDeal','threat'].includes(e.kind)&&Number.isFinite(e.created))crimeEvidence.push({...e});
   for(const c of Array.isArray(data.investigations)?data.investigations.slice(-30):[])if(c&&people.has(c.suspectId)&&people.has(c.reporterId)&&typeof c.id==='string'&&Number.isFinite(c.created))investigations.push({...c});
   if(Number.isInteger(data.criminalInventory?.drugParcel))criminalInventory.drugParcel=Math.max(0,Math.min(99,data.criminalInventory.drugParcel));
   serial=events.length;
  }
 }catch{}
 function relation(a,b){
  if(!people.has(a)||!people.has(b)||a===b)throw Error('Participantes sociais inválidos');
  const key=[a,b].sort().join('|');if(!relations.has(key)){const f=factionAffinity(people.get(a).group,people.get(b).group);relations.set(key,{...defaults(),friend:f,trust:f/2,hostility:Math.max(0,-f)});}return relations.get(key);
 }
 function emotion(id){if(!emotions.has(id))emotions.set(id,{joy:0,anger:0,sadness:0,energy:70});return emotions.get(id);}
 function mood(id){const e=emotion(id);return e.anger>=60?'Furioso':e.anger>=25?'Irritado':e.sadness>=30?'Magoado':e.joy>=45?'Entusiasmado':e.joy>=20?'Alegre':e.energy<25?'Cansado':(needs.get(id)??65)<40?'Carente':'Tranquilo';}
 function label(r){return r.dating?'Namorando':r.friend<=-30?'Inimizade':r.romance>=25?'Interesse romântico':r.friend>=60?'Melhores amigos':r.friend>=25?'Amizade':r.friend>0?'Conhecidos':'Distantes';}
 function pick(key,rows){if(!rows?.length)return '';let index=Math.min(rows.length-1,Math.floor(random()*rows.length));if(variants.get(key)===index&&rows.length>1)index=(index+1)%rows.length;variants.set(key,index);return rows[index];}
 function remember(r,m){r.memories.push(m);r.memories=r.memories.slice(-48);dirty=true;}
 function save(){try{storage?.setItem('cog-social-v1',JSON.stringify({version:1,time,relations:[...relations],emotions:[...emotions],events:events.slice(-40),crimeEvidence:crimeEvidence.slice(-40),investigations:investigations.slice(-30),criminalInventory}));dirty=false;return true;}catch{return false;}}
 function ongoing(a,b){return events.find(e=>['planned','active'].includes(e.status)&&[e.actor,e.target].includes(a)&&[e.actor,e.target].includes(b));}
 function unavailable(a,b,action,context={}){
  const s=SOCIAL_ACTIONS[action];if(!s||!people.has(a)||!people.has(b)||a===b)return 'Interação indisponível.';
  const r=relation(a,b);
  const gate=s.gate;
  if(s.targetGroup&&people.get(b).group!==s.targetGroup)return 'Esta conversa precisa ser feita com alguém da polícia.';
  if(s.requiresGroup&&!s.requiresGroup.includes(people.get(b).group))return 'Este assunto só pode ser tratado com alguém de uma gangue.';
  if(gate.evidence&&!crimeEvidence.some(e=>e.reportedBy==null))return 'Você ainda não tem um fato vivido ou uma pista concreta para relatar.';
  if(gate.caseUpdate&&!investigations.length)return 'Você ainda não tem uma investigação registrada.';
  if(s.transaction){if(!context.cityLife)return 'A carteira não está disponível para concluir a transação.';if(context.cityLife.funds<s.transaction.cost)return `Você precisa de R$ ${s.transaction.cost} para fechar o negócio.`;if(criminalInventory[s.transaction.kind]>=99)return 'Você não tem espaço para guardar outro pacote.';}
  if(time<r.cooldown)return 'Espere a outra pessoa responder.';
  if(action==='breakup'&&!r.dating)return 'Vocês não estão namorando.';
  if(s.datingOnly&&!r.dating)return 'Esse assunto pede um namoro entre vocês.';
  if(s.phoneOnly&&!r.phone)return 'Troquem números de telefone primeiro.';
  if(s.socialOnly&&!r.social)return 'Troquem perfis do CitySocial primeiro.';
  if(s.contact==='phone'&&r.phone)return 'Vocês já trocaram números.';
  if(s.contact==='social'&&r.social)return 'Vocês já se seguem no CitySocial.';
  if(s.finishEvent&&!ongoing(a,b))return 'Vocês não têm um convite ativo.';
  if(s.event&&ongoing(a,b))return 'Encerre o programa atual antes de combinar outro.';
  if(s.event&&context.busy)return 'A pessoa está em serviço e não pode sair agora.';
  if(s.home&&context.hasHome===false)return 'Você precisa de uma residência própria carregada na cidade.';
  if(s.bed&&context.hasBed===false)return 'Prepare uma cama livre no térreo para receber a pessoa.';
  if(s.dining&&context.hasDining===false)return 'Prepare uma cadeira ou sofá acessível no térreo para o jantar.';
  if(s.meal&&context.hasMeal===false)return 'Prepare uma porção de comida na cozinha antes de convidar para jantar.';
  if(r.blockedUntil>time&&s.tone!=='repair'&&!['apologize','breakup','cancelPlans','finishOuting'].includes(action))return 'Essa pessoa pediu espaço. Respeite o afastamento antes de insistir.';
  if((s.tone==='romance'||['flirt','admire','date'].includes(action))&&r.romanceBoundaryUntil>time)return 'A pessoa recusou o avanço romântico. Dê tempo antes de tentar de novo.';
  const reason=progressionReason(s,r,{time,hasPartner:[...relations].some(([key,v])=>v.dating&&key!==[a,b].sort().join('|')&&key.split('|').some(id=>id===a||id===b)),hasEvidence:crimeEvidence.some(e=>e.reportedBy==null),hasCase:investigations.length>0});
  if(reason)return reason;
  return '';
 }
 function baseResponse(b,action,r){
  const B=people.get(b),history=NPC_STORIES[b]||'Ainda estou descobrindo meu caminho por aqui.';
  const work={policia:'Trabalho na polícia. Confiança se conquista com atitude.',bombeiros:'Trabalho nos bombeiros. Cuidar da equipe faz parte do resgate.',socorristas:'Trabalho nos resgates. Aprendo algo em cada plantão.',operarios:'Trabalho nas obras. Gosto de ver o que ajudei a construir.',motoboy:'Faço entregas. Cada esquina tem uma história.'};
  return {greet:`Sou ${B.name.split(' ')[0]}. Prazer!`,chat:`Eu adoro ${B.interest}. E você?`,joke:pick(b+action,['Essa foi boa! Estava precisando rir.','Você conseguiu me pegar de surpresa!','Vou lembrar dessa na próxima vez que eu precisar rir.']),listen:pick(b+action,['Obrigado por ouvir. Nem todo mundo para para escutar.','Poder falar sem ser julgado faz diferença.','Você não tentou resolver tudo. Só de ouvir já ajudou.']),flirt:'Também gosto de estar perto de você…',date:'Sim! Vamos cuidar disso juntos.',insult:'Isso machuca. Não fale assim comigo.',apologize:'Eu ouvi seu pedido. Reconstruir confiança leva tempo.',peace:'Minha lealdade tem uma história, mas posso conhecer a sua.',breakup:'Entendo. Vou precisar de um tempo.',day:'O dia melhora quando dá para conversar sem pressa.',career:work[B.group]||history,compliment:'Você reparou? Isso significa muito para mim.',encourage:'Era o que eu precisava ouvir hoje.',story:history,memory:r.memories.length?`Lembro, sim. ${r.memories.at(-1).text.slice(0,100)}`:'Estamos criando nossa primeira lembrança agora.',dreams:history.split('. ').slice(-2).join('. '),hobby:`Quando posso, gosto de ${B.interest}. É um tempo só meu.`,music:'Gosto de música que me lembra de gente querida.',neighborhood:'Das pessoas que fazem este lugar ser mais que um endereço.',admire:'Também tenho curiosidade de saber aonde isso pode nos levar.',funnyStory:'Essa confusão daria um filme!',disagree:'Tudo bem pensar diferente. Só não diminua o que eu vivi.',loyalty:B.group==='last-kings'?'Os Last Kings me deram pertencimento. Minha lealdade tem história.':B.group==='novelis-crew'?'A Novelis Crew é minha gente. Queria que respeitassem nossa história.':B.group==='policia'?'O uniforme deveria significar responsabilidade com todos.':'Minha lealdade é com quem cuida de mim e do bairro.'}[action]||'';
 }
 function finishEvent(id,status='completed'){
  const e=events.find(e=>e.id===id);if(!e||!['active','planned'].includes(e.status))return false;
  e.status=status;e.finished=time;const r=relation(e.actor,e.target);if(status==='completed'){r.friend=clamp(r.friend+7);r.trust=clamp(r.trust+5);r.intimacy=Math.min(100,r.intimacy+6);if(e.kind==='date')r.romance=clamp(r.romance+6);emotion(e.target).joy=clamp(emotion(e.target).joy+12);if(e.kind==='overnight')emotion(e.target).energy=Math.min(100,emotion(e.target).energy+45);}
  remember(r,{action:status==='completed'?'finishOuting':'cancelPlans',actor:e.actor,time,accepted:status==='completed',text:status==='completed'?'Guardou uma boa lembrança do tempo que passaram juntos.':status==='interrupted'?'O programa foi interrompido antes de terminar.':'O combinado foi encerrado.'});return true;
 }
 function interact(a,b,action,context={}){
  const unavailableText=unavailable(a,b,action,context);if(unavailableText)return {ok:false,text:unavailableText};
  const A=people.get(a),B=people.get(b),spec=SOCIAL_ACTIONS[action],r=relation(a,b),e=emotion(b),before=mood(b);
  const tone=spec.tone||({insult:'angry',joke:'humor',funnyStory:'humor',listen:'support',encourage:'support',apologize:'repair',peace:'peace',flirt:'romance',admire:'romance',date:'romance'}[action]||'casual');
  const romantic=tone==='romance',repair=tone==='repair';let accepted=true,refusal='',event=null;
  if(r.blockedUntil>time&&!repair){accepted=false;refusal='boundary';}
  else if(romantic&&r.romanceBoundaryUntil>time){accepted=false;refusal='boundary';}
  else if(r.friend<(spec.minFriend??(romantic?15:-100))||r.trust<(spec.minTrust??(romantic?5:-100))||r.romance<(spec.minRomance??-100)){accepted=false;refusal=romantic?'refusedRomance':'refusedTrust';}
  else if(romantic&&(e.anger>=25||e.sadness>=55||random()>=.78)){accepted=false;refusal='refusedRomance';}
  else if(['humor','dark','tease'].includes(tone)&&((B.trait==='reservado'&&r.friend<10)||e.anger>=30||e.sadness>=45||(tone==='dark'&&B.trait==='acolhedor'))){accepted=false;refusal='refusedTrust';}
  else if(spec.event&&(e.anger>=30||e.energy<20)){accepted=false;refusal='refusedTrust';}
  if(action==='dreams'&&r.hurt>5&&r.memories.some(m=>m.action==='mockDream')){accepted=false;refusal='refusedTrust';}
  if(action==='peace')accepted=accepted&&r.trust>=-12;
  if(accepted&&spec.transaction){const cost=spec.transaction.cost;if(!context.cityLife?.debit(cost,'Negócio clandestino · pacote')){accepted=false;refusal='transaction';}else criminalInventory[spec.transaction.kind]=Math.min(99,criminalInventory[spec.transaction.kind]+1);}
  const recent=r.memories.filter(m=>time-m.time<180),times=recent.filter(m=>m.action===action&&m.actor===a).length;
  let scale=accepted?(r.lastAction===action?.35:1):0;
  if(times>=3&&spec.friend>0)scale=Math.min(scale,.12);
  if(accepted&&((spec.interest&&spec.interest===B.interest)||(action==='chat'&&A.interest===B.interest)))scale*=1.4;
  if(accepted&&B.trait==='brincalhão'&&tone==='humor')scale*=1.25;
  if(accepted&&B.trait==='romântico'&&romantic)scale*=1.15;
  if(accepted&&repair&&r.hurt>15)scale*=.5;
  r.friend=clamp(r.friend+spec.friend*scale+(accepted?0:-3));r.trust=clamp(r.trust+spec.trust*scale);r.romance=clamp(r.romance+(spec.romance||0)*scale);
  if(accepted){
   if(spec.friend>0&&spec.trust>=0){r.intimacy=Math.min(100,r.intimacy+(['deep','support','romance'].includes(tone)?3:1)*scale);r.hostility=Math.max(0,r.hostility-(['repair','peace'].includes(tone)?5:1)*scale);}
   if(spec.friend<0){r.hostility=Math.min(100,r.hostility+Math.abs(spec.friend)*.8*scale);r.intimacy=Math.max(0,r.intimacy-Math.abs(spec.trust)*.12*scale);}
  }
  if(accepted){
   if(tone==='angry'||tone==='cruel'||tone==='jealous'){e.anger=clamp(e.anger+(tone==='cruel'?35:22));e.sadness=clamp(e.sadness+(tone==='cruel'?30:10));e.joy=clamp(e.joy-15);r.hurt=Math.min(100,r.hurt+Math.abs(spec.trust));if(spec.boundary)r.blockedUntil=time+180;}
   else if(['support','repair','peace'].includes(tone)){e.anger=Math.max(0,e.anger-8);e.sadness=Math.max(0,e.sadness-10);e.joy=clamp(e.joy+5);if(repair)r.hurt=Math.max(0,r.hurt-5);}
   else if(spec.friend>0){e.joy=clamp(e.joy+(['joy','humor'].includes(tone)?15:6));e.energy=Math.max(0,e.energy-1);}
   if(action==='date')r.dating=true;
   if(spec.contact)r[spec.contact]=true;
   if(action==='unblock'&&r.trust>=10&&r.hurt<=15)r.blockedUntil=0;
   if(spec.event){event={id:`social-${Math.floor(time)}-${++serial}`,actor:a,target:b,kind:spec.event,status:'planned',created:time,homeKey:context.homeKey||null};events.push(event);if(events.length>40)events.shift();}
   if(spec.finishEvent){const current=ongoing(a,b);if(current)finishEvent(current.id,action==='finishOuting'?'completed':'cancelled');}
   if(spec.gossip){const victim=[...people.values()].find(p=>p.id!==a&&p.id!==b&&p.id!=='player'&&p.group===B.group);if(victim){const other=relation(a,victim.id);other.friend=clamp(other.friend-8);other.trust=clamp(other.trust-12);remember(other,{action,actor:a,time,accepted:false,text:`Soube por ${B.name} que sua confiança foi exposta numa conversa.`});}}
   if(a==='player'&&action==='buyStreetParcel')crimeEvidence.push({kind:'drugDeal',actor:a,suspectId:b,created:time,reportedBy:null,summary:`Compra de drogas envolvendo ${B.name}.`});
  }
  let investigation=null;
  if(accepted&&['reportCrime','offerInformantTip'].includes(action)){
   const clue=crimeEvidence.find(e=>e.reportedBy==null);
   if(clue){investigation={id:`case-${Math.floor(time)}-${++serial}`,reporterId:a,suspectId:clue.suspectId,evidence:clue.kind,status:'Recebida · em apuração',created:time,updated:time,summary:clue.summary,confidential:action==='offerInformantTip'};clue.reportedBy=a;clue.caseId=investigation.id;investigations.push(investigation);if(investigations.length>30)investigations.shift();}
  }
  if(!accepted&&romantic)r.romanceBoundaryUntil=time+90;
  if(action==='breakup'||r.friend<=-30)r.dating=false;
  r.lastAction=action;r.cooldown=time+4;
  let text=accepted?(spec.replies?pick(b+action,spec.replies):baseResponse(b,action,r)):pick(b+'refusal',CONTEXT_REPLIES[refusal||'refusedTrust']);
  if(accepted&&times>=3&&spec.friend>0)text=pick(b+'repeat',CONTEXT_REPLIES.repeated);
  else if(accepted&&!['cruel','angry','jealous','repair'].includes(tone)&&!spec.event&&!spec.contact){
   const ctx=spec.interest===B.interest?'enthusiastic':before==='Irritado'||before==='Furioso'?'angry':before==='Magoado'?'sad':before==='Entusiasmado'||before==='Alegre'?'happy':B.trait==='reservado'&&['deep','support'].includes(tone)?'reserved':null;
   if(ctx)text=pick(b+'context',CONTEXT_REPLIES[ctx])+text;
  }
  if(action==='dreams'&&!accepted&&r.memories.some(m=>m.action==='mockDream'))text='Eu ainda lembro de quando você ridicularizou meu sonho. Não quero abri-lo de novo agora.';
  if(accepted&&spec.transaction)text+=` Você guarda o pacote de drogas na mochila (${criminalInventory[spec.transaction.kind]}).`;
  if(accepted&&action==='reportCrime'&&investigation)text+=` Protocolo ${investigation.id}: ${investigation.status.toLowerCase()}.`;
  if(accepted&&action==='offerInformantTip'&&investigation)text+=` A pista foi vinculada ao protocolo ${investigation.id}.`;
  const line=pick(a+action+'line',spec.lines||[spec.line]);
  if(accepted&&spec.contact==='phone')text+=' Meu número na cidade é '+phoneNumbers.get(b)+'.';
  if(accepted&&spec.contact==='social')text+=' Meu perfil é @'+b.replaceAll('-','.')+'.';
  remember(r,{action,actor:a,text,time,accepted,channel:context.channel||'local',mood:before});needs.set(a,Math.min(100,(needs.get(a)??65)+12));needs.set(b,Math.min(100,(needs.get(b)??65)+12));
  return {ok:true,accepted,text,line,event,investigation,relationship:label(r),mood:mood(b),reaction:!accepted?'✋':['angry','cruel','jealous'].includes(tone)?'💢':romantic?'💕':['joy','humor'].includes(tone)?'😄':'💬'};
 }
 function contacts(){return [...people.values()].filter(p=>{const r=relations.get(['player',p.id].sort().join('|'));return p.id!=='player'&&(r?.phone||r?.social);}).map(p=>{const r=relations.get(['player',p.id].sort().join('|'));return {...p,phone:r.phone,social:r.social,number:phoneNumbers.get(p.id),handle:'@'+p.id.replaceAll('-','.'),mood:mood(p.id)};});}
 function suggest(a,b){
  const r=relation(a,b),m=mood(b);let candidates;
  if(r.blockedUntil>time)candidates=['giveSpace'];
  else if(['Furioso','Irritado','Magoado'].includes(m))candidates=r.hurt>15?['admitFault','askForgiveness','giveSpace']:['comfort','listen','day'];
  else if(ongoing(a,b))candidates=['finishOuting','day'];
  else if(r.hostility>=20)candidates=random()<.35?['choosePeace','disagree']:['disagree','choosePeace'];
  else if(r.dating&&random()<.35)candidates=['reassurance','warmLook','day'];
  else if(r.romance>=25&&random()<.25)candidates=['warmLook','flirt','chat'];
  else candidates=[pick(a+b+'auto',['day','hobby','joke','goodNews','weather','food','gossip','sportsTalk']),'chat','greet'];
  return candidates.find(action=>!unavailable(a,b,action))||null;
 }
 function initiative(a,b='player'){
  if(!people.has(a)||!people.has(b)||a===b)return null;
  const r=relation(a,b),self=people.get(a),ownMood=mood(a);
  if(r.blockedUntil>time||r.cooldown>time)return null;
  let choices;
  if(r.hostility>=25)choices=['choosePeace','disagree'];
  else if(['Irritado','Furioso','Magoado'].includes(ownMood))choices=['vent','day'];
  else if(r.romance>=25&&r.intimacy>=20&&random()<.35)choices=['warmLook','romanticCompliment'];
  else if(r.intimacy>=30&&r.friend>=40)choices=['memory','goodNews','hobby'];
  else if(r.friend<=0&&!r.memories.some(m=>m.accepted))choices=['greet'];
  else choices=self.trait==='brincalhão'?['joke','hobby','day']:['day','hobby','weather'];
  const action=choices.find(id=>!unavailable(a,b,id));if(!action)return null;
  const replies={greet:'greet',warmLook:'flirt',romanticCompliment:'flirt',vent:'listen',goodNews:'encourage',memory:'memory',choosePeace:'choosePeace',disagree:'disagree'};
  let response=replies[action]||'chat';if(unavailable(b,a,response))response='chat';if(unavailable(b,a,response))return null;
  const lines={greet:['Oi! Acho que a gente ainda não se conhece. Posso me apresentar?','Você é novo por aqui? Se quiser conversar, estou por perto.'],day:['Oi! Como está sendo seu dia?','Te vi por aqui e quis saber como você está.'],hobby:[`Estava pensando em ${self.interest}. É um assunto de que você gosta?`,`Hoje consegui um tempinho para ${self.interest}. Quer conversar?`],weather:['Esse tempo combina com uma conversa sem pressa, não acha?'],joke:['Tenho uma história que talvez te faça rir. Quer ouvir?'],goodNews:['Aconteceu uma coisa boa e lembrei de você. Posso contar?'],memory:['Lembrei da nossa última conversa. Gostei de dividir aquele momento com você.'],warmLook:['Estava com vontade de te ver. Posso ficar um pouco aqui com você?'],romanticCompliment:['Seu sorriso me fez querer vir conversar com você.'],vent:['Meu dia foi difícil. Você tem um minuto para me ouvir?'],choosePeace:['A gente já acumulou briga demais. Podemos conversar sem provocar um ao outro?'],disagree:['Ainda tenho algo atravessado entre nós. Quer conversar sobre isso?']};
  return {action,response,line:pick(a+b+'opening',lines[action]||[SOCIAL_ACTIONS[action].line])};
 }
 function messageIntent(text,channel='phone'){
  const normalized=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/vamos|quer |topa|convid|bora/.test(normalized)){
   if(/dormir|passar a noite/.test(normalized))return 'inviteSleep';
   if(/jantar/.test(normalized))return 'inviteDinner';
   if(/cafe/.test(normalized))return 'inviteCoffee';
   if(/encontro/.test(normalized))return 'inviteDate';
   if(/passear|caminhar/.test(normalized))return 'inviteWalk';
  }
  return /vai se|idiota|imbecil|ridicul/.test(normalized)?'swear':/desculp|perdao|errei/.test(normalized)?'admitFault':/nao quero|preciso de espaco/.test(normalized)?'boundaries':/amo|saudade|beij|lind[oa]/.test(normalized)?'romanticCompliment':/consegui|noticia boa|estou feliz|conquista/.test(normalized)?'goodNews':/piada|kkk|haha|meme/.test(normalized)?'sendMeme':/raiva|dia ruim|triste|chatead/.test(normalized)?'vent':channel==='social'?'commentPhoto':'checkIn';
 }
 function message(id,text,channel='phone'){
  const r=relation('player',id);if(!(channel==='social'?r.social:r.phone))return {ok:false,text:'Troque o contato pessoalmente primeiro.'};
  if(typeof text!=='string'||!text.trim())return {ok:false,text:'Escreva uma mensagem.'};
  const action=messageIntent(text,channel);if(SOCIAL_ACTIONS[action]?.event)return {ok:false,text:'Use os convites do celular para combinar esse programa.'};
  const result=interact('player',id,action,{channel});if(result.ok){const last=r.memories.at(-1);last.line=text.slice(0,160);result.line=last.line;}return result;
 }
 return {people,relations,events,crimeEvidence,investigations,criminalInventory,relation,label,interact,unavailable,save,mood,emotion,contacts,message,messageIntent,suggest,initiative,ongoing,finishEvent,
  beginEvent(id){const e=events.find(e=>e.id===id);if(!e||e.status!=='planned')return false;e.status='active';e.started=time;dirty=true;return true;},
  get time(){return time;},
  tick(dt){const step=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,1));time+=step;for(const id of people.keys()){needs.set(id,Math.max(0,(needs.get(id)??65)-step*.12));const e=emotion(id);e.anger=Math.max(0,e.anger-step*.035);e.sadness=Math.max(0,e.sadness-step*.025);e.joy=Math.max(0,e.joy-step*.04);e.energy=Math.min(100,e.energy+step*.008);}saveT+=step;if(saveT>10){saveT=0;if(dirty||emotions.size)save();}},
  need:id=>needs.get(id)??65
 };
}

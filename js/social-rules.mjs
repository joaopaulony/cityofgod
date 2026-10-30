// Every interaction, including future additions, needs an explicit progression rule.
export const gate=overrides=>Object.freeze({friend:-100,trust:-100,intimacy:0,romance:-100,hostility:0,...overrides});
const rules={};
function group(ids,requirements){for(const id of ids.split(' ')){if(rules[id])throw Error('Regra social duplicada: '+id);rules[id]=gate(requirements);}}
group('greet chat joke day career hobby music neighborhood funnyStory disagree weather food pets boundaries pun selfJoke impression absurd brag',{});
group('compliment encourage celebrate goodNews enthusiasm weekend playfulChallenge',{friend:5,trust:0});
group('listen comfort gratitude',{friend:15,trust:10,intimacy:5});
group('story values loyalty policeTalk gossip',{friend:15,trust:10,intimacy:5});
group('memory',{friend:10,intimacy:5,history:'conversation'});
group('dreams vent childhood',{friend:25,trust:20,intimacy:15});
group('fears secret',{friend:40,trust:35,intimacy:30});
group('danceTalk cookingTalk artTalk carTalk sportsTalk gardeningTalk photoTalk',{friend:5});
group('teasing darkJoke',{friend:30,trust:20,intimacy:15});
group('flirt admire romanticCompliment',{friend:20,trust:10,intimacy:5,maxHostility:15});
group('warmLook holdHands',{friend:35,trust:25,intimacy:20,romance:25,maxHostility:10});
group('confess',{friend:45,trust:35,intimacy:30,romance:40,maxHostility:10});
group('kiss',{friend:45,trust:35,intimacy:30,romance:45,maxHostility:10});
group('date',{friend:60,trust:50,intimacy:45,romance:70,maxHostility:5,exclusive:true});
group('future',{friend:60,trust:50,intimacy:50,romance:70,dating:true,maxHostility:10});
group('reassurance',{friend:35,trust:25,intimacy:25,romance:25});
group('jealousy',{intimacy:25,romance:30});
group('breakup',{dating:true});
group('insult',{});
group('snap coldShoulder',{hostility:10});
group('swear factionMock',{hostility:25});
group('humiliate',{hostility:50});
group('threaten',{hostility:65});
group('mockDream',{intimacy:15,hostility:35,history:'dreams'});
group('rumor',{hostility:25});
group('revealSecret',{intimacy:30,hostility:35,history:'confidence'});
group('publicMock',{hostility:30});
group('defend',{friend:5});
group('apologize admitFault askForgiveness promise',{history:'offense'});
group('giveSpace unblock',{history:'boundary'});
group('peace factionPeace choosePeace',{hostility:10});
group('askStreetTrade',{friend:10,trust:10});
group('buyStreetParcel',{friend:25,trust:35,maxHostility:45});
group('askGangProtection',{friend:35,trust:45,maxHostility:25});
group('shareRivalTip',{friend:35,trust:45,maxHostility:25});
group('recruitmentPitch',{friend:35,trust:40});
group('reportCrime',{evidence:true});
group('offerInformantTip',{friend:5,trust:10,evidence:true});
group('askCaseUpdate',{friend:-100,trust:-100,caseUpdate:true});
group('exchangePhone',{friend:20,trust:15,intimacy:5,maxHostility:15});
group('exchangeSocial',{friend:10,trust:5,maxHostility:20});
group('checkIn likePhoto commentPhoto',{});
group('sendMeme',{friend:10,trust:5});
group('inviteWalk inviteCoffee',{friend:20,trust:15,intimacy:8,maxHostility:15});
group('inviteDate',{friend:40,trust:30,intimacy:25,romance:35,maxHostility:10});
group('inviteDinner inviteStay',{friend:40,trust:30,intimacy:25,maxHostility:10});
group('inviteSleep',{friend:60,trust:55,intimacy:50,maxHostility:5});
group('inviteParty',{friend:30,trust:20,intimacy:15,maxHostility:15});
group('finishOuting cancelPlans standUp',{});
export const SOCIAL_RULES=Object.freeze(rules);

export function defineSocialActions(catalog){
 return Object.freeze(Object.fromEntries(Object.entries(catalog).map(([id,spec])=>{
  const rule=spec.gate||SOCIAL_RULES[id];
  if(!rule)throw Error(`A interação ${id} precisa declarar uma regra de progressão social.`);
  const fields=new Set(['friend','trust','intimacy','romance','hostility','maxHostility','dating','exclusive','history','evidence','caseUpdate']);
  for(const key of Object.keys(rule))if(!fields.has(key))throw Error(`Regra ${id}: campo desconhecido ${key}.`);
  for(const k of ['friend','trust','intimacy','romance','hostility'])if(!Number.isFinite(rule[k])||rule[k]>(100)||rule[k]<(k==='intimacy'||k==='hostility'?0:-100))throw Error(`Regra ${id}: requisito ${k} inválido.`);
  if(rule.history&&!['conversation','dreams','confidence','offense','boundary'].includes(rule.history))throw Error('Histórico social inválido: '+id);
  if(rule.maxHostility!=null&&(!Number.isFinite(rule.maxHostility)||rule.maxHostility<0||rule.maxHostility>100))throw Error('Limite de hostilidade inválido: '+id);
  for(const key of ['dating','exclusive'])if(rule[key]!=null&&typeof rule[key]!=='boolean')throw Error(`Regra ${id}: ${key} inválido.`);
  for(const key of ['evidence','caseUpdate'])if(rule[key]!=null&&typeof rule[key]!=='boolean')throw Error(`Regra ${id}: ${key} inválido.`);
  const required={...rule};
  for(const [old,key] of [['minFriend','friend'],['minTrust','trust'],['minRomance','romance']])if(Number.isFinite(spec[old]))required[key]=Math.max(required[key],spec[old]);
  return [id,Object.freeze({...spec,gate:Object.freeze(required)})];
 })));
}

export function progressionReason(action,r,{time=0,hasPartner=false,hasEvidence=false,hasCase=false}={}){
 const g=action.gate;if(!g)return 'Esta interação ainda não tem uma regra de progressão.';
 if(g.dating&&!r.dating)return 'Vocês precisam estar namorando.';
 if(g.exclusive&&(r.dating||hasPartner))return r.dating?'Vocês já estão namorando.':'Um de vocês já está em outro namoro.';
 const positive=(r.memories||[]).filter(m=>m.accepted);
 if(g.history==='conversation'&&!positive.length)return 'Conversem primeiro para criar uma lembrança em comum.';
 if(g.history==='dreams'&&!positive.some(m=>m.action==='dreams'))return 'Você ainda não conhece os sonhos dessa pessoa.';
 if(g.history==='confidence'&&!positive.some(m=>['secret','fears'].includes(m.action)))return 'Essa pessoa ainda não compartilhou uma confidência com você.';
 if(g.history==='offense'&&!(r.hurt>0))return 'Não há uma ofensa para reparar.';
 if(g.history==='boundary'&&!(r.hurt>0||r.blockedUntil>time||r.romanceBoundaryUntil>time))return 'Ninguém pediu distância ou interrompeu o contato.';
 if(g.evidence&&!hasEvidence)return 'Você ainda não tem um fato vivido ou uma pista concreta para relatar.';
 if(g.caseUpdate&&!hasCase)return 'Você ainda não tem uma investigação registrada.';
 const names={friend:'Amizade',trust:'Confiança',intimacy:'Intimidade',romance:'Romance',hostility:'Hostilidade'};
 const missing=Object.keys(names).filter(k=>(r[k]??0)<g[k]).map(k=>`${names[k]} ${Math.floor(r[k]??0)}/${g[k]}`);
 if(missing.length)return 'Ainda falta: '+missing.join(' · ')+'.';
 if(Number.isFinite(g.maxHostility)&&(r.hostility||0)>g.maxHostility)return `Reduza a hostilidade para ${g.maxHostility} ou menos (atual: ${Math.ceil(r.hostility)}).`;
 return '';
}

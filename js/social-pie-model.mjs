import {SOCIAL_ACTIONS} from './social-sim.mjs';

// Each branch is a real navigation level; leaves execute the social simulation.
export const SOCIAL_TREE=Object.freeze({
 root:{label:'Conversar',icon:'💬',children:['friendly','romantic','funny','conflict','factions','invitations','digital','details']},
 friendly:{label:'Amigável',icon:'☀',children:['smalltalk','affection','stories','deep','hobbies','interests','joyful','gossipTopics']},
 smalltalk:{label:'Conversa casual',icon:'💬',actions:['greet','day','weather','food','weekend','pets']},
 affection:{label:'Afeto e apoio',icon:'🤝',actions:['compliment','listen','encourage','comfort','gratitude','boundaries']},
 stories:{label:'Histórias',icon:'📖',actions:['story','memory','childhood','career']},
 deep:{label:'Conversa profunda',icon:'☁',actions:['dreams','fears','secret','values','listen','vent']},
 hobbies:{label:'Passatempos',icon:'🎨',actions:['hobby','music','danceTalk','cookingTalk','artTalk','carTalk','sportsTalk','gardeningTalk']},
 interests:{label:'Interesses',icon:'✦',actions:['chat','neighborhood','photoTalk']},
 joyful:{label:'Alegria e entusiasmo',icon:'🎉',actions:['celebrate','goodNews','enthusiasm','gratitude']},
 gossipTopics:{label:'Fofocas do bairro',icon:'👀',actions:['gossip','defend','rumor','revealSecret']},
 romantic:{label:'Romântico',icon:'💕',children:['flirting','closeness','commitment']},
 flirting:{label:'Flerte e atração',icon:'🌷',actions:['flirt','admire','romanticCompliment','confess']},
 closeness:{label:'Carinho e intimidade',icon:'🥰',actions:['warmLook','holdHands','kiss','reassurance']},
 commitment:{label:'Nosso relacionamento',icon:'💞',actions:['date','future','jealousy','breakup']},
 funny:{label:'Engraçado',icon:'😄',actions:['joke','funnyStory','pun','selfJoke','impression','absurd','teasing','darkJoke']},
 conflict:{label:'Conflitos',icon:'ϟ',children:['irritation','cruelty','reconciliation']},
 irritation:{label:'Irritação e discussões',icon:'💢',actions:['disagree','insult','snap','swear','coldShoulder','brag']},
 cruelty:{label:'Crueldade e traição',icon:'🧊',actions:['humiliate','mockDream','threaten','revealSecret','rumor','standUp']},
 reconciliation:{label:'Reparar o vínculo',icon:'🕊',actions:['apologize','admitFault','askForgiveness','giveSpace','promise','unblock']},
 factions:{label:'Facções, rua e polícia',icon:'⚑',children:['factionTalk','streetBusiness','policeReports']},
 factionTalk:{label:'Lealdade e rivalidade',icon:'⚑',actions:['loyalty','peace','factionPeace','factionMock','policeTalk','choosePeace']},
 streetBusiness:{label:'Assuntos da rua',icon:'🕶',actions:['askStreetTrade','buyStreetParcel','askGangProtection','shareRivalTip','recruitmentPitch']},
 policeReports:{label:'Polícia e investigações',icon:'🚔',actions:['reportCrime','offerInformantTip','askCaseUpdate']},
 invitations:{label:'Convites e encontros',icon:'🗓',children:['goingOut','atHome','plans']},
 goingOut:{label:'Sair juntos',icon:'🌇',actions:['inviteWalk','inviteCoffee','inviteDate','playfulChallenge']},
 atHome:{label:'Receber em casa',icon:'🏡',actions:['inviteDinner','inviteStay','inviteSleep','inviteParty']},
 plans:{label:'Nossos combinados',icon:'🗓',actions:['finishOuting','cancelPlans','standUp']},
 digital:{label:'Telefone e CitySocial',icon:'📱',actions:['exchangePhone','exchangeSocial','checkIn','sendMeme','likePhoto','commentPhoto','publicMock']},
 details:{label:'Conhecer melhor',icon:'◇',actions:['story','dreams','career','values','boundaries']}
});

export function actionUnavailable(sim,id,action,{inRange=true,blocked=false,...context}={}){
 if(!inRange)return 'Aproxime-se a até 4 metros e fique no mesmo andar.';
 if(blocked)return 'Pare e guarde a arma para conversar.';
 const r=sim.relation('player',id);
 if(sim.time<r.cooldown)return 'Aguarde a resposta antes da próxima interação.';
 if(action==='breakup'&&!r.dating)return 'Vocês não estão namorando.';
 if(action==='date'&&r.dating)return 'Vocês já estão namorando.';
 return sim.unavailable?.('player',id,action,context)||'';
}

export function pieOptions(branch='root'){
 const node=SOCIAL_TREE[branch]||SOCIAL_TREE.root;
 return node.children?node.children.map(id=>({id,branch:true,...SOCIAL_TREE[id]})):
  node.actions.map(id=>({id,branch:false,...SOCIAL_ACTIONS[id]}));
}

// Clamp the entire fan, rather than individual pills, to preserve its geometry at edges.
export function pieLayout(width,height,anchor,count){
 const compact=width<720||height<500;
 const w=compact?Math.min(380,width-20):700;
 const h=compact?Math.min(height-20,Math.max(290,126+Math.ceil(count/2)*53)):410;
 const x=Math.max(w/2+10,Math.min(width-w/2-10,anchor.x));
 const top=height>620?100:10,bottom=height>620?55:10;
 const y=Math.max(h/2+top,Math.min(height-h/2-bottom,anchor.y));
 const slots=compact?Array.from({length:count},(_,i)=>({x:(i%2?1:-1)*w*.25,y:75+Math.floor(i/2)*53-h/2})):
  Array.from({length:count},(_,i)=>{const angle=count===2?i*Math.PI:(count===4?-Math.PI/4:-Math.PI/2)+i*Math.PI*2/count;return {x:Math.cos(angle)*245,y:Math.sin(angle)*158};});
 return {compact,x,y,width:w,height:h,slots,buttonWidth:compact?w/2-14:190};
}

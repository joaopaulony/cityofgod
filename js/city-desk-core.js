// city-desk-core.js — regras puras do trabalho remoto (CityDesk): contratos, pagamento único, reputação, níveis,
// gerador de ofertas NPC, motor de regras do CodeLab (sem eval), SVG seguro do Brand Studio e métricas do CityLive.
// Sem DOM: testável em Node (tests/remote-work.test.cjs). A interface fica em js/city-desk.js.
(function(root){
 'use strict';
 const DAY=1440;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const round2=v=>Math.round(v*100)/100;
 // ---------- economia (recalibrada pelo jogo atual) ----------
 // Turnos presenciais pagam R$ 250–650 por ~10 min reais (R$ 25–65/min); atendimento das profissões da universidade
 // ~R$ 55–260 por cliente. Um contrato remoto leva 2–5 min reais e não exige deslocamento: paga um pouco abaixo de
 // um turno por minuto no nível 1 e chega perto dele no nível 5. Tudo aqui, nada de número solto nas telas.
 const CONFIG={
  fee:.08,                                   // taxa da plataforma sobre o bruto (exemplo do plano: 8%)
  levelMult:[1,1,1.35,1.75,2.2,2.7],         // multiplicador do valor por nível (índice = nível)
  careers:{
   programmer:{name:'Programador Freelancer',app:'CodeLab',icon:'💻',base:[110,190],xpPer:24,energy:.05},
   support:{name:'Suporte Técnico Remoto',app:'HelpDesk City',icon:'🛠️',base:[70,140],xpPer:20,energy:.04},
   designer:{name:'Designer Gráfico',app:'Brand Studio',icon:'🎨',base:[90,170],xpPer:22,energy:.05},
   streamer:{name:'Streamer',app:'CityLive Studio',icon:'🎙️',base:[45,110],xpPer:18,energy:.07}
  },
  // nível: contratos aprovados e reputação mínima (tabelas dos planos)
  levels:{
   programmer:[[0,0,'Estagiário Freelancer'],[2,0,'Estagiário Freelancer'],[8,65,'Desenvolvedor Júnior'],[22,70,'Desenvolvedor Pleno'],[55,75,'Desenvolvedor Sênior'],[120,85,'Arquiteto Digital']],
   support:[[0,0,'HelpDesk N1'],[4,0,'HelpDesk N1'],[12,65,'Técnico Júnior'],[30,75,'Analista N2'],[75,80,'Especialista de Infra'],[150,90,'Consultor de TI']],
   designer:[[0,0,'Criador Iniciante'],[1,0,'Criador Iniciante'],[8,60,'Designer Freelancer'],[22,65,'Diretor de Marca'],[55,75,'Estúdio Criativo'],[120,90,'Diretor de Arte']],
   streamer:[[0,0,'Canal de quarto'],[1,0,'Canal de quarto'],[5,45,'Criador local'],[16,55,'Parceiro'],[40,70,'Referência da cidade'],[90,80,'Estrela urbana']]
  },
  activeMax:[0,1,2,2,3,3],                   // trabalhos em andamento por nível
  offersPerCareer:4,offerTTL:2,deadlineDays:[1,3],
  dailyPaidCap:[0,4,5,6,7,8],                // pagamentos por dia de jogo, por carreira e nível (anti-farm)
  licenses:{essential:{name:'Software Essencial',price:180,level:2},pro:{name:'Suite Profissional',price:650,level:3},stream:{name:'Streaming Pro',price:1200,level:3}}
 };
 // ---------- utilidades determinísticas ----------
 function rng(seed){let s=seed>>>0||1;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 const hash=(...p)=>{let h=2166136261;for(const c of p.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 const day=clock=>Math.floor((Number(clock)||0)/DAY);

 // ---------- perfil ----------
 function newState(){
  const careers={};for(const k of Object.keys(CONFIG.careers))careers[k]={level:1,xp:0,reputation:50,done:0,failed:0,cancelled:0,quality:[],paidByDay:{}};
  return {version:1,careers,contracts:[],offers:{},offersDay:{},ledger:[],artifacts:[],messages:[],licenses:{},channel:null,seq:0};
 }
 function sanitizeState(raw){
  const s=newState();if(!raw||raw.version!==1)return s;
  for(const k of Object.keys(s.careers)){const c=raw.careers?.[k];if(!c)continue;
   s.careers[k]={level:clamp(Math.round(c.level)||1,1,5),xp:Math.max(0,+c.xp||0),reputation:clamp(+c.reputation||50,0,100),done:Math.max(0,c.done|0),failed:Math.max(0,c.failed|0),cancelled:Math.max(0,c.cancelled|0),
    quality:Array.isArray(c.quality)?c.quality.slice(-30).map(Number).filter(Number.isFinite):[],paidByDay:c.paidByDay&&typeof c.paidByDay==='object'?c.paidByDay:{}};}
  s.contracts=Array.isArray(raw.contracts)?raw.contracts.filter(c=>c&&typeof c.id==='string'&&CONFIG.careers[c.career]).slice(-200):[];
  s.offers=raw.offers&&typeof raw.offers==='object'?raw.offers:{};s.offersDay=raw.offersDay||{};
  s.ledger=Array.isArray(raw.ledger)?raw.ledger.filter(t=>t&&typeof t.id==='string').slice(-500):[];
  s.artifacts=Array.isArray(raw.artifacts)?raw.artifacts.slice(-120):[];s.messages=Array.isArray(raw.messages)?raw.messages.slice(-60):[];
  s.licenses=raw.licenses&&typeof raw.licenses==='object'?raw.licenses:{};s.channel=raw.channel||null;s.seq=Math.max(0,raw.seq|0);
  return s;
 }
 function levelOf(career,c){
  const tab=CONFIG.levels[career];let lv=1;
  for(let i=2;i<tab.length;i++)if(c.done>=tab[i][0]&&c.reputation>=tab[i][1])lv=i;
  return lv;
 }
 const levelName=(career,lv)=>CONFIG.levels[career][lv][2];
 const nextLevel=(career,lv)=>lv>=5?null:{done:CONFIG.levels[career][lv+1][0],reputation:CONFIG.levels[career][lv+1][1],name:CONFIG.levels[career][lv+1][2]};

 // ---------- ofertas NPC (semente por dia e carreira: reabrir a aba não sorteia de novo) ----------
 function refreshOffers(s,career,templates,clock,clients){
  const d=day(clock),c=s.careers[career];
  if(s.offersDay[career]===d&&Array.isArray(s.offers[career]))return s.offers[career];
  const R=rng(hash('offers',career,d,s.seq)),pool=templates.filter(t=>(t.minLevel||1)<=c.level);
  const taken=new Set(s.contracts.filter(x=>x.career===career&&!['PAID','DECLINED','CANCELLED','EXPIRED','REJECTED'].includes(x.state)).map(x=>x.templateId));
  const out=[],n=Math.min(pool.length,CONFIG.offersPerCareer+(c.level>=3?1:0));
  const order=pool.map(t=>[R(),t]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]).filter(t=>!taken.has(t.id));
  for(const t of order.slice(0,n)){
   const drawn=clients[(R()*clients.length)|0],client=t.client&&clients.find(x=>x.id===t.client)||drawn,[lo,hi]=CONFIG.careers[career].base,mult=CONFIG.levelMult[c.level]*(t.weight||1);
   const gross=Math.round((lo+(hi-lo)*R())*mult/5)*5;
   const dl=CONFIG.deadlineDays[0]+((R()*(CONFIG.deadlineDays[1]-CONFIG.deadlineDays[0]+1))|0);
   out.push({id:career.slice(0,4)+'-'+d+'-'+t.id+'-'+((R()*1e6)|0),career,templateId:t.id,client,gross,dueDays:dl,seed:(R()*1e9)|0,expiresDay:d+CONFIG.offerTTL});
  }
  s.offers[career]=out;s.offersDay[career]=d;return out;
 }
 const activeCount=(s,career)=>s.contracts.filter(c=>c.career===career&&['ACCEPTED','IN_PROGRESS','REVISION_REQUIRED','SUBMITTED'].includes(c.state)).length;
 function accept(s,offerId,clock){
  for(const [career,list] of Object.entries(s.offers)){
   const i=(list||[]).findIndex(o=>o.id===offerId);if(i<0)continue;
   const o=list[i],c=s.careers[career];
   if(s.contracts.some(x=>x.id===o.id))return {ok:false,code:'ALREADY_APPLIED',text:'Contrato já aceito.'};
   if(activeCount(s,career)>=CONFIG.activeMax[c.level])return {ok:false,code:'CAPACITY',text:'Conclua os trabalhos em andamento antes de aceitar outro (limite do seu nível: '+CONFIG.activeMax[c.level]+').'};
   if(o.expiresDay<day(clock))return {ok:false,code:'EXPIRED',text:'Esta proposta expirou.'};
   const contract={...o,state:'ACCEPTED',acceptedClock:clock,dueClock:(day(clock)+o.dueDays+1)*DAY,revisions:0,attempts:0,artifactId:null,payoutTxnId:null,score:null,history:[{state:'ACCEPTED',clock}]};
   list.splice(i,1);s.contracts.push(contract);s.seq++;
   return {ok:true,code:'OK',text:'Contrato aceito. Prazo: '+o.dueDays+' dia(s) de jogo.',data:contract};
  }
  return {ok:false,code:'NOT_FOUND',text:'Proposta indisponível.'};
 }
 // transições válidas (OFFERED → ACCEPTED → IN_PROGRESS → SUBMITTED → APPROVED → PAID; alternativas)
 const FLOW={ACCEPTED:['IN_PROGRESS','CANCELLED','EXPIRED'],IN_PROGRESS:['SUBMITTED','CANCELLED','EXPIRED'],SUBMITTED:['APPROVED','REVISION_REQUIRED','REJECTED'],
  REVISION_REQUIRED:['IN_PROGRESS','SUBMITTED','CANCELLED','EXPIRED'],APPROVED:['PAID'],PAID:[],CANCELLED:[],EXPIRED:[],REJECTED:[],DECLINED:[]};
 function transition(contract,to,clock,note){
  if(contract.state===to)return {ok:false,code:'ALREADY_APPLIED',text:'Já aplicado.'};
  if(!(FLOW[contract.state]||[]).includes(to))return {ok:false,code:'INVALID',text:'Transição inválida: '+contract.state+' → '+to};
  contract.state=to;contract.history.push({state:to,clock,note});return {ok:true};
 }
 // expiração pelo relógio do jogo (título/pausa não avançam o relógio)
 function expire(s,clock){
  const out=[];
  for(const c of s.contracts)if(['ACCEPTED','IN_PROGRESS','REVISION_REQUIRED'].includes(c.state)&&clock>c.dueClock){transition(c,'EXPIRED',clock,'prazo');
   const k=s.careers[c.career];k.failed++;k.reputation=clamp(k.reputation-6,0,100);out.push(c);}
  return out;
 }
 // avaliação: nota 0–1 → aprovado (≥ .6), revisão (≥ .4, 1 vez), recusado
 function evaluate(s,contract,score,clock,{revisable=true}={}){
  if(!['IN_PROGRESS','REVISION_REQUIRED','ACCEPTED'].includes(contract.state))return {ok:false,code:'INVALID',text:'Contrato não está em andamento.'};
  if(contract.state==='ACCEPTED')transition(contract,'IN_PROGRESS',clock);
  transition(contract,'SUBMITTED',clock);contract.attempts++;
  const late=clock>contract.dueClock;
  if(score>=.6){transition(contract,'APPROVED',clock);contract.score=round2(score);return {ok:true,code:'APPROVED',late};}
  if(score>=.4&&revisable&&contract.revisions<1){contract.revisions++;transition(contract,'REVISION_REQUIRED',clock);return {ok:true,code:'REVISION'};}
  transition(contract,'REJECTED',clock);const k=s.careers[contract.career];k.failed++;k.reputation=clamp(k.reputation-4,0,100);
  return {ok:true,code:'REJECTED'};
 }
 // pagamento único: id determinístico, conferido no ledger antes de creditar; teto diário por carreira
 function payout(s,contract,clock,credit,{partial=1}={}){
  if(contract.state!=='APPROVED')return {ok:false,code:'NOT_APPROVED',text:'Só paga contrato aprovado.'};
  const id=contract.career+':'+contract.id+':final';
  if(s.ledger.some(t=>t.id===id)){contract.payoutTxnId=id;transition(contract,'PAID',clock);return {ok:false,code:'ALREADY_APPLIED',text:'Pagamento já registrado.'};}
  const k=s.careers[contract.career],d=day(clock),used=k.paidByDay[d]||0;
  const capped=used>=CONFIG.dailyPaidCap[k.level];
  const quality=clamp(contract.score??.6,0,1),gross=Math.round(contract.gross*partial*(.85+.3*quality)*(capped?.35:1));
  const fee=Math.round(gross*CONFIG.fee),net=gross-fee;   // reais inteiros, como a carteira do CityLife
  const tx={id,career:contract.career,contractId:contract.id,gross,fee,net,clock,client:contract.client?.name||''};
  s.ledger.push(tx);                                   // 1) registra (idempotência)
  if(!credit(net,CONFIG.careers[contract.career].app+' · '+(contract.client?.name||'cliente'))){s.ledger.pop();return {ok:false,code:'CREDIT_FAILED',text:'Não foi possível creditar.'};}
  contract.payoutTxnId=id;transition(contract,'PAID',clock);
  k.paidByDay={[d]:used+1};k.done++;k.quality.push(quality);if(k.quality.length>30)k.quality.shift();
  k.reputation=clamp(k.reputation+(quality-.6)*12+(clock>contract.dueClock?-3:1),0,100);
  k.xp+=Math.round(CONFIG.careers[contract.career].xpPer*(.5+quality));
  const before=k.level;k.level=levelOf(contract.career,k);
  return {ok:true,code:'PAID',data:{...tx,capped,levelUp:k.level>before?k.level:0}};
 }
 function cancel(s,contract,clock){
  const r=transition(contract,'CANCELLED',clock,'desistência');if(!r.ok)return r;
  const k=s.careers[contract.career];k.cancelled++;k.reputation=clamp(k.reputation-3,0,100);
  return {ok:true,text:'Contrato cancelado. Desistir com frequência reduz a reputação.'};
 }

 // ---------- CodeLab: motor de regras fechado (JSON tipado, sem eval) ----------
 const OPS={'==':(a,b)=>a===b,'!=':(a,b)=>a!==b,'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'contém':(a,b)=>Array.isArray(a)?a.includes(b):String(a).includes(String(b))};
 function evalCond(cond,input){const f=OPS[cond.op];if(!f||!(cond.field in input))return false;return !!f(input[cond.field],cond.value);}
 function runRules(rule,input){
  const conds=(rule.when||[]).slice(0,4);if(!conds.length)return rule.else??null;
  const ok=rule.combine==='or'?conds.some(c=>evalCond(c,input)):conds.every(c=>evalCond(c,input));
  return ok?rule.then:rule.else;
 }
 function testRules(rule,cases){return cases.map(c=>({name:c.name,expect:c.expect,got:runRules(rule,c.input),pass:runRules(rule,c.input)===c.expect}));}
 // sequência: cada restrição "a antes de b" é um teste
 function testSequence(order,constraints,required){
  const pos=new Map(order.map((s,i)=>[s,i])),tests=[];
  for(const r of required||[])tests.push({name:'Inclui “'+r+'”',pass:pos.has(r)});
  for(const [a,b] of constraints)tests.push({name:'“'+a+'” antes de “'+b+'”',pass:pos.has(a)&&pos.has(b)&&pos.get(a)<pos.get(b)});
  return tests;
 }
 // depuração: cada opção é uma função escrita por nós (conteúdo), avaliada nos casos de teste
 function testFix(fix,cases){return cases.map(c=>{const got=fix(c.input);return {name:c.name,expect:c.expect,got,pass:JSON.stringify(got)===JSON.stringify(c.expect)};});}
 // interface: componentes autorizados ligados aos dados certos
 function testUI(config,spec){
  const tests=[];
  for(const req of spec.required)tests.push({name:'Tem '+req.label,pass:config.components.includes(req.component)&&(!req.bind||config.bind[req.component]===req.bind)});
  for(const f of spec.forbidden||[])tests.push({name:'Sem '+f.label,pass:!config.components.includes(f.component)});
  tests.push({name:'No máximo '+spec.max+' componentes',pass:config.components.length<=spec.max});
  return tests;
 }
 const passRate=tests=>tests.length?tests.filter(t=>t.pass).length/tests.length:0;
 // nota do programador: funcionalidade 55%, testes 25%, clareza 10%, prazo 10%
 function codeScore(tests,{steps=0,idealSteps=0,late=false,ranTests=false}={}){
  const fn=passRate(tests),clarity=idealSteps?clamp(1-Math.max(0,steps-idealSteps)*.15,0,1):1;
  return round2(.55*(fn===1?1:fn*.7)+.25*(ranTests?fn:fn*.5)+.10*clarity+.10*(late?0:1));
 }

 // ---------- Suporte: nota 40% causa, 25% procedimento, 20% verificação, 15% tempo/relatório ----------
 function supportScore(ticket,run){
  const cause=run.cause===ticket.cause?1:0;
  const usedEvidence=ticket.evidence.filter(t=>run.tools.includes(t)).length/Math.max(1,ticket.evidence.length);
  const harmful=run.actions.filter(a=>ticket.harmful?.includes(a)).length,wrong=run.actions.filter(a=>a!==ticket.action&&!ticket.harmful?.includes(a)).length;
  const procedure=clamp(usedEvidence-harmful*.5-wrong*.2,0,1);
  const fixed=run.actions.includes(ticket.action);
  const verified=fixed&&run.verified?1:0;
  const doc=(run.report?.prevention===ticket.prevention?.5:0)+(run.minutes<=ticket.sla?.5:.2);
  let score=.4*cause+.25*procedure+.2*verified+.15*doc;
  if(ticket.action==='escalate'&&fixed&&cause)score=Math.max(score,.62);       // escalar certo é sucesso parcial
  if(!fixed)score=Math.min(score,.39);                                          // sem reparo nem escalonamento: não paga
  return {score:round2(score),cause,procedure:round2(procedure),verified,doc:round2(doc),partial:ticket.action==='escalate'?.7:1};
 }

 // ---------- Brand Studio: modelo JSON → SVG seguro ----------
 const SHAPES=['circle','square','rounded','hexagon','shield','diamond','triangle','star','moon','drop','leaf','bolt','heart','ring','wave','cup','scissors','wrench','house','badge'];
 const FONTS={sans:"'Segoe UI',system-ui,sans-serif",serif:"Georgia,'Times New Roman',serif",display:"Impact,'Arial Narrow',sans-serif",mono:"Consolas,'Courier New',monospace"};
 const RATIOS={square:[512,512],landscape:[960,540],banner:[1200,400],portrait:[540,760],card:[700,400]};
 const isHex=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
 const cleanText=t=>String(t??'').replace(/[<>&"'`\\{}]/g,'').replace(/\s+/g,' ').trim().slice(0,40);
 function sanitizeDesign(d){
  const ratio=RATIOS[d?.ratio]?d.ratio:'square',[W,H]=RATIOS[ratio];
  const els=(Array.isArray(d?.elements)?d.elements:[]).slice(0,24).map(e=>{
   const base={id:String(e.id||'').replace(/[^a-z0-9-]/gi,'').slice(0,12)||'e',x:clamp(+e.x||0,-W,W*2),y:clamp(+e.y||0,-H,H*2),rot:clamp(+e.rot||0,-360,360)};
   if(e.type==='text')return {...base,type:'text',text:cleanText(e.text),size:clamp(+e.size||48,8,240),font:FONTS[e.font]?e.font:'sans',fill:isHex(e.fill)?e.fill:'#222222',weight:e.weight==='bold'?'bold':'normal'};
   return {...base,type:'shape',shape:SHAPES.includes(e.shape)?e.shape:'circle',size:clamp(+e.size||120,8,W*1.5),fill:isHex(e.fill)?e.fill:'#d8973a',stroke:isHex(e.stroke)?e.stroke:'none',sw:clamp(+e.sw||0,0,24)};
  });
  return {ratio,bg:isHex(d?.bg)?d.bg:'#ffffff',elements:els};
 }
 // caminhos das formas originais (unidade: caixa de -1 a 1)
 const PATHS={square:'M-1-1H1V1H-1Z',rounded:'M-.7-1H.7Q1-1 1-.7V.7Q1 1 .7 1H-.7Q-1 1-1 .7V-.7Q-1-1-.7-1Z',hexagon:'M0-1L.87-.5V.5L0 1-.87.5V-.5Z',
  shield:'M0-1L.85-.7V.05C.85 .55 .45 .85 0 1C-.45 .85-.85 .55-.85 .05V-.7Z',diamond:'M0-1L1 0 0 1-1 0Z',triangle:'M0-1L1 .8H-1Z',
  star:'M0-1L.24-.32 .95-.31 .38 .12 .59 .81 0 .4-.59 .81-.38 .12-.95-.31-.24-.32Z',moon:'M.35-.95A1 1 0 1 0 .35 .95A.75 .75 0 1 1 .35-.95Z',
  drop:'M0-1C.35-.45.75-.1.75.3A.75.75 0 0 1-.75.3C-.75-.1-.35-.45 0-1Z',leaf:'M-.9.9C-.9-.3-.1-.9.9-.9C.9.3.1.9-.9.9Z',bolt:'M.2-1L-.6.15H-.05L-.25 1 .6-.2H.05Z',
  heart:'M0 .9C-.9.25-1-.25-.75-.6S-.1-.7 0-.35C.1-.7.5-.85.75-.6S.9.25 0 .9Z',wave:'M-1 .2Q-.5-.4 0 .2T1 .2V1H-1Z',cup:'M-.7-.6H.6V.3Q.6.9 0 .9T-.7.3ZM.6-.4H.85Q1-.4 1-.15T.85.15H.6',
  scissors:'M-.5-.9L.4.5M.5-.9L-.4.5M-.6.6A.3.3 0 1 0-.6.61M.6.6A.3.3 0 1 0 .6.61',wrench:'M-.9.7L.1-.3A.45.45 0 1 1 .3-.1L-.7.9Z',house:'M0-1L1-.1V1H-1V-.1Z',
  badge:'M0-1L.3-.8.65-.85.75-.5 1-.25.85.1.95.45.6.6.45.95.1.85-.2 1-.45.8-.8.75-.85.4-1 .1-.8-.2-.8-.55-.5-.7-.3-.95Z'};
 const escAttr=v=>String(v).replace(/[^#a-z0-9 .,()\-'%À-ÿ]/gi,'');   // sem aspas duplas: o valor fica dentro de "..."
 const escText=t=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 function renderSVG(design,{width,title}={}){
  const d=sanitizeDesign(design),[W,H]=RATIOS[d.ratio];
  const out=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"'+(width?' width="'+(+width|0)+'"':'')+' role="img" aria-label="'+escAttr(title||'Arte')+'">','<rect width="'+W+'" height="'+H+'" fill="'+d.bg+'"/>'];
  for(const e of d.elements){
   const tr='translate('+e.x.toFixed(1)+' '+e.y.toFixed(1)+') rotate('+e.rot.toFixed(1)+')';
   if(e.type==='text'){out.push('<text transform="'+tr+'" text-anchor="middle" dominant-baseline="central" font-family="'+escAttr(FONTS[e.font])+'" font-size="'+e.size+'" font-weight="'+e.weight+'" fill="'+e.fill+'">'+escText(e.text)+'</text>');continue;}
   const s=(e.size/2).toFixed(1),st=e.stroke!=='none'&&e.sw?' stroke="'+e.stroke+'" stroke-width="'+(e.sw/(e.size/2)).toFixed(3)+'"':'';
   if(e.shape==='circle')out.push('<circle transform="'+tr+' scale('+s+')" r="1" fill="'+e.fill+'"'+st+'/>');
   else if(e.shape==='ring')out.push('<circle transform="'+tr+' scale('+s+')" r=".82" fill="none" stroke="'+e.fill+'" stroke-width=".26"/>');
   else{const line=['scissors','cup'].includes(e.shape);out.push('<path transform="'+tr+' scale('+s+')" d="'+PATHS[e.shape]+'" fill="'+(line?'none':e.fill)+'"'+(line?' stroke="'+e.fill+'" stroke-width=".14" stroke-linecap="round"':st)+'/>');}
  }
  out.push('</svg>');return out.join('');
 }
 // contraste WCAG entre duas cores
 const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const colorNear=(a,b)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const x=p(a),y=p(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2])<60;};
 // avaliação objetiva do briefing: 30% briefing, 25% legibilidade/contraste, 20% composição, 15% cor, 10% prazo
 function designCheck(design,brief,{late=false}={}){
  const d=sanitizeDesign(design),[W,H]=RATIOS[d.ratio],checks=[];
  const texts=d.elements.filter(e=>e.type==='text'),shapes=d.elements.filter(e=>e.type==='shape');
  const norm=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  for(const t of brief.texts||[])checks.push({group:'brief',name:'Texto “'+t+'”',pass:texts.some(e=>norm(e.text)===norm(t))});
  for(const s of brief.shapes||[])checks.push({group:'brief',name:'Forma: '+s,pass:shapes.some(e=>e.shape===s)});
  checks.push({group:'brief',name:'Proporção '+brief.ratio,pass:d.ratio===brief.ratio});
  // legibilidade: contraste do texto com o fundo e tamanho mínimo (lido a 48 px no caso de logo)
  for(const e of texts){
   checks.push({group:'legib',name:'Contraste de “'+e.text+'”',pass:contrast(e.fill,d.bg)>=3});
   checks.push({group:'legib',name:'Tamanho de “'+e.text+'”',pass:e.size/Math.max(W,H)*(brief.small||48)>=(brief.small?4:3.5)||e.size>=Math.max(W,H)*.07});
  }
  if(!texts.length)checks.push({group:'legib',name:'Algum texto',pass:false});
  // composição: tudo dentro da área segura e alinhado ao centro ou às guias
  const margin=Math.min(W,H)*.04,inside=d.elements.every(e=>{const r=(e.type==='text'?e.size*Math.max(1,e.text.length*.32):e.size)/2;return e.x-r>=-margin&&e.x+r<=W+margin&&e.y-e.size/2>=-margin&&e.y+e.size/2<=H+margin;});
  checks.push({group:'comp',name:'Tudo dentro da área segura',pass:inside});
  const aligned=d.elements.filter(e=>[W/2,W/3,2*W/3,W*.25,W*.75].some(g=>Math.abs(e.x-g)<W*.025)).length>=Math.ceil(d.elements.length*.6);
  checks.push({group:'comp',name:'Alinhado às guias',pass:aligned});
  checks.push({group:'comp',name:'Até '+(brief.maxElements||10)+' elementos',pass:d.elements.length>0&&d.elements.length<=(brief.maxElements||10)});
  // cor: só as cores do briefing (mais branco/preto neutros)
  const colors=[d.bg,...d.elements.map(e=>e.fill)],allowed=[...(brief.colors||[]),'#ffffff','#111111','#000000','#f5f1e8'];
  checks.push({group:'color',name:'Somente a paleta pedida',pass:colors.every(c=>allowed.some(a=>colorNear(a,c)))});
  checks.push({group:'color',name:'Usa as cores da marca',pass:(brief.colors||[]).every(a=>colors.some(c=>colorNear(a,c)))});
  const g=k=>{const l=checks.filter(c=>c.group===k);return l.length?l.filter(c=>c.pass).length/l.length:1;};
  const score=round2(.30*g('brief')+.25*g('legib')+.20*g('comp')+.15*g('color')+.10*(late?0:1));
  return {score,checks};
 }

 // ---------- CityLive: métricas de transmissão (determinísticas pela escolha) ----------
 const METRICS=['audience','retention','trust','hype','fatigue'];
 function streamStart(channel,format,level){
  const reach=10+level*12+Math.round((channel?.followers||0)**.6);
  return {format,round:0,audience:reach,retention:55,trust:55,hype:40,fatigue:0,log:[],sponsor:null,ended:false,reach};
 }
 function streamApply(st,effects,label){
  for(const k of METRICS)if(effects[k])st[k]=clamp(st[k]+effects[k],0,k==='audience'?st.reach*3:100);
  if(effects.sponsor)st.sponsor=effects.sponsor;
  st.fatigue=clamp(st.fatigue+6,0,100);st.round++;st.log.push(label);
  // audiência segue retenção e hype, limitada pelo alcance do canal (sem centenas de milhares do nada)
  st.audience=Math.round(clamp(st.audience*(.92+st.retention/600+st.hype/900),3,st.reach*3));
  return st;
 }
 function streamReport(st,level,{interrupted=false}={}){
  const base=[0,40,70,110,160,210][level],ret=Math.round(st.retention*.9),tr=Math.round(st.trust*.6);
  const sponsor=st.sponsor&&st.sponsor.aligned?st.sponsor.value:0,cost=Math.round(st.fatigue*.15);
  const cap=[0,140,240,360,480,620][level];
  let gross=Math.min(cap,base+ret+tr+sponsor-cost);if(interrupted)gross=Math.round(gross*.3);
  const score=round2(clamp((st.retention*.4+st.trust*.4+st.hype*.2)/100,0,1));
  return {gross:Math.max(0,Math.round(gross)),parts:{base,retention:ret,trust:tr,sponsor,cost},score,followers:Math.max(0,Math.round(st.audience*(st.trust/100)*.25)),interrupted};
 }

 const api={DAY,CONFIG,rng,hash,day,newState,sanitizeState,levelOf,levelName,nextLevel,refreshOffers,activeCount,accept,transition,expire,evaluate,payout,cancel,
  OPS,runRules,testRules,testSequence,testFix,testUI,passRate,codeScore,supportScore,SHAPES,FONTS,RATIOS,PATHS,sanitizeDesign,renderSVG,contrast,designCheck,
  streamStart,streamApply,streamReport,clamp};
 root.CityDeskCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

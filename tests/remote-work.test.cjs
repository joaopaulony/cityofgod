// Trabalho remoto (CityDesk): núcleo de contratos, pagamento único, as quatro mecânicas e a segurança do SVG.
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/city-desk-core.js'),T=require('../js/city-desk-content.js');
const DAY=C.DAY;
const wallet=()=>{let funds=0;const log=[];return {credit:(v,r)=>{funds+=v;log.push(r);return true;},get funds(){return funds;},log};};

test('48 modelos: 12 por profissão, cada um verificável',()=>{
 assert.equal(T.PROGRAMMER.length,12);assert.equal(T.SUPPORT.length,12);assert.equal(T.DESIGNER.length,12);assert.equal(T.STREAM.length,12);
 // todo brief de programação tem solução que passa em todos os testes
 for(const b of T.PROGRAMMER){
  if(b.mech==='sequence')assert.equal(C.passRate(C.testSequence(b.steps,b.constraints,b.steps)),1,b.id);
  if(b.mech==='debug')assert.ok(b.options.some(o=>C.passRate(C.testFix(o.fn,b.cases))===1)&&b.options.some(o=>C.passRate(C.testFix(o.fn,b.cases))<1),b.id);
  if(b.mech==='ui'){const cfg={components:b.spec.required.map(r=>r.component),bind:Object.fromEntries(b.spec.required.map(r=>[r.component,r.bind]))};assert.equal(C.passRate(C.testUI(cfg,b.spec)),1,b.id);}
  if(b.mech==='rules'){
   // procura combinação da paleta que passa em tudo (prova que o problema tem solução)
   const P=b.palette,found=[];
   for(let m=1;m<1<<P.length;m++)for(const combine of ['and','or'])for(const [then,els] of [[b.actions[0],b.actions[1]],[b.actions[1],b.actions[0]]]){
    const rule={when:P.filter((_,i)=>m>>i&1),combine,then,else:els};if(rule.when.length<=4&&C.passRate(C.testRules(rule,b.cases))===1)found.push(rule);}
   assert.ok(found.length,b.id+' sem solução');
  }
 }
 // todo chamado: causa entre as opções, evidências e ação válidas
 for(const t of T.SUPPORT){assert.ok(t.causes.includes(t.cause),t.id);assert.ok(T.ACTIONS[t.action],t.id);for(const e of t.evidence)assert.ok(T.TOOLS[e]&&t.out[e],t.id+' '+e);}
});

test('contrato: aceitar, avaliar, pagar uma única vez (duplo clique e recarga não pagam de novo)',()=>{
 const s=C.newState(),w=wallet(),clock=3*DAY+600;
 const offers=C.refreshOffers(s,'programmer',T.PROGRAMMER,clock,T.CLIENTS);
 assert.ok(offers.length>=3);assert.deepEqual(C.refreshOffers(s,'programmer',T.PROGRAMMER,clock,T.CLIENTS),offers,'mesma semente no mesmo dia');
 const a=C.accept(s,offers[0].id,clock);assert.ok(a.ok);
 assert.equal(C.accept(s,offers[1].id,clock).code,'CAPACITY','nível 1: um trabalho por vez');
 const ct=a.data;assert.equal(C.evaluate(s,ct,.9,clock+60).code,'APPROVED');
 const p1=C.payout(s,ct,clock+60,w.credit);assert.ok(p1.ok);const paid=w.funds;
 assert.ok(paid>0&&paid<ct.gross*1.2);
 assert.equal(C.payout(s,ct,clock+61,w.credit).ok,false,'segundo pagamento recusado');
 // recarga: estado sanitizado mantém o ledger e não paga de novo
 const s2=C.sanitizeState(JSON.parse(JSON.stringify(s)));const ct2=s2.contracts[0];ct2.state='APPROVED';
 assert.equal(C.payout(s2,ct2,clock+62,w.credit).code,'ALREADY_APPLIED');assert.equal(w.funds,paid);
 assert.equal(s.careers.programmer.done,1);
});

test('prazo pelo relógio do jogo, revisão uma vez e recusa sem pagamento',()=>{
 const s=C.newState(),clock=10*DAY;
 const o=C.refreshOffers(s,'support',T.SUPPORT,clock,T.CLIENTS)[0];const ct=C.accept(s,o.id,clock).data;
 assert.equal(C.evaluate(s,ct,.5,clock+10).code,'REVISION');
 assert.equal(C.evaluate(s,ct,.5,clock+20).code,'REJECTED','só uma revisão');
 assert.equal(C.payout(s,ct,clock+30,()=>true).code,'NOT_APPROVED');
 const o2=C.refreshOffers(s,'designer',T.DESIGNER,clock,T.CLIENTS)[0],ct3=C.accept(s,o2.id,clock).data;
 assert.equal(C.expire(s,ct3.dueClock-1).length,0);assert.equal(C.expire(s,ct3.dueClock+1).length,1);assert.equal(ct3.state,'EXPIRED');
});

test('CodeLab: regras sem eval, determinísticas; a solução certa passa e a errada falha',()=>{
 const b=T.PROGRAMMER.find(x=>x.id==='PR02');
 const good={when:[{field:'hora',op:'>=',value:8},{field:'hora',op:'<',value:18},{field:'livre',op:'==',value:true}],combine:'and',then:'agendar',else:'recusar'};
 const bad={when:[{field:'hora',op:'>=',value:8}],combine:'and',then:'agendar',else:'recusar'};
 assert.equal(C.passRate(C.testRules(good,b.cases)),1);assert.ok(C.passRate(C.testRules(bad,b.cases))<1);
 assert.deepEqual(C.testRules(good,b.cases),C.testRules(good,b.cases));
 assert.ok(!/\beval\(|new Function/.test(require('node:fs').readFileSync(__dirname+'/../js/city-desk-core.js','utf8')),'sem eval no motor');
 assert.ok(C.codeScore(C.testRules(good,b.cases),{ranTests:true})>=.9);
});

test('HelpDesk: causa errada não paga; escalar certo é sucesso parcial; sem verificar não fecha',()=>{
 const t=T.SUPPORT[0];
 const right=C.supportScore(t,{cause:t.cause,tools:t.evidence,actions:[t.action],verified:true,report:{prevention:t.prevention},minutes:10});
 assert.ok(right.score>=.9);
 const guess=C.supportScore(t,{cause:'DNS incorreto',tools:[],actions:['fixdns'],verified:true,report:{},minutes:5});assert.ok(guess.score<.4);
 const noverify=C.supportScore(t,{cause:t.cause,tools:t.evidence,actions:[t.action],verified:false,report:{},minutes:10});assert.ok(noverify.score<right.score);
 const harmful=C.supportScore(t,{cause:t.cause,tools:[],actions:['reinstall',t.action],verified:true,report:{},minutes:10});assert.ok(harmful.procedure===0);
 const esc=T.SUPPORT.find(x=>x.action==='escalate');
 assert.ok(C.supportScore(esc,{cause:esc.cause,tools:esc.evidence,actions:['escalate'],verified:true,report:{},minutes:5}).score>=.6);
});

test('Brand Studio: SVG sanitizado, briefing validado por regras objetivas',()=>{
 const evil={ratio:'square',bg:'javascript:alert(1)',elements:[{type:'text',text:'<script>alert(1)</script>"onload=x',fill:'url(http://x)',size:60,x:256,y:256},{type:'shape',shape:'foreignObject',fill:'#fff',x:1,y:1}]};
 const svg=C.renderSVG(evil);
 assert.ok(!/<script|javascript:|\son\w+=|url\(|foreignObject/i.test(svg),svg);
 assert.equal((svg.match(/http/g)||[]).length,1,'só o xmlns padrão');
 assert.equal((svg.match(/"/g)||[]).length%2,0,'aspas de atributo fechadas');
 const b=T.DESIGNER[0];
 const good={ratio:'square',bg:'#e8c39e',elements:[{type:'shape',shape:'cup',size:200,x:256,y:200,fill:'#5b3a29'},{type:'text',text:'Café da Esquina',size:56,x:256,y:400,fill:'#5b3a29',font:'serif'}]};
 const r=C.designCheck(good,b);assert.ok(r.score>=.8,JSON.stringify(r.checks.filter(c=>!c.pass)));
 const poor=C.designCheck({ratio:'landscape',bg:'#ffffff',elements:[{type:'text',text:'Cafe',size:10,x:20,y:20,fill:'#eeeeee'}]},b);assert.ok(poor.score<.5);
 assert.equal(C.sanitizeDesign({elements:Array(40).fill({type:'shape'})}).elements.length,24,'limite de elementos');
});

test('CityLive: decisões mexem nas métricas, sessão interrompida paga menos, teto por nível',()=>{
 let st=C.streamStart({followers:0},'chat',1);
 for(const sit of T.STREAM.slice(0,5))C.streamApply(st,sit.options[0].fx,sit.id);
 const full=C.streamReport(st,1),cut=C.streamReport(st,1,{interrupted:true});
 assert.ok(full.gross>0&&cut.gross<full.gross);assert.ok(full.gross<=140,'teto do nível 1');
 let bad=C.streamStart({followers:0},'chat',1);for(const sit of T.STREAM.slice(0,5))C.streamApply(bad,sit.options[1].fx,sit.id);
 assert.ok(C.streamReport(bad,1).score<full.score,'escolhas ruins rendem menos');
});

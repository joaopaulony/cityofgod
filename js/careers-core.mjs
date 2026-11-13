// careers-core.mjs — regras das profissões (sem engine, testáveis no Node): cursos da Universidade City of God,
// agenda de aulas, notas, formatura, negócio próprio (nível, XP, preço, reputação, procura) e a pontuação dos minigames.
//
// Duração: cada ano de curso vale meio mês de jogo (15 aulas, uma por dia). Curso de 2 anos = 1 mês; Medicina (6 anos) = 3.
// Aula: todo dia, no período escolhido na matrícula. Só conta a aula assistida na sala do curso, no campus.
export const DAY=1440;   // minutos de jogo por dia
export const LESSONS_PER_YEAR=15;
export const PERIODS=Object.freeze({
 manha:{label:'Manhã',start:8*60,end:12*60},
 tarde:{label:'Tarde',start:13*60+30,end:17*60+30},
 noite:{label:'Noite',start:19*60,end:22*60+30},
});
// tolerância de atraso p/ entrar na aula e o mínimo assistido p/ a aula contar (minutos de jogo)
export const LATE_LIMIT=60,MIN_ATTEND=150;

export const PROFESSIONS=Object.freeze({
 medic:{id:'medic',title:'Medicina',pro:'Médico(a)',icon:'🩺',years:6,tuition:2200,enroll:1500,room:'lecture',
  business:{kind:'medclinic',name:'Consultório Médico',price:210000,service:'Consulta médica',base:220,min:120,max:1400},
  topics:['Anatomia humana','Fisiologia','Semiologia: como examinar o paciente','Farmacologia','Clínica médica','Pronto-socorro e trauma','Pediatria','Ética médica']},
 vet:{id:'vet',title:'Medicina Veterinária',pro:'Veterinário(a)',icon:'🐾',years:4,tuition:1500,enroll:1000,room:'lecture',
  business:{kind:'vetclinic',name:'Clínica Veterinária',price:150000,service:'Atendimento veterinário',base:160,min:80,max:900},
  topics:['Anatomia de cães e gatos','Vacinação e vermifugação','Clínica de pequenos animais','Cirurgia veterinária','Nutrição animal','Doenças infecciosas','Comportamento animal','Emergência veterinária']},
 lawyer:{id:'lawyer',title:'Direito',pro:'Advogado(a)',icon:'⚖️',years:5,tuition:1300,enroll:900,room:'classroom',
  business:{kind:'lawoffice',name:'Escritório de Advocacia',price:95000,service:'Consulta jurídica',base:260,min:150,max:1600},
  topics:['Direito constitucional','Direito civil: contratos','Direito do consumidor','Direito do trabalho','Direito penal','Processo civil','Prática de audiência','Ética da advocacia']},
 mechanic:{id:'mechanic',title:'Mecânica Automotiva',pro:'Mecânico(a)',icon:'🔧',years:2,tuition:650,enroll:350,room:'lab',
  business:{kind:'autoshop',name:'Oficina Mecânica',price:120000,service:'Conserto de veículo',base:240,min:120,max:1200},
  topics:['Motor a combustão','Freios e suspensão','Injeção eletrônica','Sistema elétrico','Câmbio e embreagem','Diagnóstico com scanner']},
 chef:{id:'chef',title:'Gastronomia',pro:'Chef de cozinha',icon:'👨‍🍳',years:2,tuition:700,enroll:400,room:'lab',
  business:{kind:'restaurant',name:'Restaurante',price:140000,service:'Mesa servida',base:90,min:45,max:480},
  topics:['Higiene e segurança dos alimentos','Cortes e técnicas de faca','Molhos-base','Cozinha brasileira','Confeitaria','Gestão de cozinha']},
 // serviços públicos: sem negócio próprio — formado, entra na carreira (delegacia / SAMU) pelo app Carreira
 police:{id:'police',title:'Academia de Polícia',pro:'Policial',icon:'👮',years:1,tuition:400,enroll:250,room:'classroom',career:'svc:police',
  business:{kind:'security',name:'Empresa de Segurança Privada',price:160000,service:'Contrato de segurança',base:240,min:120,max:1300},
  topics:['Legislação e direitos humanos','Abordagem e uso progressivo da força','Tiro defensivo e segurança','Direção de viatura','Primeiros socorros','Boletim de ocorrência']},
 paramedic:{id:'paramedic',title:'Técnico em Emergência (SAMU)',pro:'Socorrista',icon:'🚑',years:2,tuition:600,enroll:350,room:'lecture',career:'svc:paramedic',
  business:{kind:'ambulancebase',name:'Base de Ambulâncias Particular',price:190000,service:'Atendimento e remoção particular',base:260,min:130,max:1400},
  topics:['Atendimento pré-hospitalar (XABCDE)','Reanimação cardiopulmonar','Imobilização e transporte','Trauma e hemorragias','Emergências clínicas: AVC e infarto','Direção de ambulância']},
 barber:{id:'barber',title:'Estética e Barbearia',pro:'Barbeiro(a)',icon:'💈',years:2,tuition:500,enroll:300,room:'classroom',
  business:{kind:'barbershop',name:'Barbearia',price:48000,service:'Corte e barba',base:55,min:30,max:320},
  topics:['Anatomia do cabelo','Cortes clássicos','Degradê e navalhado','Barba e toalha quente','Atendimento ao cliente','Gestão do salão']},
});
export const lessonsFor=id=>PROFESSIONS[id].years*LESSONS_PER_YEAR;

// ---------- curso ----------
// course: {id, period, startDay, attended:[dia...], grades:[0..10], paidUntil (aula paga até), log:[]}
export function enrollCourse(state,id,period,day){
 const p=PROFESSIONS[id];if(!p)return {ok:false,text:'Curso inexistente.'};
 if(!PERIODS[period])return {ok:false,text:'Escolha um período.'};
 if(state.course)return {ok:false,text:'Você já está matriculado em '+PROFESSIONS[state.course.id].title+'. Conclua ou tranque antes.'};
 if(state.degrees?.[id])return {ok:false,text:'Você já é formado em '+p.title+'.'};
 state.course={id,period,startDay:day,attended:[],grades:[],paidLessons:LESSONS_PER_YEAR};
 return {ok:true,cost:p.enroll+p.tuition,text:'Matrícula em '+p.title+' ('+PERIODS[period].label+'). Primeira aula: '+(dayTime(day,PERIODS[period].start))+'.'};
}
export const dayTime=(day,min)=>'dia '+(day+1)+', '+String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
// a aula de hoje: aberta entre o início e o início + tolerância; termina no fim do período
export function classWindow(course,clock){
 const P=PERIODS[course.period],day=Math.floor(clock/DAY),m=clock-day*DAY;
 return {day,start:day*DAY+P.start,end:day*DAY+P.end,open:m>=P.start-20&&m<=P.start+LATE_LIMIT,running:m>=P.start&&m<P.end,before:m<P.start-20,after:m>P.start+LATE_LIMIT,attendedToday:course.attended.includes(day)};
}
// próxima aula (minuto absoluto) — hoje se ainda dá p/ entrar, senão amanhã
export function nextClass(course,clock){
 const w=classWindow(course,clock);
 if(!w.attendedToday&&!w.after)return w.start;
 return w.start+DAY;
}
export function needsPayment(course){return course.attended.length>=course.paidLessons;}
export function payTuition(course){course.paidLessons+=LESSONS_PER_YEAR;return PROFESSIONS[course.id].tuition;}
// fim da aula: minutos assistidos e acertos nas perguntas → nota 0..10; conta a presença se assistiu o mínimo
export function finishLesson(state,clock,{minutes,correct,asked}){
 const c=state.course;if(!c)return {ok:false,text:'Sem curso.'};
 const day=Math.floor(clock/DAY);
 if(c.attended.includes(day))return {ok:false,text:'A aula de hoje já foi registrada.'};
 if(minutes<MIN_ATTEND)return {ok:false,text:'Você saiu cedo: a presença não foi registrada (mínimo '+Math.round(MIN_ATTEND/60*10)/10+' h de aula).'};
 const quiz=asked?correct/asked:1,att=Math.min(1,minutes/(PERIODS[c.period].end-PERIODS[c.period].start));
 const grade=Math.round((6+3*quiz+1*att)*10)/10;
 c.attended.push(day);c.grades.push(grade);
 const total=lessonsFor(c.id),done=c.attended.length;
 if(done>=total)return {ok:true,grade,graduated:graduate(state,day),text:'Última aula! Você se formou em '+PROFESSIONS[c.id].title+'.'};
 return {ok:true,grade,done,total,text:'Presença registrada · nota '+grade.toFixed(1)+' · '+done+'/'+total+' aulas.'};
}
export function graduate(state,day){
 const c=state.course,gpa=c.grades.reduce((a,b)=>a+b,0)/Math.max(1,c.grades.length);
 (state.degrees||(state.degrees={}))[c.id]={day,gpa:Math.round(gpa*10)/10};
 state.course=null;
 return {id:c.id,gpa};
}
export function dropCourse(state){const c=state.course;if(!c)return {ok:false,text:'Sem curso.'};state.course=null;return {ok:true,text:'Matrícula trancada. O que você já cursou não conta numa nova matrícula.'};}

// ---------- negócio próprio ----------
// biz: {id, owned, level, xp, price, open, served, revenue, rep (0..100), auto}
export const levelXP=level=>Math.round(120*Math.pow(level,1.45));   // XP p/ passar do nível
export const MAX_LEVEL=10;
// preço justo e teto de cobrança sobem com o nível; a nota da faculdade dá um empurrão inicial na reputação
export function priceRange(id,level){
 const b=PROFESSIONS[id].business,t=(level-1)/(MAX_LEVEL-1);
 const fair=Math.round(b.base*(1+1.6*t)),cap=Math.round(b.min+(b.max-b.min)*Math.min(1,.18+.82*t));
 return {min:b.min,max:Math.max(b.min,cap),fair};
}
export function newBusiness(state,id){
 const gpa=state.degrees?.[id]?.gpa||7;
 return {id,owned:true,level:1,xp:0,price:priceRange(id,1).fair,open:false,served:0,revenue:0,rep:Math.round(30+(gpa-6)*8),auto:false};
}
export function setPrice(biz,price){const r=priceRange(biz.id,biz.level);biz.price=Math.max(r.min,Math.min(r.max,Math.round(price)));return biz.price;}
// intervalo médio entre clientes (segundos reais): mais rápido com boa reputação e preço justo
export function clientInterval(biz){
 const r=priceRange(biz.id,biz.level),ratio=biz.price/r.fair;
 const pricePenalty=ratio<=1?1-.25*(1-ratio):1+1.9*(ratio-1)*(ratio-1)+.6*(ratio-1);
 return Math.max(12,Math.min(150,40*pricePenalty*(1.35-biz.rep/100)));
}
// pagamento de um atendimento: minigame paga cheio × qualidade (até +35%); automático paga 55% e conta como nota .55
export function servicePay(biz,{score,auto}){
 const s=Math.max(0,Math.min(1,score));
 const mult=auto?.55:(.6+.75*s);   // 0,6 (ruim) a 1,35 (perfeito)
 return Math.round(biz.price*mult);
}
export function serviceXP(biz,{score,auto}){return Math.round((auto?6:10+14*Math.max(0,Math.min(1,score)))*(1+.08*(biz.level-1)));}
export function registerService(biz,{score,auto}){
 const pay=servicePay(biz,{score,auto}),xp=serviceXP(biz,{score,auto});
 biz.served++;biz.revenue+=pay;biz.xp+=xp;
 const r=priceRange(biz.id,biz.level),fairness=Math.max(-1,Math.min(1,(r.fair-biz.price)/r.fair));
 biz.rep=Math.max(0,Math.min(100,biz.rep+(auto?.2:(score-.55)*3.2)+fairness*.8));
 let up=false;
 while(biz.level<MAX_LEVEL&&biz.xp>=levelXP(biz.level)){biz.xp-=levelXP(biz.level);biz.level++;up=true;}
 if(biz.level>=MAX_LEVEL)biz.xp=Math.min(biz.xp,levelXP(MAX_LEVEL));
 return {pay,xp,levelUp:up,level:biz.level};
}

// ---------- minigames ----------
// passos: choice (escolher a resposta certa), timing (parar a agulha na faixa verde), sequence (apertar as teclas na ordem)
export function scoreChoice(correct){return correct?1:0;}
// agulha em [0,1], faixa verde [a,b]: 1 no centro, 0,7 na borda, cai fora dela
export function scoreTiming(pos,a,b){
 const c=(a+b)/2,h=(b-a)/2,d=Math.abs(pos-c);
 if(d<=h)return 1-.3*(d/h);
 return Math.max(0,.7-(d-h)*3.5);
}
export function scoreSequence(hits,total,seconds,limit){
 if(!total)return 0;
 const acc=hits/total,speed=Math.max(0,Math.min(1,1-seconds/limit));
 return Math.max(0,Math.min(1,acc*(.8+.2*speed)));
}
export const average=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0;

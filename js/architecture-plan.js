// Shared architectural source: rooms -> footprint, walls, openings and furnishing.
// No Three/DOM dependency: the collision and rendering layers consume this plan.
(function(root){
 'use strict';
 const round=n=>Math.round(n*1000)/1000;
 const rect=(id,use,x0,y0,x1,y1)=>({id,use,x0:round(x0),y0:round(y0),x1:round(x1),y1:round(y1)});
 const inside=(r,x,y,pad=0)=>x>=r.x0+pad&&x<=r.x1-pad&&y>=r.y0+pad&&y<=r.y1-pad;
 const residential=k=>['house','bungalow','poor','mansion','rural','condo','projects'].includes(k);
 function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 // Hospital City of God: alas esquerda/direita do corredor central, de trás (y=0) p/ a frente (fração da profundidade)
 const HOSPITAL_FLOORS=[
  {L:[['trauma',.30],['clinic',.49],['pharmacy',.65],['reception',1]],R:[['recovery',.32],['bathroom',.46],['xray',.65],['cafe',1]]},
  {L:[['ward',.34],['nurses',.52],['lab',.69],['ward',1]],R:[['surgery',.36],['bathroom',.50],['office',.67],['lounge',1]]},
  {L:[['icu',.36],['nurses',.53],['ward',1]],R:[['maternity',.34],['bathroom',.48],['office',.66],['ward',1]]}];
 // cômodos cheios de verdade: fileiras de leitos com monitor, soro e cortina; setores com todos os aparelhos
 function furnishHospital(r,put,level,{W,D,cx,cy}){
  const E={exact:true},left=r.x1<=level.entry[0]+.01,outer=left?r.x0:r.x1,os=left?1:-1,inner=left?r.x1:r.x0,is=-os;
  const wallX=off=>outer+os*off,doorX=off=>inner+is*off;
  // leitos encostados numa parede (dir=+1: parede de trás y0; -1: parede da frente y1)
  const beds=(dir,step,{kind='hospitalbed',w=1.15,d=2.05,monitor=true,vent=false,crib=false}={})=>{
   const y=dir>0?r.y0+.3+d/2:r.y1-.3-d/2,hy=y-dir*(d/2-.25);
   for(let x=r.x0+1.6;x<=r.x1-1.5;x+=step){
    if(!put(kind,w,d,kind==='stretcher'?.95:.9,[x,y],{...E,top:'#e1eee9'}))continue;
    if(monitor)put('monitor',.5,.45,1.5,[x+w/2+.37,hy],E);
    put('ivstand',.45,.45,1.95,[x-w/2-.35,hy],E);
    if(vent)put('ventilator',.5,.5,1.45,[x-w/2-.37,hy+dir*.72],E);
    if(crib)put('crib',.6,.9,1,[x+w/2+.42,y+dir*.55],E);
    if(x+step<=r.x1-1.5)put('curtain',.08,2.1,2.05,[x+step/2,y],{...E,overlay:true});
   }
  };
  const corners=(kind,w,d,h)=>{for(const [x,y] of [[r.x0+.25+w/2,r.y0+.25+d/2],[r.x1-.25-w/2,r.y0+.25+d/2],[r.x0+.25+w/2,r.y1-.25-d/2],[r.x1-.25-w/2,r.y1-.25-d/2]])put(kind,w,d,h,[x,y],E);};
  const sideWall=(kind,w,d,h,ys)=>{for(const y of ys)put(kind,d,w,h,[wallX(.25+d/2),y],E);};   // encostado na parede de fora (de lado)
  const aisle=()=>{for(let x=r.x0+2.4;x<r.x1-2;x+=4.4){put('chair',.5,.55,.85,[x,cy-.45],E);put('chair',.5,.55,.85,[x+.62,cy-.45],E);}
   put('crashcart',.75,.55,1.05,[cx-1,cy+.75],E);put('wheelchair',.65,.95,.95,[cx+1.6,cy+.75],E);};
  switch(r.use){
   case'ward':case'recovery':beds(1,2.7);if(D>=7.4)beds(-1,2.7);aisle();sideWall('medcabinet',1,.45,1.95,[cy-1.2]);sideWall('sink',.8,.58,.86,[cy+.6]);
    if(r.use==='recovery'){sideWall('tvwall',1.3,.12,2,[cy+2.2]);corners('bigplant',.7,.7,1.6);}break;
   case'icu':beds(1,3.3,{vent:true});if(D>=7.4)beds(-1,3.3,{vent:true});put('nursedesk',3,1.8,1.1,[cx,cy],E);sideWall('medcabinet',1,.45,1.95,[cy-1.6,cy+1.6]);put('crashcart',.75,.55,1.05,[cx+2.6,cy],E);break;
   case'maternity':beds(1,3,{monitor:false,crib:true});if(D>=7.4)beds(-1,3,{monitor:false,crib:true});aisle();sideWall('medcabinet',1,.45,1.95,[cy]);corners('bigplant',.7,.7,1.6);break;
   case'trauma':beds(1,3.2,{kind:'stretcher',w:.7,d:2});if(D>=7.4)beds(-1,3.2);
    put('nursedesk',3,1.8,1.1,[cx,cy],E);put('crashcart',.75,.55,1.05,[cx-2.6,cy],E);put('crashcart',.75,.55,1.05,[cx+2.6,cy],E);
    sideWall('medcabinet',1,.45,1.95,[cy-1.4,cy-.3]);sideWall('sink',.8,.58,.86,[cy+1]);put('wheelchair',.65,.95,.95,[doorX(1.2),cy+1.8],E);put('stretcher',.7,2,.95,[doorX(1.1),cy-2.2],E);break;
   case'clinic':for(const f of [.26,.72]){const sx=r.x0+W*f;
     put('exambed',.75,1.9,.95,[sx,r.y0+1.3],E);put('desk',1.1,.62,.74,[sx+.2,r.y1-.55],E);put('chair',.5,.55,.85,[sx-.45,r.y1-1.45],E);put('chair',.5,.55,.85,[sx+.25,r.y1-1.45],E);
     put('sink',.8,.58,.86,[sx+1.55,r.y0+.55],E);put('scale',.45,.45,1.7,[sx-1.3,r.y0+.45],E);put('medcabinet',1,.45,1.95,[sx+1.9,r.y1-.35],E);put('monitor',.5,.45,1.5,[sx+.95,r.y0+.6],E);}
    put('curtain',.08,2.1,2.05,[r.x0+W*.49,r.y0+1.3],{...E,overlay:true});corners('plant',.44,.44,.74);break;
   case'pharmacy':for(let x=r.x0+1.5;x<r.x1-1.3;x+=2.35)put('medshelf',2.2,.45,1.95,[x,r.y0+.5],E);
    put('counter',2.8,.6,.9,[cx-1.6,cy+.35],{...E,top:'#e8ece9'});put('counter',2.8,.6,.9,[cx+1.6,cy+.35],{...E,top:'#e8ece9'});
    for(let x=r.x0+1;x<r.x1-.8;x+=1.15)put('medcabinet',1,.45,1.95,[x,r.y1-.5],E);put('waitingrow',2.3,.68,.85,[doorX(2),cy+1.4],E);break;
   case'reception':put('receptiondesk',3.4,1.7,1.15,[cx,r.y1-1.4],E);put('infoboard',1.6,.08,1.5,[cx,r.y0+.3],{...E,overlay:true});
    for(let y=r.y0+1.7;y<r.y1-3.3;y+=1.85)for(let x=r.x0+2.2;x<r.x1-2;x+=2.9)put('waitingrow',2.3,.68,.85,[x,y],E);
    sideWall('vending',.95,.8,1.9,[r.y0+1.1,r.y0+2.2]);sideWall('watercooler',.35,.35,1.25,[r.y0+3.1]);sideWall('tvwall',1.3,.12,2,[cy+.6]);
    corners('bigplant',.7,.7,1.6);put('wheelchair',.65,.95,.95,[doorX(.9),r.y0+1],E);put('wheelchair',.65,.95,.95,[doorX(1.7),r.y0+1],E);break;
   case'xray':put('xray',1.2,2.4,2.2,[cx-1.5,cy],E);put('leadscreen',1.1,.12,1.9,[cx+.6,cy+1.4],E);put('desk',1.1,.62,.74,[cx+1.9,r.y0+.55],E);
    for(let x=r.x0+.9;x<r.x0+3.4;x+=1.3)put('locker',1.2,.5,1.95,[x,r.y1-.45],E);put('medcabinet',1,.45,1.95,[cx+3.6,r.y1-.35],E);
    put('exambed',.75,1.9,.95,[r.x0+W*.8,cy],E);put('monitor',.5,.45,1.5,[r.x0+W*.8+.85,cy-.7],E);put('chair',.5,.55,.85,[r.x0+W*.8-.8,cy+.3],E);corners('plant',.44,.44,.74);break;
   case'cafe':put('coffeestation',1.4,.6,1.25,[cx-1.4,r.y0+.45],E);put('counter',2.8,.6,.9,[cx+1.3,r.y0+.45],{...E,top:'#e8ece9'});sideWall('vending',.95,.8,1.9,[r.y0+1.2,r.y0+2.3]);
    for(let y=r.y0+2.6;y<r.y1-1.2;y+=2.7)for(let x=r.x0+1.8;x<r.x1-1.5;x+=2.7)put('cafetable',1.5,1.5,.95,[x,y],E);corners('bigplant',.7,.7,1.6);break;
   case'surgery':for(const f of [.27,.73]){const sx=r.x0+W*f;
     put('ortable',1.3,2.1,1,[sx,cy],E);put('surglamp',1.9,.65,2.7,[sx+.4,cy-.2],{...E,overlay:true});put('anesthesia',1.05,.65,1.55,[sx,cy-1.75],E);
     put('mayo',.6,.45,1,[sx+1.1,cy+.8],E);put('monitor',.5,.45,1.5,[sx-1.1,cy-1.3],E);put('ivstand',.45,.45,1.95,[sx-1,cy+.1],E);
     put('medcabinet',1,.45,1.95,[sx-.6,r.y0+.35],E);put('medcabinet',1,.45,1.95,[sx+.6,r.y0+.35],E);put('sinkrow',2.4,.6,1.95,[sx,r.y1-.4],E);put('crashcart',.75,.55,1.05,[sx+1.9,cy-1.3],E);}
    put('curtain',.08,2.1,2.05,[r.x0+W*.5,cy-1.2],{...E,overlay:true});put('curtain',.08,2.1,2.05,[r.x0+W*.5,cy+1.2],{...E,overlay:true});break;
   case'lab':for(let x=r.x0+1.5;x<r.x1-1.4;x+=2.6)put('labbench',2.4,.75,1,[x,r.y0+.5],E);
    put('labbench',2.4,.75,1,[cx-1.4,cy+.4],E);put('labbench',2.4,.75,1,[cx+1.4,cy+.4],E);
    sideWall('labfridge',.75,.7,1.95,[cy-.9,cy+.1]);for(let x=r.x0+1.4;x<r.x1-1.3;x+=2.6)put('medshelf',2.2,.45,1.95,[x,r.y1-.35],E);
    put('chair',.5,.55,.85,[cx-1.4,cy+1.2],E);put('chair',.5,.55,.85,[cx+1.4,cy+1.2],E);break;
   case'nurses':put('nursedesk',3,1.8,1.1,[cx,cy],E);for(let x=r.x0+.9;x<r.x0+5;x+=1.3)put('locker',1.2,.5,1.95,[x,r.y0+.4],E);
    for(let x=r.x1-1;x>r.x1-4.5;x-=1.15)put('medcabinet',1,.45,1.95,[x,r.y1-.35],E);put('crashcart',.75,.55,1.05,[cx+2.6,cy],E);
    put('wheelchair',.65,.95,.95,[cx-2.6,cy],E);sideWall('stretcher',.7,2,.95,[cy]);put('coffeestation',1.4,.6,1.25,[cx+1.5,r.y0+.45],E);break;
   case'office':for(let x=r.x0+1.6;x<r.x1-1.2;x+=3.3)put('desk',1.1,.62,.74,[x,r.y0+.55],{...E,top:'#d9dcd6'});
    put('shelf',2.5,.45,1.9,[cx-1.4,r.y1-.35],E);put('shelf',2.5,.45,1.9,[cx+1.4,r.y1-.35],E);put('sofa',2.1,.85,.56,[cx,cy+.3],{...E,top:'#5f8d8a'});
    put('infoboard',1.6,.08,1.5,[cx+4,r.y1-.15],{...E,overlay:true});corners('bigplant',.7,.7,1.6);break;
   case'lounge':put('sofa',2.1,.85,.56,[cx-1.4,cy+1],{...E,top:'#4f7f8a'});put('sofa',2.1,.85,.56,[cx+1.4,cy+1],{...E,top:'#4f7f8a'});put('tv',1.1,.45,.55,[cx,r.y1-.4],E);
    put('coffeestation',1.4,.6,1.25,[cx-1.4,r.y0+.45],E);for(let x=cx+.5;x<cx+5;x+=1.3)put('locker',1.2,.5,1.95,[x,r.y0+.4],E);
    put('cafetable',1.5,1.5,.95,[r.x0+2.4,cy-1.2],E);put('cafetable',1.5,1.5,.95,[r.x1-2.4,cy-1.2],E);sideWall('vending',.95,.8,1.9,[cy+2.3]);corners('bigplant',.7,.7,1.6);break;
   case'bathroom':{const a=left?r.x1-1.2:r.x0+1.2,b=left?r.x0+5.2:r.x1-5.2,step=left?-1.2:1.2;   // boxes a partir do corredor
    for(let x=a;left?x>b:x<b;x+=step)put('toiletstall',1.1,1.95,2.05,[x,r.y0+1.1],E);
    put('toilet',.45,.7,.45,[wallX(.6),r.y0+.6],E);put('shower',.9,.9,1.9,[wallX(.65),r.y1-.65],E);put('shower',.9,.9,1.9,[wallX(1.75),r.y1-.65],E);
    put('sinkrow',2.4,.6,1.95,[cx-1.2,r.y1-.4],E);put('sinkrow',2.4,.6,1.95,[cx+1.4,r.y1-.4],E);put('sink',.8,.58,.86,[wallX(.65),cy],E);put('plant',.44,.44,.74,[doorX(.5),r.y1-.5],E);break;}
   case'circulation':{const sx=(r.x0+r.x1)/2-.45,sy=Math.max(...level.rooms.map(q=>q.y1))*.45;   // escada: livre
    for(let y=r.y0+1.6;y<r.y1-1.4;y+=3.6){if(Math.abs(y-sy)<2.4)continue;put('hbench',.5,1.8,.85,[r.x0+.5,y],E);put('bigplant',.6,.6,1.6,[r.x1-.55,y],E);}
    if(level.kind==='hospital')put('wheelchair',.65,.95,.95,[r.x0+.6,r.y1-2.2],E);else put('flagstand',.5,.5,2.3,[r.x1-.5,r.y1-1.4],E);break;}
  }
 }
 // Delegacia Central: térreo com carceragem, interrogatório, evidências, saguão, sala dos investigadores, arquivo e
 // central de rádio; em cima briefing, arsenal, vestiário, escritórios, sala do delegado e copa
 // Universidade City of God (campus em civic.js): prédio central de aulas e o prédio da biblioteca com restaurante
 const UNIVERSITY_FLOORS=[
  {L:[['lecture',.42],['lab',.70],['reception',1]],R:[['classroom',.36],['bathroom',.50],['office',.68],['lounge',1]]},
  {L:[['classroom',.36],['lab',.68],['classroom',1]],R:[['classroom',.36],['bathroom',.50],['study',.72],['office',1]]},
  {L:[['lecture',.50],['meeting',.72],['office',1]],R:[['classroom',.40],['bathroom',.54],['study',1]]}];
 const CAMPUSLIB_FLOORS=[
  {L:[['library',.62],['reception',1]],R:[['cafeteria',.66],['bathroom',.80],['lounge',1]]},
  {L:[['library',.55],['study',1]],R:[['study',.40],['bathroom',.56],['library',1]]}];
 // salas de aula, auditório, laboratórios, biblioteca, restaurante e convivência, cheios de verdade
 function furnishUniversity(r,put,level,{W,D,cx,cy}){
  const E={exact:true},left=r.x1<=level.entry[0]+.01,outer=left?r.x0:r.x1,os=left?1:-1,inner=left?r.x1:r.x0,is=-os;
  const wallX=off=>outer+os*off,doorX=off=>inner+is*off;
  const plant=(x,y)=>put('bigplant',.7,.7,1.6,[x,y],E);
  switch(r.use){
   case'lecture':{   // auditório: telão e púlpito no fundo, fileiras de cadeiras com corredor central viradas p/ ele
    put('screen',Math.min(4,W-2),.12,1.6,[cx,r.y0+.25],{...E,overlay:true});put('lectern',.7,.6,1.25,[cx+Math.min(2.4,W/2-1),r.y0+1.2],E);
    for(let y=r.y0+2.6;y<r.y1-.9;y+=1.15)for(let x=r.x0+.75;x<r.x1-.5;x+=.72){if(Math.abs(x-cx)<.8||Math.abs(x-doorX(.6))<1.1&&Math.abs(y-cy)<1.4)continue;put('chair',.5,.55,.85,[x,y],{...E,turn:Math.PI,top:'#3d5a80'});}
    plant(r.x0+.5,r.y0+.5);plant(r.x1-.5,r.y0+.5);break;}
   case'lab':{   // laboratório de informática: bancadas com computador em fileiras, lousa
    put('infoboard',Math.min(3,W-2),.08,1.5,[cx,r.y0+.15],{...E,overlay:true});
    // corredor junto à parede da porta: as fileiras de bancadas se alcançam por ele
    for(let y=r.y0+1.9;y<r.y1-1.2;y+=2.1)for(let x=r.x0+1.1;x<r.x1-.9;x+=1.8){if(Math.abs(x-inner)<2)continue;put('policedesk',1.5,1.3,1.25,[x,y],{...E,turn:0});}   // cadeira do lado de trás: o aluno olha o monitor e a lousa
    break;}
   case'classroom':{   // sala de aula: lousa, mesa do professor, carteiras com cadeira
    put('infoboard',Math.min(3.4,W-2),.08,1.5,[cx,r.y0+.15],{...E,overlay:true});put('desk',1.3,.65,.75,[cx-Math.min(2,W/3),r.y0+1.1],E);
    // colunas de carteiras com corredores de ~0,7 m entre elas e um corredor largo junto à parede da porta
    for(let y=r.y0+2.4;y<r.y1-1;y+=1.75)for(let x=r.x0+.9;x<r.x1-.7;x+=1.8){if(Math.abs(x-inner)<1.8)continue;put('studentdesk',1.1,.6,.75,[x,y],{...E,turn:Math.PI});put('chair',.45,.5,.8,[x,y+.7],{...E,turn:Math.PI,top:'#6d8aa0'});}
    break;}
   case'library':{   // estantes em fileiras junto à parede externa e mesas de leitura perto do corredor
    for(let y=r.y0+1;y<r.y1-1.4;y+=2.3)for(const off of [1.15,3.35])put('qf_shelf_large',1.69,.38,2.22,[wallX(off),y],E);
    for(let y=r.y0+1.6;y<r.y1-1.2;y+=2.6){const x=doorX(1.9);put('table',1.6,.9,.75,[x,y],E);for(const dx of [-.45,.45])for(const s of [-1,1])put('chair',.45,.45,.85,[x+dx,y+s*.75],{...E,turn:s>0?Math.PI:0,top:'#8a6a4a'});put('qf_light_desk',.25,.45,.57,[x+.6,y],{...E,overlay:true});}
    plant(r.x0+.5,r.y1-.5);plant(r.x1-.5,r.y1-.5);break;}
   case'study':{   // estudo: mesas individuais com cadeira junto à janela, estante e sofá
    for(let y=r.y0+.7;y<r.y1-1.4;y+=1.5){put('desk',1.2,.6,.75,[wallX(.9),y],E);put('chair',.45,.45,.85,[wallX(1.45),y],{...E,turn:left?-Math.PI/2:Math.PI/2});}
    put('qf_bookshelf',1.16,.38,2.22,[doorX(1.2),r.y0+.3],E);put('qf_couch_medium2',Math.min(2.26,W-1),1,.98,[cx,r.y1-.7],E);plant(doorX(.5),r.y1-.5);break;}
   case'cafeteria':{   // restaurante universitário: balcão, café, geladeira e mesas redondas com cadeiras
    put('counter',Math.min(4,W-3),.7,1.05,[cx,r.y0+.55],E);put('coffeestation',1.4,.6,1.25,[r.x0+.95,r.y0+.45],E);put('qf_kitchen_fridge',.65,.65,1.65,[r.x1-.6,r.y0+.5],E);
    for(let y=r.y0+2.6;y<r.y1-1.2;y+=2.4)for(let x=r.x0+1.5;x<r.x1-1.2;x+=2.5){put('cafetable',1.2,1.2,.95,[x,y],E);for(const [dx,t] of [[-.92,Math.PI/2],[.92,-Math.PI/2]])put('qf_chair_3',.38,.42,.85,[x+dx,y],{...E,turn:t});}
    put('vending',.9,.8,1.9,[doorX(.6),r.y1-.6],E);break;}
   case'lounge':{   // convivência: sofás frente a frente, mesa, plantas, luminária e máquina de lanche
    put('qf_couch_large1',Math.min(2.74,W-1),1,1.05,[cx,r.y0+.75],{...E,turn:0});put('qf_couch_medium1',Math.min(2.34,W-1),1.1,.96,[cx,r.y1-.8],{...E,turn:Math.PI});
    put('qf_table_roundsmall',1.26,1.26,.75,[cx,cy],E);put('vending',.9,.8,1.9,[wallX(.6),cy],E);plant(r.x0+.5,cy+1.6);plant(r.x1-.5,cy-1.6);put('qf_light_floor1',.28,.3,1.6,[doorX(.4),cy+1.4],E);break;}
   case'reception':{   // secretaria: balcão, banco de espera, mural e plantas
    put('receptiondesk',Math.min(3,W-2),.9,1.1,[cx,cy-.6],E);put('infoboard',1.6,.08,1.5,[cx,r.y0+.15],{...E,overlay:true});
    put('hbench',1.8,.5,.85,[cx,r.y1-.6],E);plant(r.x0+.5,r.y1-.5);plant(r.x1-.5,r.y1-.5);break;}
   case'office':{   // sala dos professores / coordenação
    for(let x=r.x0+1;x<r.x1-.8;x+=2){put('desk',1.3,.65,.75,[x,r.y0+.65],E);put('chair',.45,.45,.85,[x,r.y0+1.35],{...E,turn:Math.PI});}
    put('qf_bookshelf',1.16,.38,2.22,[r.x0+.85,r.y1-.35],E);put('qf_drawer_5',1.4,.58,.67,[r.x1-1,r.y1-.45],E);plant(cx,r.y1-.5);break;}
   case'meeting':{put('table',Math.min(4,W-2),1.4,.75,[cx,cy],E);for(let x=cx-1.5;x<=cx+1.5;x+=.9)for(const s of [-1,1])put('chair',.5,.5,.85,[x,cy+s*1.05],{...E,turn:s>0?Math.PI:0});put('screen',2,.12,1.2,[cx,r.y0+.25],{...E,overlay:true});break;}
   case'bathroom':{put('toiletstall',.95,1.4,2,[wallX(.75),r.y0+1],E);if(D>4.2)put('toiletstall',.95,1.4,2,[wallX(.75),r.y0+2.5],E);put('sinkrow',Math.min(2.4,W-1.4),.55,.9,[doorX(1.4),r.y1-.4],E);break;}
  }
 }
 // Estabelecimentos das profissões (careers.mjs): um pavimento, corredor central e salas de verdade de cada ofício
 const BUSINESS_FLOORS={
  vetclinic:[{L:[['vetsurgery',.42],['vetconsult',.72],['vetwait',1]],R:[['kennel',.38],['bathroom',.56],['pharmacy',.72],['vetconsult',1]]}],
  medclinic:[{L:[['medlab',.38],['medconsult',.70],['medwait',1]],R:[['medexam',.38],['bathroom',.56],['medconsult',1]]}],
  lawoffice:[{L:[['archive',.32],['lawoffice',.68],['lawwait',1]],R:[['lawmeeting',.40],['bathroom',.58],['lawoffice',1]]}],
  autoshop:[{L:[['garage',1]],R:[['parts',.36],['bathroom',.54],['shopoffice',.74],['shopwait',1]]}],
  restaurant:[{L:[['restkitchen',.45],['restdining',1]],R:[['pantry',.30],['bathroom',.48],['restdining',1]]}],
  barbershop:[{L:[['barberhall',1]],R:[['pantry',.30],['bathroom',.50],['barberwait',1]]}],
  // imóveis das carreiras públicas (liberam por cargo na escada de carreira)
  security:[{L:[['monitoring',.40],['secoffice',.72],['secwait',1]],R:[['armory',.36],['bathroom',.54],['lockers',.74],['secoffice',1]]}],
  ambulancebase:[{L:[['ambgarage',.58],['ambcare',1]],R:[['medstock',.34],['bathroom',.52],['dispatch',.74],['ambwait',1]]}],
 };
 const BUSINESS_KINDS=Object.keys(BUSINESS_FLOORS);
 function furnishBusiness(r,put,level,{W,D,cx,cy}){
  const E={exact:true},left=r.x1<=level.entry[0]+.01,outer=left?r.x0:r.x1,os=left?1:-1,inner=left?r.x1:r.x0,is=-os;
  const wallX=off=>outer+os*off,doorX=off=>inner+is*off;
  const plant=(x,y)=>put('bigplant',.7,.7,1.6,[x,y],E);
  const wait=(n=2)=>{for(let i=0;i<n;i++)put('hbench',.5,1.8,.85,[wallX(.45),r.y0+1.4+i*2.2],E);};
  switch(r.use){
   // ---- veterinária
   case'vetconsult':   // mesa de exame no centro (o pet sobe nela), pia, armário, balança e mesa da(o) veterinária(o)
    put('exambed',1.15,2.05,.9,[cx,cy],{...E,service:'exam'});put('sink',.8,.6,.9,[wallX(.55),r.y0+.5],E);put('medcabinet',.9,.45,1.9,[wallX(.5),r.y1-.5],E);
    put('scale',.55,.55,1.1,[doorX(.5),r.y0+.5],E);put('desk',1.3,.65,.75,[cx,r.y0+.55],E);put('infoboard',1.2,.08,1.2,[cx,r.y1-.15],{...E,overlay:true});break;
   case'vetsurgery':put('ortable',1,2.1,1,[cx,cy],{...E,service:'surgery'});put('surglamp',1,1,2.2,[cx,cy],{...E,overlay:true});put('anesthesia',.8,.6,1.4,[wallX(.5),cy],E);put('mayo',.6,.45,1,[cx+1,cy+1.1],E);put('crashcart',.7,.5,1,[doorX(.5),r.y0+.5],E);put('sinkrow',1.8,.55,.9,[cx,r.y0+.4],E);break;
   case'kennel':   // canis com grade e caminha
    for(let y=r.y0+.4;y<r.y1-1.4;y+=1.6){put('cellbars',1.5,.12,1.1,[wallX(1.6),y+.75],{...E,overlay:true});put('qf_carpet_round',1.2,1.2,.02,[wallX(.85),y+.1],{...E,overlay:true});}
    put('shelf',1.6,.45,1.8,[doorX(.4),cy],E);plant(doorX(.5),r.y1-.5);break;
   case'pharmacy':put('medshelf',1.8,.45,1.9,[wallX(.35),cy],E);put('counter',2,.7,1.05,[cx,r.y1-.6],E);break;
   case'vetwait':put('receptiondesk',Math.min(3,W-2),.9,1.1,[cx,r.y0+1],{...E,service:'desk'});wait(2);put('vending',.9,.8,1.9,[doorX(.6),r.y1-.6],E);plant(wallX(.5),r.y1-.5);put('infoboard',1.6,.08,1.5,[cx,r.y1-.15],{...E,overlay:true});break;
   // ---- médico
   case'medconsult':put('execdesk',2.2,2.15,1.3,[cx,r.y0+1.4],{...E,service:'desk'});put('exambed',1.15,2.05,.9,[wallX(.75),r.y1-1.4],{...E,service:'exam'});put('sink',.8,.6,.9,[doorX(.5),r.y1-.5],E);put('medcabinet',.9,.45,1.9,[wallX(.5),r.y0+.5],E);put('scale',.55,.55,1.1,[doorX(.5),r.y0+.5],E);break;
   case'medlab':put('labbench',2.4,.75,1,[cx,r.y0+.5],E);put('labbench',2.4,.75,1,[cx,cy+.4],E);put('labfridge',.8,.7,1.9,[wallX(.5),r.y1-.5],E);put('sink',.8,.6,.9,[doorX(.5),r.y1-.5],E);break;
   case'medexam':put('xray',1.2,2.2,2,[cx,cy],{...E,service:'exam'});put('leadscreen',1.2,.2,1.9,[doorX(.7),r.y1-.6],E);put('desk',1.3,.65,.75,[wallX(.75),r.y0+.5],E);break;
   case'medwait':put('receptiondesk',Math.min(3,W-2),.9,1.1,[cx,r.y0+1],{...E,service:'desk'});wait(2);put('watercooler',.35,.35,1.25,[doorX(.4),r.y1-.4],E);plant(wallX(.5),r.y1-.5);put('infoboard',1.6,.08,1.5,[cx,r.y1-.15],{...E,overlay:true});break;
   // ---- advocacia
   case'lawoffice':put('execdesk',2.2,2.15,1.3,[cx,r.y0+1.4],{...E,service:'desk'});for(const dx of [-.6,.6])put('chair',.5,.5,.9,[cx+dx,r.y0+3.1],{...E,turn:Math.PI,top:'#6b4a32',service:dx<0?'client':undefined});
    put('qf_bookshelf',1.16,.38,2.22,[wallX(.75),r.y1-.35],E);put('qf_bookshelf',1.16,.38,2.22,[wallX(2),r.y1-.35],E);put('qf_houseplant_8',.52,.52,1.56,[doorX(.5),r.y1-.5],E);put('qf_couch_small2',1.06,1,.64,[wallX(.65),cy+.6],{...E,turn:left?Math.PI/2:-Math.PI/2});break;
   case'lawmeeting':put('table',Math.min(4,W-2),1.4,.75,[cx,cy],E);for(let x=cx-1.5;x<=cx+1.5;x+=1)for(const s of [-1,1])put('chair',.5,.5,.9,[x,cy+s*1.05],{...E,turn:s>0?Math.PI:0,top:'#6b4a32'});put('screen',2,.12,1.2,[cx,r.y0+.25],{...E,overlay:true});break;
   case'archive':for(let x=r.x0+.5;x<r.x1-.4;x+=.62)put('filingcab',.5,.65,1.35,[x,r.y0+.5],E);put('shelf',2,.45,1.9,[cx,r.y1-.4],E);break;
   case'lawwait':put('receptiondesk',Math.min(3,W-2),.9,1.1,[cx,r.y0+1],{...E,service:'desk'});put('qf_couch_medium2',2.26,1,.98,[wallX(1.4),r.y1-.7],E);put('qf_table_roundsmall',1.26,1.26,.75,[cx+.6,r.y1-1.9],E);plant(doorX(.5),r.y1-.5);put('qf_light_floor1',.28,.3,1.6,[wallX(.3),r.y0+.4],E);break;
   // ---- oficina
   case'garage':put('carlift',3.4,5.2,2.2,[cx,r.y0+3.6],{...E,service:'lift'});for(let x=r.x0+.9;x<r.x1-.8;x+=1.15)put('toolchest',1.05,.55,1.1,[x,r.y0+.4],E);
    put('workbench',2,.8,1,[wallX(.5),r.y1-2.6],E);put('compressor',.8,.6,1,[wallX(.5),r.y1-4.2],E);put('tirestack',.8,.8,1.1,[doorX(.6),r.y1-4],E);put('oildrum',.6,.6,.9,[doorX(.5),r.y1-5],E);put('tirestand',1.6,.7,1.9,[wallX(1.1),r.y0+6.8],E);break;
   case'parts':for(let y=r.y0+.5;y<r.y1-.6;y+=1.4)put('shelf',Math.min(2.4,W-1.5),.5,1.9,[cx,y],E);break;
   case'shopoffice':put('desk',1.3,.65,.75,[cx,r.y0+.55],E);put('filingcab',.5,.65,1.35,[wallX(.4),r.y1-.45],E);put('printer',.7,.6,1.1,[doorX(.45),r.y1-.45],E);break;
   case'shopwait':put('counter',Math.min(2.6,W-2),.7,1.05,[cx,r.y0+.8],{...E,service:'desk'});wait(1);put('vending',.9,.8,1.9,[doorX(.6),r.y1-.6],E);put('tirestand',1.6,.7,1.9,[cx,r.y1-.45],E);break;
   // ---- restaurante
   case'restkitchen':put('stove',.75,.62,.9,[wallX(.45),r.y0+.9],{...E,service:'stove'});put('stove',.75,.62,.9,[wallX(.45),r.y0+1.8],E);put('qf_kitchen_oven_large',.59,.54,.8,[wallX(.4),r.y0+2.7],E);
    put('fridge',.72,.7,1.8,[r.x0+.5,r.y1-.5],E);put('counter',2.4,.65,.9,[cx,cy],E);put('sink',.8,.6,.9,[doorX(.5),r.y0+.5],E);put('counter',1.6,.65,.9,[doorX(.45),r.y0+1.6],E);break;
   case'restdining':for(let y=r.y0+1.6;y<r.y1-1.3;y+=2.5)for(let x=r.x0+1.5;x<r.x1-1.2;x+=2.8){put('cafetable',1.2,1.2,.95,[x,y],{...E,service:'table'});for(const [dx,t] of [[-.92,Math.PI/2],[.92,-Math.PI/2]])put('qf_chair_3',.38,.42,.85,[x+dx,y],{...E,turn:t});}
    plant(wallX(.5),r.y1-.5);if(!left){put('counter',2,.7,1.05,[cx,r.y1-.55],{...E,service:'desk'});put('coffeestation',1.4,.6,1.25,[wallX(.8),r.y0+.45],E);}break;
   case'pantry':for(let y=r.y0+.5;y<r.y1-.5;y+=1.3)put('shelf',Math.min(2.4,W-1.5),.5,1.9,[cx,y],E);break;
   // ---- segurança privada: recepção, sala do contrato, central de monitoramento, armaria e vestiário
   case'secwait':put('receptiondesk',Math.min(3,W-2),.9,1.1,[cx,r.y0+1],{...E,service:'desk'});wait(2);put('watercooler',.35,.35,1.25,[doorX(.4),r.y1-.4],E);plant(wallX(.5),r.y1-.5);put('infoboard',1.6,.08,1.5,[cx,r.y1-.15],{...E,overlay:true});break;
   case'secoffice':put('execdesk',2.2,2.15,1.3,[cx,r.y0+1.4],E);for(const dx of [-.6,.6])put('chair',.5,.5,.9,[cx+dx,r.y0+3.1],{...E,turn:Math.PI,top:'#2f3a46',service:dx<0?'client':undefined});
    put('filingcab',.5,.65,1.35,[wallX(.4),r.y1-.45],E);put('filingcab',.5,.65,1.35,[wallX(1),r.y1-.45],E);put('camstand',.5,.5,1.6,[doorX(.5),r.y0+.5],E);plant(doorX(.5),r.y1-.5);break;
   case'monitoring':put('videowall',Math.min(3.6,W-1.2),.3,2.4,[cx,r.y0+.3],E);put('policedesk',1.5,1.3,1.25,[cx-.8,r.y0+2],{...E,turn:0});put('policedesk',1.5,1.3,1.25,[cx+.8,r.y0+2],{...E,turn:0});
    put('filingcab',.5,.65,1.35,[wallX(.4),r.y1-.5],E);put('watercooler',.35,.35,1.25,[doorX(.4),r.y1-.4],E);break;
   case'armory':put('safe',.8,.7,1.2,[wallX(.6),r.y0+.6],E);put('safe',.8,.7,1.2,[wallX(.6),r.y0+1.5],E);put('evidenceshelf',Math.min(2.2,W-1.4),.6,2.1,[cx,r.y1-.45],E);put('counter',1.6,.6,.9,[doorX(.45),cy],{...E,top:'#cfd4d8'});break;
   case'lockers':for(let x=r.x0+.8;x<r.x1-.6;x+=1.3)put('locker',1.2,.5,1.95,[x,r.y0+.35],E);put('hbench',Math.min(2.4,W-1.6),.45,.45,[cx,cy+.3],E);break;
   // ---- base de ambulâncias: garagem, sala de atendimento, almoxarifado, central de regulação e recepção
   case'ambgarage':for(let x=r.x0+.9;x<r.x1-.8;x+=1.15)put('toolchest',1.05,.55,1.1,[x,r.y0+.4],E);put('workbench',2,.8,1,[wallX(.5),r.y1-1.4],E);put('crashcart',.7,.5,1,[doorX(.5),r.y1-.6],E);put('medshelf',1.8,.45,1.9,[doorX(.35),cy],E);break;
   case'ambcare':put('exambed',1.15,2.05,.9,[cx,cy],{...E,service:'exam'});put('crashcart',.7,.5,1,[cx+1.2,cy-.9],E);put('medcabinet',.9,.45,1.9,[wallX(.5),r.y0+.5],E);put('sink',.8,.6,.9,[doorX(.5),r.y1-.5],E);put('desk',1.3,.65,.75,[wallX(.75),r.y1-.6],E);break;
   case'medstock':for(let y=r.y0+.5;y<r.y1-.5;y+=1.3)put('medshelf',Math.min(2.2,W-1.5),.45,1.9,[cx,y],E);break;
   case'dispatch':put('videowall',Math.min(3.2,W-1.2),.3,2.2,[cx,r.y0+.3],E);put('policedesk',1.5,1.3,1.25,[cx-.8,r.y0+2],{...E,turn:0});put('policedesk',1.5,1.3,1.25,[cx+.8,r.y0+2],{...E,turn:0});put('filingcab',.5,.65,1.35,[wallX(.4),r.y1-.5],E);break;
   case'ambwait':put('receptiondesk',Math.min(3,W-2),.9,1.1,[cx,r.y0+1],{...E,service:'desk'});wait(2);put('watercooler',.35,.35,1.25,[doorX(.4),r.y1-.4],E);plant(wallX(.5),r.y1-.5);put('infoboard',1.6,.08,1.5,[cx,r.y1-.15],{...E,overlay:true});break;
   // ---- barbearia
   case'barberhall':{   // bancadas com espelho na parede interna (sem janelas), cadeira hidráulica de frente p/ o espelho; lavatórios e sofá do lado das janelas
    const st=left?-Math.PI/2:Math.PI/2;
    // (w/d da planta são extensões em x/y do mundo; bancada e lavatório viram sozinhos para o centro da sala)
    for(let y=r.y0+1.3;y<r.y1-1;y+=2.3){if(Math.abs(y-cy)<2)continue;put('barberstation',.45,1.2,2.05,[doorX(.25),y],E);put('barberchair',.75,.75,1.25,[doorX(1.4),y],{...E,turn:-st,top:'#6b2626',service:'chair'});}
    put('sink',.58,.8,.86,[wallX(.35),r.y0+3.85],E);put('sink',.58,.8,.86,[wallX(.35),r.y1-3.85],E);put('qf_shelf_small1',.28,.97,.29,[wallX(.2),r.y0+6.4],{...E,overlay:true});
    put('qf_couch_medium1',.9,1.9,.9,[wallX(.55),cy],E);put('qf_table_roundsmall',.6,.6,.5,[wallX(1.6),cy],E);
    plant(wallX(.45),r.y0+.5);plant(wallX(.45),r.y1-.5);plant(doorX(.5),r.y0+.5);break;}
   case'barberwait':put('counter',Math.min(2.2,W-2),.7,1.05,[cx,r.y0+.9],{...E,service:'desk'});put('qf_couch_small1',1.44,1.1,.96,[wallX(1),r.y1-.8],E);put('qf_couch_small2',1.06,1,.64,[doorX(.8),r.y1-.8],E);put('tv',1.1,.36,.8,[cx,r.y0+.25],E);plant(wallX(.5),cy);break;
   case'bathroom':put('toilet',.55,.72,.55,[wallX(.6),r.y0+.65],{...E,top:'#eeece6'});put('sink',.65,.52,.85,[doorX(.6),r.y0+.55],{...E,top:'#eee9dd'});put('shower',.88,.88,1.9,[wallX(.7),r.y1-.7],{...E,top:'#bad1d1'});break;
  }
 }
 const POLICE_FLOORS=[
  {L:[['holding',.30],['interrogation',.46],['evidence',.62],['lobby',1]],R:[['bullpen',.36],['bathroom',.50],['records',.64],['dispatch',1]]},
  {L:[['briefing',.34],['armory',.50],['lockers',.66],['office',1]],R:[['chief',.30],['bathroom',.44],['break',.66],['office',1]]}];
 function furnishPolice(r,put,level,dims){
  const {W,D,cx,cy}=dims,E={exact:true},left=r.x1<=level.entry[0]+.01,outer=left?r.x0:r.x1,os=left?1:-1,inner=left?r.x1:r.x0,is=-os;
  const wallX=off=>outer+os*off,doorX=off=>inner+is*off;
  const corners=(kind,w,d,h)=>{for(const [x,y] of [[r.x0+.25+w/2,r.y0+.25+d/2],[r.x1-.25-w/2,r.y0+.25+d/2],[r.x0+.25+w/2,r.y1-.25-d/2],[r.x1-.25-w/2,r.y1-.25-d/2]])put(kind,w,d,h,[x,y],E);};
  const sideWall=(kind,w,d,h,ys)=>{for(const y of ys)put(kind,d,w,h,[wallX(.25+d/2),y],E);};
  const rowY0=(kind,w,d,h,step,from=r.x0+.4,to=r.x1-.4)=>{for(let x=from+w/2;x<=to-w/2;x+=step)put(kind,w,d,h,[x,r.y0+.2+d/2],E);};
  const rowY1=(kind,w,d,h,step,from=r.x0+.4,to=r.x1-.4)=>{for(let x=from+w/2;x<=to-w/2;x+=step)put(kind,w,d,h,[x,r.y1-.2-d/2],E);};
  // mesas de investigador em pares, frente a frente
  const desks=(y0,y1)=>{for(let y=y0+.65;y<=y1-.65;y+=3.1)for(let x=r.x0+1.3,i=1;x<r.x1-1.1;x+=i++%3?1.62:2.8){put('policedesk',1.5,1.3,1.25,[x,y-.65],{...E,turn:Math.PI});put('policedesk',1.5,1.3,1.25,[x,y+.65],{...E,turn:0});}};
  switch(r.use){
   case'holding':{const n=Math.floor((W-4)/3);   // celas encostadas no fundo, com grade, beliche e vaso de aço
    for(let i=0;i<n;i++){const x0=r.x0+.25+i*3,x=x0+1.5;
     put('bunk',.9,2,1.6,[x-.6,r.y0+1.2],E);put('steeltoilet',.5,.6,.75,[x+.95,r.y0+.5],E);put('cellbars',3,.14,2.5,[x,r.y0+3.45],{...E,overlay:true});
     put('cellwall',.14,3.4,2.5,[x0+3,r.y0+1.75],{...E,overlay:true});}
    put('cellwall',.14,3.4,2.5,[r.x0+.25,r.y0+1.75],{...E,overlay:true});
    put('desk',1.1,.62,.74,[doorX(2.6),r.y1-.55],{...E,top:'#cfd4d8'});put('videowall',3.6,.3,2.4,[cx,r.y1-.3],E);put('hbench',.5,1.8,.85,[wallX(.5),r.y1-1.6],E);
    rowY1('locker',1.2,.5,1.95,1.3,r.x0+.4,r.x0+4.4);put('watercooler',.35,.35,1.25,[doorX(.6),r.y1-.5],E);
    // corredor das celas: bancos de espera, posto de guarda com mesa dupla, arquivo e câmera
    for(let x=r.x0+2.2;x<cx-1;x+=2.4)put('hbench',1.8,.5,.85,[x,r.y0+5.1],E);put('policedesk',1.5,1.3,1.25,[cx+2.2,r.y0+5.3],{...E,turn:0});put('policedesk',1.5,1.3,1.25,[cx+3.8,r.y0+5.3],{...E,turn:0});
    put('filingcab',.5,.65,1.35,[wallX(.4),r.y0+4.6],E);put('filingcab',.5,.65,1.35,[wallX(.4),r.y0+5.3],E);put('camstand',.5,.5,1.6,[cx+5.4,r.y0+4.4],E);put('bigplant',.7,.7,1.6,[doorX(.6),r.y0+4.2],E);break;}
   case'interrogation':put('itable',1.2,2.1,.95,[r.x0+W*.28,cy],E);put('onewaymirror',.12,3.4,2.4,[r.x0+W*.5,cy],{...E,overlay:true});
    put('desk',1.1,.62,.74,[r.x0+W*.68,r.y0+.55],{...E,top:'#cfd4d8'});put('chair',.5,.55,.85,[r.x0+W*.64,cy],E);put('chair',.5,.55,.85,[r.x0+W*.72,cy],E);
    put('filingcab',.5,.65,1.35,[r.x0+.5,r.y1-.5],E);put('camstand',.5,.5,1.6,[r.x0+W*.28+1.4,r.y0+.5],E);corners('plant',.44,.44,.74);break;
   case'evidence':rowY0('evidenceshelf',2.2,.6,2.1,2.35,r.x0+.3,r.x1-2);rowY1('evidenceshelf',2.2,.6,2.1,2.35,r.x0+3,r.x1-.3);
    put('counter',2.8,.6,.9,[doorX(2),cy],{...E,top:'#cfd4d8'});put('safe',.8,.7,1.2,[wallX(.6),cy-.6],E);put('safe',.8,.7,1.2,[wallX(.6),cy+.6],E);break;
   case'lobby':put('frontdesk',3.64,1.9,1.3,[cx,r.y1-1.4],E);put('flagstand',.5,.5,2.3,[cx-2.6,r.y1-.5],E);put('flagstand',.5,.5,2.3,[cx+2.6,r.y1-.5],E);
    for(let y=r.y0+1.6;y<r.y1-3.4;y+=1.85)for(let x=r.x0+2.2;x<r.x1-2;x+=2.9)put('waitingrow',2.3,.68,.85,[x,y],E);
    put('wantedboard',2.2,.1,1.6,[cx,r.y0+.25],{...E,overlay:true});sideWall('trophycase',1.6,.5,1.9,[cy-1.5,cy+.4]);sideWall('vending',.95,.8,1.9,[r.y0+1.1]);
    put('metaldetector',1.1,.7,2.2,[doorX(1.2),cy+1.6],E);corners('bigplant',.7,.7,1.6);put('watercooler',.35,.35,1.25,[wallX(.4),r.y1-2.2],E);break;
   case'bullpen':case'office':desks(r.y0+1.6,r.y1-1.6);rowY0('filingcab',.5,.65,1.35,.56,r.x1-3.2,r.x1-.3);put('printer',.7,.6,1.1,[wallX(.55),cy],E);
    put('infoboard',1.6,.08,1.5,[r.x0+2,r.y1-.15],{...E,overlay:true});put('coffeestation',1.4,.6,1.25,[r.x1-2,r.y1-.45],E);corners('bigplant',.7,.7,1.6);break;
   case'records':rowY0('filingcab',.5,.65,1.35,.56);rowY1('filingcab',.5,.65,1.35,.56,r.x0+.4,cx-1);put('desk',1.1,.62,.74,[cx+2,r.y1-.55],{...E,top:'#cfd4d8'});put('printer',.7,.6,1.1,[cx+4,r.y1-.45],E);break;
   case'dispatch':put('videowall',3.6,.3,2.4,[cx-2,r.y0+.35],E);put('videowall',3.6,.3,2.4,[cx+2,r.y0+.35],E);
    for(let y=r.y0+2.4;y<r.y1-1.5;y+=2.4)for(let x=r.x0+2.4;x<r.x1-2;x+=3.4)put('consoledesk',1.8,1.35,1.3,[x,y],E);
    sideWall('radiorack',.7,.9,2,[cy-1.2,cy,cy+1.2]);corners('plant',.44,.44,.74);break;
   case'briefing':put('lectern',.7,.6,1.25,[cx,r.y0+1.1],E);put('tvwall',1.3,.12,2,[cx-2.2,r.y0+.15],{...E,overlay:true});put('infoboard',1.6,.08,1.5,[cx+2.4,r.y0+.15],{...E,overlay:true});
    put('flagstand',.5,.5,2.3,[cx+1.1,r.y0+.5],E);for(let y=r.y0+2.6;y<r.y1-.8;y+=1.15)for(let x=r.x0+1.4;x<r.x1-1.2;x+=.75)if(Math.abs(x-cx)>.7)put('chair',.5,.55,.85,[x,y],{...E,turn:Math.PI});break;
   case'armory':rowY0('gunrack',1.6,.5,2,1.75,r.x0+.4,r.x1-.4);put('counter',2.8,.6,.9,[cx,r.y1-1.4],{...E,top:'#5a6168'});
    rowY1('vestrack',1.56,.5,1.8,1.7,r.x0+.4,cx-1.8);rowY1('ammocrate',.9,.6,.8,1.05,cx+1.8,r.x1-.4);break;
   case'lockers':rowY0('locker',1.2,.5,1.95,1.3);rowY1('locker',1.2,.5,1.95,1.3,r.x0+.4,r.x1-3);for(let x=r.x0+2;x<r.x1-2;x+=2.4)put('hbench',1.8,.5,.85,[x,cy],E);break;
   case'chief':put('execdesk',2.2,2.15,1.3,[cx,r.y0+1.6],E);put('flagstand',.5,.5,2.3,[cx-1.8,r.y0+.5],E);put('flagstand',.5,.5,2.3,[cx+1.8,r.y0+.5],E);
    put('sofa',2.1,.85,.56,[cx,r.y1-.7],{...E,top:'#3e2f26'});put('table',1.05,.65,.42,[cx,r.y1-1.8],{...E,top:'#5a3e2a'});rowY0('shelf',2.5,.45,1.9,2.6,r.x0+.4,cx-2.8);rowY0('trophycase',1.6,.5,1.9,1.8,cx+2.8,r.x1-.4);
    corners('bigplant',.7,.7,1.6);sideWall('infoboard',1.6,.08,1.5,[cy]);break;
   case'break':for(let y=r.y0+2.4;y<r.y1-1.2;y+=2.6)for(let x=r.x0+2.2;x<cx;x+=2.7)put('cafetable',1.5,1.5,.95,[x,y],E);
    put('counter',2.8,.6,.9,[cx+2.4,r.y0+.45],{...E,top:'#e8ece9'});put('coffeestation',1.4,.6,1.25,[cx+4.8,r.y0+.45],E);put('fridge',.75,.7,1.85,[cx+.5,r.y0+.5],{...E,top:'#ecebe6'});
    put('sofa',2.1,.85,.56,[cx+2.8,r.y1-.7],{...E,top:'#36506e'});put('tv',1.1,.45,.55,[cx+2.8,cy],E);sideWall('vending',.95,.8,1.9,[cy-1,cy+.2]);corners('bigplant',.7,.7,1.6);break;
   default:furnishHospital(r,put,level,dims);   // banheiros e corredor como no hospital
  }
 }
 // City Motors: carros de verdade (GLB) sobre plataformas giratórias, totem de ficha técnica ao lado de cada um,
 // parede da marca, mesas de vendedor, banners, expositores de pneus/rodas; oficina com elevadores e ferramentas
 const DEALER_CARS=[['sport','#c0392b'],['coupe','#f4f4f2'],['suv','#1f2d3d'],['silvia','#f39c12'],['pickup','#2c3e50'],['sedan','#7f8c8d'],['offroad','#3d5a3a'],['hatchback','#2e86de']];
 function furnishDealer(r,put,level,dims){
  const {W,D,cx,cy}=dims,E={exact:true};
  const car=(i,x,y)=>{const [model,col]=DEALER_CARS[i%DEALER_CARS.length];
   put('turntable',3.3,5.3,.12,[x,y],{...E,overlay:true});put('parkedcar',1.95,4.6,1.5,[x,y],{...E,overlay:true,modelId:model,col,top:col,side:col,display:true,lift:.12,carAlong:'y'});
   put('infokiosk',.5,.45,1.25,[x+2.05,y+1.6],E);put('spotbar',.4,.4,3.2,[x-2.05,y-1.9],E);};
  switch(r.use){
   case'showroom':{
    // duas fileiras de carros + um em destaque perto da vitrine
    const cols=Math.max(2,Math.floor((W-4)/6.4)),x0=r.x0+(W-(cols-1)*6.4)/2;
    for(let i=0;i<cols;i++){car(i,x0+i*6.4,r.y0+4.1);car(i+cols,x0+i*6.4+(i%2?.6:-.6),r.y1-4.6);}
    put('brandwall',6,.35,3.4,[cx,r.y0+.3],{...E,overlay:true});
    for(const s of [-1,1]){put('salesdesk',2.2,1.9,1.2,[cx+s*7.2,r.y0+1.4],E);put('bannerstand',.9,.4,2.1,[cx+s*4.3,r.y0+.5],E);}
    put('tirestand',1.6,.7,1.9,[r.x0+1.1,r.y0+.6],E);put('rimwall',2.4,.25,2.2,[r.x1-1.6,r.y0+.25],{...E,overlay:true});
    put('sofa',2.1,.85,.56,[r.x1-2.2,cy+.2],{...E,top:'#2d3436'});put('table',1.05,.65,.42,[r.x1-2.2,cy-.9],{...E,top:'#dfe6e9'});
    for(const [x,y] of [[r.x0+.6,r.y1-.6],[r.x1-.6,r.y1-.6],[r.x0+.6,r.y0+2.4],[r.x1-.6,r.y0+2.4]])put('bigplant',.7,.7,1.6,[x,y],E);
    put('bannerstand',.9,.4,2.1,[r.x0+.8,cy],E);put('bannerstand',.9,.4,2.1,[r.x1-.8,cy+2.6],E);break;}
   case'workshop':{
    for(let x=r.x0+2.6;x<r.x1-2.4;x+=5.2)put('carlift',3.4,5.2,2.2,[x,r.y0+3.4],E);
    for(let x=r.x0+.9;x<r.x1-.8;x+=1.15)put('toolchest',1.05,.55,1.1,[x,r.y1-.45],E);
    put('workbench',2,.8,1,[r.x1-1.4,cy],E);put('compressor',.8,.6,1,[r.x1-.6,r.y0+.6],E);
    for(const y of [cy-1.2,cy+.2])put('tirestack',.8,.8,1.1,[r.x0+.6,y],E);put('oildrum',.6,.6,.9,[r.x0+.5,r.y0+.5],E);put('oildrum',.6,.6,.9,[r.x0+1.2,r.y0+.5],E);break;}
   case'sales':put('execdesk',2.2,2.15,1.3,[cx,r.y0+1.5],E);for(let x=r.x0+1.3;x<cx-2;x+=2.6)put('desk',1.1,.62,.74,[x,r.y1-.55],{...E,top:'#d9dcd6'});for(let x=cx+2.8;x<r.x1-1.6;x+=2.6)put('desk',1.1,.62,.74,[x,r.y0+.55],{...E,top:'#d9dcd6'});
    put('shelf',2.5,.45,1.9,[cx+3.6,r.y1-.35],E);put('printer',.7,.6,1.1,[r.x0+.5,r.y0+.5],E);put('infoboard',1.6,.08,1.5,[cx-3.4,r.y0+.15],{...E,overlay:true});put('filingcab',.5,.65,1.35,[r.x1-.5,r.y1-.5],E);
    put('filingcab',.5,.65,1.35,[r.x1-1.1,r.y1-.5],E);put('keybox',.8,.12,1.1,[r.x0+.5,cy],{...E,overlay:true});put('safe',.8,.7,1.2,[r.x1-.6,r.y0+.6],E);put('bigplant',.7,.7,1.6,[r.x0+.5,r.y0+.5],E);break;
   case'lounge':put('coffeestation',1.4,.6,1.25,[cx-1.2,r.y0+.45],E);put('vending',.95,.8,1.9,[r.x1-.6,cy],E);put('vending',.95,.8,1.9,[r.x1-1.7,r.y0+.5],E);
    for(const x of [cx-5,cx,cx+5])put('sofa',2.1,.85,.56,[x,r.y1-.7],{...E,top:'#2d3436'});for(const x of [r.x0+1.6,r.x0+4.2])put('cafetable',1.5,1.5,.95,[x,cy],E);
    put('watercooler',.35,.35,1.25,[cx+2.6,r.y0+.4],E);put('bigplant',.7,.7,1.6,[r.x1-.5,r.y1-.5],E);put('tv',1.1,.45,.55,[cx+1.6,r.y0+.4],E);put('bigplant',.7,.7,1.6,[r.x0+.5,r.y1-.5],E);break;
   default:furnishHospital(r,put,level,dims);
  }
 }
 // Central Logística: despacho com telões de rastreamento e mesas de despachante; armazém com estantes porta-paletes,
 // paletes de caixas, empilhadeiras e bancada de embalagem; escritório e vestiário da equipe
 function furnishDepot(r,put,level,dims){
  const {W,D,cx,cy}=dims,E={exact:true};
  switch(r.use){
   case'dispatch':put('receptiondesk',3.4,1.7,1.15,[cx,r.y0+1.6],E);put('videowall',3.6,.3,2.4,[cx-4.4,r.y0+.35],E);put('videowall',3.6,.3,2.4,[cx+4.4,r.y0+.35],E);
    for(const s of [-1,1])for(let k=0;k<2;k++){const x=cx+s*(9.5+k*1.65);put('policedesk',1.5,1.3,1.25,[x,r.y0+3],{...E,turn:Math.PI});put('policedesk',1.5,1.3,1.25,[x,r.y0+4.3],{...E,turn:0});}
    for(let y=cy+1.2;y<r.y1-2;y+=1.85)for(let x=cx-4.4;x<=cx+4.4;x+=2.9)put('waitingrow',2.3,.68,.85,[x,y],E);
    put('keybox',.8,.12,1.1,[r.x0+.4,cy-1],{...E,overlay:true});put('infoboard',1.6,.08,1.5,[r.x1-.2,cy-1],{...E,overlay:true});put('vending',.95,.8,1.9,[r.x0+.6,cy+2],E);put('watercooler',.35,.35,1.25,[r.x0+.5,cy+3.4],E);
    put('pallet',1.3,1.2,1.4,[r.x1-1.2,cy+2.4],E);put('bannerstand',.9,.4,2.1,[r.x1-.8,r.y1-1.4],E);put('printer',.7,.6,1.1,[cx+2.6,r.y0+.5],E);
    for(const [x,y] of [[r.x0+.6,r.y1-.6],[r.x1-.6,r.y1-.6]])put('bigplant',.7,.7,1.6,[x,y],E);break;
   case'storehouse':for(let y=r.y0+.5;y<r.y1-1;y+=3.4)for(let x=r.x0+1.3;x<r.x1-2;x+=2.35)put('evidenceshelf',2.2,.6,2.1,[x,y],E);
    for(let x=r.x0+1.4;x<r.x1-1.4;x+=1.7)put('pallet',1.3,1.2,1.4,[x,r.y1-.8],E);put('forklift',1.3,2.4,2.2,[cx-2,cy+1.6],E);put('forklift',1.3,2.4,2.2,[cx+3,cy+1.6],E);
    put('workbench',2,.8,1,[r.x1-1.4,cy+1.8],E);put('oildrum',.6,.6,.9,[r.x0+.5,cy+1.7],E);break;
   case'office':put('execdesk',2.2,2.15,1.3,[cx,r.y0+1.5],E);for(let x=r.x0+1.3;x<cx-2;x+=2.6)put('desk',1.1,.62,.74,[x,r.y1-.55],{...E,top:'#d9dcd6'});
    put('filingcab',.5,.65,1.35,[r.x1-.5,r.y1-.5],E);put('filingcab',.5,.65,1.35,[r.x1-1.1,r.y1-.5],E);put('safe',.8,.7,1.2,[r.x1-.6,r.y0+.6],E);put('shelf',2.5,.45,1.9,[cx+3.6,r.y1-.35],E);put('bigplant',.7,.7,1.6,[r.x0+.5,r.y0+.5],E);break;
   case'lockers':for(let x=r.x0+.9;x<r.x1-.8;x+=1.3)put('locker',1.2,.5,1.95,[x,r.y0+.4],E);for(let x=r.x0+2;x<r.x1-2;x+=2.4)put('hbench',1.8,.5,.85,[x,r.y1-.9],E);
    put('coffeestation',1.4,.6,1.25,[r.x1-1.2,r.y1-.45],E);break;
   default:furnishHospital(r,put,level,dims);
  }
 }
 function makePlan({width:W,depth:D,kind='house',seed=1,floors=1,height=3}){
  if(W<6||D<6)throw Error('Property envelope too small');
  const random=rng(seed),family=Math.floor(random()*4),palette=Math.floor(random()*6);
  const plan={version:1,kind,seed,width:W,depth:D,floorHeight:height,family:['courtyard','offset-wing','garden-wing','cross-gable'][family],palette,levels:[]};
  const isHome=residential(kind),count=Math.max(1,Math.min(12,floors));
  const coreX=W*(.47+random()*.06),rearFraction=.40+random()*.06;
  for(let floor=0;floor<count;floor++){
   const setback=count>3&&floor>1?Math.min(Math.min(W,D)*.13,.65+Math.floor((floor-2)/3)*.6):0;
   const w=W-setback*2,d=D-setback*2,ox=setback,oy=setback;
   const civic=['hospital','police','military','cityhall','school','university','campuslib',...BUSINESS_KINDS].includes(kind);
   const publicFloor=civic||floor===0&&['office','condo','projects','deco','shop','airport','warehouse'].includes(kind);
   const hallW=publicFloor?(kind==='airport'?3.6:kind==='warehouse'?2.8:3.4):count>1?3.0:1.8;   // corredores largos: a escada encosta numa parede e sobra passagem
   const left=round(coreX-hallW/2-ox),right=round(left+hallW),rear=round(Math.max(2.8,d*rearFraction));
   const inset=round(Math.min(1.8,d*.18)),wingRecess=count>3&&floor>=Math.ceil(count*.6)?Math.min(1.4,d*.1):0;
   const leftEnd=Math.max(rear+2.8,d-(family===2?inset:0)-(family%2===0?wingRecess:0)),rightEnd=Math.max(rear+2.8,d-(family===1||family===3?inset:0)-(family%2?wingRecess:0)),entry=d-(floor>0?1.65:family===0?inset:inset*.55);
   let uses;
   if(isHome&&!(floor===0&&['condo','projects'].includes(kind)))uses=floor===0||['condo','projects'].includes(kind)?['bedroom','bathroom','living','kitchen']:['bedroom','bathroom','bedroom','study'];
   else if(kind==='warehouse')uses=['office','bathroom','warehouse','loading'];
   else if(kind==='hospital')uses=floor?['ward','bathroom','clinic','office']:['clinic','bathroom','reception','ward'];
   else if(kind==='police')uses=floor?['office','bathroom','briefing','office']:['holding','bathroom','reception','office'];
   else if(kind==='military')uses=floor?['barracks','bathroom','barracks','briefing']:['armory','bathroom','reception','briefing'];
   else if(kind==='cityhall')uses=floor?['council','bathroom','office','meeting']:['office','bathroom','reception','council'];
   else if(kind==='school')uses=floor?['classroom','bathroom','classroom','library']:['classroom','bathroom','reception','library'];
   else if(kind==='airport')uses=['office','bathroom','terminal','service'];
   else if(kind==='office')uses=['meeting','bathroom',floor?'office':'reception','office'];
   else if(kind==='deco')uses=floor?['bedroom','bathroom','living','kitchen']:['storage','bathroom','reception','dining'];
   else if(['condo','projects'].includes(kind))uses=['laundry','bathroom','reception','lounge'];
   else uses=floor>0?['bedroom','bathroom','living','kitchen']:palette%3===0?['storage','bathroom','dining','kitchen']:palette%3===1?['storage','bathroom','sales','checkout']:['staff','bathroom','salon','reception'];
   let rooms=[rect('rear-left',uses[0],0,0,left,rear),rect('rear-right',uses[1],right,0,w,rear),rect('front-left',uses[2],0,rear,left,leftEnd),rect('front-right',uses[3],right,rear,w,rightEnd),rect('hall','circulation',left,0,right,entry)];
   // prédio residencial: cada andar de cima vira 2 (ou 4) apartamentos com porta própria no corredor (architecture-organic.js)
   let unitLinks=null,unitList=null;
   if(['condo','projects','deco'].includes(kind)&&floor>0&&root.CityOrganic){
    const U=root.CityOrganic.apartmentFloor({w,d,left,right,dl:leftEnd,dr:rightEnd});
    if(U.units.length){rooms=[...U.rooms,rect('hall','circulation',left,0,right,entry)];unitLinks=U.links.map(L=>L.pos?{...L,pos:[L.pos[0]+ox,L.pos[1]+oy]}:L);unitList=U.units;}
   }
   if(kind==='mansion'&&w>=14){const bath=rooms[1];const split=round(rear*.57);bath.y1=split;rooms.push(rect('laundry','laundry',right,split,w,rear));}
   // hospital: corredor central largo e alas com vários cômodos de verdade (cada um com porta p/ o corredor)
   let hospital=null;
   const custom={hospital:HOSPITAL_FLOORS,police:POLICE_FLOORS,university:UNIVERSITY_FLOORS,campuslib:CAMPUSLIB_FLOORS,...BUSINESS_FLOORS}[kind];
   if(custom){
    const HW=4.4,hl=round(w/2-HW/2),hr=round(hl+HW),he=round(d-1.2),plan=custom[Math.min(floor,custom.length-1)];
    rooms=[];
    for(const [side,list] of [['left',plan.L],['right',plan.R]])list.reduce((y0,[use,f],i)=>{
     const last=i===list.length-1,y1=last?d:round(d*f),id=last?'front-'+side:side+'-'+i;
     rooms.push(side==='left'?rect(id,use,0,y0,hl,y1):rect(id,use,hr,y0,w,y1));return y1;},0);
    rooms.push(rect('hall','circulation',hl,0,hr,he));hospital={hl,hr,he};
   }
   if(kind==='dealer'||kind==='depot'){
    const sy=round(d*.4),HW=3.4,hl=round(w*.46),hr=round(hl+HW),r1=round(sy*.42),r2=round(sy*.66),dep=kind==='depot';
    rooms=[rect('front-left',dep?'dispatch':'showroom',0,sy,w,d),rect('rear-left',dep?'storehouse':'workshop',0,0,hl,sy),rect('rear-right',dep?'office':'sales',hr,0,w,r1),rect('bath','bathroom',hr,r1,w,r2),rect('lounge',dep?'lockers':'lounge',hr,r2,w,sy),rect('hall','circulation',hl,0,hr,sy)];
    hospital={hl,hr,he:d};
   }
   if(civic&&!hospital){for(const room of rooms.slice()){if(room.id==='hall'||room.y1-room.y0<8)continue;
    const mid=round((room.y0+room.y1)/2),front=room.id.startsWith('front');
    rooms.push({...room,id:room.id+'-annex',y0:front?room.y0:mid,y1:front?mid:room.y1});
    if(front)room.y0=mid;else room.y1=mid;
   }}
   for(const r of rooms){r.x0=round(r.x0+ox);r.x1=round(r.x1+ox);r.y0=round(r.y0+oy);r.y1=round(r.y1+oy);}
   const level={floor,kind,wingRecess,z:floor*height,rooms,walls:[],furniture:[],entry:hospital?[ox+(hospital.hl+hospital.hr)/2,oy+hospital.he]:[ox+(left+right)/2,oy+entry],setback,
    outdoor:floor>0?[hospital?rect("balcony","balcony",ox+hospital.hl,oy+hospital.he,ox+hospital.hr,oy+d):rect("balcony","balcony",ox+left,oy+entry,ox+right,oy+d)]:[]};
   if(unitLinks){level.links=unitLinks;level.units=unitList;level.entryStyle='glazed';}
   if(kind==='mansion'&&floor>0)level.outdoor.push({...rect('rear-balcony','balcony',1.3,-2.7,W-1.3,0),rear:true});
   makeWalls(level,seed+floor);(level.links&&root.CityOrganic?root.CityOrganic.furnishLevel:furnish)(level,seed+floor*71);orientFurniture(level);
   plan.levels.push(level);
  }
  plan.signature=JSON.stringify(plan.levels[0].rooms.map(r=>[r.use,r.x0,r.y0,r.x1,r.y1]));
  plan.audit=auditPlan(plan);return plan;
 }
 function makeWalls(level,seed){
  const rooms=level.rooms,seen=new Set();
  const X=[...new Set(rooms.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),Y=[...new Set(rooms.flatMap(r=>[r.y0,r.y1]))].sort((a,b)=>a-b);
  const at=(x,y)=>rooms.find(r=>inside(r,x,y,.00001));
  const add=(a,b,left,right,n)=>{
   if(!left&&!right||left===right)return;
   const key=[...a,...b].map(round).join(',');if(seen.has(key))return;seen.add(key);
   const ext=!left||!right,owner=left||right,len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const wall={a,b,ext,normal:ext?(left?n:n.map(v=>-v)):n,rooms:[left?.id,right?.id].filter(Boolean),openings:[]};
   if(level.links){linkOpenings(level,wall,owner,len);level.walls.push(wall);return;}   // planta com ligações explícitas (gerador orgânico, apartamentos)
   if(!ext&&[left.id,right.id].includes('hall')&&len>=1.12)wall.openings.push({kind:'door',style:[left.use,right.use].includes('holding')?'bars':undefined,at:len/2,width:1.02,height:2.16});
   if(ext&&owner.id==='hall'&&n[1]!==0&&Math.abs((a[1]+b[1])/2-level.entry[1])<.01)wall.openings.push({kind:'door',style:level.floor?'glazed':undefined,at:len/2,width:Math.min(1.15,len-.16),height:2.25});
   else if(ext&&owner.id==='hall'&&wall.normal[1]<-.5&&level.outdoor.some(r=>r.rear))wall.openings.push({kind:'door',style:'glazed',at:len/2,width:1.15,height:2.25});
   else if(ext&&(owner.use==='showroom'||owner.use==='dispatch')&&len>=1.8){
    const front=wall.normal[1]>.5,count=Math.max(1,Math.floor(len/2.7));
    for(let i=0;i<count;i++){const at=len*(i+.5)/count;if(front&&Math.abs(at-len/2)<2)continue;wall.openings.push({kind:'window',at,width:Math.min(2.45,len/count-.25),sill:.25,height:3.4});}
    if(front)wall.openings.push({kind:'door',style:'glazed',at:len/2,width:2.6,height:2.7});
    wall.openings.sort((a,b)=>a.at-b.at);
   }
   else if(ext&&owner.use==='garage'&&wall.normal[1]>.5&&len>4){wall.openings.push({kind:'door',style:'roller',at:len/2,width:Math.min(3.6,len-1),height:3.4});}   // portão da oficina, de frente p/ a rua
   else if(ext&&(owner.use==='workshop'||owner.use==='storehouse')&&wall.normal[1]<-.5&&len>5){wall.openings.push({kind:'door',style:'roller',at:len/2,width:3.6,height:3.6});}
   else if(ext&&owner.use!=='circulation'&&len>=1.8){
    const privacy=owner.use==='bathroom',count=Math.max(1,Math.floor(len/(privacy?3.7:2.6)));
    const office=level.kind==='office';
    for(let i=0;i<count;i++)wall.openings.push({kind:'window',at:len*(i+1)/(count+1),width:privacy?.65:Math.min(office?1.75:1.35,len/(count+1)-.35),sill:privacy?1.6:office?.65:.85,height:privacy?.55:office?1.65:1.35});
   }
   if(ext&&owner.use==='loading'&&level.floor===0&&wall.normal[1]>.5&&len>4)wall.openings=[{kind:'door',style:'roller',at:len/2,width:Math.min(3.4,len-1),height:3.6}];
   level.walls.push(wall);
  };
  // Atomic boundaries are merged when the two neighbouring rooms match.
  const raw=[];
  for(const x of X)for(let j=0;j<Y.length-1;j++){const y=(Y[j]+Y[j+1])/2;raw.push([[x,Y[j]],[x,Y[j+1]],at(x-.001,y),at(x+.001,y),[1,0]]);}
  for(const y of Y)for(let i=0;i<X.length-1;i++){const x=(X[i]+X[i+1])/2;raw.push([[X[i],y],[X[i+1],y],at(x,y-.001),at(x,y+.001),[0,1]]);}
  const merged=[];
  for(const item of raw){const prev=merged.at(-1);if(prev&&prev[2]===item[2]&&prev[3]===item[3]&&prev[4][0]===item[4][0]&&prev[0][0]===item[0][0]&&prev[1][0]===item[0][0]&&prev[1][1]===item[0][1])prev[1]=item[1];else if(prev&&prev[2]===item[2]&&prev[3]===item[3]&&prev[4][1]===item[4][1]&&prev[0][1]===item[0][1]&&prev[1][0]===item[0][0]&&prev[1][1]===item[0][1])prev[1]=item[1];else merged.push(item);}
  for(const a of merged)add(...a);
 }
 // Ligações explícitas: {a,b} = porta/vão entre dois cômodos; {a,ext:[nx,ny]} = porta numa parede externa do cômodo a.
 // kind 'door' (folha que abre) ou 'passage' (vão aberto, sem folha: cozinha americana, entrada do corredor).
 // pos = ponto da planta onde a abertura deve ficar (é projetado na parede); sem pos, perto do canto da parede.
 // A entrada da casa é a porta externa do 'hall' na fachada (normal +y) que contém level.entry.
 function linkOpenings(level,wall,owner,len){
  const dx=(wall.b[0]-wall.a[0])/len,dy=(wall.b[1]-wall.a[1])/len;
  const project=p=>(p[0]-wall.a[0])*dx+(p[1]-wall.a[1])*dy;
  const place=(L,width,pos)=>Math.max(width/2+.12,Math.min(len-width/2-.12,pos==null?width/2+.35:project(pos)));
  const open=(L)=>{const passage=L.kind==='passage',width=passage?Math.min(L.width||1.6,len-.3):Math.min(L.width||.92,len-.24);if(width<.8)return;
   wall.openings.push(passage?{kind:'passage',at:place(L,width,L.pos),width,height:2.25,sill:0}:{kind:'door',style:L.style,at:place(L,width,L.pos),width,height:2.16,...(L.unit!=null?{unit:L.unit}:{})});};
  if(!wall.ext){const [r0,r1]=wall.rooms;for(const L of level.links)if(!L.ext&&(L.a===r0&&L.b===r1||L.a===r1&&L.b===r0))open(L);}
  else{
   const e=level.entry,horiz=Math.abs(dy)<1e-6;
   if(owner.id==='hall'&&wall.normal[1]>.5&&horiz&&Math.abs(wall.a[1]-e[1])<.02&&e[0]>Math.min(wall.a[0],wall.b[0])+.5&&e[0]<Math.max(wall.a[0],wall.b[0])-.5)
    wall.openings.push({kind:'door',style:level.entryStyle,at:project(e),width:Math.min(1.15,len-.3),height:2.25});
   for(const L of level.links)if(L.ext&&L.a===owner.id&&Math.abs(L.ext[0]-wall.normal[0])<.01&&Math.abs(L.ext[1]-wall.normal[1])<.01)open(L);
  }
  // janelas nas paredes externas (não no corredor), sem encostar nas portas
  if(wall.ext&&owner.use!=='circulation'&&len>=1.6){
   const privacy=owner.use==='bathroom'||owner.use==='laundry',count=Math.max(1,Math.floor(len/(privacy?3.4:2.6)));
   for(let i=0;i<count;i++){const at=len*(i+1)/(count+1),width=privacy?.65:Math.min(1.35,len/(count+1)-.35);
    if(width<.5||wall.openings.some(o=>Math.abs(o.at-at)<(o.width+width)/2+.3))continue;
    wall.openings.push({kind:'window',at,width,sill:privacy?1.6:.85,height:privacy?.55:1.35});}
  }
  wall.openings.sort((a,b)=>a.at-b.at);
 }
 function furnish(level,seed){
  const random=rng(seed);
  for(const r of level.rooms){
   if(r.use==='circulation'&&!['hospital','police','dealer','depot','university','campuslib'].includes(level.kind))continue;
   const W=r.x1-r.x0,D=r.y1-r.y0,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
   const portals=level.walls.filter(w=>w.rooms.includes(r.id)).flatMap(w=>w.openings.filter(o=>o.kind==='door'||o.kind==='passage').map(o=>{const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),x=w.a[0]+(w.b[0]-w.a[0])*o.at/L,y=w.a[1]+(w.b[1]-w.a[1])*o.at/L;return{x,y};}));
   const items=[];
   const put=(kind,w,d,h,preferred,extra={})=>{
    const fit=(v,a,b,s)=>Math.max(a+.17+s/2,Math.min(b-.17-s/2,v));   // posição exata: encosta na parede sem sair do cômodo
    const candidates=extra.exact?[[fit(preferred[0],r.x0,r.x1,w),fit(preferred[1],r.y0,r.y1,d)]]:[preferred,[r.x0+.25+w/2,r.y0+.25+d/2],[r.x1-.25-w/2,r.y0+.25+d/2],[r.x0+.25+w/2,r.y1-.25-d/2],[r.x1-.25-w/2,r.y1-.25-d/2],[cx,cy]];
    function* positions(){yield* candidates;if(extra.exact)return;for(let y=r.y0+.2+d/2;y<r.y1-.18-d/2;y+=.25)for(let x=r.x0+.2+w/2;x<r.x1-.18-w/2;x+=.25)yield[x,y];}
    for(const [x,y] of positions()){
     if(!inside(r,x-w/2,y-d/2,.16)||!inside(r,x+w/2,y+d/2,.16))continue;
     if(!extra.overlay&&items.some(b=>!b.overlay&&Math.abs(x-b.x)<(w+b.w)/2+.08&&Math.abs(y-b.y)<(d+b.d)/2+.08))continue;
     if(!extra.overlay&&portals.some(p=>Math.abs(p.x-x)<w/2+.67&&Math.abs(p.y-y)<d/2+.67))continue;
     const b={room:r.id,kind,x:round(x),y:round(y),w,d,h,top:extra.top||['#c9a77d','#b9946e','#d7c5a8'][Math.floor(random()*3)],side:'#85684b',...extra};items.push(b);return b;
    }return null;
   };
   const bed=()=>{put('bed',Math.min(1.6,W-1.1),2.05,.55,[cx,r.y0+1.3],{top:'#92b1a6'});put('wardrobe',1.05,.52,1.95,[r.x0+.8,r.y1-.55]);};
   const kitchen=()=>{put('fridge',.65,.65,1.85,[r.x0+.6,r.y0+.6],{top:'#ecebe6'});put('stove',.7,.62,.9,[r.x0+1.38,r.y0+.6],{top:'#c6c4be'});put('sink',.72,.62,.9,[r.x1-.65,r.y0+.6],{top:'#e6e0d5'});if(D>3.7)put('counter',1.5,.65,.9,[cx,r.y1-.6]);};
   const lounge=()=>{put('sofa',Math.min(2.3,W-1.2),.85,.6,[cx,r.y1-.75],{top:'#839b93'});put('tv',1.1,.36,.8,[cx,r.y0+.4],{top:'#30363b'});if(D>3.8)put('table',1.05,.65,.42,[cx,cy]);};
   if(level.kind==='hospital')furnishHospital(r,put,level,{W,D,cx,cy});
   else if(level.kind==='police')furnishPolice(r,put,level,{W,D,cx,cy});
   else if(BUSINESS_KINDS.includes(level.kind))furnishBusiness(r,put,level,{W,D,cx,cy});
   else if(level.kind==='university'||level.kind==='campuslib'){if(r.use==='circulation'){for(let y=r.y0+3;y<r.y1-3;y+=6){put('hbench',.5,1.8,.85,[r.x0+.4,y],{exact:true});put('bigplant',.6,.6,1.6,[r.x1-.45,y],{exact:true});}}else furnishUniversity(r,put,level,{W,D,cx,cy});}
   else if(level.kind==='dealer')furnishDealer(r,put,level,{W,D,cx,cy});
   else if(level.kind==='depot')furnishDepot(r,put,level,{W,D,cx,cy});
   else switch(r.use){
    case'ward':case'barracks':for(let y=r.y0+1.5;y<r.y1-1;y+=3.2)for(const x of [r.x0+1.2,r.x1-1.2]){put(r.use==='ward'?'hospitalbed':'bed',1.15,2.05,.9,[x,y],{top:r.use==='ward'?'#e1eee9':'#657361'});put('cabinet',.5,.55,.75,[x+.85,y-.6],{top:'#bfcac8'});}break;
    case'clinic':put('hospitalbed',1.15,2.05,.9,[cx,cy],{top:'#d3e6e1'});put('sink',.8,.6,.9,[r.x0+.7,r.y0+.7]);put('desk',1.6,.7,.8,[cx,r.y0+.7]);put('shelf',2,.5,1.8,[r.x1-1.4,r.y1-.5]);break;
    case'classroom':for(let y=r.y0+2.2;y<r.y1-1;y+=2)for(let x=r.x0+1;x<r.x1-1;x+=2.2){put('studentdesk',1.2,.65,.75,[x,y]);put('chair',.45,.5,.8,[x,y+.7]);}put('tv',Math.min(3,W-1),.15,1.8,[cx,r.y0+.3],{top:'#284b43'});break;
    case'library':case'armory':for(let y=r.y0+1;y<r.y1-1;y+=2.4)put('shelf',Math.min(W-2,4),.6,2,[cx,y],{top:r.use==='armory'?'#596562':'#a68b64'});break;
    case'council':case'briefing':put('table',Math.min(5,W-2),2,.8,[cx,cy]);for(let x=cx-2;x<=cx+2;x+=1)for(const y of [cy-1.5,cy+1.5])put('chair',.55,.55,.9,[x,y]);put('desk',2,.8,.9,[cx,r.y0+.8]);break;
    case'holding':put('bed',.85,2,.5,[r.x0+1,r.y0+1.4],{top:'#687b83'});put('toilet',.55,.7,.55,[r.x1-.7,r.y0+.7]);put('bench',2,.5,.45,[cx,r.y1-.6]);break;
    case'bedroom':bed();break;
    case'bathroom':put('toilet',.55,.72,.55,[r.x0+.6,r.y0+.65],{top:'#eeece6'});put('sink',.65,.52,.85,[r.x1-.6,r.y0+.55],{top:'#eee9dd'});put('shower',.88,.88,1.9,[r.x1-.7,r.y1-.7],{top:'#bad1d1'});break;
    case'kitchen':kitchen();break;
    case'living':case'lounge':lounge();break;
    case'dining':put('table',1.5,1.05,.75,[cx,cy]);put('counter',1.8,.65,.9,[cx,r.y0+.6]);break;
    case'office':case'study':case'staff':put('desk',1.25,.65,.75,[cx,r.y0+.6]);put('shelf',1.4,.45,1.9,[r.x0+.95,r.y1-.55]);break;
    case'meeting':put('table',Math.min(2.2,W-1.3),1.1,.75,[cx,cy]);put('tv',1.2,.3,1,[cx,r.y0+.4]);break;
    case'reception':case'service':case'checkout':put('counter',Math.min(2.5,W-1),.7,1.05,[cx,cy]);put('sofa',1.8,.8,.6,[cx,r.y0+.7],{top:'#a2b6b8'});break;
    case'sales':case'storage':case'warehouse':case'loading':put('shelf',Math.min(2.1,W-1.2),.6,1.8,[cx,r.y0+.65]);if(D>3.4)put('shelf',Math.min(2.1,W-1.2),.6,1.6,[cx,r.y1-.65]);break;
    case'laundry':put('cabinet',1.1,.65,.92,[cx,r.y0+.65]);put('sink',.65,.6,.9,[r.x1-.6,r.y1-.6]);break;
    case'salon':put('mirror',1.2,.15,1.7,[cx,r.y0+.3]);put('sofa',1.6,.8,.6,[cx,r.y1-.7]);break;
    case'terminal':for(let i=0;i<3;i++)put('sofa',2,.85,.6,[cx,r.y0+1.1+i*2.1]);break;
   }
   level.furniture.push(...items);
  }
 }
 // ---------- orientação dos móveis (vale p/ toda planta, antiga e nova) ----------
 // Todo modelo 3D tem a frente em +z (cabeceira, encosto, fundo da geladeira e da TV em -z). Peça encostada numa
 // parede fica de costas para ela e de frente para o cômodo; cadeira fica de frente para a mesa/escrivaninha mais
 // próxima. face = direção da frente na planta; along/depth = medidas paralela/perpendicular à parede.
 // Proporção largura/fundo de cada modelo (decide qual lado encosta quando a peça está num canto).
 const MODEL_WD={bed:[1.6,2.1],sofa:[2.1,.85],couch:[2,.9],tv:[1.1,.45],wardrobe:[1.43,.62],desk:[1.1,.62],counter:[2.8,.6],shelf:[2.5,.45],
  fridge:[.72,.7],stove:[.75,.62],sink:[.8,.58],toilet:[.45,.7],shower:[.85,.85],cabinet:[1.05,.48],bookshelf:[1,.35],execdesk:[1.8,.9],
  medcabinet:[1,.45],sinkrow:[2.4,.6],locker:[1.2,.5],coffeestation:[1.4,.6],vending:[.95,.8],infoboard:[1.6,.08],mirror:[.85,.1],screen:[3,.12],
  hospitalbed:[1.15,2.05],exambed:[.8,1.9],studentdesk:[1.2,.65],policedesk:[1.5,1.3],toolchest:[1.2,.6],workbench:[2,.8],labbench:[2.4,.75],medshelf:[2.2,.45]};
 const SEATS=new Set(['chair','stool','qf_chair_1','qf_chair_2','qf_chair_3','qf_chair_4','qf_stool','armchair']);
 const TABLES=/^(table|desk|studentdesk|execdesk|cafetable|policedesk|counter|nursedesk|receptiondesk|salesdesk|qf_table_roundsmall|qf_table_roundsmall2|qf_table_roundlarge|labbench|lectern)$/;
 function orientFurniture(level){
  for(const f of level.furniture){
   if(f.turn!=null||f.face)continue;
   const r=level.rooms.find(r=>r.id===f.room);if(!r)continue;
   if(SEATS.has(f.kind)){
    let best=null,bd=1.4;
    for(const t of level.furniture)if(t!==f&&t.room===f.room&&TABLES.test(t.kind)){const d=Math.hypot(t.x-f.x,t.y-f.y);if(d<bd){bd=d;best=t;}}
    if(best){const dx=best.x-f.x,dy=best.y-f.y;f.face=Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)||1];f.along=Math.abs(f.face[0])?f.d:f.w;f.depth=Math.abs(f.face[0])?f.w:f.d;}
    continue;
   }
   const gaps={rear:f.y-f.d/2-r.y0,front:r.y1-(f.y+f.d/2),left:f.x-f.w/2-r.x0,right:r.x1-(f.x+f.w/2)};
   const wd=MODEL_WD[f.kind],ratio=wd?wd[0]/wd[1]:null;
   let pick=null,score=1e9;
   for(const [s,g] of Object.entries(gaps)){
    if(g>.45)continue;
    const horiz=s==='rear'||s==='front',along=horiz?f.w:f.d,depth=horiz?f.d:f.w;
    // sem proporção conhecida: o lado comprido encosta na parede
    const fit=ratio?Math.abs(Math.log(Math.max(.05,along)/Math.max(.05,depth)/ratio)):(along>=depth-.01?0:1);
    // empate (peça quadrada no canto): de frente para o lado com mais espaço livre
    const room=horiz?r.y1-r.y0:r.x1-r.x0,sc=fit+g*1.5-room*.01;
    if(sc<score){score=sc;pick=s;}
   }
   if(!pick)continue;
   f.face={rear:[0,1],front:[0,-1],left:[1,0],right:[-1,0]}[pick];
   const horiz=pick==='rear'||pick==='front';f.along=horiz?f.w:f.d;f.depth=horiz?f.d:f.w;
  }
 }
 function auditPlan(plan){
  const problems=[],required=new Set(['bedroom','bathroom','living','kitchen']);
  for(const level of plan.levels){
   const reachable=new Set(['hall']);let changes=true;
   while(changes){changes=false;for(const w of level.walls)if(!w.ext&&w.openings.some(o=>o.kind==='door'||o.kind==='passage')&&w.rooms.some(id=>reachable.has(id)))for(const id of w.rooms)if(!reachable.has(id)){reachable.add(id);changes=true;}}
   for(const r of level.rooms){if(!reachable.has(r.id))problems.push(`floor ${level.floor}: inaccessible ${r.id}`);if((r.x1-r.x0)*(r.y1-r.y0)<2.5)problems.push('room too small');}
   for(const b of level.furniture){const r=level.rooms.find(r=>r.id===b.room);if(!inside(r,b.x-b.w/2,b.y-b.d/2,.1)||!inside(r,b.x+b.w/2,b.y+b.d/2,.1))problems.push('furniture outside room');}
  }
  if(residential(plan.kind)&&!['condo','projects'].includes(plan.kind))for(const type of required)if(!plan.levels[0].rooms.some(r=>r.use===type))problems.push('missing '+type);
  const entry=plan.levels[0].walls.some(w=>w.ext&&w.openings.some(o=>o.kind==='door'));
  if(!entry)problems.push('missing entrance');
  const needed={bedroom:['bed'],bathroom:['toilet','sink','shower'],living:['sofa','tv'],kitchen:['fridge','sink','stove']};
  // banheiro coletivo da universidade: cabines e pia corrida (sem chuveiro)
  const campus=['university','campuslib'].includes(plan.kind),neededFor=use=>campus&&use==='bathroom'?['toiletstall','sinkrow']:needed[use]||[];
  for(const level of plan.levels)for(const room of level.rooms)for(const kind of neededFor(room.use))if(!level.furniture.some(f=>f.room===room.id&&f.kind===kind))problems.push(`floor ${level.floor}: ${room.use} missing ${kind}`);
  return{passed:!problems.length,problems};
 }
 const api={makePlan,auditPlan,inside,residential,_kit:{rect,round,rng,makeWalls,auditPlan,inside,furnish,orientFurniture}};root.CityArchitecture=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

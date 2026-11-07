// Public campuses are planned globally before streaming, so adjacent sectors cannot occupy them.
(function(G){
 const C=G.COG;
 C.CIVIC_TYPES=[
  {kind:'hospital',name:'Hospital City of God',floors:3,color:'#e7eeeb',reserved:'AMBULÂNCIA',spaces:3},
  {kind:'police',name:'Delegacia Central',floors:2,color:'#cdd9e1',reserved:'VIATURA',spaces:3},
  {kind:'military',name:'Batalhão da Cidade',floors:2,color:'#bac3af',reserved:'EXÉRCITO',spaces:4},
  {kind:'cityhall',name:'Prefeitura Municipal',floors:3,color:'#f0e8d5',reserved:'SERVIÇO',spaces:2},
  {kind:'school',name:'Escola Municipal',floors:2,color:'#e8d6b4',reserved:'ESCOLAR',spaces:2},
  // três concessionárias City Motors: centro, bairro residencial e a cidade vizinha
  // Central Logística: empregos de entregador, taxista e gari (frota no pátio)
  {kind:'depot',id:'civic-depot',name:'Central Logística City',floors:1,floorHeight:4.4,color:'#e8e4da',reserved:'FROTA',spaces:0,target:A=>({x:A.urban.x+180,y:A.urban.y+220})},
  {kind:'dealer',id:'civic-dealer-centro',name:'City Motors · Centro',floors:1,floorHeight:4.4,color:'#eef1f3',reserved:'TEST DRIVE',spaces:0,target:A=>({x:A.downtown.x+300,y:A.downtown.y+140})},
  {kind:'dealer',id:'civic-dealer-bairro',name:'City Motors · Zona Norte',floors:1,floorHeight:4.4,color:'#eef1f3',reserved:'TEST DRIVE',spaces:0,target:A=>({x:A.urban.x-420,y:A.urban.y-260})},
  {kind:'dealer',id:'civic-dealer-cidade',name:'City Motors · Litoral',floors:1,floorHeight:4.4,color:'#eef1f3',reserved:'TEST DRIVE',spaces:0,target:A=>A.towns?.[0]?{x:A.towns[0].x+60,y:A.towns[0].y+40}:{x:A.urban.x+520,y:A.urban.y+300}},
  // campus universitário (por último: não muda o lugar dos que já existiam nos saves)
  {kind:'university',id:'civic-university',name:'Universidade City of God',floors:3,color:'#efe7d8',reserved:'',spaces:0,campus:{w:104,d:92},target:A=>({x:A.urban.x-260,y:A.urban.y+180})},
  // estabelecimentos das profissões (careers.mjs): à venda até um formado comprar; um pavimento, mobiliados
  {kind:'vetclinic',id:'biz-vetclinic',name:'Clínica Veterinária',profession:'vet',floors:1,color:'#e8f1ec',business:{w:32,d:34},target:A=>({x:A.urban.x+140,y:A.urban.y+80})},
  {kind:'medclinic',id:'biz-medclinic',name:'Consultório Médico',profession:'medic',floors:1,color:'#eef3f5',business:{w:32,d:34},target:A=>({x:A.urban.x-90,y:A.urban.y+130})},
  {kind:'lawoffice',id:'biz-lawoffice',name:'Escritório de Advocacia',profession:'lawyer',floors:1,color:'#e7e1d6',business:{w:32,d:34},target:A=>({x:A.downtown.x+60,y:A.downtown.y+80})},
  {kind:'autoshop',id:'biz-autoshop',name:'Oficina Mecânica',profession:'mechanic',floors:1,color:'#d9dde0',business:{w:32,d:34},target:A=>({x:A.urban.x+320,y:A.urban.y-120})},
  {kind:'restaurant',id:'biz-restaurant',name:'Restaurante',profession:'chef',floors:1,color:'#f1e2cf',business:{w:32,d:34},target:A=>({x:A.downtown.x-160,y:A.downtown.y+40})},
  {kind:'barbershop',id:'biz-barbershop',name:'Barbearia',profession:'barber',floors:1,color:'#ece6dc',business:{w:32,d:34},target:A=>({x:A.urban.x-60,y:A.urban.y-160})}
 ];
 C.planCivicSites=function(cw,roadDist,water,reserved=[]){
  const sites=[],A=cw.geo.anchors;
  for(const [index,type] of C.CIVIC_TYPES.entries()){
   const landmark=type.target?null:cw.landmarks.find(l=>l.kind===type.kind),target=type.target?type.target(A):landmark||{x:A.urban.x+(index-2)*170,y:A.urban.y-300};
   const choices=[];
   for(const rd of cw.roads){if(['highway','rail'].includes(rd.cls))continue;
    for(let i=1;i<rd.pts.length;i+=3){const a=rd.pts[i-1],b=rd.pts[i];if(Math.abs(a[1]-b[1])>.05)continue;
     const x=a[0],y=a[1]-rd.w/2-3,c=type.campus||type.business,bb=c?[x-c.w/2,y-c.d,x+c.w/2,y]:[x-27,y-64,x+27,y];choices.push({x,y,bb,score:Math.hypot(x-target.x,y-target.y)});
    }
   }
   choices.sort((a,b)=>a.score-b.score);
   const site=choices.find(q=>{
    const b=q.bb;if([...reserved,...sites.map(s=>s.bb)].some(r=>b[0]<r[2]+10&&b[2]>r[0]-10&&b[1]<r[3]+10&&b[3]>r[1]-10))return false;
    for(let y=b[1];y<=b[3];y+=4)for(let x=b[0];x<=b[2];x+=4)if(water(x,y)<1.4||roadDist(x,y)<6)return false;
    return true;
   });
   if(!site)throw Error('No accessible campus for '+type.kind);
   Object.assign(site,type,{id:type.id||'civic-'+type.kind});delete site.target;sites.push(site);
   if(landmark)Object.assign(landmark,{x:site.x,y:site.y-40,r:30});else cw.landmarks.push({name:type.name,kind:type.kind,x:site.x,y:site.y-40,r:30});
  }
  return sites;
 };
})(globalThis);

function civicPlaceSector(S){
 for(const site of world.civicSites||[]){
  const x=site.x,y=site.y-(site.business?17:44);if(x<S.bounds[0]||x>=S.bounds[2]||y<S.bounds[1]||y>=S.bounds[3])continue;
  if(site.campus){civicCampus(S,site);owIndexOwnedLive(S);continue;}
  if(site.business){civicBusiness(S,site);owIndexOwnedLive(S);continue;}
  const fh=site.floorHeight||3.3;
  const H=addHouse({x0:x-23,y0:y-18,x1:x+23,y1:y+18,h:site.floors*fh,nFloors:site.floors,floorHeight:fh,seed:owSeed(S,site.id),roofKind:'flat',frontSide:'S',open:{S:{door:[19]}},civic:true,miaKind:site.kind,bName:site.name});
  H.style={...H.style,plaster:site.color};remodelProperty(H);H.walk=[H.doorPt,[H.doorPt[0],site.y+3]];
  const bb=[x-25,site.y-25,x+25,site.y+2];world.paved.push(bb);
  world.decals.push({kind:'civic-parking',bb,site,paint(g){
   g.fillStyle='#52595c';g.fillRect(bb[0],bb[1],50,27);g.strokeStyle='#e4dfcc';g.lineWidth=.1;
   for(const side of [-1,1])for(let i=0;i<6;i++){const sx=x+side*(6+i*3),sy=site.y-19;g.strokeRect(sx-1.3,sy,2.6,side<0?8.4:5.5);
    if(side<0&&(site.kind==='police'?(i===0||i===2||i===4):site.kind==='military'?i<site.spaces:i===0)){g.fillStyle=site.kind==='hospital'?'#4e9ba0':'#607c9b';g.fillRect(sx-1.1,sy+.2,2.2,7.9);g.save();g.translate(sx,sy+2.8);g.rotate(-Math.PI/2);g.font='bold .55px sans-serif';g.textAlign='center';g.fillStyle='#fff';g.fillText(site.reserved,0,0);g.restore();}
   }
   g.fillStyle='#ddd8c9';g.fillRect(H.doorPt[0]-2,H.doorPt[1],4,site.y+2-H.doorPt[1]);
  }});
  // The reserved left-side bays are persistent parking spaces belonging to
  // this procedurally placed campus. Start invisible/inert until the actual
  // licensed GLB is present; vehicle-webgl activates them once loaded.
  // Keys are stable across streamed sector unload/reload.
  const civicFleetBays={police:3,hospital:1,cityhall:1,school:1};
  const sizes={police:[5.6,2.55,1.85],hospital:[7.25,2.8,2.65],
    cityhall:[5.8,2.65,2.4],school:[8.25,2.85,3.0]};
  const count=civicFleetBays[site.kind]||0;
  for(let i=0;i<count;i++){
   const dims=sizes[site.kind];
   addBox({x:x-6-i*6,y:site.y-16.25,rot:Math.PI/2,
    w:dims[0],d:dims[1],h:dims[2],kind:'parkedcar',
    civicFleetBay:true,civicKind:site.kind,civicSiteId:site.id,civicBayIndex:i,
    vehicleKey:'civic:'+site.id+':'+i,modelId:null,
    fleetHidden:true,solid:true,street:true,
    col:'#f0f0f0',top:'#f0f0f0',side:'#f0f0f0',draw:drawParkedCar});
  }
  // The opposite row stays available for regular civilian parking.
  if(site.kind==='depot'){
   // frota da empresa no pátio (exposição; o veículo do turno é entregue na vaga de saída)
   const FLEET=[['minivan','#f4f4f2'],['minivan','#f4f4f2'],['minivan','#f4f4f2'],['sedan','#f1c40f'],['sedan','#f1c40f'],['pickup','#2e7d32'],['pickup','#2e7d32'],['minivan','#f4f4f2']];
   for(let i=0;i<8;i++){const [m,c]=FLEET[i],sx=i<4?x+7+i*3.2:x-8-(i-4)*3.2,b=addBox({x:sx,y:site.y-15.5,w:4.8,d:1.95,h:1.6,rot:Math.PI/2,kind:'parkedcar',modelId:m,col:c,top:c,side:c,display:true,solid:true,street:true,draw:drawParkedCar});b.vehicleKey='depot:'+i;}
   site.delivery={x:x+18,y:site.y-5,angle:Math.PI};
  }else if(site.kind==='dealer'){
   // pátio de seminovos: carros de verdade em exposição (não dá p/ entrar), virados p/ a rua; vaga de entrega do comprado
   const MODELS=['sedan','suv','hatchback','pickup','coupe','compact','wagon','offroad'],COLS=['#c0392b','#f2f2f0','#1d2b3a','#7f8c8d','#2c6e49','#e1b12c','#2f3640','#5d6d7e'];
   for(let i=0;i<8;i++){const sx=i<4?x+7+i*3.2:x-8-(i-4)*3.2,b=addBox({x:sx,y:site.y-15.5,w:4.6,d:1.9,h:1.5,rot:Math.PI/2,kind:'parkedcar',modelId:MODELS[i],col:COLS[i],top:COLS[i],side:COLS[i],display:true,solid:true,street:true,draw:drawParkedCar});b.vehicleKey='dealer:'+site.id+':'+i;}
   site.delivery={x:x+18,y:site.y-5,angle:Math.PI};
  }else for(let i=0;i<4;i++)miaCar(x+7+i*3,site.y-16,Math.PI/2);
  for(const dx of [-24,24]){world.lamps.push({x:x+dx,y:site.y-8,ax:0,ay:-1});}
  if(site.kind==='military'){
   const [x0,y0,x1,y1]=site.bb,gate=(px,py)=>py>y1-1&&Math.abs(px-H.doorPt[0])<4;
   for(const [a,b] of [[[x0,y0],[x1,y0]],[[x0,y0],[x0,y1]],[[x1,y0],[x1,y1]],[[x0,y1],[x1,y1]]])chainLine(...a,...b,gate,{h:2.3});
  }
  // sem marquise nem pilares na entrada (pedido do jogador); a prefeitura mantém só o coroamento no telhado
  const portico=site.kind==='cityhall';
  if(portico)addBox({x,y:H.y0+6,w:12,d:8,h:1.1,z:H.h,kind:'civic-crown',top:'#d7cfb8',side:site.color,solid:false,house:H,exteriorFixture:true});
  owIndexOwnedLive(S);
 }
}

// ---------- Universidade City of God: campus com dois prédios, quadras, praça e estacionamento ----------
// Coordenadas relativas ao sítio: x = centro da frente, y = linha da calçada (a frente fica ao sul, o campus sobe p/ o norte).
//   prédio central (3 andares: auditórios, salas, laboratórios)  · biblioteca + restaurante universitário (2 andares)
//   quadra de basquete · campo de futsal · quadra de vôlei · praça com chafariz de canteiro, palmeiras e bancos
//   estacionamento de alunos · portal com colunas na entrada
const CAMPUS={W:104,D:92};
function civicCampus(S,site){
 const X=site.x,Y=site.y,P=(dx,dy)=>[X+dx,Y+dy];
 const fh=3.4,[x0,y0,x1,y1]=site.bb;
 world.yards.push([x0,y0,x1,y1]);
 // chão: gramado geral, praça de pedras, caminhos e estacionamento
 const quad=(ax,ay,bx,by)=>[[X+ax,Y+ay],[X+bx,Y+ay],[X+bx,Y+by],[X+ax,Y+by]];
 miaDecal(quad(-52,-92,52,0),'lawn',null);
 miaDecal(quad(-24,-36,24,-6),'plaza',null);world.paved.push([X-24,Y-36,X+24,Y-6]);
 miaDecal(quad(-3,-6,3,0),'walk',null);world.paved.push([X-3,Y-6,X+3,Y]);   // entrada principal
 miaDecal(quad(24,-38,52,-34),'walk',null);miaDecal(quad(-52,-38,-24,-34),'walk',null);   // caminhos laterais
 miaDecal(quad(-3,-68,3,-64),'walk',null);miaDecal(quad(-52,-68,52,-64.5),'walk',null);   // passarela dos fundos (quadras)
 world.paved.push([X-52,Y-68,X+52,Y-64.5],[X-52,Y-38,X+52,Y-34]);
 const lot=[X-50,Y-31,X-28,Y-3];world.paved.push(lot);
 world.decals.push({kind:'campus-lot',bb:lot,paint(g){
  g.fillStyle='#54595b';g.fillRect(lot[0],lot[1],lot[2]-lot[0],lot[3]-lot[1]);g.strokeStyle='#e8e4d4';g.lineWidth=.1;
  for(let i=0;i<9;i++){const sy=lot[1]+1+i*2.9;g.strokeRect(lot[0]+.5,sy,5.2,2.6);g.strokeRect(lot[2]-5.7,sy,5.2,2.6);}
  g.fillStyle='#e8e4d4';g.fillRect((lot[0]+lot[2])/2-.08,lot[1]+1,.16,lot[3]-lot[1]-3);   // faixa central da via
 }});
 for(let i=0;i<9;i++)if((i*7+site.x|0)%3)miaCar(lot[0]+3.1,lot[1]+2.3+i*2.9,0);
 for(let i=0;i<9;i++)if((i*5+site.y|0)%3===1)miaCar(lot[2]-3.1,lot[1]+2.3+i*2.9,Math.PI);
 // prédios (a porta fica no corredor central da planta, de frente p/ a praça)
 const main=addHouse({x0:X-20,y0:Y-64,x1:X+20,y1:Y-38,h:3*fh,nFloors:3,floorHeight:fh,seed:owSeed(S,site.id+':main'),roofKind:'flat',frontSide:'S',open:{S:{door:[19]}},civic:true,miaKind:'university',bName:site.name});
 main.style={...main.style,plaster:'#efe7d8'};remodelProperty(main);main.walk=[main.doorPt,[main.doorPt[0],Y-6]];
 const lib=addHouse({x0:X+27,y0:Y-62,x1:X+49,y1:Y-38,h:2*fh,nFloors:2,floorHeight:fh,seed:owSeed(S,site.id+':lib'),roofKind:'flat',frontSide:'S',open:{S:{door:[10]}},civic:true,miaKind:'campuslib',bName:'Biblioteca e Restaurante Universitário'});
 lib.style={...lib.style,plaster:'#d9cdb7'};remodelProperty(lib);lib.walk=[lib.doorPt,[lib.doorPt[0],Y-34]];
 // coroamento no telhado do prédio central (nome da universidade); sem marquise nem colunas na entrada
 addBox({x:X,y:main.y0+6,w:14,d:8,h:1.2,z:main.h,kind:'civic-crown',top:'#cdbf9f',side:'#efe7d8',solid:false,house:main,exteriorFixture:true});
 // quadras esportivas com alambrado (basquete ao lado do prédio; futsal e vôlei atrás)
 campusCourt(S,X-39,Y-51,'y','basketball');
 campusCourt(S,X-11,Y-79,'x','soccer');
 campusCourt(S,X+33,Y-77,'x','volleyball');
 // arquibancada (bancos) ao lado do futsal e do basquete
 for(let i=0;i<4;i++)addBox({x:X+12.5,y:Y-86+i*2.4,w:.5,d:1.8,h:.85,kind:'hbench',top:'#3d5a80',side:'#2b3f5a'});
 for(let i=0;i<3;i++)addBox({x:X-29.5,y:Y-58+i*3,w:.5,d:1.8,h:.85,kind:'hbench',top:'#3d5a80',side:'#2b3f5a'});
 // praça: canteiro central florido com palmeiras-imperiais, bancos voltados p/ ele, palmeiras nos caminhos e postes
 for(const [dx,dy] of [[-2.2,-21],[2.2,-21],[0,-23.2],[0,-18.8]])miaBush(X+dx,Y+dy,['hibiscus','bougainvillea','croton','hibiscus'][(dx+dy+9)&3]);
 miaPalm(X,Y-21,'royal');
 for(const [dx,dy,r] of [[-6,-21,Math.PI/2],[6,-21,Math.PI/2],[0,-27,0],[0,-15,0],[-14,-12,0],[14,-12,0],[-14,-30,0],[14,-30,0]])addBox({x:X+dx,y:Y+dy,w:1.8,d:.5,h:.85,rot:r,kind:'hbench',top:'#7a5a3c',side:'#4a4f54'});
 for(const dx of [-21,-12,12,21])for(const dy of [-30,-12])miaPalm(X+dx,Y+dy,dx<0?'royal':'coconut');
 for(let dx=-48;dx<=48;dx+=8)if(Math.abs(dx)>6&&(dx<-30||dx>-24))miaPalm(X+dx,Y-1.6,'washington');
 for(let dy=-88;dy<=-8;dy+=10){miaPalm(X-51,Y+dy,'coconut');miaPalm(X+51,Y+dy,'coconut');}
 for(const dx of [26,36,46])for(const dy of [-30,-12])miaBush(X+dx,Y+dy,'seagrape');
 for(const [dx,dy] of [[-22,-8],[22,-8],[-22,-34],[22,-34],[0,-36],[-40,-66],[0,-66],[40,-66],[-50,-36],[50,-36]])world.lamps.push({x:X+dx,y:Y+dy,ax:0,ay:-1});
 S.campus=site;
}
// quadra com piso pintado, alambrado com portão, cestas/traves/rede (como miaCourt, sem exigir o setor inteiro)
function campusCourt(S,cx,cy,along,sport){
 const dims={basketball:[26,15],volleyball:[20,12],soccer:[38,22]},[L,Wd]=dims[sport];
 const w=along==='x'?L:Wd,d=along==='x'?Wd:L,x0=Math.round(cx-w/2),y0=Math.round(cy-d/2),x1=x0+w,y1=y0+d;
 world.yards.push([x0,y0,x1,y1]);world.paved.push([x0-.5,y0-.5,x1+.5,y1+.5]);
 miaDecal([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'court',null,{along,sport});
 const gate=(x,y)=>Math.hypot(x-(along==='x'?cx:x1),y-(along==='x'?y1:cy))<1.2;
 chainLine(x0,y0,x1,y0,gate,{h:3.2});chainLine(x0,y1,x1,y1,gate,{h:3.2});chainLine(x0,y0,x0,y1,gate,{h:3.2});chainLine(x1,y0,x1,y1,gate,{h:3.2});
 if(sport==='basketball')for(const s of [-1,1]){const hx=along==='x'?cx+s*(L/2-1.2):cx,hy=along==='x'?cy:cy+s*(L/2-1.2);addBox({x:hx,y:hy,w:.3,d:.3,h:3.05,top:'#56595c',side:'#3e4144',kind:'hoop',draw:drawHoop,face:along==='x'?[-s,0]:[0,-s]});}
 if(sport==='volleyball')addBox({x:cx,y:cy,w:along==='x'?.08:Wd,d:along==='x'?Wd:.08,h:2.4,kind:'sport-net',solid:false,along,draw:drawSportNet});
 if(sport==='soccer')for(const q of [-1,1])addBox({x:along==='x'?cx+q*(L/2-1.2):cx,y:along==='x'?cy:cy+q*(L/2-1.2),w:.2,d:.2,h:2.45,kind:'sport-goal',solid:false,along,draw:drawSportGoal});
 (S.sports||(S.sports=[])).push({x:cx,y:cy,x0,y0,x1,y1,sport,along});
}

// ---------- estabelecimento de profissão: prédio de um pavimento, calçada, duas vagas, letreiro e jardim ----------
function civicBusiness(S,site){
 const X=site.x,Y=site.y,fh=3.4;
 world.yards.push(site.bb);
 const H=addHouse({x0:X-12,y0:Y-28,x1:X+12,y1:Y-10,h:fh,nFloors:1,floorHeight:fh,seed:owSeed(S,site.id),roofKind:'flat',frontSide:'S',open:{S:{door:[11]}},civic:true,miaKind:site.kind,bName:site.name});
 H.style={...H.style,plaster:site.color};remodelProperty(H);H.walk=[H.doorPt,[H.doorPt[0],Y-1]];H.business=site.profession;site.house=H;
 const q=(ax,ay,bx,by)=>[[X+ax,Y+ay],[X+bx,Y+ay],[X+bx,Y+by],[X+ax,Y+by]];
 miaDecal(q(-16,-34,16,0),'lawn',null);
 miaDecal(q(-3,-10,3,0),'pavers',null);world.paved.push([X-3,Y-10,X+3,Y]);
 const lot=[X+4,Y-9,X+15,Y-1];world.paved.push(lot);
 world.decals.push({kind:'biz-lot',bb:lot,paint(g){g.fillStyle='#55595b';g.fillRect(lot[0],lot[1],lot[2]-lot[0],lot[3]-lot[1]);g.strokeStyle='#ece8da';g.lineWidth=.1;for(let i=0;i<2;i++)g.strokeRect(lot[0]+.6+i*5.2,lot[1]+.6,4.6,6.6);}});
 if(site.kind==='autoshop'){const apron=[X-12,Y-10,X-2,Y];world.paved.push(apron);miaDecal(q(-12,-10,-2,0),'drive',null);}   // rampa do portão da oficina
 // canteiros, palmeiras e postes na frente (sem marquise nem colunas)
 for(const dx of [-10,-6,7,10])miaBush(X+dx,Y-8.5,['hibiscus','croton','bougainvillea','seagrape'][(dx+20)&3]);
 for(const dx of [-14,14])miaPalm(X+dx,Y-2,'royal');
 world.lamps.push({x:X-6,y:Y-1,ax:0,ay:-1},{x:X+6,y:Y-1,ax:0,ay:-1});
}

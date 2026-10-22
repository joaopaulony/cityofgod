
'use strict';
// Procedural isometric vehicles: original 2.5D car surfaces, all camera angles.
const CAR_MODELS=[
 // Parametros individuais obtidos da leitura das referencias, NAO um unico
 // gabarito de cupê pintado com cores diferentes.
 {id:'supercar',name:'Superesportivo roxo',len:4.68,w:2.07,roof:1.43,hood:.84,deck:.95,front:1.59,rear:-1.48,wheel:.37,acc:7.7,max:22,
  cabF:.53,cabB:-1.18,roofF:-.04,roofB:-.93,roofW:.70,noseW:.67,tailW:.95,paint:'#4e2d7a',kind:'wedge',cue:'midEngineVents'},
 {id:'eclipse',name:'Cupê azul 1991',len:4.41,w:1.79,roof:1.68,hood:.91,deck:1.00,front:1.39,rear:-1.39,wheel:.36,acc:6.4,max:19,
  cabF:.51,cabB:-1.27,roofF:-.07,roofB:-.91,roofW:.76,noseW:.93,tailW:.95,paint:'#75a4ac',kind:'hatch',cue:'popUpLamps'},
 {id:'skyline',name:'Cupê japonês 1992',len:4.60,w:1.84,roof:1.67,hood:1.03,deck:1.06,front:1.48,rear:-1.43,wheel:.38,acc:6.8,max:20,
  cabF:.35,cabB:-1.18,roofF:-.02,roofB:-.90,roofW:.72,noseW:.92,tailW:.95,paint:'#30333b',kind:'sport',cue:'rearWing'},
 {id:'mustang',name:'Esportivo americano 1993',len:4.58,w:1.78,roof:1.76,hood:1.04,deck:1.00,front:1.42,rear:-1.44,wheel:.37,acc:7.2,max:21,
  cabF:.32,cabB:-1.31,roofF:-.08,roofB:-.93,roofW:.77,noseW:.97,tailW:1.00,paint:'#b82323',kind:'fastback',cue:'foxbody'},
 {id:'explorer',name:'Utilitário temático 1993',len:4.86,w:2.02,roof:2.13,hood:1.28,deck:1.32,front:1.54,rear:-1.53,wheel:.46,acc:4.9,max:15,
  cabF:.68,cabB:-2.03,roofF:.19,roofB:-1.74,roofW:.83,noseW:.93,tailW:.95,paint:'#be3330',kind:'suv',cue:'jurassic'},
 {id:'daytona',name:'Muscle Daytona 1969',len:5.42,w:1.96,roof:1.58,hood:.94,deck:1.02,front:1.82,rear:-1.84,wheel:.425,acc:7.4,max:21,
  cabF:.31,cabB:-1.27,roofF:-.16,roofB:-1.06,roofW:.76,noseW:.70,tailW:.98,paint:'#512c6b',kind:'aero',cue:'towerWing'},
 {id:'challenger',name:'Muscle de corrida 1970',len:4.88,w:1.98,roof:1.71,hood:1.12,deck:1.12,front:1.60,rear:-1.63,wheel:.41,acc:7.0,max:20,
  cabF:.37,cabB:-1.33,roofF:-.05,roofB:-1.00,roofW:.82,noseW:.96,tailW:.99,paint:'#adc913',kind:'muscle',cue:'number77'},
 {id:'pickup',name:'Picape clássica',len:5.33,w:2.03,roof:1.95,hood:1.29,deck:1.31,front:1.73,rear:-1.71,wheel:.44,acc:4.8,max:16,
  cabF:.52,cabB:-.80,roofF:.14,roofB:-.55,roofW:.83,noseW:.98,tailW:1.00,paint:'#bb5c5e',kind:'pickup',cue:'openBed'},
 {id:'sedan',name:'Sedã clássico',len:4.82,w:1.89,roof:1.79,hood:1.09,deck:1.05,front:1.51,rear:-1.50,wheel:.38,acc:5.7,max:17,
  cabF:.50,cabB:-1.38,roofF:.07,roofB:-1.01,roofW:.83,noseW:.98,tailW:.99,paint:'#e1d4c5',kind:'sedan',cue:'sunroof'}
];
const CAR_REFERENCE_CUES={
 supercar:['wedge','panoramicWindshield','sideIntakes','engineVents'],
 eclipse:['hatch','popUpLamps','blackRoof','continuousRearGlass'],
 skyline:['longHood','sideCut','thinRearWing','angularHeadlamps'],
 mustang:['foxbody','rectangularHeadlamps','fastback','hoodInsert'],
 explorer:['suv','twoToneLivery','roofMarkers','bullBar'],
 daytona:['aeroNose','tallWing','longHood','aeroRear'],
 challenger:['muscle','hoodScoop','race77','sideStripes'],
 pickup:['pickup','openBed','bedRibs','squareFascia'],
 sedan:['sedan','longRearDeck','sunroof','fourDoors']
};
function carModel(b){return CAR_MODELS.find(m=>m.id===b.model)||CAR_MODELS[1];}
function carPoint(b,u,v,z){
 const co=Math.cos(b.rot),si=Math.sin(b.rot);
 return [b.x+co*u-si*v,b.y+si*u+co*v,z];
}
function carProject(b,u,v,z){return proj(...carPoint(b,u,v,z));}
function carFill(g,b,vertices,fill,stroke){
 poly(g,vertices.map(p=>carProject(b,p[0],p[1],p[2])),
 fill,stroke||null,stroke?Math.max(.55,cam.zoom*.009):0);
}
function carLine(g,b,vertices,color,w=.022){
 g.beginPath();vertices.forEach((p,i)=>{
  const q=carProject(b,p[0],p[1],p[2]);
  if(i)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y);
 });
 g.strokeStyle=color;g.lineWidth=Math.max(.55,w*cam.zoom);
 g.lineCap='round';g.lineJoin='round';g.stroke();
}
// Pneumatico REAL de 2.5D: cilindro com duas faces separadas fisicamente
// no eixo lateral do carro, banda de rodagem envolvendo toda a largura,
// ombro arredondado, aro independente, cinco raios e cavidade de paralama.
// Todas as faces usam carProject (mudam corretamente ao girar camera).
// A posicao da roda acompanha a largura LOCAL da carroceria.
// Em superesportivos e no Daytona o nariz afunila bastante: um eixo
// com largura constante deixava a roda oposta completamente solta.
function carWheelMount(m,u,side){
 const L=m.len/2,w=m.w/2;
 let ratio=1;
 if(u>m.cabF){
  ratio=lerp(1,m.noseW,
    clamp((u-m.cabF)/(L-m.cabF),0,1));
 }else if(u<m.cabB){
  ratio=lerp(1,m.tailW,
    clamp((m.cabB-u)/(L+m.cabB),0,1));
 }
 // Centro do pneu levemente dentro do painel, com ombro para fora.
 return side*w*(ratio-.065);
}
function carWheelGeometry(b,u,v,m){
 const r=m.wheel,side=Math.sign(v)||1,
   width=m.id==='pickup'||m.id==='explorer'?.37:m.id==='daytona'?.34:.31,
   sideWall=Math.abs(v),centerZ=r+.012,
   back=side*(sideWall-width*.50),
   front=side*(sideWall+width*.50);
 return {r,width,side,back,front,u,centerZ,
   centerBack:carProject(b,u,back,centerZ),
   centerFront:carProject(b,u,front,centerZ)};
}
function carWheelRing(b,u,v,z,r,n=28){
 return Array.from({length:n},(_,i)=>{
  const t=TAU*i/n;
  return [u+Math.cos(t)*r,v,z+Math.sin(t)*r];
 });
}
function carTire(g,b,u,v,m){
 const geo=carWheelGeometry(b,u,v,m),{r,back,front,centerZ:z}=geo,
   n=28,spin=(b.odometer||0)/r;
 const ring=(v0,rr)=>carWheelRing(b,u,v0,z,rr,n);
 // Cubo traseiro evita a impressao de uma unica elipse sem profundidade.
 carFill(g,b,ring(back,r),'#090c0e','#242b30');
 const outer=ring(back,r),frontOuter=ring(front,r);
 // Banda de rodagem com largura real + sulcos que cruzam o pneu.
 // Quadrilateros segmentados criam um volume cilíndrico completo.
 for(let i=0;i<n;i++){
  const j=(i+1)%n,
    k=(i+Math.floor(spin*7))%7,
    tread=['#12181c','#1b2125','#262b2e','#151a1d',
      '#1c2025','#202529','#13181c'][k];
  carFill(g,b,[outer[i],outer[j],frontOuter[j],frontOuter[i]],tread);
  if(i%3===0){
   const a=TAU*(i+.37)/n,ci=Math.cos(a),si=Math.sin(a);
   carLine(g,b,[
     [u+ci*r*.988,back,z+si*r*.988],
     [u+ci*r*.988,front,z+si*r*.988]],
    'rgba(91,98,104,.45)',.011);
  }
 }
 // Ombro visível de borracha; aro embutido e painel lateral do pneu.
 carFill(g,b,ring(front,r),'#111519','#343b40');
 carFill(g,b,ring(front+geo.side*.009,r*.91),
  '#25292d','#0b1014');
 carFill(g,b,ring(front+geo.side*.013,r*.77),
  '#171e23','#3b4346');
 // Aro de metal espesso, aro de montagem e prato interno em camadas.
 const pV=front+geo.side*.020;
 carFill(g,b,ring(pV,r*.685),'#b8bfc0','#69737a');
 carFill(g,b,ring(pV+geo.side*.008,r*.595),'#ecede8','#747d81');
 carFill(g,b,ring(pV+geo.side*.015,r*.53),'#424b50','#bbc1c4');
 // Raios giram de acordo com o deslocamento real, não o frame.
 for(let i=0;i<5;i++){
  const a=spin+TAU*i/5,
   q=(angle,k)=>[u+Math.cos(angle)*r*k,
       pV+geo.side*.026,z+Math.sin(angle)*r*k];
  carFill(g,b,[q(a-.19,.12),q(a-.13,.51),
    q(a+.13,.51),q(a+.19,.12)],
    i%2===0?'#d8dddd':'#bdc6c8');
  // Entalhe escuro entre os raios.
  carLine(g,b,[q(a+.18,.27),q(a+.19,.49)],
    'rgba(35,44,48,.65)',.010);
 }
 carFill(g,b,ring(pV+geo.side*.033,r*.175),'#777f83');
 const hub=carProject(b,u,pV+geo.side*.047,z);
 g.fillStyle='#c6cccb';g.beginPath();
 g.arc(hub.x,hub.y,Math.max(1,cam.zoom*.053),0,TAU);g.fill();
 g.fillStyle='#60676d';g.beginPath();
 g.arc(hub.x,hub.y,Math.max(.55,cam.zoom*.022),0,TAU);g.fill();
 // Letras/textura na lateral, leves, nao poluem o aro em zoom pequeno.
 for(let i=0;i<12;i++){
  const a=TAU*i/12+spin*.10,rr=r*.85;
  carLine(g,b,[
    [u+Math.cos(a)*rr,pV+.01*geo.side,z+Math.sin(a)*rr],
    [u+Math.cos(a+.036)*rr,pV+.01*geo.side,
      z+Math.sin(a+.036)*rr]],
      'rgba(158,168,171,.22)',.009);
 }
}
function carDrawFender(g,b,u,side,m,C){
 const r=m.wheel,v=carWheelMount(m,u,side)+side*.10,z=r+.012;
 const curve=(a,rr,y=v)=>[u+Math.cos(a)*rr,y,z+Math.sin(a)*rr];
 // A face do paralama passa na frente da parte superior do pneu.
 // Na montagem: carroceria -> roda externa -> aba pintada -> arco escuro.
 const outer=[],inner=[];
 for(let i=0;i<=19;i++){
  const a=.035*Math.PI+i*.93*Math.PI/19;
  outer.push(curve(a,r*1.20,v+side*.015));
  inner.push(curve(a,r*1.005,v+side*.045));
 }
 carFill(g,b,outer.concat(inner.reverse()),C.paint);
 carLine(g,b,inner.slice().reverse(),
   'rgba(12,16,21,.85)',.027);
 // Faixa de reflexo sobre a aba, arredondada como chapa estampada.
 carLine(g,b,outer.slice(3,17),
   'rgba(235,230,219,.26)',.022);
}
// Rectangular inset automotive lenses with an outline instead of
// floating screen-space ellipses. The units remain attached while rotating.
function carLamp(g,b,u,v,z,kind,on){
 const m=carModel(b),isTurn=kind==='turn',front=kind==='front',
  width=isTurn?.135:(m.id==='explorer'||m.id==='pickup'?.30:.27),
  height=isTurn?.083:.125,
  lens=isTurn?'#b97a35':front?'#aec1c8':'#a53840',
  lit=isTurn?'#ffb64b':front?'#fff1cc':'#ff403c',
  face=u>=0?1:-1;
 const quad=[
  [u+face*.021,v-width*.50,z-height*.50],
  [u+face*.021,v+width*.50,z-height*.50],
  [u+face*.021,v+width*.50,z+height*.50],
  [u+face*.021,v-width*.50,z+height*.50]];
 carFill(g,b,quad,on?lit:lens,'#1b242c');
 // Small internal vertical lamp division for glass depth.
 carLine(g,b,[[u+face*.027,v-width*.21,z-height*.39],
   [u+face*.027,v-width*.21,z+height*.37]],
   on?'rgba(255,255,236,.54)':'rgba(252,247,234,.28)',.008);
 if(on){
  const q=carProject(b,u+face*.05,v,z),
   r=Math.max(2.1,cam.zoom*(isTurn?.065:.10)),
   rgb=front?'255,247,214':isTurn?'255,171,48':'255,52,46';
  const grad=g.createRadialGradient(q.x,q.y,0,q.x,q.y,r*6);
  grad.addColorStop(0,'rgba('+rgb+',.53)');
  grad.addColorStop(.24,'rgba('+rgb+',.18)');
  grad.addColorStop(1,'rgba('+rgb+',0)');
  g.fillStyle=grad;g.beginPath();g.arc(q.x,q.y,r*6,0,TAU);g.fill();
 }
}
// Individual surface grammar: segments intentionally depend on model data.
// No one-size sedan chassis or generic cuboid cabins.
function carPanel(g,b,vs,c,edge='rgba(16,23,28,.48)'){
 carFill(g,b,vs,c,edge);
 // Gradiente de esmalte por face (nada de caixas chapadas).
 // Clipping respeita a geometria projetada de cada plano da carroceria.
 if(vs.length<3)return;
 const points=vs.map(q=>carProject(b,q[0],q[1],q[2]));
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),
  x0=Math.min(...xs),x1=Math.max(...xs),
  y0=Math.min(...ys),y1=Math.max(...ys);
 if(x1-x0<1||y1-y0<1)return;
 g.save();g.beginPath();
 points.forEach((p,i)=>{if(i)g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y);});
 g.closePath();g.clip();
 const gloss=g.createLinearGradient(x0,y0,x1,y1);
 gloss.addColorStop(0,'rgba(255,255,249,.12)');
 gloss.addColorStop(.36,'rgba(248,246,236,.035)');
 gloss.addColorStop(.66,'rgba(13,18,23,0)');
 gloss.addColorStop(1,'rgba(7,11,16,.13)');
 g.fillStyle=gloss;g.fillRect(x0,y0,x1-x0,y1-y0);
 g.restore();
}
function carBadge(g,b,u,v,z,r=.055,color='#bcc9c8'){
 const q=carProject(b,u,v,z);
 g.fillStyle=color;g.beginPath();g.ellipse(q.x,q.y,
  Math.max(1,cam.zoom*r),Math.max(.7,cam.zoom*r*.37),0,0,TAU);g.fill();
}
// Inset automotive glass: dark gasket, muted tint and subtle highlights.
// The previous completely opaque light-blue polygons looked like loose panels.
function carWindow(g,b,vs,color='#87a4b0'){
 carFill(g,b,vs,'#131c25','#0d151d');
 if(vs.length!==4)return;
 const mid=vs.reduce((v,p)=>[v[0]+p[0]/4,v[1]+p[1]/4,v[2]+p[2]/4],[0,0,0]);
 const glass=vs.map(p=>[
  lerp(p[0],mid[0],.065),lerp(p[1],mid[1],.078),
  lerp(p[2],mid[2],.078)
 ]);
 carFill(g,b,glass,'#344e5d','rgba(14,23,31,.85)');
 const points=glass.map(q=>carProject(b,q[0],q[1],q[2]));
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const x0=Math.min(...xs),x1=Math.max(...xs),
  y0=Math.min(...ys),y1=Math.max(...ys);
 if(x1-x0<1||y1-y0<1)return;
 g.save();g.beginPath();
 points.forEach((q,i)=>i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y));
 g.closePath();g.clip();
 const grad=g.createLinearGradient(x0,y0,x1,y1);
 grad.addColorStop(0,'rgba(195,223,224,.43)');
 grad.addColorStop(.28,'rgba(103,145,164,.28)');
 grad.addColorStop(.49,'rgba(22,42,60,.10)');
 grad.addColorStop(.72,'rgba(13,29,47,.36)');
 grad.addColorStop(1,'rgba(6,15,30,.50)');
 g.fillStyle=grad;g.fillRect(x0,y0,x1-x0,y1-y0);
 // Narrow reflected strip suggests curved windshield glass, not a white wall.
 g.beginPath();g.moveTo(x0+(x1-x0)*.12,y0-4);
 g.lineTo(x0+(x1-x0)*.28,y0-4);
 g.lineTo(x0+(x1-x0)*.68,y1+4);
 g.lineTo(x0+(x1-x0)*.59,y1+4);
 g.closePath();g.fillStyle='rgba(232,246,247,.055)';g.fill();
 g.restore();
 carLine(g,b,[glass[0],glass[3]],'rgba(219,234,233,.19)',.013);
}
function carWing(g,b,m,kind){
 const L=m.len/2,w=m.w/2;
 if(kind==='daytona'){
  // Extra tall hollow race wing: height and side profiles unique to 1969 Aero.
  const rear=-L+.47,top=2.44;
  for(const side of [-1,1]){
   const v=side*w*.76;
   carPanel(g,b,[[rear-.17,v,1.02],[rear+.01,v,1.02],
     [rear+.25,v,top],[rear+.02,v,top]],'#d8d6d3');
   carLine(g,b,[[rear-.02,v,1.13],[rear+.13,v,top-.11]],
     '#928f93',.027);
  }
  carPanel(g,b,[[rear-.16,-w*.91,top-.03],[rear+.06,-w*.91,top+.06],
    [rear+.06,w*.91,top+.06],[rear-.16,w*.91,top-.03]],
    '#dce1dd','#6e7780');
  carPanel(g,b,[[rear-.16,-w*.91,top-.04],[rear-.16,w*.91,top-.04],
    [rear-.16,w*.91,top-.19],[rear-.16,-w*.91,top-.19]],'#a9b2b5');
 }else{
  const h=kind==='skyline'?.36:kind==='supercar'?.24:.19;
  const rear=-L+.46,z=m.deck+.04;
  for(const side of [-1,1])carLine(g,b,[
   [rear,side*w*.60,z],[rear,side*w*.60,z+h]],
    '#384048',.038);
  carPanel(g,b,[[rear-.19,-w*.78,z+h],[rear+.12,-w*.78,z+h],
    [rear+.12,w*.78,z+h],[rear-.19,w*.78,z+h]],
    kind==='skyline'?'#292d33':'#41444a');
  carLine(g,b,[[rear-.14,-w*.74,z+h+.02],[rear-.14,w*.74,z+h+.02]],
    'rgba(219,226,221,.25)',.015);
 }
}
function carReferenceDecor(g,b,m,C){
 const key=m.id,L=m.len/2,w=m.w/2,H=m.hood,z=m.deck,
  p=(u,v,h)=>[u,v,h];
 if(key==='supercar'){
  // McLaren-F1-like wedge: low nose, panoramic canopy, rear engine vents.
  for(const side of [-1,1]){
   carPanel(g,b,[p(.18,side*w*.84,.92),p(-1.12,side*w*.89,.94),
     p(-.67,side*w*.94,.68)],'#272335');
   carLine(g,b,[p(.30,side*w*.83,.96),p(-.83,side*w*.90,.88)],
     '#8b6dac',.040);
   carPanel(g,b,[p(L-.18,side*w*.87,.57),p(L-.57,side*w*.92,.64),
     p(L-.49,side*w*.92,.83)],'#2f293d');
  }
  for(const side of [-1,1])for(let j=0;j<3;j++){
   const v=side*(w*.28+j*.19);
   carPanel(g,b,[p(-L+.26,v-.055,z+.030),p(-1.02,v-.065,z+.035),
     p(-1.02,v+.065,z+.035),p(-L+.26,v+.055,z+.030)],
     '#171b20','rgba(13,14,21,.56)');
   carLine(g,b,[p(-L+.29,v,z+.042),p(-1.08,v,z+.042)],
    'rgba(141,142,149,.36)',.012);
  }
  for(const side of [-1,1])
   carPanel(g,b,[p(L-.25,side*w*.46,H+.020),p(L-.64,side*w*.56,H+.038),
     p(L-.61,side*w*.76,H+.030)],'#252534');
 }else if(key==='eclipse'){
  // Flush 90s popup headlight lids and iconic dark glass hatch surround.
  for(const side of [-1,1]){
   carPanel(g,b,[p(L-.25,side*w*.42,H+.020),p(L-.76,side*w*.42,H+.035),
     p(L-.79,side*w*.75,H+.025),p(L-.26,side*w*.73,H+.013)],
     '#76a8b0','#4c6d79');
   carLine(g,b,[p(L-.73,side*w*.47,H+.046),p(L-.34,side*w*.47,H+.023)],
     'rgba(39,70,77,.58)',.016);
  }
  carPanel(g,b,[p(-L+.24,-w*.68,m.deck+.045),
    p(m.cabB-.22,-w*.72,m.deck+.05),p(m.cabB-.22,w*.72,m.deck+.05),
    p(-L+.24,w*.68,m.deck+.045)],'#414d55','#26353d');
  carLine(g,b,[p(-L+.33,-w*.65,m.deck+.055),
    p(-L+.33,w*.65,m.deck+.055)],'#1c292d',.035);
 }else if(key==='skyline'){
  // Straight angular 1990s bonnet, split rectangular headlamps and spoiler.
  for(const side of [-1,1]){
   carPanel(g,b,[p(L-.10,side*w*.39,H-.13),p(L-.10,side*w*.77,H-.13),
     p(L-.10,side*w*.77,H-.015),p(L-.10,side*w*.39,H-.015)],
     '#d9e1e0','#3c4549');
   carLine(g,b,[p(L-.34,side*w*.53,H+.02),
     p(m.cabF+.38,side*w*.42,H+.02)],'#454951',.020);
   carLine(g,b,[p(m.cabB+.22,side*w*.97,.74),
     p(m.cabF+.14,side*w*.97,.74)],'#1e2026',.058);
  }
  carWing(g,b,m,'skyline');
 }else if(key==='mustang'){
  // Foxbody front: squared rectangular lamps, inset grill, small center scoop.
  for(const side of [-1,1]){
   carPanel(g,b,[p(L-.10,side*w*.36,.95),p(L-.10,side*w*.79,.95),
     p(L-.10,side*w*.79,1.06),p(L-.10,side*w*.36,1.06)],
     '#c8d1cb','#41484a');
   carPanel(g,b,[p(.78,side*w*.13,H+.012),p(.47,side*w*.12,H+.021),
      p(.47,side*w*.40,H+.023),p(.78,side*w*.36,H+.015)],
      '#282c33');
  }
  carPanel(g,b,[p(L-.055,-w*.30,.93),p(L-.055,w*.30,.93),
     p(L-.055,w*.30,1.02),p(L-.055,-w*.30,1.02)],'#2e3237');
  carLine(g,b,[p(-1.73,-w*.81,z+.04),p(-1.73,w*.81,z+.04)],
     '#a52a2b',.054);
 }else if(key==='explorer'){
  // Red, gold and green safari livery; original triangular torn paint panels.
  // Not using protected park insignia / license plates or logos.
  for(const side of [-1,1]){
   carPanel(g,b,[p(-L+.05,side*w*.999,.54),
     p(L-.13,side*w*.999,.53),p(L-.25,side*w*.995,.94),
     p(-L+.12,side*w*.995,.88)],'#d9b62e',null);
   carPanel(g,b,[p(-L+.05,side*w*1.003,.90),p(L-.20,side*w*1.003,.93),
     p(L-.64,side*w*1.010,1.14),p(-L+.05,side*w*1.01,1.13)],'#398546');
   for(let i=0;i<9;i++){
    const u=-L+.28+i*(m.len-.55)/9;
    const h0=1.09+(.12*(i%3));
    carPanel(g,b,[p(u,side*w*1.015,h0),
      p(u+.20,side*w*1.017,h0-.14),
      p(u+.15,side*w*1.015,h0+.06)],'#b72d2d',null);
   }
   carLine(g,b,[p(-L+.18,side*w*1.02,.76),
      p(L-.28,side*w*1.02,.76)],'#baa640',.035);
  }
  // Roof markers and brush guard.
  for(const side of [-1,0,1])carBadge(g,b,m.roofF+.04,side*w*.34,
    m.roof+.064,.070,'#efcf67');
  for(const v of [-w*.78,w*.78]){
   carLine(g,b,[p(L+.06,v,.41),p(L+.15,v,1.01)],
      '#263038',.065);
  }
  carLine(g,b,[p(L+.15,-w*.83,.58),p(L+.15,w*.83,.58)],
     '#354046',.074);
  for(const side of [-1,1]){
   const rim=[p(-L+.38,side*w*.50,m.roof+.085),
     p(L-.89,side*w*.50,m.roof+.085)];
   carLine(g,b,rim,'#485359',.041);
  }
 }else if(key==='daytona'){
  // Aero nose is extended and pointed, with iconic tall white rear wing.
  carPanel(g,b,[p(m.cabF+.35,-w*.90,H+.035),
    p(L+.07,-w*.25,H-.21),p(L+.07,w*.25,H-.21),
    p(m.cabF+.35,w*.90,H+.035)],C.hi);
  for(const side of [-1,1]){
   carLine(g,b,[p(.80,side*w*.64,H+.023),p(L-.24,side*w*.32,H-.14)],
     'rgba(224,211,230,.26)',.023);
  }
  carWing(g,b,m,'daytona');
 }else if(key==='challenger'){
  // Bright acid-lime race paint with black bonnet stripes, air scoop, 77.
  for(const side of [-1,1])
   carPanel(g,b,[p(m.cabF+.22,side*w*.36,H+.022),p(L-.18,side*w*.36,H-.04),
     p(L-.18,side*w*.53,H-.04),p(m.cabF+.22,side*w*.53,H+.022)],
     '#20282b',null);
  carPanel(g,b,[p(1.04,-w*.22,H+.06),p(1.25,-w*.22,H+.18),
    p(1.25,w*.22,H+.18),p(1.04,w*.22,H+.06)],'#171f24');
  for(const side of [-1,1]){
   const sideV=side*w*1.010;
   carPanel(g,b,[p(-.80,sideV,.77),p(.42,sideV,.77),
      p(.57,sideV,.95),p(-.61,sideV,.95)],'#151b20',null);
   for(let i=0;i<2;i++){
    const u=.03+i*.50;
    carLine(g,b,[p(u,sideV,.80),p(u+.12,sideV,.92)],
       '#e4ecb6',.032);
   }
   // Big '77' is projected from individual stroked segments, no image font.
   const nn=side*w*1.018;
   for(let i=0;i<2;i++){
    const u=-.80+i*.42;
    carLine(g,b,[p(u,nn,1.02),p(u+.29,nn,1.02),
       p(u+.04,nn,.67)],'#202629',.071);
   }
  }
 }else if(key==='pickup'){
  // Open metal bed with lower floor and four continuous internal ribs.
  const a=-L+.18,d=m.cabB-.18,rail=1.31,floor=.90;
  carPanel(g,b,[[a,-w*.84,floor],[d,-w*.84,floor],
      [d,w*.84,floor],[a,w*.84,floor]],'#8c4748');
  for(let i=0;i<8;i++){
   const v=-w*.74+i*w*.205;
   carLine(g,b,[[a,v,floor+.014],[d,v,floor+.014]],
     'rgba(229,160,152,.23)',.020);
  }
  for(const side of [-1,1]){
   const v=side*w;
   carPanel(g,b,[[a,v,floor],[d,v,floor],
      [d,v,rail],[a,v,rail]],C.paint);
   carLine(g,b,[[a,v,rail],[d,v,rail]],C.hi,.043);
   carPanel(g,b,[[a,side*w*.88,floor+.04],[d,side*w*.88,floor+.04],
      [d,side*w*.88,rail-.10],[a,side*w*.88,rail-.10]],C.dark,null);
  }
  carPanel(g,b,[[a,-w,rail],[a,w,rail],[a,w,floor],[a,-w,floor]],
     C.side);
  // Square headlights and chrome grille of 70s American pickup.
  for(const side of [-1,1])
   carPanel(g,b,[[L-.03,side*w*.42,.84],[L-.03,side*w*.75,.84],
      [L-.03,side*w*.75,1.04],[L-.03,side*w*.42,1.04]],
      '#d9ddda','#4a5053');
 }else if(key==='sedan'){
  // 1990s four-door beige sedan with recess and optional glass sunroof.
  carPanel(g,b,[[m.roofB+.10,-w*.43,m.roof+.019],
    [m.roofF-.14,-w*.43,m.roof+.019],
    [m.roofF-.14,w*.43,m.roof+.019],
    [m.roofB+.10,w*.43,m.roof+.019]],'#75878a','#57656a');
  carLine(g,b,[[m.roofF-.14,-w*.42,m.roof+.035],
     [m.roofF-.14,w*.42,m.roof+.035]],'#c4cfca',.020);
  for(const side of [-1,1]){
   carLine(g,b,[[m.cabB+.06,side*w*.99,.62],
      [m.cabB+.06,side*w*.99,m.hood-.17]],
      'rgba(71,65,65,.51)',.021);
   carLine(g,b,[[.16,side*w*.99,.62],[.16,side*w*.99,1.02]],
      'rgba(71,65,65,.51)',.022);
  }
 }
}
function carDraw(g,b,time=0,night=false){
 const m=carModel(b),L=m.len/2,w=m.w/2,
 paint=b.top||m.paint,C={paint,hi:shadeHex(paint,1.12),
 side:shadeHex(paint,.80),dark:shadeHex(paint,.62),
 roof:shadeHex(paint,1.07)},
 front=m.cabF,back=m.cabB,rf=m.roofF,rb=m.roofB,rw=w*m.roofW,
 hood=m.hood,roof=m.roof,deck=m.deck,
 p=(u,v,z)=>[u,v,z],
 farSide=Math.sign(facingCam(-Math.sin(b.rot),Math.cos(b.rot)))||1;
 // Contact shadow sized to this exact body and wheelbase.
 const ground=carProject(b,0,0,.015);
 g.save();g.translate(ground.x+cam.zoom*.05,ground.y+cam.zoom*.08);g.scale(1,TILT);
 const shadow=g.createRadialGradient(0,0,cam.zoom*.32,0,0,cam.zoom*(L+.22));
 shadow.addColorStop(0,'rgba(9,12,15,.42)');
 shadow.addColorStop(1,'rgba(9,12,15,0)');
 g.fillStyle=shadow;g.beginPath();g.arc(0,0,cam.zoom*(L+.22),0,TAU);
 g.fill();g.restore();
 // Em nariz bem afilado, a roda dianteira do lado oposto fica
 // inteiramente escondida pela frente da carroceria. Pintá-la antes do
 // capô deixava um arco negro flutuando FORA do contorno do veículo.
 for(const u of [m.rear,m.front]){
  if(u===m.front&&m.noseW<.84)continue;
  carTire(g,b,u,carWheelMount(m,u,-farSide),m);
 }
 // Each shoulder follows actual model nose/tail taper and deck height.
 for(const side of [-1,1]){
  const v=side*w,frontWidth=v*m.noseW,rearWidth=v*m.tailW;
  carPanel(g,b,[p(-L+.20,rearWidth,.44),p(L-.15,frontWidth,.44),
    p(L-.18,frontWidth,hood-.12),p(front,v,hood+.015),
    p(back,v,deck+.006),p(-L+.16,rearWidth,deck-.12)],
     side===farSide?C.side:C.paint);
  carPanel(g,b,[p(-L+.20,rearWidth,.44),p(L-.16,frontWidth,.44),
    p(L-.12,frontWidth,.53),p(-L+.17,rearWidth,.53)],
     C.dark,null);
  // Os arcos superiores so entram depois da roda visivel;
  // pintar os dois lados aqui deixava um arco preto no ar, sobre o capo.
  carLine(g,b,[p(-L+.28,rearWidth,.59),
     p(front-.12,v,.59),p(L-.30,frontWidth,.59)],
     'rgba(12,16,20,.40)',.019);
  carLine(g,b,[p(back-.13,v,deck+.012),
     p(front+.20,v,hood+.020)],'rgba(247,239,226,.23)',.018);
 }
 // Trapezoidal hood and trunk stations; supercar/Daytona have tapered nose.
 carPanel(g,b,[p(front+.30,-w*.83,hood+.026),
   p(L-.13,-w*m.noseW*.81,hood-.07),
   p(L-.13,w*m.noseW*.81,hood-.07),
   p(front+.30,w*.83,hood+.026)],C.hi);
 carPanel(g,b,[p(-L+.15,-w*m.tailW*.82,deck-.08),
   p(back-.20,-w*.79,deck+.020),
   p(back-.20,w*.79,deck+.020),
   p(-L+.15,w*m.tailW*.82,deck-.08)],C.roof);
 // Upper greenhouse: each car has bespoke A/B/C pillars in world space.
 const wf=[p(front+.29,-w*.75,hood+.10),
   p(front+.29,w*.75,hood+.10),
   p(rf,rw,roof),p(rf,-rw,roof)];
 carWindow(g,b,wf,m.id==='supercar'?'#9cb4c5':'#8daabd');
 const rearGlass=[p(rb,-rw,roof),p(rb,rw,roof),
   p(back-.25,w*.72,deck+.11),
   p(back-.25,-w*.72,deck+.11)];
 carWindow(g,b,rearGlass,m.id==='eclipse'?'#344d58':'#658093');
 // Canvas shape of the roof differs per car (long SUV, black Eclipse etc.).
 carPanel(g,b,[p(rb,-rw,roof),p(rf,-rw,roof),
     p(rf,rw,roof),p(rb,rw,roof)],
   m.id==='eclipse'?'#21262c':C.roof);
 carLine(g,b,[p(front+.29,-w*.67,hood+.11),
    p(front+.15,-w*.12,hood+.23)],'#384c55',.028);
 carLine(g,b,[p(front+.29,w*.67,hood+.11),
    p(front+.15,w*.12,hood+.23)],'#384c55',.028);
 for(const side of [-1,1]){
  const v=side*w*.93,rv=side*rw;
  carPanel(g,b,[p(back-.13,v,deck+.03),
    p(front+.18,v,hood+.03),p(rf,rv,roof),p(rb,rv,roof)],
    side===farSide?C.side:C.paint);
  const split=lerp(back,front,m.id==='explorer'?.59:
    m.id==='sedan'?.52:m.id==='pickup'?.20:.46);
  const forwardWindow=[p(split+.04,v,hood+.155),
     p(front+.10,v,hood+.145),p(rf-.08,rv,roof-.095),
     p(split-.05,rv,roof-.14)];
  carWindow(g,b,forwardWindow,'#8eafc0');
  if(m.id!=='pickup'&&m.id!=='supercar'){
   carWindow(g,b,[p(back-.055,v,deck+.14),
     p(split-.08,v,hood+.14),p(split-.12,rv,roof-.14),
     p(rb+.07,rv,roof-.12)],
      m.id==='eclipse'?'#819fac':'#688b9b');
   carLine(g,b,[p(split-.055,v,hood+.10),
     p(split-.10,rv,roof-.11)],'#1b272e',.052);
  }
  if(m.id==='supercar'){
   carWindow(g,b,[p(back-.10,v,deck+.14),
      p(split-.07,v,hood+.14),p(split-.18,rv,roof-.14),
      p(rb+.07,rv,roof-.12)],'#85a3b1');
  }
  carLine(g,b,[p(front+.20,v,hood-.09),
     p(front+.20,v,.60)],'rgba(35,35,37,.42)',.018);
  const handle=carProject(b,lerp(back,front,.40),
     side*(w*.995),hood-.20);
  g.fillStyle='#2c3135';
  g.fillRect(handle.x-1.4,handle.y,Math.max(3,cam.zoom*.095),
    Math.max(.8,cam.zoom*.019));
  const mount=[front+.26,side*w*.89,hood+.145],
    mirrorWorld=[front+.34,side*(w+.045),hood+.20];
  // Stalk visibly anchors the mirror to the door (no detached dots).
  carLine(g,b,[mount,mirrorWorld],C.dark,.036);
  const mirror=carProject(b,...mirrorWorld);
  g.fillStyle=C.dark;g.beginPath();g.ellipse(mirror.x,mirror.y,
    Math.max(1.3,cam.zoom*.075),Math.max(.8,cam.zoom*.046),-.2,0,TAU);
  g.fill();
  g.strokeStyle='rgba(213,225,225,.37)';g.lineWidth=.65;g.stroke();
 }
 // Specific front/rear fascia; lights are small with borders (not car-sized globes).
 const nose=L-.06,tail=-L+.06;
 carPanel(g,b,[p(nose,-w*m.noseW*.74,.53),
   p(nose,w*m.noseW*.74,.53),
   p(nose,w*m.noseW*.69,.79),
   p(nose,-w*m.noseW*.69,.79)],C.dark);
 carPanel(g,b,[p(nose+.018,-w*.41,.60),p(nose+.018,w*.41,.60),
   p(nose+.018,w*.41,.70),p(nose+.018,-w*.41,.70)],
   '#303d44','#111b20');
 for(let i=0;i<6;i++){
  const v=-w*.31+i*w*.125;
  carLine(g,b,[p(nose+.019,v,.62),p(nose+.019,v+.04,.62)],
    '#a9b0b1',.010);
 }
 carLine(g,b,[p(nose,-w*m.noseW*.70,.49),
    p(nose,w*m.noseW*.70,.49)],'#a9aaad',.058);
 carLine(g,b,[p(tail,-w*.72,.52),p(tail,w*.72,.52)],
    '#8d9194',.055);
 for(const side of [-1,1]){
  const v=side*w*.68;
  carLamp(g,b,nose,v,hood-.21,'front',b.headlights);
  carLamp(g,b,tail,v,deck-.24,'rear',b.headlights||b.brake);
  const blink=Math.floor(time*2.8)%2===0;
  // Pisca fica DENTRO da quina chanfrada, não fora do carro.
  carLamp(g,b,nose-.045,side*w*m.noseW*.57,.73,'turn',
    blink&&(b.hazards||b.indicator===side));
  carLamp(g,b,tail+.045,side*w*m.tailW*.58,.73,'turn',
    blink&&(b.hazards||b.indicator===side));
 }
 carReferenceDecor(g,b,m,C);
 // Pneus no primeiro plano sobrepoem o asfalto, mas os arcos de
 // carroceria os recobrem parcialmente: rodas realmente encaixadas.
 for(const u of [m.rear,m.front]){
  carTire(g,b,u,carWheelMount(m,u,farSide),m);
  carDrawFender(g,b,u,farSide,m,C);
 }
 if(b.engine&&Math.abs(b.speed)>.32){
  const tailp=carProject(b,-L-.13,w*.46,.51);
  for(let i=0;i<3;i++){
   const t=((time*1.5+i*.35+b.seed*.001)%1+1)%1,
     x=tailp.x+Math.cos(b.rot+Math.PI)*t*cam.zoom*.34,
     y=tailp.y-t*cam.zoom*.28,r=Math.max(2,cam.zoom*(.05+t*.10));
   const grad=g.createRadialGradient(x,y,0,x,y,r);
   grad.addColorStop(0,'rgba(178,182,177,'+(.13*(1-t))+')');
   grad.addColorStop(1,'rgba(178,182,177,0)');
   g.fillStyle=grad;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
  }
 }
}
function carLightSpots(b){
 const m=carModel(b),L=m.len/2;
 return [-.38,.38].map(v=>{
  const p=carPoint(b,L+2.45,v,0);
  return {x:p[0],y:p[1],nx:Math.cos(b.rot),ny:Math.sin(b.rot)};
 });
}
function carNightLamps(g,t){
 for(const b of vehicleSystem.cars){
  if(!b.headlights&&!b.brake&&!b.hazards&&!b.indicator)continue;
  const p=carProject(b,0,0,0),m=carModel(b),L=m.len/2,w=m.w/2;
  if(p.x<-cam.zoom*6||p.x>cam.W+cam.zoom*6||
     p.y<-cam.zoom*6||p.y>cam.H+cam.zoom*6)continue;
  for(const side of [-1,1]){
   if(b.headlights)carLamp(g,b,L-.05,side*w*.71,m.hood-.20,'front',true);
   if(b.headlights||b.brake)carLamp(g,b,-L+.05,side*w*.71,m.hood-.20,'rear',true);
   if((b.hazards||b.indicator===side)&&Math.floor(t*2.8)%2===0){
    carLamp(g,b,L-.10,side*w*m.noseW*.57,.71,'turn',true);
    carLamp(g,b,-L+.10,side*w*m.tailW*.58,.77,'turn',true);
   }
  }
 }
}

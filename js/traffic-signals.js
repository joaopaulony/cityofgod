// Semaforos urbanos desenhados em geometria 3D projetada no Canvas 2D.
// Cabecas paralelas a faixa de parada, NAO voltadas artificialmente para a camera.
'use strict';
const SIGNAL_CYCLE=54;
function trafficPhase(seconds){
 const t=((seconds%SIGNAL_CYCLE)+SIGNAL_CYCLE)%SIGNAL_CYCLE;
 const main=t<21?'green':t<24?'yellow':'red';
 const branch=t>=25&&t<42?'green':t>=42&&t<45?'yellow':'red';
 // Travessia EXCLUSIVA, com as duas direcoes vermelhas, sem conflito de curva.
 const walk=t>=47&&t<53;
 return {main,branch,pedestrianMain:walk,pedestrianBranch:walk,
  pedestrian:walk?'walk':t>=45&&t<47?'wait':'stop',
  countdown:walk?Math.ceil(53-t):0,
  allRed:t>=45||t>=24&&t<25};
}
function signalState(signal,seconds){return trafficPhase(seconds)[signal.group];}
function trafficSignalGeometry(signal){
 const arm={x:signal.ix,y:signal.iy}; // normal apontando DO passeio AO meio da pista
 const span=signal.armSpan||4.7;
 const tip={x:signal.x+arm.x*span,y:signal.y+arm.y*span,z:signal.armHeight||4.14};
 const dir={x:signal.ax,y:signal.ay}; // SENTIDO em que os carros avancam
 const face={x:-dir.x,y:-dir.y}; // PARA os carros QUE SE APROXIMAM, nao para a camera
 const pedFront={x:-arm.x,y:-arm.y}; // pedestre espera no passeio
 return {tip,face,pedFront,span,arm};
}
function generateTrafficSignals(){
 world.trafficSignals=[];
 const J=world.junction;if(!J)return;
 for(const [index,road] of world.roads.entries()){
  const pts=road.pts;let center=0,closest=Infinity;
  pts.forEach((p,i)=>{
   const d=Math.hypot(p.x-J.x,p.y-J.y);
   if(d<closest){closest=d;center=i;}
  });
  const group=road.branch?'branch':'main';
  for(const direction of [-1,1]){
   const candidates=[];
   for(let k=8;k<29;k+=2){
    const i=center+direction*k;if(i<6||i>=pts.length-6)continue;
    const p=pts[i],d=Math.hypot(p.x-J.x,p.y-J.y);
    if(d<5.4||d>13.5)continue;
    const side=direction>0?-1:1;
    const x=p.x+p.nx*(ROAD_W+.95)*side,
      y=p.y+p.ny*(ROAD_W+.95)*side;
    if(x<4||y<4||x>MAP-4||y>MAP-4)continue;
    if(pondVal(x,y)<1.35||world.blocked(x,y,.15))continue;
    if(world.lamps.some(l=>Math.hypot(l.x-x,l.y-y)<2.3))continue;
    candidates.push({x,y,p,d,side});
   }
   candidates.sort((a,b)=>Math.abs(a.d-8)-Math.abs(b.d-8));
   if(!candidates.length)continue;
   const q=candidates[0];
   if(world.trafficSignals.some(s=>Math.hypot(s.x-q.x,s.y-q.y)<4))continue;
   const toward=direction<0?1:-1;
   const signal={
    id:'signal-'+index+'-'+(direction>0?'b':'a'),
    x:q.x,y:q.y,ax:q.p.tx*toward,ay:q.p.ty*toward,
    ix:-q.p.nx*q.side,iy:-q.p.ny*q.side,
    armSpan:ROAD_W+.95,armHeight:4.14,
    group,direction,
    crossing:{x:q.p.x,y:q.p.y},
    poleHeight:4.14,headHeight:3.45
   };
   world.trafficSignals.push(signal);
   world.circles.push({x:signal.x,y:signal.y,r:.15,h:4.14,
     kind:'trafficSignal',ref:signal});
  }
 }
}
// Visibilidade calculada no MUNDO. Girar a camera nunca reorienta luzes.
function trafficHeadView(front,angle){
 const d=front.x*Math.sin(angle)+front.y*Math.cos(angle);
 return d>.20?'front':d<-.20?'back':'side';
}
function trafficHeadSites(signal){
 const g=trafficSignalGeometry(signal);
 return [.53,1].map(fraction=>({
  x:signal.x+g.arm.x*g.span*fraction,
  y:signal.y+g.arm.y*g.span*fraction,
  fraction
 }));
}
const trafficInk='#141c22';
const rgbLamp={red:'#f34e42',yellow:'#ffc946',green:'#4de18c'};
const darkLamp={red:'#4e2928',yellow:'#4d4329',green:'#214536'};
function signalFacePoint(x,y,z,side,front,u,offset=0){
 return proj(x+side.x*u+front.x*offset,y+side.y*u+front.y*offset,z);
}
function drawSignalHousing(g,site,front,width,height,centerZ){
 const side={x:-front.y,y:front.x},half=width/2,
  low=centerZ-height/2,high=centerZ+height/2;
 const point=(u,z,off=.115)=>signalFacePoint(site.x,site.y,z,side,front,u,off);
 const near=[point(-half,low),point(half,low),point(half,high),point(-half,high)];
 const far=[point(-half,low,-.155),point(half,low,-.155),
  point(half,high,-.155),point(-half,high,-.155)];
 const view=trafficHeadView(front,cam.ang);
 const frontVisible=view==='front',backVisible=view==='back';
 if(frontVisible){
  poly(g,far,'#455159','#172126',.8);
  poly(g,[far[0],near[0],near[3],far[3]],'#35424b','#182125',.9);
  poly(g,[far[1],near[1],near[2],far[2]],'#3a444b','#182125',.9);
  poly(g,[far[3],far[2],near[2],near[3]],'#6a767e','#172126',.9);
  poly(g,near,'#1d272d','#0a1116',1.5);
 }else{
  poly(g,near,'#273238','#121a1f',1);
  poly(g,[near[0],far[0],far[3],near[3]],'#475159','#171f24',1);
  poly(g,[near[1],far[1],far[2],near[2]],'#3e4a51','#171f24',1);
  poly(g,[near[3],near[2],far[2],far[3]],'#65727a','#161f24',1);
  if(backVisible){
   poly(g,far,'#465158','#1d262c',1.1);
   const plate=point(0,centerZ,-.165);
   g.fillStyle='#829199';
   g.fillRect(plate.x-2,plate.y-2,4,4);
  }
 }
 return {side,point,frontVisible,view,quad:near};
}
function drawVehicleSignalHead(g,signal,seconds,night,site){
 const geo=trafficSignalGeometry(signal);
 const front=geo.face;
 const center=signal.headHeight,hw=.46,hh=1.21;
 const obj=drawSignalHousing(g,site,front,hw,hh,center);
 if(!obj.frontVisible)return;
 const state=signalState(signal,seconds);
 const colors=['red','yellow','green'];
 // Dimensao em tela acompanha orientacao da fachada verdadeira.
 // Face de lado nunca desenha circulos flutuantes no espaco.
 const side={x:-front.y,y:front.x};
 const projectedSide=Math.hypot(
  cam.cos*side.x-cam.sin*side.y,
  (cam.sin*side.x+cam.cos*side.y)*TILT);
 const lensX=Math.max(1.0,cam.zoom*.125*projectedSide);
 const lensY=Math.max(2.2,cam.zoom*.118);
 const p=obj.point;
 colors.forEach((name,i)=>{
  const z=center+.36-i*.37;
  const pos=p(0,z,.138),active=state===name;
  g.fillStyle='#0b151a';g.beginPath();
  g.ellipse(pos.x,pos.y,lensX*1.21,lensY*1.10,0,0,TAU);g.fill();
  const ring=g.createLinearGradient(pos.x-lensX,pos.y-lensY,
    pos.x+lensX,pos.y+lensY);
  ring.addColorStop(0,active?'#283638':'#141f23');
  ring.addColorStop(1,'#091217');
  g.strokeStyle=ring;g.lineWidth=Math.max(.8,cam.zoom*.023);
  g.beginPath();g.ellipse(pos.x,pos.y,lensX*1.12,lensY*1.04,0,0,TAU);g.stroke();
  const glass=g.createRadialGradient(pos.x-lensX*.26,pos.y-lensY*.28,1,
    pos.x,pos.y,Math.max(lensX,lensY)*1.3);
  glass.addColorStop(0,active?'#f1ece0':'#354448');
  glass.addColorStop(.28,active?rgbLamp[name]:darkLamp[name]);
  glass.addColorStop(1,active?rgbLamp[name]:'#131b20');
  g.fillStyle=glass;g.beginPath();
  g.ellipse(pos.x,pos.y,lensX,lensY,0,0,TAU);g.fill();
  // Sombreiro de aluminio projetado para fora da fachada, como no modelo.
  const hood=cam.zoom*.047;
  g.fillStyle='#101a20';g.strokeStyle='#38454b';
  g.beginPath();g.moveTo(pos.x-lensX*1.14,pos.y-lensY*.35);
  g.quadraticCurveTo(pos.x-lensX*.84,pos.y-lensY-hood,
    pos.x,pos.y-lensY-hood);
  g.quadraticCurveTo(pos.x+lensX*.84,pos.y-lensY-hood,
    pos.x+lensX*1.14,pos.y-lensY*.35);
  g.stroke();g.lineWidth=1;g.fill();
  if(active&&night){
   const tint=name==='red'?'255,65,50':name==='yellow'?'255,210,76':'75,236,136';
   const glow=g.createRadialGradient(pos.x,pos.y,0,
    pos.x,pos.y,lensY*3.1);
   glow.addColorStop(0,'rgba('+tint+',.35)');
   glow.addColorStop(1,'rgba('+tint+',0)');
   g.save();g.globalCompositeOperation='screen';g.fillStyle=glow;
   g.fillRect(pos.x-lensY*3.1,pos.y-lensY*3.1,lensY*6.2,lensY*6.2);
   g.restore();
  }
 });
}
function drawPedestrianIcon(g,pt,walk,size,active=true){
 // Mesmos simbolos de travessia do exemplo: PEDESTRE VERMELHO PARADO
 // em cima e PEDESTRE VERDE CAMINHANDO embaixo. Nunca quadrados abstratos.
 const color=walk?(active?'#69f6ad':'#244b3b'):
   (active?'#fc665b':'#542725');
 const width=Math.max(.8,size*.17);
 g.save();g.lineCap='round';g.lineJoin='round';g.strokeStyle=color;
 g.lineWidth=width;g.fillStyle=color;
 g.beginPath();g.arc(pt.x,pt.y-size*.32,size*.11,0,TAU);g.fill();
 g.beginPath();g.moveTo(pt.x,pt.y-size*.17);
 if(walk){
  g.lineTo(pt.x-size*.11,pt.y+size*.025);
  g.lineTo(pt.x+size*.19,pt.y+size*.23);
  g.moveTo(pt.x-size*.11,pt.y+size*.025);
  g.lineTo(pt.x-size*.25,pt.y+size*.28);
  g.moveTo(pt.x-size*.055,pt.y-size*.13);
  g.lineTo(pt.x-size*.23,pt.y+size*.015);
  g.moveTo(pt.x,pt.y-size*.13);
  g.lineTo(pt.x+size*.21,pt.y-size*.055);
 }else{
  g.lineTo(pt.x,pt.y+size*.085);
  g.moveTo(pt.x,pt.y+size*.025);
  g.lineTo(pt.x-size*.14,pt.y+size*.29);
  g.moveTo(pt.x,pt.y+size*.025);
  g.lineTo(pt.x+size*.14,pt.y+size*.29);
  g.moveTo(pt.x,pt.y-size*.13);
  g.lineTo(pt.x-size*.21,pt.y+size*.02);
  g.moveTo(pt.x,pt.y-size*.13);
  g.lineTo(pt.x+size*.21,pt.y+size*.02);
 }
 g.stroke();g.restore();
}
function drawPedestrianSignalHead(g,signal,seconds){
 const geo=trafficSignalGeometry(signal),state=trafficPhase(seconds);
 const walk=state.pedestrian==='walk';
 const centerZ=2.35;
 // A mesma cabeca orientada para o pedestre que espera na calcada,
 // independentemente da orientacao da camera.
 const obj=drawSignalHousing(g,signal,geo.pedFront,.55,.86,centerZ);
 if(!obj.frontVisible)return;
 const sz=Math.max(7,cam.zoom*.205);
 const top=obj.point(0,centerZ+.19,.14);
 const lower=obj.point(0,centerZ-.12,.14);
 for(const [pt,walking,on] of [[top,false,!walk],[lower,true,walk]]){
  g.fillStyle='#081216';g.strokeStyle='#354449';g.lineWidth=.7;
  g.beginPath();g.roundRect(pt.x-sz*.45,pt.y-sz*.47,
    sz*.9,sz*.79,Math.max(1,sz*.09));g.fill();g.stroke();
  drawPedestrianIcon(g,pt,walking,sz*.86,on);
 }
 if(walk&&state.countdown>0){
  const low=obj.point(0,centerZ-.335,.15);
  g.fillStyle='#77edb4';
  g.font='bold '+Math.max(6,cam.zoom*.13)+'px monospace';
  g.textAlign='center';
  g.fillText(String(state.countdown).padStart(2,'0'),low.x,low.y+2);
 }
}
function drawTrafficSignal(g,signal,seconds,night){
 const geo=trafficSignalGeometry(signal),base=proj(signal.x,signal.y,0),
  foot=proj(signal.x,signal.y,.18),bend=proj(signal.x,signal.y,signal.armHeight),
  tip=proj(geo.tip.x,geo.tip.y,signal.armHeight);
 const w=Math.max(2,cam.zoom*.086);
 g.save();g.lineCap='round';g.lineJoin='round';
 // Sapata com quatro chumbadores
 g.fillStyle='rgba(9,16,18,.29)';g.beginPath();
 g.ellipse(base.x+3,base.y+2,w*2.1,w*.75,-.1,0,TAU);g.fill();
 poly(g,[[base.x-w,base.y],[base.x+w,base.y],
  [foot.x+w*.80,foot.y],[foot.x-w*.80,foot.y]],
  '#828885','#2b3032',1);
 for(const k of [-.6,.6]){
  g.fillStyle='#22282c';g.beginPath();
  g.arc(base.x+k*w,base.y,Math.max(.7,w*.17),0,TAU);g.fill();
 }
 // Mastro galvanizado reto + travessa horizontal em "L" para MEIO da pista.
 const drawBeam=(color,sz,offset=0)=>{
  g.strokeStyle=color;g.lineWidth=sz;g.beginPath();
  g.moveTo(foot.x+offset,foot.y);
  g.lineTo(bend.x+offset,bend.y);
  g.lineTo(tip.x+offset,tip.y);g.stroke();
 };
 drawBeam('#141d23',w+3);drawBeam('#4c5962',w);
 drawBeam('rgba(186,206,208,.58)',w*.22,-w*.25);
 // Juntas e parafusos no cotovelo, brace entre o mastro e o braço.
 const brace=proj(signal.x+geo.arm.x*.72,signal.y+geo.arm.y*.72,signal.armHeight-.02);
 g.strokeStyle='#273239';g.lineWidth=Math.max(1,w*.34);
 g.beginPath();g.moveTo(bend.x,bend.y+w*1.15);
 g.lineTo(brace.x,brace.y);g.stroke();
 g.fillStyle='#839095';g.beginPath();g.arc(bend.x,bend.y,w*.44,0,TAU);g.fill();
 // Duas cabecas de veiculos suspensas na faixa, ambas recebem as
 // mesmas fases; jamais viram a luz de frente para a camera.
 for(const site of trafficHeadSites(signal)){
  const start=proj(site.x,site.y,signal.armHeight);
  const mount=proj(site.x,site.y,signal.headHeight+.66);
  g.strokeStyle='#242c30';g.lineWidth=Math.max(1,w*.50);
  g.beginPath();g.moveTo(start.x,start.y);g.lineTo(mount.x,mount.y);g.stroke();
 }
 // Quadro de inspeção / conduíte de sinalização.
 const hatch=proj(signal.x,signal.y,1.24);
 g.fillStyle='#222a2d';g.fillRect(hatch.x-w*.33,hatch.y-w*.6,w*.66,w*1.22);
 g.strokeStyle='#8e999d';g.lineWidth=.7;
 g.strokeRect(hatch.x-w*.33,hatch.y-w*.6,w*.66,w*1.22);
 for(const site of trafficHeadSites(signal))
  drawVehicleSignalHead(g,signal,seconds,night,site);
 drawPedestrianSignalHead(g,signal,seconds);
 g.restore();
}

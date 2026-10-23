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
const trafficInk='#141c22';
const rgbLamp={red:'#f34e42',yellow:'#ffc946',green:'#4de18c'};
const darkLamp={red:'#4e2928',yellow:'#4d4329',green:'#214536'};
function signalFacePoint(x,y,z,side,front,u,offset=0){
 return proj(x+side.x*u+front.x*offset,y+side.y*u+front.y*offset,z);
}
function drawSignalHousing(g,site,front,width,height,centerZ){
 const side={x:-front.y,y:front.x};
 const half=width/2,low=centerZ-height/2,high=centerZ+height/2;
 const point=(u,z,off=.095)=>signalFacePoint(site.x,site.y,z,side,front,u,off);
 const q=[point(-half,low),point(half,low),point(half,high),point(-half,high)];
 const behind=[
  point(-half,low,-.14),point(half,low,-.14),
  point(half,high,-.14),point(-half,high,-.14)
 ];
 const litSide=facingCam(front.x,front.y)>-.05;
 // Corpo real em perspectiva: frente/lateral/pequena cobertura com volume.
 poly(g,[behind[0],q[0],q[3],behind[3]],'#354047','#13181d',.85);
 poly(g,[behind[1],q[1],q[2],behind[2]],'#38454b','#13181d',.85);
 poly(g,[behind[3],behind[2],q[2],q[3]],'#566169','#11181c',.85);
 poly(g,q,litSide?'#202a30':'#455059','#0c1317',1.5);
 return {side,point,frontVisible:litSide,quad:q};
}
function drawVehicleSignalHead(g,signal,seconds,night){
 const geo=trafficSignalGeometry(signal);
 const site={x:geo.tip.x,y:geo.tip.y},front=geo.face;
 const center=signal.headHeight,hw=.46,hh=1.21;
 const obj=drawSignalHousing(g,site,front,hw,hh,center);
 if(!obj.frontVisible){
  // Costas de chapa, etiqueta e fixacoes: nunca luzes na direcao contraria.
  const c=obj.point(0,center,-.02);
  g.fillStyle='#88979d';g.fillRect(c.x-3,c.y-2,6,3);
  return;
 }
 const state=signalState(signal,seconds);
 const colors=['red','yellow','green'];
 const lensR=Math.max(2.2,cam.zoom*.124);
 const p=obj.point;
 colors.forEach((name,i)=>{
  const z=center+.36-i*.37;
  const pos=p(0,z,.125),active=state===name;
  const sh=cam.zoom*.028;
  // Placa anti-reflexo, lente concava e sombreiro, calculados em tela.
  g.fillStyle='#0c1215';g.beginPath();g.ellipse(pos.x,pos.y,
    lensR*1.24,lensR*1.07,0,0,TAU);g.fill();
  g.fillStyle=active?rgbLamp[name]:darkLamp[name];
  g.beginPath();g.ellipse(pos.x,pos.y,lensR,lensR*.92,0,0,TAU);g.fill();
  g.strokeStyle='#070d10';g.lineWidth=Math.max(1,lensR*.28);
  g.beginPath();g.arc(pos.x,pos.y,lensR*1.10,Math.PI*1.10,Math.PI*1.91);g.stroke();
  g.fillStyle=active?'rgba(255,255,246,.65)':'rgba(166,186,180,.10)';
  g.beginPath();g.ellipse(pos.x-lensR*.24,pos.y-lensR*.25,
    lensR*.25,lensR*.13,-.5,0,TAU);g.fill();
  // Metal de sombreamento acima de cada lente
  g.strokeStyle='#101a1e';g.lineWidth=Math.max(1,lensR*.20);
  g.beginPath();g.moveTo(pos.x-lensR*1.12,pos.y-lensR*.25);
  g.quadraticCurveTo(pos.x,pos.y-lensR*1.45,
    pos.x+lensR*1.12,pos.y-lensR*.25);g.stroke();
  if(active&&night){
   const glow=g.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,lensR*4);
   const tint=name==='red'?'255,65,50':name==='yellow'?'255,216,70':'71,246,139';
   glow.addColorStop(0,'rgba('+tint+',.30)');
   glow.addColorStop(1,'rgba('+tint+',0)');
   g.save();g.globalCompositeOperation='screen';
   g.fillStyle=glow;g.fillRect(pos.x-lensR*4,pos.y-lensR*4,lensR*8,lensR*8);
   g.restore();
  }
  if(i===0){
   const cap=p(0,center+hh*.53,.13);
   g.strokeStyle='#a9b2b3';g.lineWidth=sh;
   g.beginPath();g.moveTo(cap.x-lensR*.45,cap.y-1);
   g.lineTo(cap.x+lensR*.45,cap.y-1);g.stroke();
  }
 });
}
function drawPedestrianIcon(g,pt,walk,size){
 // Pictograma humano construido de cabeca, tronco, bracos e pernas.
 const color=walk?'#73f1b6':'#ff6a5f';
 const w=Math.max(1,size*.17);
 g.lineCap='round';g.lineJoin='round';g.strokeStyle=color;g.lineWidth=w;
 g.fillStyle=color;g.beginPath();g.arc(pt.x,pt.y-size*.32,size*.11,0,TAU);g.fill();
 g.beginPath();g.moveTo(pt.x,pt.y-size*.17);
 if(walk){
   g.lineTo(pt.x-size*.10,pt.y+size*.04);
   g.lineTo(pt.x+size*.20,pt.y+size*.21);
   g.moveTo(pt.x-size*.10,pt.y+size*.04);
   g.lineTo(pt.x-size*.26,pt.y+size*.29);
   g.moveTo(pt.x-size*.04,pt.y-size*.12);
   g.lineTo(pt.x-size*.23,pt.y+size*.01);
   g.moveTo(pt.x,pt.y-size*.12);
   g.lineTo(pt.x+size*.21,pt.y-size*.05);
 }else{
   g.lineTo(pt.x,pt.y+size*.08);
   g.moveTo(pt.x,pt.y+size*.02);g.lineTo(pt.x-size*.14,pt.y+size*.3);
   g.moveTo(pt.x,pt.y+size*.02);g.lineTo(pt.x+size*.14,pt.y+size*.3);
   g.moveTo(pt.x,pt.y-size*.12);g.lineTo(pt.x-size*.22,pt.y+size*.01);
   g.moveTo(pt.x,pt.y-size*.12);g.lineTo(pt.x+size*.22,pt.y+size*.01);
 }
 g.stroke();
}
function drawPedestrianSignalHead(g,signal,seconds){
 const geo=trafficSignalGeometry(signal),state=trafficPhase(seconds);
 const walk=state.pedestrian==='walk';
 const centerZ=2.40;
 const obj=drawSignalHousing(g,signal,geo.pedFront,.51,.64,centerZ);
 if(!obj.frontVisible)return;
 const pt=obj.point(0,centerZ+.075,.15),size=Math.max(7,cam.zoom*.24);
 g.fillStyle='#091419';g.beginPath();
 g.roundRect(pt.x-size*.54,pt.y-size*.71,size*1.08,size*1.16,1.5);g.fill();
 drawPedestrianIcon(g,pt,walk,size);
 // Contagem digital separada para o intervalo de travessia protegida.
 const low=obj.point(0,centerZ-.20,.16);
 g.fillStyle=walk?'#7cf5ba':'#c9776f';
 g.font='bold '+Math.max(6,cam.zoom*.145)+'px monospace';
 g.textAlign='center';g.fillText(walk?String(state.countdown).padStart(2,'0'):'--',low.x,low.y+3);
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
 // Trava de suspensão da cabeça veicular.
 const mount=proj(geo.tip.x,geo.tip.y,signal.headHeight+.66);
 g.strokeStyle='#242c30';g.lineWidth=Math.max(1,w*.50);
 g.beginPath();g.moveTo(tip.x,tip.y);g.lineTo(mount.x,mount.y);g.stroke();
 // Quadro de inspeção / conduíte de sinalização.
 const hatch=proj(signal.x,signal.y,1.24);
 g.fillStyle='#222a2d';g.fillRect(hatch.x-w*.33,hatch.y-w*.6,w*.66,w*1.22);
 g.strokeStyle='#8e999d';g.lineWidth=.7;
 g.strokeRect(hatch.x-w*.33,hatch.y-w*.6,w*.66,w*1.22);
 drawVehicleSignalHead(g,signal,seconds,night);
 drawPedestrianSignalHead(g,signal,seconds);
 g.restore();
}

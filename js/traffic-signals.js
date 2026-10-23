// Semaforos 100% procedurais em Canvas 2D: fases sincronizadas e travessia.
'use strict';
const SIGNAL_CYCLE=46; // 21 + 3 + 1 + 17 + 3 + 1
function trafficPhase(seconds){
 const t=((seconds%SIGNAL_CYCLE)+SIGNAL_CYCLE)%SIGNAL_CYCLE;
 const main=t<21?'green':t<24?'yellow':'red';
 const branch=t>=25&&t<42?'green':t>=42&&t<45?'yellow':'red';
 return {main,branch,pedestrianMain:t>=25&&t<42,
  pedestrianBranch:t>=0&&t<21,allRed:(t>=24&&t<25)||(t>=45)};
}
function signalState(signal,seconds){
 return trafficPhase(seconds)[signal.group];
}
function generateTrafficSignals(){
 world.trafficSignals=[];
 const J=world.junction;
 if(!J)return;
 for(const [index,road] of world.roads.entries()){
  const pts=road.pts;
  let center=0,closest=Infinity;
  pts.forEach((p,i)=>{const d=Math.hypot(p.x-J.x,p.y-J.y);
   if(d<closest){closest=d;center=i;}});
  const group=road.branch?'branch':'main';
  for(const direction of [-1,1]){
   // Just before an intersection: pole on sidewalk outside the road.
   const candidates=[];
   for(let k=8;k<29;k+=2){
    const i=center+direction*k;
    if(i<6||i>=pts.length-6)continue;
    const p=pts[i],d=Math.hypot(p.x-J.x,p.y-J.y);
    if(d<5.4||d>13.5)continue;
    const side=direction>0?-1:1;
    const x=p.x+p.nx*(ROAD_W+0.95)*side,
          y=p.y+p.ny*(ROAD_W+0.95)*side;
    if(x<4||y<4||x>MAP-4||y>MAP-4)continue;
    if(pondVal(x,y)<1.35||world.blocked(x,y,.15))continue;
    if(world.lamps.some(l=>Math.hypot(l.x-x,l.y-y)<2.3))continue;
    candidates.push({x,y,p,d,side});
   }
   candidates.sort((a,b)=>Math.abs(a.d-8)-Math.abs(b.d-8));
   if(!candidates.length)continue;
   const pick=candidates[0];
   if(world.trafficSignals.some(s=>Math.hypot(s.x-pick.x,s.y-pick.y)<4))continue;
   const toward=direction<0?1:-1;
   // Heads face vehicles travelling toward the junction.
   const ax=pick.p.tx*toward,ay=pick.p.ty*toward;
   const signal={id:'signal-'+index+'-'+(direction>0?'b':'a'),
     x:pick.x,y:pick.y,ax,ay,group,direction,
     crossing:{x:pick.p.x,y:pick.p.y},
     poleHeight:3.85,headHeight:3.55};
   world.trafficSignals.push(signal);
   world.circles.push({x:signal.x,y:signal.y,r:.12,h:3.85,
     kind:'trafficSignal',ref:signal});
  }
 }
}
function drawTrafficSignal(g,l,seconds,night){
 const state=signalState(l,seconds),p=proj(l.x,l.y,0),
  top=proj(l.x,l.y,l.poleHeight),
  arm=proj(l.x+l.ax*.42,l.y+l.ay*.42,l.headHeight),
  head=proj(l.x+l.ax*.60,l.y+l.ay*.60,l.headHeight);
 const w=Math.max(1.3,cam.zoom*.058),a=Math.max(3.5,cam.zoom*.22),
  b=Math.max(8,cam.zoom*.57);
 g.save();g.lineCap='round';g.lineJoin='round';
 // Concrete footing, galvanized steel, pole bevel and exposed conduit.
 g.fillStyle='rgba(10,12,15,.26)';g.beginPath();
 g.ellipse(p.x+3,p.y+1,a*.75,a*.34,-.12,0,TAU);g.fill();
 const foot=proj(l.x,l.y,.18);
 poly(g,[[p.x-a*.43,p.y],[p.x+a*.43,p.y],
  [foot.x+a*.33,foot.y],[foot.x-a*.33,foot.y]],
  '#777a76','#25272b',Math.max(.7,w*.4));
 g.strokeStyle='#1e2225';g.lineWidth=w+2.5;
 g.beginPath();g.moveTo(foot.x,foot.y);g.lineTo(top.x,top.y);
 g.lineTo(arm.x,arm.y);g.stroke();
 g.strokeStyle='#646e73';g.lineWidth=w;
 g.stroke();g.strokeStyle='#9da5a7';g.lineWidth=w*.24;
 g.beginPath();g.moveTo(foot.x-w*.28,foot.y);g.lineTo(top.x-w*.28,top.y);g.stroke();
 g.fillStyle='#25292d';g.fillRect(top.x-w*1.1,top.y-w*.5,w*2.2,w);
 // Signal housing: recessed lamps, black visor and side bevel.
 const hw=a*.74,hh=b,cy=head.y+hh*.10;
 g.fillStyle='rgba(0,0,0,.28)';g.fillRect(head.x-hw+2,cy-hh*.5+3,hw*2,hh);
 g.fillStyle='#22282c';g.strokeStyle='#0f1214';g.lineWidth=1.5;
 g.beginPath();g.roundRect(head.x-hw,cy-hh*.5,hw*2,hh,hw*.25);g.fill();g.stroke();
 g.fillStyle='#4b555b';g.fillRect(head.x-hw*.8,cy-hh*.45,hw*.19,hh*.89);
 const colors={red:'#fa4940',yellow:'#ffcb48',green:'#52df81'},
  off={red:'#632921',yellow:'#61502a',green:'#244936'};
 ['red','yellow','green'].forEach((c,i)=>{
  const y=cy-hh*.30+i*hh*.30,r=hw*.56,on=state===c;
  g.fillStyle='#0d1518';g.beginPath();g.ellipse(head.x+hw*.15,y,r*1.18,r*1.05,0,0,TAU);g.fill();
  g.fillStyle=on?colors[c]:off[c];g.beginPath();g.arc(head.x+hw*.15,y,r,0,TAU);g.fill();
  if(on){
   g.fillStyle='rgba(255,255,255,.55)';g.beginPath();
   g.ellipse(head.x,y-r*.27,r*.29,r*.14,-.5,0,TAU);g.fill();
   if(night){g.save();g.globalCompositeOperation='screen';
    const glow=g.createRadialGradient(head.x,y,r*.4,head.x,y,r*5);
    glow.addColorStop(0,c==='red'?'rgba(255,62,42,.36)':c==='yellow'?'rgba(255,213,60,.32)':'rgba(84,255,138,.29)');
    glow.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=glow;g.fillRect(head.x-r*5,y-r*5,r*10,r*10);
    g.restore();}
  }
  g.strokeStyle='#111719';g.lineWidth=Math.max(.7,r*.25);
  g.beginPath();g.arc(head.x+hw*.15,y,r*1.10,Math.PI*1.07,Math.PI*1.94);g.stroke();
 });
 // Pedestrian mini-panel runs opposite of this traffic approach.
 const ped=trafficPhase(seconds);
 const walk=l.group==='main'?ped.pedestrianMain:ped.pedestrianBranch;
 const plate=proj(l.x,l.y,2.18),sz=Math.max(3,cam.zoom*.16);
 g.fillStyle='#20282b';g.fillRect(plate.x-sz*.5,plate.y-sz*.52,sz,sz*1.1);
 g.fillStyle=walk?'#76efb4':'#ec6660';
 g.font='bold '+Math.max(7,sz*.72)+'px sans-serif';
 g.textAlign='center';g.fillText(walk?'●':'■',plate.x,plate.y+sz*.23);
 g.restore();
}

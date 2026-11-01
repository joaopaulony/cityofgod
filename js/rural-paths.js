// Acesso de fazenda/campo: estrada de chão de verdade — terra batida com a textura do jogo (ground-dirt), duas trilhas
// de pneu compactadas e mais escuras, capim no meio, cascalho com sombra e brilho, poças de lama de vez em quando e a
// borda comida pelo capim. Pintado no chão (terrain.js → houses.js paintFloors), alinhado ao mundo entre os blocos.
'use strict';
function ruralAccessProfile(H){
 const a=H.walk?.[0],b=H.walk?.[1];if(!a||!b)return null;
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<.3)return null;
 return {a,b,length,tx:dx/length,ty:dy/length,
   nx:-dy/length,ny:dx/length,width:1.75,seed:H.seed||1};
}
// padrão de terra (textures.js: GTEX.dirt já reamostrada a TP px/m), criado uma vez
let ruralDirtPattern=null;
function ruralDirt(g,M){
 if(ruralDirtPattern===null&&typeof GTEX!=='undefined'&&GTEX.ready&&GTEX.t.dirt){
  const T=GTEX.t.dirt,c=makeCanvas(T.n,T.n),cg=c.getContext('2d'),img=cg.createImageData(T.n,T.n);
  img.data.set(T.data);cg.putImageData(img,0,0);ruralDirtPattern=c;
 }
 if(!ruralDirtPattern)return null;
 const p=g.createPattern(ruralDirtPattern,'repeat'),k=M(1)/TP;   // QP (versão rápida) ou TP: mesma escala no mundo
 p.setTransform(new DOMMatrix([k,0,0,k,0,0]));
 return p;
}
function paintRuralAccess(g,M,H){
 const p=ruralAccessProfile(H);if(!p)return;
 const rnd=mulberry(p.seed+38551),N=Math.max(12,Math.ceil(p.length*4));
 const points=[];for(let i=0;i<=N;i++){
   const t=i/N,lat=Math.sin(t*7+p.seed*.17)*.11+
     Math.sin(t*14+p.seed*.03)*.035;
   points.push({x:p.a[0]+p.tx*p.length*t+p.nx*lat,
    y:p.a[1]+p.ty*p.length*t+p.ny*lat,
    t,width:(1.60+Math.sin(t*14+p.seed)*.12)*
      (.66+.34*Math.sin(Math.PI*Math.min(1,.10+t*.85)))});
 }
 // contorno da estrada (borda irregular: o capim come pedaços)
 const edge=(extra,jit=0)=>{g.beginPath();
   points.forEach((q,i)=>{const w=q.width+extra+(jit?Math.sin(q.t*61+p.seed)*jit+Math.sin(q.t*23)*jit*.6:0);
     const x=M(q.x+p.nx*w),y=M(q.y+p.ny*w);i?g.lineTo(x,y):g.moveTo(x,y);});
   for(let i=points.length-1;i>=0;i--){const q=points[i],w=q.width+extra+(jit?Math.sin(q.t*47+p.seed*.5)*jit+Math.sin(q.t*19)*jit*.6:0);
     g.lineTo(M(q.x-p.nx*w),M(q.y-p.ny*w));}
   g.closePath();};
 const band=(off,half,style,alpha=1)=>{g.globalAlpha=alpha;g.strokeStyle=style;g.lineWidth=M(half*2);g.beginPath();
   points.forEach((q,i)=>{const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.globalAlpha=1;};
 g.save();g.lineJoin='round';g.lineCap='round';
 // 1) terra espalhada no capim (transição), 2) a estrada com a textura de terra, tingida p/ terra batida
 edge(.42,.12);g.fillStyle='rgba(84,66,44,.30)';g.fill();
 edge(.04,.09);g.save();g.clip();
 const dirt=ruralDirt(g,M);
 g.fillStyle=dirt||'#8a6c4c';g.fill();
 g.fillStyle='rgba(172,146,110,.30)';g.fill();   // poeira: puxa p/ terra batida seca, sem escurecer a textura
 // trilhas de pneu: compactadas, mais escuras e lisas, com a beirada levantada um pouco mais clara
 for(const off of [-.62,.62]){
  band(off,.30,'rgb(104,82,60)',.26);
  band(off,.16,'rgb(86,66,48)',.18);
  band(off+(off>0?.33:-.33),.06,'rgb(186,160,124)',.30);
  band(off-(off>0?.33:-.33),.05,'rgb(176,150,116)',.22);
 }
 // poças de lama numa das trilhas (só em acessos compridos)
 if(p.length>8)for(let k=0,n=1+(rnd()<.5?1:0);k<n;k++){
  const q=points[Math.floor((.25+rnd()*.5)*N)],off=(rnd()<.5?-.62:.62),cx=M(q.x+p.nx*off),cy=M(q.y+p.ny*off);
  const rx=M(.55+rnd()*.5),ry=M(.24+rnd()*.12),ang=Math.atan2(p.ty,p.tx);
  g.fillStyle='rgba(58,44,32,.55)';g.beginPath();g.ellipse(cx,cy,rx*1.25,ry*1.35,ang,0,TAU);g.fill();   // barro molhado em volta
  const w=g.createRadialGradient(cx,cy,0,cx,cy,rx);w.addColorStop(0,'rgba(92,98,96,.85)');w.addColorStop(.75,'rgba(70,72,66,.8)');w.addColorStop(1,'rgba(60,52,40,.0)');
  g.fillStyle=w;g.beginPath();g.ellipse(cx,cy,rx,ry,ang,0,TAU);g.fill();
  g.strokeStyle='rgba(205,214,210,.35)';g.lineWidth=Math.max(1,M(.025));g.beginPath();g.ellipse(cx-rx*.15,cy-ry*.2,rx*.55,ry*.45,ang,3.6,5.4);g.stroke();   // reflexo do céu
 }
 // cascalho solto: pedrinhas com sombra e um ponto de luz, mais nas trilhas e nas bordas
 const count=Math.floor(p.length*24);
 for(let i=0;i<count;i++){
   const t=.03+rnd()*.94,q=points[Math.min(N,Math.floor(t*N))],side=rnd()<.5?-1:1;
   const off=rnd()<.55?side*(.62+(rnd()-.5)*.5):(rnd()-.5)*q.width*1.85;
   const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off),size=M(.014+rnd()*.04)*(rnd()>.86?1.7:1);
   const color=rnd()<.15?'#bfae8c':rnd()<.55?'#8a7f6d':rnd()<.8?'#9b8f78':'#6a6152',rot=rnd()*3;
   g.fillStyle='rgba(30,22,15,.32)';g.beginPath();g.ellipse(x+size*.28,y+size*.24,size*1.05,size*.6,rot,0,TAU);g.fill();
   g.fillStyle=color;g.beginPath();g.ellipse(x,y,size,size*(.45+rnd()*.3),rot,0,TAU);g.fill();
   g.fillStyle='rgba(255,246,226,.22)';g.beginPath();g.ellipse(x-size*.3,y-size*.25,size*.35,size*.2,rot,0,TAU);g.fill();
 }
 g.restore();   // fim do recorte
 // capim no meio da estrada (entre as trilhas), mais cheio longe da casa e da rua
 for(let i=0;i<Math.floor(p.length*48);i++){
   const t=.08+rnd()*.84,q=points[Math.floor(t*N)],off=(rnd()-.5)*.5,dens=Math.sin(Math.PI*t);
   if(rnd()>dens)continue;
   const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off),h=M(.05+rnd()*.09);
   g.strokeStyle=rnd()<.45?'#5d7a35':rnd()<.75?'#7b8c42':'#9a9a58';g.lineWidth=Math.max(.7,M(.012));
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+M((rnd()-.5)*.05),y-h*.6,x+M((rnd()-.5)*.08),y-h);g.stroke();
 }
 // borda: tufos de capim invadindo a terra, sem linha reta
 for(let i=0;i<Math.floor(p.length*14);i++){
   const t=rnd(),q=points[Math.floor(t*N)],side=rnd()<.5?-1:1,off=side*(q.width-.05+rnd()*.32);
   const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off),h=M(.06+rnd()*.12);
   g.strokeStyle=rnd()<.5?'#48612e':rnd()<.8?'#6f8a3c':'#8d9848';g.lineWidth=Math.max(.7,M(.014));
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+M((rnd()-.5)*.06),y-h*.55,x+M((rnd()-.5)*.1),y-h);g.stroke();
 }
 g.restore();
}

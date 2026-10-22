
'use strict';
// Procedural isometric vehicles: original 2.5D car surfaces, all camera angles.
const CAR_MODELS=[
 {id:'supercar',name:'Superesportivo',len:4.52,w:1.93,roof:1.55,hood:1.00,front:1.49,rear:-1.47,wheel:.37,acc:7.7,max:22},
 {id:'coupe',name:'Cupê esportivo',len:4.42,w:1.85,roof:1.75,hood:1.06,front:1.42,rear:-1.42,wheel:.37,acc:6.4,max:19},
 {id:'tuner',name:'Cupê de corrida',len:4.56,w:1.91,roof:1.73,hood:1.04,front:1.50,rear:-1.48,wheel:.38,acc:6.8,max:20},
 {id:'muscle',name:'Muscle car',len:4.81,w:1.96,roof:1.74,hood:1.15,front:1.65,rear:-1.61,wheel:.40,acc:7.2,max:21},
 {id:'sedan',name:'Sedã',len:4.67,w:1.85,roof:1.82,hood:1.08,front:1.50,rear:-1.45,wheel:.38,acc:5.7,max:17},
 {id:'suv',name:'Utilitário 4×4',len:4.91,w:2.03,roof:2.17,hood:1.32,front:1.62,rear:-1.62,wheel:.46,acc:4.9,max:15},
 {id:'pickup',name:'Picape',len:5.18,w:2.01,roof:1.94,hood:1.24,front:1.79,rear:-1.76,wheel:.44,acc:4.8,max:16}
];
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
function carTire(g,b,u,v,m){
 const r=m.wheel,center=.47,side=Math.sign(v),v0=v+side*.045,turn=b.odometer/r;
 const pp=(angle,radius)=>carProject(b,u+Math.cos(angle)*radius,v0,
   center+Math.sin(angle)*radius);
 const ring=(r0,n=20)=>Array.from({length:n},(_,i)=>pp(i*TAU/n,r0));
 poly(g,ring(r),'#11171a','#2d3235',Math.max(.8,cam.zoom*.022));
 poly(g,ring(r*.85),'#292e31','#11191d',.65);
 poly(g,ring(r*.65),'#b6b9bb','#44484e',Math.max(.6,cam.zoom*.013));
 poly(g,ring(r*.50),'#40484f',null);
 for(let i=0;i<5;i++){
  const a=turn+TAU*i/5;
  carFill(g,b,[
   [u+Math.cos(a-.22)*r*.13,v0,center+Math.sin(a-.22)*r*.13],
   [u+Math.cos(a-.17)*r*.51,v0,center+Math.sin(a-.17)*r*.51],
   [u+Math.cos(a+.17)*r*.51,v0,center+Math.sin(a+.17)*r*.51],
   [u+Math.cos(a+.22)*r*.13,v0,center+Math.sin(a+.22)*r*.13]
  ],i%2?'#dce0df':'#aeb8bd');
 }
 const hub=pp(0,0);
 g.fillStyle='#bcc1c2';g.beginPath();g.arc(hub.x,hub.y,
  Math.max(1,cam.zoom*.067),0,TAU);g.fill();
 g.fillStyle='#3d4749';g.beginPath();g.arc(hub.x,hub.y,
  Math.max(.5,cam.zoom*.029),0,TAU);g.fill();
 for(let i=0;i<12;i++){
  const a=i*TAU/12+turn*.14,p=pp(a,r*.90),q=pp(a+.065,r*.99);
  g.strokeStyle='rgba(177,185,188,.25)';g.lineWidth=.65;
  g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.stroke();
 }
}
function carLamp(g,b,u,v,z,kind,on){
 const p=carProject(b,u,v,z),r=Math.max(1.4,cam.zoom*.085);
 const rgb=kind==='front'?'255,245,216':kind==='turn'?'255,175,48':'254,52,45';
 g.fillStyle=on?'rgba('+rgb+',.98)':kind==='front'?'#a8bdc6':
  kind==='turn'?'#b68247':'#9f3c3d';
 g.beginPath();g.ellipse(p.x,p.y,r*1.15,r*.56,-.09,0,TAU);g.fill();
 g.strokeStyle='rgba(12,20,24,.78)';g.lineWidth=Math.max(.7,cam.zoom*.013);
 g.stroke();
 if(on){
  const grad=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r*5);
  grad.addColorStop(0,'rgba('+rgb+',.61)');
  grad.addColorStop(.19,'rgba('+rgb+',.22)');
  grad.addColorStop(1,'rgba('+rgb+',0)');
  g.fillStyle=grad;g.beginPath();g.arc(p.x,p.y,r*5,0,TAU);g.fill();
 }
}
function carDraw(g,b,time=0,night=false){
 const m=carModel(b),paint=b.top||'#677d7c',
  C={paint,hi:shadeHex(paint,1.15),side:shadeHex(paint,.80),
     dark:shadeHex(paint,.54),roof:shadeHex(paint,1.08)},
  L=m.len/2,w=m.w/2,key=m.id,
  pick=key==='pickup',supercar=key==='supercar',suv=key==='suv',
  hood=m.hood,roof=m.roof,cabF=pick?.25:supercar?.74:key==='muscle'?.38:.58,
  cabB=pick?-.99:suv?-1.32:supercar?-.80:-1.06,
  frontRoof=cabF-.25,backRoof=cabB+.18,
  rw=w*(supercar?.77:.80),p=(u,v,z)=>[u,v,z],
  farSide=Math.sign(facingCam(-Math.sin(b.rot),Math.cos(b.rot)))||1;
 // Contact shadow cast on the street/grass, follows vehicle orientation.
 const c=carProject(b,0,0,.01);
 g.save();g.translate(c.x+cam.zoom*.07,c.y+cam.zoom*.075);g.scale(1,TILT);
 const gr=g.createRadialGradient(0,0,cam.zoom*.36,0,0,cam.zoom*(L+.2));
 gr.addColorStop(0,'rgba(8,13,15,.36)');gr.addColorStop(1,'rgba(8,13,15,0)');
 g.fillStyle=gr;g.beginPath();g.arc(0,0,cam.zoom*(L+.2),0,TAU);g.fill();g.restore();
 for(const u of [m.rear,m.front])carTire(g,b,u,-farSide*w*.95,m);
 // Chassis taper, bumpers, side panels and wheel arch shadows.
 for(const side of [-1,1]){
  const v=side*w;
  carFill(g,b,[p(-L+.22,v,.47),p(L-.22,v,.47),
    p(L-.26,v,hood-.16),p(-L+.24,v,hood-.16)],
    side===farSide?C.side:C.paint,'rgba(22,24,28,.58)');
  carLine(g,b,[p(-L+.33,v,.55),p(L-.33,v,.55)],
    'rgba(17,21,25,.53)',.024);
  carLine(g,b,[p(-L+.30,v,hood-.17),p(L-.30,v,hood-.17)],
    'rgba(255,250,238,.28)',.013);
  // Front / rear wheel arch outlines.
  for(const u of [m.front,m.rear]){
   const points=[];for(let k=0;k<=9;k++){
    const a=Math.PI*.10+Math.PI*.8*k/9;
    points.push(p(u+Math.cos(a)*m.wheel*.99,v+side*.012,
      .47+Math.sin(a)*m.wheel*.98));
   }
   carLine(g,b,points,'rgba(23,26,29,.72)',.023);
  }
 }
 // Nose, hood, panel creases and trunk (view angle independent).
 carFill(g,b,[p(cabF+.41,-w*.79,hood),p(L-.16,-w*.76,hood-.07),
   p(L-.02,w*.70,hood-.12),p(cabF+.41,w*.79,hood)],
   C.hi,'rgba(25,28,32,.58)');
 carFill(g,b,[p(-L+.13,-w*.75,hood-.11),p(cabB-.21,-w*.79,hood),
   p(cabB-.21,w*.79,hood),p(-L+.13,w*.75,hood-.11)],
   C.roof,'rgba(26,29,30,.53)');
 for(const side of [-1,1]){
  carLine(g,b,[p(cabF+.65,side*w*.61,hood+.007),
   p(L-.30,side*w*.53,hood-.055)],'rgba(252,246,232,.25)',.015);
  carLine(g,b,[p(cabF+.79,side*w*.40,hood+.014),
   p(L-.43,side*w*.37,hood-.052)],'rgba(35,41,44,.11)',.010);
 }
 // Vincos do paralama e pequeno emblema cromado na dianteira.
 const emblem=carProject(b,L-.35,0,hood-.085);
 g.fillStyle='#989f9f';g.beginPath();
 g.ellipse(emblem.x,emblem.y,Math.max(.8,cam.zoom*.035),
   Math.max(.6,cam.zoom*.016),0,0,TAU);g.fill();
 // Slope of front/rear windshield, glass inset, roof.
 carFill(g,b,[p(cabF+.40,-w*.76,hood+.06),
   p(cabF+.40,w*.76,hood+.06),p(frontRoof,rw,roof),
   p(frontRoof,-rw,roof)],'#263642','#20282e');
 carFill(g,b,[p(cabF+.31,-w*.68,hood+.125),p(cabF+.31,w*.68,hood+.125),
   p(frontRoof+.10,rw*.91,roof-.07),p(frontRoof+.10,-rw*.91,roof-.07)],
   '#8baebe','rgba(33,42,49,.55)');
 carFill(g,b,[p(backRoof,-rw,roof),p(backRoof,rw,roof),
   p(cabB-.24,w*.73,hood+.05),p(cabB-.24,-w*.73,hood+.05)],
   suv?'#587382':'#607d8c','#252b30');
 carFill(g,b,[p(backRoof,-rw,roof),p(frontRoof,-rw,roof),
   p(frontRoof,rw,roof),p(backRoof,rw,roof)],C.roof,'rgba(25,27,30,.66)');
 for(const side of [-1,1]){
  const v=side*w*.915,rv=side*rw;
  carFill(g,b,[p(cabB-.22,v,hood-.02),p(cabF+.30,v,hood-.02),
    p(frontRoof,rv,roof),p(backRoof,rv,roof)],
    side===farSide?C.side:C.paint,'rgba(24,29,35,.70)');
  const left=cabB-.10,right=cabF+.18,
    split=lerp(left,right,suv?.55:.46);
  const a=[p(left,v,hood+.11),p(split-.065,v,hood+.10),
    p(split-.14,rv,roof-.13),p(backRoof+.10,rv,roof-.14)];
  const d=[p(split+.05,v,hood+.10),p(right,v,hood+.10),
    p(frontRoof-.09,rv,roof-.13),p(split-.065,rv,roof-.13)];
  if(!pick)carFill(g,b,a,'#617f90','rgba(22,28,35,.80)');
  carFill(g,b,d,'#81a5b5','rgba(22,28,35,.80)');
  carLine(g,b,[d[3],d[2]],'rgba(211,229,231,.49)',.019);
  if(!pick)carLine(g,b,[p(split-.05,v,hood+.08),
    p(split-.09,rv,roof-.12)],'#29343b',.05);
  // Pintura metalica discreta e arestas de portas: microdetalhes
  // permanecem legiveis quando a camera gira, sem depender de sprites.
  carLine(g,b,[p(cabF+.20,v,hood-.04),
    p(cabF+.20,v,.58)],'rgba(29,31,34,.38)',.012);
  carLine(g,b,[p(cabB-.11,v,.57),p(cabF+.18,v,.57)],
    'rgba(236,232,217,.16)',.014);
  carLine(g,b,[p(cabB-.20,v,hood-.08),
    p(cabB-.20,v,.71)],'rgba(29,31,34,.27)',.010);
  const handle=carProject(b,lerp(cabB,cabF,.36),side*(w+.025),hood-.20);
  g.fillStyle='#272f32';g.fillRect(handle.x-1.5,handle.y,
    Math.max(3,cam.zoom*.12),Math.max(.85,cam.zoom*.023));
  const mirror=carProject(b,cabF+.28,side*(w+.15),hood+.16);
  g.fillStyle=C.dark;g.beginPath();g.ellipse(mirror.x,mirror.y,
    Math.max(1.7,cam.zoom*.10),Math.max(1,cam.zoom*.058),-.2,0,TAU);g.fill();
 }
 // Grill, bumper trim, vents, reflectors and license plate.
 const f=L-.065,r=-L+.08;
 carFill(g,b,[p(f,-w*.75,.56),p(f,w*.75,.56),
   p(f,w*.72,.75),p(f,-w*.72,.75)],'#323a3f','#1e292d');
 carFill(g,b,[p(f+.01,-w*.41,.59),p(f+.01,w*.41,.59),
   p(f+.01,w*.41,.68),p(f+.01,-w*.41,.68)],'#6a7478');
 for(let i=0;i<5;i++){
  const v=-w*.34+i*w*.17;
  carLine(g,b,[p(f+.015,v,.61),p(f+.015,v+.045,.61)],
    '#a3afb2',.010);
 }
 carLine(g,b,[p(f,-w*.74,.49),p(f,w*.74,.49)],'#adb2b0',.074);
 carLine(g,b,[p(r,-w*.73,.52),p(r,w*.73,.52)],'#999d9b',.061);
 const blink=Math.floor(time*2.8)%2===0;
 for(const side of [-1,1]){
  carLamp(g,b,f,side*w*.71,hood-.23,'front',b.headlights);
  carLamp(g,b,r,side*w*.70,hood-.23,'rear',b.headlights||b.brake);
  carLamp(g,b,f,side*w*.93,.71,'turn',blink&&(b.hazards||b.indicator===side));
  carLamp(g,b,r,side*w*.93,.77,'turn',blink&&(b.hazards||b.indicator===side));
 }
 // Distinct silhouettes and features for the seven models.
 if(['supercar','tuner','muscle'].includes(key)){
  const wing=supercar?.28:key==='tuner'?.23:.08;
  if(wing>.2){
   for(const side of [-1,1])carLine(g,b,[
     p(-L+.38,side*w*.66,hood-.07),p(-L+.38,side*w*.66,hood+wing)],
     '#434950',.055);
   carFill(g,b,[p(-L+.53,-w*.73,hood+wing),p(-L+.30,-w*.73,hood+wing),
     p(-L+.30,w*.73,hood+wing),p(-L+.53,w*.73,hood+wing)],
     '#343940','#161c21');
   carLine(g,b,[p(-L+.48,-w*.70,hood+wing+.006),
     p(-L+.48,w*.70,hood+wing+.006)],
     'rgba(211,216,214,.36)',.016);
  }
  carFill(g,b,[p(L-.47,-w*.20,hood+.009),p(L-.31,-w*.16,hood+.009),
    p(L-.31,w*.16,hood+.009),p(L-.47,w*.20,hood+.009)],
    '#2d3338','rgba(89,104,112,.65)');
 }
 if(pick){
  const start=-L+.17,end=cabB-.24,z=.91,rail=1.28;
  carFill(g,b,[p(start,-w*.76,z),p(end,-w*.76,z),
    p(end,w*.76,z),p(start,w*.76,z)],'#65534d','#21282b');
  for(let i=0;i<7;i++){
   const v=-w*.68+i*w*.23;
   carLine(g,b,[p(start,v,z+.012),p(end,v,z+.012)],
     'rgba(170,163,156,.38)',.014);
  }
  for(const side of [-1,1]){
   const v=side*w;
   carFill(g,b,[p(start,v,z),p(end,v,z),p(end,v,rail),p(start,v,rail)],
     C.paint,'#292d30');
   carLine(g,b,[p(start,v,rail),p(end,v,rail)],C.hi,.047);
  }
  carFill(g,b,[p(start,-w,z),p(start,w,z),
   p(start,w,rail),p(start,-w,rail)],C.paint,'#272a2e');
 }
 if(suv)for(const side of [-1,1]){
  carLine(g,b,[p(backRoof+.12,side*rw*.70,roof+.08),
    p(frontRoof-.07,side*rw*.70,roof+.08)],'#374448',.056);
  carLine(g,b,[p(-L+.60,side*w,.45),p(L-.57,side*w,.45)],
    '#bdc1be',.062);
 }
 for(const u of [m.rear,m.front])carTire(g,b,u,farSide*w*.95,m);
 // Subtle exhaust while running, animated from vehicle wheel distance.
 if(b.engine&&Math.abs(b.speed)>.35){
  const tail=carProject(b,-L-.13,w*.45,.53);
  for(let i=0;i<3;i++){
   const age=((time*1.65+i*.32+b.seed*.00001)%1+1)%1,
    x=tail.x+Math.cos(b.rot+Math.PI)*age*cam.zoom*.35,
    y=tail.y-age*cam.zoom*.28,r0=Math.max(2,cam.zoom*(.05+age*.11)),
    gradient=g.createRadialGradient(x,y,0,x,y,r0);
   gradient.addColorStop(0,'rgba(171,177,177,'+(.16*(1-age))+')');
   gradient.addColorStop(1,'rgba(171,177,177,0)');
   g.fillStyle=gradient;g.beginPath();g.arc(x,y,r0,0,TAU);g.fill();
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
    carLamp(g,b,L-.05,side*w*.92,.71,'turn',true);
    carLamp(g,b,-L+.05,side*w*.92,.77,'turn',true);
   }
  }
 }
}

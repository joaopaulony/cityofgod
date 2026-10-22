// urban-life.js — residuos urbanos discretos e chaminés habitadas.
// Formas originais feitas pixel a pixel no Canvas, sem imagens externas.
// RNG isolado: nao modifica a semente, as casas ou a vegetacao existentes.
'use strict';
const urbanLife={litter:[],bins:[],sprites:[],counts:{},smoking:0};
const URBAN_KINDS=['paper','can','bottle','wrapper','newspaper','butt','cup'];
function urbanSprite(kind,variant){
  const c=makeCanvas(22,18),p=c.getContext('2d');
  p.imageSmoothingEnabled=false;
  const dot=(x,y,color,w=1,h=1)=>{
    p.fillStyle=color;p.fillRect(x,y,w,h);
  };
  const edge='#3e4140',light='#e1dacc',shade='#a8a49a';
  // Sombra pequena evita aspecto de decal suspenso do asfalto.
  dot(4,12,'rgba(15,18,19,.23)',14,2);
  if(kind==='paper'){
    dot(5,6,edge,11,7);dot(6,5,light,9,7);
    dot(7,6,'#f3ede1',5,2);dot(11,7,'#c9c4b9',3,1);
    dot(7,10,'#9a998e',5,1);dot(14,9,'#b4aa98',2,2);
    dot(6,7,'#eee5d5',2,3);dot(12,11,'#867e71',1,1);
  }else if(kind==='newspaper'){
    dot(4,5,'#474c4b',14,8);dot(5,5,'#cecac1',12,7);
    dot(6,6,'#ebe5d8',10,2);dot(6,9,'#858686',6,1);
    dot(6,11,'#9b9b96',10,1);dot(13,9,'#6a7377',3,2);
    dot(11,5,'#878a85',1,7);
  }else if(kind==='can'){
    const metal=variant===0?'#a6b2b6':variant===1?'#b45d4c':'#668780';
    dot(6,8,'#3a4447',12,5);dot(6,7,'#bfc6c6',11,4);
    dot(8,7,metal,7,4);dot(8,8,'#e1d2bc',2,2);
    dot(6,6,'#e0e0da',10,1);dot(6,11,'#6a7474',11,1);
    dot(14,7,'#f6f0df',1,3);
  }else if(kind==='bottle'){
    const glass=variant===0?'#647f6c':variant===1?'#63828e':'#8d977e';
    dot(7,5,'#303f3c',4,2);dot(4,7,'#253d3e',13,6);
    dot(5,8,glass,11,4);dot(6,8,'#bac7ba',3,1);
    dot(11,8,'#e4d8c5',3,3);dot(15,10,'#cbdad4',1,1);
    dot(4,9,'#9bb1a7',1,2);
  }else if(kind==='wrapper'){
    const ink=variant===0?'#c7a553':variant===1?'#8a9aaf':'#a88181';
    dot(4,8,edge,14,5);dot(6,7,ink,10,5);
    dot(8,8,'#e9ddc3',6,2);dot(5,10,'#eee1cc',3,2);
    dot(14,11,'#615a54',3,1);dot(16,8,'#f3e4c7',2,1);
  }else if(kind==='butt'){
    dot(7,9,'#96928a',9,2);dot(8,8,'#e8e1cf',7,2);
    dot(14,8,'#a97d49',3,2);dot(7,9,'#4c4540',1,1);
  }else if(kind==='cup'){
    dot(7,5,'#626d69',8,2);dot(8,7,'#cbc8b6',7,6);
    dot(9,8,'#e4ded0',3,4);dot(12,10,'#8b9b98',2,2);
    dot(7,5,'#e9e5de',8,1);dot(14,6,'#6d7778',1,1);
  }
  return c;
}
function urbanGenerate(){
  urbanLife.litter=[];urbanLife.bins=[];
  const r=mulberry((world.seed*16127+18043)>>>0);
  urbanLife.sprites=URBAN_KINDS.map(kind=>
    Array.from({length:3},(_,v)=>urbanSprite(kind,v)));
  // Ate 95 residuos em 160x160 m: levemente concentrados perto do meio-fio.
  // O asfalto central permanece praticamente limpo, sem poluir parques.
  for(let tries=0;tries<9000&&urbanLife.litter.length<94;tries++){
    const x=2+r()*(MAP-4),y=2+r()*(MAP-4);
    const d=roadDist(x,y),curb=d>=ROAD_W-.60&&d<=ROAD_W+SIDE+.12;
    if(!curb||pondVal(x,y)<1.2)continue;
    if(world.blocked(x,y,.12))continue;
    if(r()<(d<ROAD_W+.3?.94:.82))continue;
    if(urbanLife.litter.some(p=>Math.hypot(p.x-x,p.y-y)<.72))continue;
    const u=r(),kind=u<.25?'paper':u<.42?'can':u<.57?'bottle':
      u<.73?'wrapper':u<.84?'newspaper':u<.94?'butt':'cup';
    urbanLife.litter.push({kind,x,y,variant:(r()*3)|0,
      a:r()*TAU,s:.78+r()*.35});
  }
  // Lixeiras robustas de calçada, perto de mercados e algumas casas.
  const order=houses.filter(H=>!H.rural).sort((a,b)=>
    (a.seed%131)-(b.seed%131));
  for(const H of order){
    if(urbanLife.bins.length>=11)break;
    const nx=H.doorN[0],ny=H.doorN[1];
    // H.walk[1] e o ponto final da trilha ate a calçada,
    // ao contrario da soleira que muitas vezes fica dentro do terreno.
    const curb=H.walk?.[1]||H.front;
    const x=curb[0]-ny*(.65+(H.seed%3)*.23),
      y=curb[1]+nx*(.65+(H.seed%3)*.23);
    if(x<2||y<2||x>MAP-2||y>MAP-2||!onRoad(x,y)||
      pondVal(x,y)<1.25||world.blocked(x,y,.35)||
      urbanLife.bins.some(p=>Math.hypot(p.x-x,p.y-y)<8))continue;
    urbanLife.bins.push({x,y,kind:H.brick?'metal':'plastic',
      seed:H.seed});
  }
  urbanLife.counts=Object.fromEntries(URBAN_KINDS.map(k=>
    [k,urbanLife.litter.filter(x=>x.kind===k).length]));
}
function urbanDrawLitter(g,d){
  const p=proj(d.x,d.y,.008),sc=cam.zoom/72*d.s;
  g.save();g.translate(p.x,p.y);g.rotate(d.a-cam.ang);
  g.imageSmoothingEnabled=false;g.scale(sc,sc*TILT);
  const image=urbanLife.sprites[URBAN_KINDS.indexOf(d.kind)][d.variant];
  g.drawImage(image,-11,-10);g.restore();
}
function urbanDrawBin(g,b){
  const p=proj(b.x,b.y,0);
  const green=b.kind!=='metal',base=green?'#3f6151':'#65757b',
    dark=green?'#253a36':'#303b41',edge=green?'#60826d':'#94a0a1';
  g.fillStyle='rgba(8,12,13,.24)';
  g.beginPath();g.ellipse(p.x+3,p.y+2,cam.zoom*.28,
    cam.zoom*.12,0,0,TAU);g.fill();
  const polyFace=(pts,col)=>poly(g,pts.map(v=>proj(
    b.x+v[0],b.y+v[1],v[2])),col,'rgba(22,28,29,.60)',.7);
  polyFace([[-.24,-.18,.05],[.24,-.18,.05],
    [.22,-.18,.85],[-.22,-.18,.85]],dark);
  polyFace([[.24,-.18,.05],[.24,.18,.05],
    [.22,.18,.85],[.22,-.18,.85]],edge);
  polyFace([[-.24,.18,.05],[.24,.18,.05],
    [.22,.18,.85],[-.22,.18,.85]],base);
  polyFace([[-.29,-.22,.85],[.29,-.22,.85],
    [.29,.22,.85],[-.29,.22,.85]],dark);
  polyFace([[-.26,-.19,.91],[.26,-.19,.91],
    [.26,.19,.91],[-.26,.19,.91]],edge);
  polyFace([[-.16,-.12,.915],[.16,-.12,.915],
    [.16,.12,.915],[-.16,.12,.915]],'#252a29');
  const label=proj(b.x,b.y+.185,.59);
  g.fillStyle='rgba(221,233,216,.63)';
  g.fillRect(label.x-cam.zoom*.09,label.y-cam.zoom*.05,
    cam.zoom*.18,cam.zoom*.08);
  g.fillStyle='rgba(52,78,61,.75)';
  g.fillRect(label.x-cam.zoom*.06,label.y-cam.zoom*.031,
    cam.zoom*.12,Math.max(1,cam.zoom*.014));
}
function urbanDrawables(list,g){
  const pad=cam.zoom*1.2;
  for(const d of urbanLife.litter){
    const p=proj(d.x,d.y,0);
    if(p.x<-pad||p.x>cam.W+pad||p.y<-pad||p.y>cam.H+pad)continue;
    list.push({d:depthOf(d.x,d.y)-.2,urbanLitter:d,
      draw:ctx=>urbanDrawLitter(ctx,d)});
  }
  for(const b of urbanLife.bins){
    const p=proj(b.x,b.y,0);
    if(p.x<-pad||p.x>cam.W+pad||p.y<-pad||p.y>cam.H+pad)continue;
    list.push({d:depthOf(b.x,b.y)+.04,urbanBin:b,
      draw:ctx=>urbanDrawBin(ctx,b)});
  }
}
// Chamine nas lareiras domesticas: algumas casas apenas, nunca mercados.
function urbanChimneyFor(H,T,L){
  if(H.brick||H.templateKey==='SHOP')return;
  const r=mulberry((H.seed*2101+41)>>>0);
  if(r()>(H.rural?.52:.31))return;
  const u=T.w*(.32+r()*.10),v=T.d*(.43+r()*.12),
    p=L(u,v),roofHeight=H.roofKind==='flat'?H.h:
      H.h+Math.min(T.w,T.d)*.22;
  H.chimney={x:p[0],y:p[1],z:roofHeight-.50,
    h:1.36,seed:(r()*10000)|0,smoke:r()<.68,
    stone:H.rural,style:H.style};
  if(H.chimney.smoke)urbanLife.smoking++;
}
function urbanDrawChimney(g,H,t){
  const c=H.chimney;
  if(!c||H.inside)return;
  const w=.32,z=c.z,top=z+c.h,col=c.stone?'#918677':'#9e5545';
  const topPoly=(x0,y0,x1,y1,h,color)=>{
    poly(g,[[x0,y0,h],[x1,y0,h],[x1,y1,h],[x0,y1,h]]
      .map(p=>proj(c.x+p[0],c.y+p[1],p[2])),color,
      'rgba(30,20,20,.60)',Math.max(.6,cam.zoom*.014));
  };
  const face=(pts,color)=>{
    poly(g,pts.map(p=>proj(c.x+p[0],c.y+p[1],p[2])),
      color,'rgba(43,30,24,.50)',Math.max(.6,cam.zoom*.014));
  };
  face([[-w,-w,z],[w,-w,z],[w,-w,top],[-w,-w,top]],
    c.stone?'#766d63':'#874538');
  face([[w,-w,z],[w,w,z],[w,w,top],[w,-w,top]],
    c.stone?'#70645c':'#6f362c');
  face([[-w,w,z],[w,w,z],[w,w,top],[-w,w,top]],col);
  // Juntas de tijolos desenhadas individualmente, em filas alternadas.
  for(let k=0;k<7;k++){
    const zz=z+.16+k*.16,p=proj(c.x,c.y+w,zz),
      q=proj(c.x+w,c.y+w,zz);
    g.strokeStyle='rgba(227,202,165,.30)';
    g.lineWidth=Math.max(.48,cam.zoom*.009);
    g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.stroke();
    for(let j=0;j<2;j++){
      const a=proj(c.x+(j*.30-.12+(k%2)*.13),c.y+w,
        zz),b=proj(c.x+(j*.30-.12+(k%2)*.13),c.y+w,zz+.14);
      g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
    }
  }
  topPoly(-w-.11,-w-.11,w+.11,w+.11,top,'#6c6059');
  topPoly(-w*.62,-w*.62,w*.62,w*.62,top+.013,'#302d2c');
  if(!c.smoke)return;
  // Plumas suaves geradas por trajetorias fechadas: respiram, desviam com
  // o vento e se dissipam progressivamente, sem objetos por frame.
  for(let i=0;i<7;i++){
    const f=((t*.12+i/7+c.seed*.00001)%1+1)%1,
      dx=Math.sin(t*.75+i*1.67+c.seed)*.07+f*.45,
      dy=Math.cos(t*.60+i*1.21)*.06+f*.26,
      pp=proj(c.x+dx,c.y+dy,top+.06+f*2.35),
      radius=cam.zoom*(.085+f*.18),alpha=(1-f)*.16;
    const grad=g.createRadialGradient(pp.x,pp.y,0,pp.x,pp.y,radius);
    grad.addColorStop(0,'rgba(180,182,174,'+alpha+')');
    grad.addColorStop(.62,'rgba(160,166,166,'+(alpha*.50)+')');
    grad.addColorStop(1,'rgba(145,151,155,0)');
    g.fillStyle=grad;g.beginPath();g.arc(pp.x,pp.y,radius,0,TAU);g.fill();
  }
}

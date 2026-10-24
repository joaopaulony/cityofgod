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
 // Lixeira de coleta projetada em 3D real pelo Canvas, sem bitmap.
 const plastic=b.kind!=='metal',steel=plastic?
  {base:'#3b6554',shadow:'#253f38',lit:'#628778',edge:'#9aafa2',lid:'#2d4b40'}:
  {base:'#697c82',shadow:'#36454b',lit:'#abb8bc',edge:'#c8d0ce',lid:'#3d4c51'};
 const at=(x,y,z)=>proj(b.x+x,b.y+y,z);
 const verts=(v)=>v.map(p=>at(...p));
 const face=(v,fill,outline='rgba(13,23,25,.60)',w=.7)=>poly(g,verts(v),fill,outline,w);
 const P=proj(b.x,b.y,0),q=Math.max(1,cam.zoom*.024);
 g.save();g.lineCap='round';g.lineJoin='round';
 // Chão: sombra larga e contato sob cada pé.
 g.fillStyle='rgba(12,17,14,.28)';g.beginPath();
 g.ellipse(P.x+cam.zoom*.09,P.y+cam.zoom*.04,cam.zoom*.41,
   cam.zoom*.17,-.17,0,TAU);g.fill();
 const faces=[
  {v:[[-.27,-.25,.09],[.27,-.25,.09],[.27,-.25,.91],[-.27,-.25,.91]],col:steel.shadow,x:0,y:-.25},
  {v:[[-.27,.25,.09],[.27,.25,.09],[.27,.25,.91],[-.27,.25,.91]],col:steel.base,x:0,y:.25},
  {v:[[-.27,-.25,.09],[-.27,.25,.09],[-.27,.25,.91],[-.27,-.25,.91]],col:steel.shadow,x:-.27,y:0},
  {v:[[.27,-.25,.09],[.27,.25,.09],[.27,.25,.91],[.27,-.25,.91]],col:steel.lit,x:.27,y:0}
 ];
 // Correct painter sorting based on side-face centers, not origin.
 faces.sort((a,c)=>depthOf(b.x+a.x,b.y+a.y)-depthOf(b.x+c.x,b.y+c.y));
 for(const f of faces)face(f.v,f.col);
 // Visible near face with framed removable front, embossed ribbing and
 // service hatch, not the old single untextured green rectangle.
 const faceDir=facingCam(0,1)>=0?1:-1;
 const zFront=faceDir*.258;
 const plate=[
  [-.218,zFront,.21],[.218,zFront,.21],
  [.218,zFront,.76],[-.218,zFront,.76]
 ];
 face(plate,plastic?'rgba(24,49,39,.36)':'rgba(26,37,44,.28)',steel.shadow,.8);
 const inset=[
  [-.197,zFront+faceDir*.003,.23],[.197,zFront+faceDir*.003,.23],
  [.197,zFront+faceDir*.003,.73],[-.197,zFront+faceDir*.003,.73]
 ];
 face(inset,plastic?'#456d5a':'#7a888c','rgba(10,23,23,.5)',.6);
 for(const u of [-.14,-.07,0,.07,.14]){
  const a=at(u,zFront+faceDir*.006,.31),c=at(u,zFront+faceDir*.006,.68);
  g.strokeStyle='rgba(11,28,26,.22)';g.lineWidth=Math.max(.55,q*.8);
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(c.x,c.y);g.stroke();
 }
 // Metal badge with weathering and identification.
 face([[-.125,zFront+faceDir*.012,.64],
   [.125,zFront+faceDir*.012,.64],
   [.125,zFront+faceDir*.012,.70],
   [-.125,zFront+faceDir*.012,.70]],
   '#c2cabd',steel.shadow,.6);
 const sign=at(0,zFront+faceDir*.015,.665);
 g.save();g.fillStyle='#445852';g.textAlign='center';
 g.font='bold '+Math.max(5,cam.zoom*.12)+'px sans-serif';
 g.fillText(plastic?'RESÍDUOS':'RECICLE',sign.x,sign.y+1);
 g.restore();
 // Tampa abaulada com o recorte de inserção protegido por uma aba móvel;
 // fecha o buraco quadrado preto dos modelos anteriores.
 face([[-.31,-.30,.91],[.31,-.30,.91],
   [.31,.30,.91],[-.31,.30,.91]],steel.shadow);
 face([[-.33,-.32,.96],[.33,-.32,.96],
   [.33,.32,.96],[-.33,.32,.96]],steel.lid,
  '#1a2929',Math.max(1,cam.zoom*.026));
 face([[-.21,-.08,.969],[.21,-.08,.969],
   [.21,.20,.969],[-.21,.20,.969]],
  plastic?'#253b33':'#2c3c43',null);
 face([[-.175,-.055,.974],[.175,-.055,.974],
   [.175,.13,.974],[-.175,.13,.974]],
  plastic?'#4b7260':'#7c8b92','#182523',.7);
 const lift=at(0,.17,.976),ww=cam.zoom*.16;
 g.strokeStyle='#aab5ab';g.lineWidth=Math.max(1,cam.zoom*.031);
 g.beginPath();g.moveTo(lift.x-ww,lift.y);
 g.lineTo(lift.x+ww,lift.y);g.stroke();
 for(const off of [-.25,.25]){
   for(const v of [-.23,.23]){
    const bolt=at(off,v,.975);
    g.fillStyle='#c3ccc2';g.beginPath();g.arc(bolt.x,bolt.y,
     Math.max(.5,cam.zoom*.015),0,TAU);g.fill();
   }
 }
 // Foot pedal and paired small black caster wheels.
 const pedal=at(0,faceDir*.32,.065);
 g.fillStyle='#30383b';g.fillRect(pedal.x-cam.zoom*.12,pedal.y,
    cam.zoom*.24,Math.max(1,cam.zoom*.055));
 for(const xx of [-.19,.19]){
  const wheel=at(xx,faceDir*.22,.065);
  g.fillStyle='#1d282a';g.beginPath();
  g.ellipse(wheel.x,wheel.y,cam.zoom*.068,cam.zoom*.065,0,0,TAU);g.fill();
  g.fillStyle='#93a09d';g.beginPath();
  g.arc(wheel.x,wheel.y,Math.max(.6,cam.zoom*.016),0,TAU);g.fill();
 }
 // Rust streaks on metal types and subtle paint abrasion on plastic.
 if(!plastic)for(const xx of [-.16,.13]){
  const a=at(xx,zFront+faceDir*.015,.73),z=at(xx+.012,zFront+faceDir*.015,.47);
  g.strokeStyle='rgba(119,73,53,.33)';g.lineWidth=Math.max(.8,q*.55);
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(z.x,z.y);g.stroke();
 }
 g.restore();
}
function urbanDrawables(list,g){
  const pad=cam.zoom*1.2;
  for(const d of urbanLife.litter){
    const p=proj(d.x,d.y,0);
    if(p.x<-pad||p.x>cam.W+pad||p.y<-pad||p.y>cam.H+pad)continue;
    list.push({d:depthOf(d.x,d.y)-.2,urbanLitter:d,
      draw:ctx=>urbanDrawLitter(ctx,d)});
  }
  for(const b of globalThis.VEG3D?[]:urbanLife.bins){   // lixeiras em 3D
    const p=proj(b.x,b.y,0);
    if(p.x<-pad||p.x>cam.W+pad||p.y<-pad||p.y>cam.H+pad)continue;
    list.push({d:depthOf(b.x,b.y)+.04,urbanBin:b,
      draw:ctx=>urbanDrawBin(ctx,b)});
  }
}
// COBERTURAS HABITADAS — chaminés, fumaca, parabólicas e antenas de TV.
// A intersecao com telhado e medida na geometria ORIGINAL do edificio,
// nunca por uma altura média que deixa o equipamento flutuando.
function urbanRoofSurface(H,x,y){
  const rg=H.roofGeom||(H.roofGeom=buildRoofGeom(H));
  if(rg.flat)return H.h;
  let result=-Infinity;
  for(const face of rg.faces){
    if(!face.slope)continue;
    const q=face.p;
    for(let i=1;i<q.length-1;i++){
      const a=q[0],b=q[i],c=q[i+1],
        abx=b[0]-a[0],aby=b[1]-a[1],
        acx=c[0]-a[0],acy=c[1]-a[1],
        det=abx*acy-aby*acx;
      if(Math.abs(det)<1e-8)continue;
      const dx=x-a[0],dy=y-a[1],
        u=(dx*acy-dy*acx)/det,v=(abx*dy-aby*dx)/det;
      if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)
        result=Math.max(result,a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]));
    }
  }
  return Number.isFinite(result)?result:H.h;
}
function urbanRoofVertex(H,x,y,lift=0){
  return [x,y,urbanRoofSurface(H,x,y)+lift];
}
function urbanRoofPoly(g,pts,fill,line=null,lw=.7){
  poly(g,pts.map(q=>proj(...q)),fill,line,lw);
}
function urbanRoofStroke(g,pts,col,width=.022){
  g.strokeStyle=col;g.lineWidth=Math.max(.55,cam.zoom*width);
  g.lineCap='round';g.lineJoin='round';g.beginPath();
  for(let i=0;i<pts.length;i++){
    const p=proj(...pts[i]);
    if(i)g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y);
  }
  g.stroke();
}
// As quatro saias metalicas usam alturas independentes, de forma que
// cada quina acompanha a telha real, inclusive telhados de quatro aguas.
function urbanRoofFlashing(g,H,x,y,w,d){
  const rx=w/2,ry=d/2,outer=.23;
  const ring=(ox,oy,lift)=>urbanRoofVertex(H,x+ox,y+oy,lift);
  const shell=[
    [ring(-rx-outer,-ry-outer,.024),ring(rx+outer,-ry-outer,.024),
      ring(rx,-ry,.065),ring(-rx,-ry,.065)],
    [ring(rx+outer,-ry-outer,.024),ring(rx+outer,ry+outer,.024),
      ring(rx,ry,.065),ring(rx,-ry,.065)],
    [ring(rx+outer,ry+outer,.024),ring(-rx-outer,ry+outer,.024),
      ring(-rx,ry,.065),ring(rx,ry,.065)],
    [ring(-rx-outer,ry+outer,.024),ring(-rx-outer,-ry-outer,.024),
      ring(-rx,-ry,.065),ring(-rx,ry,.065)]
  ];
  const shadow=[
    ring(-rx-outer-.055,-ry-outer-.06,.008),
    ring(rx+outer+.06,-ry-outer-.06,.008),
    ring(rx+outer+.06,ry+outer+.06,.008),
    ring(-rx-outer-.055,ry+outer+.06,.008)
  ];
  urbanRoofPoly(g,shadow,'rgba(14,16,20,.38)');
  shell.forEach((plate,i)=>{
    urbanRoofPoly(g,plate,
      ['#677079','#92999a','#6b7476','#a8a8a4'][i],
      'rgba(23,29,30,.45)',Math.max(.5,cam.zoom*.012));
    urbanRoofStroke(g,[plate[2],plate[3]],
      i%2?'rgba(219,217,204,.55)':'rgba(45,50,55,.65)',.014);
    const riv=plate[0],p=proj(...V.lerp(plate[0],plate[1],.33));
    g.fillStyle=i%2?'#c4c4b8':'#525a5d';
    g.fillRect(p.x,p.y,Math.max(1,cam.zoom*.018),Math.max(1,cam.zoom*.018));
  });
  return shell;
}
// Textura em perspectiva, semelhante a fachada: cada tijolo com argamassa,
// variaçao de oxido, eflorescência, fuligem, riscos, quinas gastas.
function urbanChimneyTex(c,index){
  if(!c.textures)c.textures=[];
  if(c.textures[index])return c.textures[index];
  const w=96,h=214,can=makeCanvas(w,h),g=can.getContext('2d'),
    r=mulberry((c.seed*181+index*7927)>>>0);
  const stone=c.stone;
  const base=stone?'#857d70':'#a36550';
  g.fillStyle=stone?'#827c70':'#9c8977';g.fillRect(0,0,w,h);
  // argamassa de espessura variável; tijolos com fiadas desencontradas.
  const bw=stone?34:40,bh=stone?25:19,margin=stone?2:1.7;
  for(let row=0,yy=-bh;yy<h+bh;yy+=bh,row++){
    for(let xx=-(row%2)*bw/2;xx<w+bw;xx+=bw){
      const j=(r()-.5)*.16,col=jitter(base,.34,r);
      g.fillStyle=col;
      g.fillRect(xx+margin,yy+margin,bw-margin*1.8,bh-margin*1.9);
      g.fillStyle='rgba(255,231,207,.19)';
      g.fillRect(xx+margin,yy+margin,bw-margin*1.8,1.2);
      g.fillStyle='rgba(28,20,18,.17)';
      g.fillRect(xx+margin,yy+bh-margin-1,bw-margin*1.8,1.3);
      g.fillStyle='rgba(37,33,27,.10)';
      g.fillRect(xx+bw-margin-2,yy+margin,1,bh-margin*2);
      if(r()<.24){
        const chipx=xx+margin+r()*(bw-margin*3),
          chipy=yy+margin+r()*(bh-margin*3);
        g.fillStyle=r()<.5?'rgba(45,40,35,.25)':'rgba(223,206,177,.25)';
        g.fillRect(chipx,chipy,1.3+r()*3,1+r()*2);
      }
      if(r()<.09){
        g.strokeStyle='rgba(61,50,42,.25)';g.lineWidth=.6;
        g.beginPath();g.moveTo(xx+bw*.28,yy+bh*.30);
        g.lineTo(xx+bw*.35,yy+bh*.58);g.lineTo(xx+bw*.30,yy+bh*.72);
        g.stroke();
      }
    }
  }
  for(let i=0;i<1500;i++){
    const x=r()*w,y=r()*h;
    g.fillStyle=r()<.52?'rgba(24,22,21,.10)':'rgba(253,231,198,.11)';
    g.fillRect(x,y,.8+r()*1.3,.75+r()*1.2);
  }
  // Fuligem escorre da boca e mancha o argamassa superior; base humida.
  let gr=g.createLinearGradient(0,0,0,h*.55);
  gr.addColorStop(0,'rgba(25,24,23,.48)');
  gr.addColorStop(.40,'rgba(37,34,30,.13)');
  gr.addColorStop(1,'rgba(30,30,30,0)');
  g.fillStyle=gr;g.fillRect(0,0,w,h*.55);
  gr=g.createLinearGradient(0,h*.68,0,h);
  gr.addColorStop(0,'rgba(35,37,39,0)');
  gr.addColorStop(1,'rgba(30,32,34,.31)');
  g.fillStyle=gr;g.fillRect(0,h*.68,w,h*.32);
  c.textures[index]=can;
  return can;
}
function urbanChimneyFor(H,T,L){
  // Lajes de concreto nao possuem agua inclinada para acoplar chaminés.
  // Preserva caixas-d'agua, ventilacoes e antenas nas lajes.
  if(world.open||H.roofKind==='flat'||H.brick||H.templateKey==='SHOP')return;   // Miami: casas sem lareira
  const r=mulberry((H.seed*2101+41)>>>0);
  if(r()>(H.rural?.52:.36))return;
  const wide=(H.x1-H.x0)>=(H.y1-H.y0),W=H.x1-H.x0,D=H.y1-H.y0;
  // Na mesma agua inclinada, longe da cumeeira e das empenas.
  const px=H.x0+W*(wide?.31+r()*.23:.25+r()*.09);
  const py=H.y0+D*(wide?.25+r()*.09:.31+r()*.23);
  const roofZ=urbanRoofSurface(H,px,py);
  H.chimney={
    x:px,y:py,z:roofZ-.19,roofZ,h:1.60,
    w:.72,d:.68,seed:(r()*100000)|0,
    smoke:r()<.88,stone:H.rural,style:H.style
  };
  if(H.chimney.smoke)urbanLife.smoking++;
}
function urbanRooftopFor(H,T,L){
  const r=mulberry((H.seed*43271+111)>>>0),q=r();
  H.antennas=[];
  if(H.brick&&q>.16)return; // letreiros comerciais tem poucos equipamentos.
  const kind=q<.31?'dish':q<.64?'yagi':null;
  if(!kind)return;
  const W=H.x1-H.x0,D=H.y1-H.y0,wide=W>=D;
  let x=H.x0+W*(wide?.71+r()*.12:.67+r()*.14);
  let y=H.y0+D*(wide?.25+r()*.12:.71+r()*.10);
  if(H.roofKind==='flat'){
    x=H.x0+W*(.64+r()*.15);y=H.y0+D*(.26+r()*.18);
  }
  if(H.chimney&&Math.hypot(x-H.chimney.x,y-H.chimney.y)<1.6){
    x=H.x0+W*.72;y=H.y0+D*.75;
  }
  const z=urbanRoofSurface(H,x,y),yaw=r()*TAU;
  H.antennas.push({kind,x,y,z,yaw,seed:(r()*100000)|0,
    radius:kind==='dish'?.44:0,mast:kind==='yagi'?1.90:.76});
}
function urbanDrawChimney(g,H,t){
  const c=H.chimney;
  // Protecao adicional contra dados antigos / saves com chaminé na laje.
  if(!c||H.inside||H.roofKind==='flat')return;
  const w=c.w/2,d=c.d/2,roof=c.roofZ,top=c.z+c.h;
  const face=(pts,col,idx)=>{
    const pp=pts.map(p=>proj(...p));
    const img=urbanChimneyTex(c,idx);
    const a=pts[3],b=pts[2];
    const tangent=V.norm(V.sub(b,a));
    // Origem e eixos em metros; a textura é mapeada no plano vertical.
    const o=pts[3],height=top-Math.min(pts[0][2],pts[1][2]);
    texPlane(g,img,o,tangent,[0,0,-1],img.width/c.w,pp);
    // Sombreamento da face de acordo com a direcao da luz ambiente.
    poly(g,pp,col,null);
    urbanRoofStroke(g,[pts[3],pts[2]],'rgba(231,211,185,.34)',.014);
  };
  // Sombra irregular projetada na telha e saia de aço galvanizado.
  urbanRoofFlashing(g,H,c.x,c.y,c.w,c.d);
  const corners=[
    [c.x-w,c.y-d],[c.x+w,c.y-d],
    [c.x+w,c.y+d],[c.x-w,c.y+d]
  ];
  const front=[
    {i:0,j:1,n:[0,-1]}, {i:1,j:2,n:[1,0]},
    {i:2,j:3,n:[0,1]}, {i:3,j:0,n:[-1,0]}
  ].filter(f=>facingCam(...f.n)>-.001)
    .sort((a,b)=>depthOf(...corners[a.i])-depthOf(...corners[b.i]));
  for(let k=0;k<front.length;k++){
    const f=front[k],a=corners[f.i],b=corners[f.j],pa=[
      [a[0],a[1],urbanRoofSurface(H,...a)-.075],
      [b[0],b[1],urbanRoofSurface(H,...b)-.075],
      [b[0],b[1],top],[a[0],a[1],top]
    ];
    face(pa,f.n[0]+f.n[1]>0?'rgba(23,20,19,.08)':
      'rgba(29,26,24,.24)',f.i);
  }
  // Flange metalica vertical com fixadores nos quatro cantos.
  const cornersTop=[
    [c.x-w-.065,c.y-d-.065,top-.12],
    [c.x+w+.065,c.y-d-.065,top-.12],
    [c.x+w+.065,c.y+d+.065,top-.12],
    [c.x-w-.065,c.y+d+.065,top-.12]
  ];
  const hi=cornersTop.map(q=>[q[0],q[1],top+.055]);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    urbanRoofPoly(g,[cornersTop[i],cornersTop[j],hi[j],hi[i]],
      i===2?'#aaa29a':'#79736d','rgba(25,27,26,.55)',.7);
    urbanRoofStroke(g,[hi[i],hi[j]],
      'rgba(227,218,204,.42)',.020);
  }
  urbanRoofPoly(g,hi,'#77726d','rgba(32,30,28,.60)',.7);
  const inset=.135,open=[
    [c.x-w+inset,c.y-d+inset,top+.063],
    [c.x+w-inset,c.y-d+inset,top+.063],
    [c.x+w-inset,c.y+d-inset,top+.063],
    [c.x-w+inset,c.y+d-inset,top+.063]
  ];
  urbanRoofPoly(g,open,'#262725','rgba(27,23,21,.75)',.8);
  const recess=open.map(q=>[q[0],q[1],top-.105]);
  urbanRoofPoly(g,[open[3],open[2],recess[2],recess[3]],
    '#554640');
  urbanRoofPoly(g,[open[1],open[2],recess[2],recess[1]],
    '#382e2b');
  const soot=proj(c.x,c.y,top-.085);
  const grad=g.createRadialGradient(soot.x,soot.y,0,soot.x,soot.y,
    Math.max(3,cam.zoom*.29));
  grad.addColorStop(0,'rgba(8,10,10,.83)');
  grad.addColorStop(1,'rgba(8,10,10,0)');
  g.fillStyle=grad;g.beginPath();
  g.ellipse(soot.x,soot.y,cam.zoom*.26,cam.zoom*.13,0,0,TAU);g.fill();
  if(c.smoke)urbanDrawChimneySmoke(g,c,t,top);
}
function urbanSmokeSample(c,t,i){
  const count=17,f=((t*.17+i/count+c.seed*.000011)%1+1)%1;
  const sway=Math.sin(t*.76+i*.83+c.seed*.02);
  return {f,
    x:c.x+.07*sway+f*(.39+Math.sin(c.seed)*.16),
    y:c.y+.05*Math.cos(t*.43+i*1.14)+f*.31,
    z:c.z+c.h+.15+f*3.65,
    radius:.145+f*.49,
    alpha:(.38*(1-f)**.78)*Math.min(1,(f+.065)*8)};
}
function urbanDrawChimneySmoke(g,c,t,top){
  // Núcleo continuo + 17 puffs espirais, sem contorno e com subplumas.
  // A composicao original preserva o contraste do desenho 2D ao entardecer.
  const source=proj(c.x,c.y,top+.12),out=proj(c.x,c.y,top+.80);
  const stem=g.createLinearGradient(source.x,source.y,out.x,out.y);
  stem.addColorStop(0,'rgba(208,205,196,.26)');
  stem.addColorStop(1,'rgba(198,198,194,0)');
  g.strokeStyle=stem;g.lineWidth=Math.max(2,cam.zoom*.15);
  g.lineCap='round';g.beginPath();g.moveTo(source.x,source.y);
  g.lineTo(out.x,out.y);g.stroke();
  for(let i=0;i<17;i++){
    const puff=urbanSmokeSample(c,t,i);
    const pp=proj(puff.x,puff.y,puff.z),
      r=Math.max(4,cam.zoom*puff.radius);
    const color=st.night?'170,178,181':'204,204,198';
    const grd=g.createRadialGradient(pp.x-r*.18,pp.y-r*.20,r*.10,
      pp.x,pp.y,r);
    grd.addColorStop(0,'rgba('+color+','+puff.alpha+')');
    grd.addColorStop(.46,'rgba('+color+','+(puff.alpha*.76)+')');
    grd.addColorStop(.78,'rgba('+color+','+(puff.alpha*.23)+')');
    grd.addColorStop(1,'rgba('+color+',0)');
    g.fillStyle=grd;g.beginPath();g.arc(pp.x,pp.y,r,0,TAU);g.fill();
    // Sub-lobos translúcidos quebram silhueta circular de partícula.
    if(i%2===0){
      const subr=r*.69;
      const gg=g.createRadialGradient(pp.x+r*.31,pp.y-r*.14,0,
        pp.x+r*.31,pp.y-r*.14,subr);
      gg.addColorStop(0,'rgba('+color+','+(puff.alpha*.55)+')');
      gg.addColorStop(1,'rgba('+color+',0)');
      g.fillStyle=gg;g.beginPath();
      g.arc(pp.x+r*.31,pp.y-r*.14,subr,0,TAU);g.fill();
    }
  }
}
// Pequena sapata real de antena: 32 cm com quatro parafusos,
// guarnição de borracha e base conformada à telha. Diferente de uma
// chapa larga de chaminé, não deve cobrir várias telhas.
function urbanAntennaBracket(g,H,x,y,r=.19){
  const P=(dx,dy,lift)=>urbanRoofVertex(H,x+dx,y+dy,lift);
  const q=[P(-r,-r,.024),P(r,-r,.024),
    P(r,r,.024),P(-r,r,.024)];
  const pad=[P(-r*.71,-r*.71,.045),P(r*.71,-r*.71,.045),
    P(r*.71,r*.71,.045),P(-r*.71,r*.71,.045)];
  const shadow=q.map(p=>[p[0]+.026,p[1]+.024,p[2]-.017]);
  urbanRoofPoly(g,shadow,'rgba(23,26,28,.32)');
  urbanRoofPoly(g,q,'#4e5659','rgba(33,39,41,.55)',.75);
  urbanRoofPoly(g,pad,'#879298','rgba(35,43,45,.40)',.5);
  urbanRoofStroke(g,[pad[3],pad[0],pad[1]],
    'rgba(217,221,212,.68)',.010);
  for(const [dx,dy] of [[-r*.82,-r*.82],[r*.82,-r*.82],
    [r*.82,r*.82],[-r*.82,r*.82]]){
    const p=proj(...P(dx,dy,.05));
    g.fillStyle='#c6cbc5';
    g.beginPath();
    g.arc(p.x,p.y,Math.max(.6,cam.zoom*.016),0,TAU);
    g.fill();
  }
  const center=proj(...P(0,0,.062));
  const grad=g.createRadialGradient(center.x,center.y,0,
    center.x,center.y,Math.max(2,cam.zoom*.15));
  grad.addColorStop(0,'rgba(29,40,44,.34)');
  grad.addColorStop(1,'rgba(29,40,44,0)');
  g.fillStyle=grad;g.beginPath();
  g.ellipse(center.x,center.y,cam.zoom*.14,
    cam.zoom*.08,0,0,TAU);g.fill();
}
function urbanDish(g,H,a){
  const x=a.x,y=a.y,z=a.z,co=Math.cos(a.yaw),si=Math.sin(a.yaw);
  // Base de fixação, com dobras e abraçadeiras de aço.
  urbanAntennaBracket(g,H,x,y,.19);
  const base=urbanRoofVertex(H,x,y,.08),
    upright=[x,y,z+.59],center=[x+co*.19,y+si*.19,z+.95];
  urbanRoofStroke(g,[base,upright], '#343f43',.075);
  urbanRoofStroke(g,[[x-.19,y-.11,urbanRoofSurface(H,x-.19,y-.11)+.04],upright],
    '#657278',.036);
  urbanRoofStroke(g,[[x+.15,y+.13,urbanRoofSurface(H,x+.15,y+.13)+.04],upright],
    '#647177',.036);
  urbanRoofStroke(g,[upright,center],'#a8b5b5',.043);
  // Paraboloide em fatias, com bordo elíptico oblíquo em perspectiva.
  // Normais e eixos reais 3D, não elipse chapada na tela.
  const normal=V.norm([co*.80,si*.80,.45]),
    u=V.norm([-si,co,0]),v=V.norm(V.cross(normal,u)),
    C=center,r=.47;
  const ring=[],inner=[],sections=24;
  const surface=(theta,radius,depth)=>{
    return V.add(V.add(V.add(C,V.mul(u,Math.cos(theta)*radius)),
      V.mul(v,Math.sin(theta)*radius)),V.mul(normal,depth));
  };
  for(let i=0;i<sections;i++){
    const theta=TAU*i/sections;
    ring.push(surface(theta,r,.005));
    inner.push(surface(theta,r*.48,-.075));
  }
  for(let i=0;i<sections;i++){
    const j=(i+1)%sections;
    const light=i%3===0?'#d7d9d5':i%2===0?'#bfc8c6':'#b7c1bf';
    urbanRoofPoly(g,[inner[i],inner[j],ring[j],ring[i]],light,null);
    urbanRoofPoly(g,[C,inner[i],inner[j]],'#99abae',null);
  }
  urbanRoofStroke(g,ring.concat([ring[0]]),'#e3e5e1',.034);
  urbanRoofStroke(g,[surface(-.50,r*.84,.008),
    surface(-.49,r*.35,-.056)],'rgba(251,251,239,.48)',.023);
  // Suportes radiais, receptor LNB e cabo coaxial até o mastro.
  const focal=V.add(C,V.mul(normal,.47));
  for(const offset of [-.35,.35]){
    urbanRoofStroke(g,[surface(offset,r*.78,-.01),focal],
      '#536066',.017);
  }
  urbanRoofStroke(g,[C,focal],'#667479',.030);
  const f=proj(...focal);g.fillStyle='#353d43';
  g.beginPath();g.ellipse(f.x,f.y,Math.max(1.3,cam.zoom*.053),
    Math.max(1.3,cam.zoom*.035),0,0,TAU);g.fill();
  urbanRoofStroke(g,[focal,center,upright,base],
    'rgba(39,49,49,.50)',.013);
  // Parafusos perceptiveis em zoom alto, sem linhas grossas artificiais.
  for(const p3 of [ring[0],ring[6],ring[12],ring[18]]){
    const q=proj(...p3);g.fillStyle='#778287';
    g.fillRect(q.x-.6,q.y-.6,1.3,1.3);
  }
}
function urbanYagi(g,H,a){
  const x=a.x,y=a.y,z=a.z,
    cx=Math.cos(a.yaw),sy=Math.sin(a.yaw),
    nx=-sy,ny=cx,base=[x,y,z+.08],
    top=[x,y,z+a.mast];
  urbanAntennaBracket(g,H,x,y,.18);
  urbanRoofStroke(g,[base,top],'#515b61',.053);
  urbanRoofStroke(g,[[x-.26,y,urbanRoofSurface(H,x-.26,y)+.035],
    [x,y,z+.52]],'#768088',.018);
  urbanRoofStroke(g,[[x+.26,y,urbanRoofSurface(H,x+.26,y)+.035],
    [x,y,z+.52]],'#77848a',.018);
  // Boom horizontal de alumínio: 10 dipolos graduados, escuros nas pontas.
  const zz=z+a.mast-.20,half=1.13,axis=[
    [x-cx*half,y-sy*half,zz],
    [x+cx*half,y+sy*half,zz]
  ];
  urbanRoofStroke(g,axis,'#949fa5',.045);
  for(let i=0;i<10;i++){
    const t=i/9,span=.53*(1-.45*t),
      px=x+cx*(-half+t*2*half),py=y+sy*(-half+t*2*half),
      a1=[px-nx*span,py-ny*span,zz],
      b1=[px+nx*span,py+ny*span,zz];
    urbanRoofStroke(g,[a1,b1],i%2===0?'#a7b0b5':'#828e92',.020);
    // Isolador escuro no ponto de ancoragem de cada dipolo.
    const p=proj(px,py,zz);g.fillStyle='#424d52';
    g.beginPath();g.arc(p.x,p.y,Math.max(.6,cam.zoom*.018),0,TAU);g.fill();
  }
  // Braço secundário de rádio e suporte, com cabinho descendo no mastro.
  urbanRoofStroke(g,[[x,y,zz],[x+nx*.36,y+cx*.36,zz-.09]],
    '#697c85',.020);
  urbanRoofStroke(g,[[x+nx*.36,y+cx*.36,zz-.09],
    [x+.03,y+.02,z+.20]],'rgba(39,43,45,.65)',.011);
  urbanRoofStroke(g,[[x,y,z+a.mast+.14],[x,y,z+a.mast-.2]],
    '#d1d6d1',.028);
}
function urbanDrawRooftopDetails(g,H,t){
  if(H.inside)return;
  for(const a of H.antennas||[]){
    if(a.kind==='dish')urbanDish(g,H,a);else urbanYagi(g,H,a);
  }
  urbanDrawChimney(g,H,t);
}

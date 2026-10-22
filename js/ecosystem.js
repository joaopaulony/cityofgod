// ecosystem.js — prados, polinizadores e pequenos animais 100% Canvas 2D.
// Sprites de flores pre-renderizados; somente animais proximos sao atualizados.
// Usa RNG proprio: a nova ambientacao nao altera a semente nem as casas do mapa.
'use strict';
const ecosystem={flowers:[],butterflies:[],squirrels:[],pollen:[],sprites:[],squirrelSprites:[],time:0,rng:null};
const WILDFLOWER_COLORS=[
  ['#f3e9d5','#b28d37'],['#e7c54b','#8e6a24'],
  ['#c7a5d4','#87688f'],['#d89aab','#a75e79'],
  ['#9eaccf','#596e9b'],['#e7a268','#aa6938'],
  ['#c65d5c','#8a4148'],['#d4cf98','#858847']
];
function ecoFlowerSprite(kind,rr){
  const c=makeCanvas(68,47),g=c.getContext('2d'),pal=WILDFLOWER_COLORS[kind];
  const stems=[];
  for(let i=0;i<8;i++){
    const x=34+(rr()-.5)*51,high=15+rr()*20,tip=x+(rr()-.5)*7;
    stems.push({x,tip,y:44-high,size:1.8+rr()*1.3});
  }
  g.fillStyle='rgba(20,30,11,.21)';g.beginPath();g.ellipse(34,43,23,3,0,0,TAU);g.fill();
  for(const s of stems){
    // Caules finos, ervas e folhas inferiores.
    g.strokeStyle='#456d35';g.lineWidth=1.15;g.beginPath();
    g.moveTo(s.x,44);g.quadraticCurveTo(s.tip+3,33,s.tip,s.y);g.stroke();
    g.fillStyle='#628848';g.beginPath();
    g.ellipse(s.x-2.4,36,4.5,1.6,-.55,0,TAU);
    g.ellipse(s.x+2.4,34,4.5,1.5,.55,0,TAU);g.fill();
  }
  for(const s of stems){
    g.fillStyle='rgba(42,36,20,.24)';g.beginPath();
    g.arc(s.tip+.5,s.y+.6,s.size+1.1,0,TAU);g.fill();
    for(let k=0;k<5;k++){
      const a=k*TAU/5+.1;
      g.fillStyle=pal[0];g.beginPath();
      g.ellipse(s.tip+Math.cos(a)*s.size*.78,
        s.y+Math.sin(a)*s.size*.78,s.size*.70,s.size*.46,a,0,TAU);g.fill();
    }
    g.fillStyle=pal[1];g.beginPath();g.arc(s.tip,s.y,s.size*.52,0,TAU);g.fill();
    g.fillStyle='rgba(255,243,190,.60)';g.fillRect(s.tip-.45,s.y-.65,.9,.9);
  }
  return {img:c,ax:34,ay:44};
}
function ecoFree(x,y){
  return x>1&&y>1&&x<MAP-1&&y<MAP-1&&
    !onRoad(x,y)&&pondVal(x,y)>1.17&&
    !(world.blocked&&world.blocked(x,y,.12));
}
// Pixel art feita pixel a pixel: tres pelagens, poses de repouso/corrida/escalada.
// Seis quadros por pose; cauda, torax, patas e orelhas mudam entre quadros.
// Pre-renderiza tudo UMA vez: nenhum fillRect de pixel ocorre durante os frames.
const SQUIRREL_PALETTES=[
  {edge:'#2b1c17',fur:'#916348',shade:'#67432e',sun:'#b88b65',belly:'#e1bd97',ear:'#d4988e',eye:'#141110'},
  {edge:'#29221c',fur:'#83715b',shade:'#5b4b3c',sun:'#b6a183',belly:'#e0cfad',ear:'#c8a693',eye:'#171310'},
  {edge:'#332016',fur:'#a7734a',shade:'#7c5032',sun:'#d6a073',belly:'#e8cca5',ear:'#dda18f',eye:'#1d1512'}
];
const SQUIRREL_PIXEL_SIZE=26;
// O divisor anterior (280) gerava menos de 8px de animal no zoom comum.
// Com 155 ficam ~14px: perceptivel, mas 5.5x menor que a versao gigante.
const SQUIRREL_SCALE_DIVISOR=155;
const SQUIRREL_DEBUG=new URLSearchParams(location.search).get('wildlifeDebug')==='1';
function ecoSquirrelPixelSprite(kind,pose,frame){
  const col=SQUIRREL_PALETTES[kind],c=makeCanvas(26,26),g=c.getContext('2d');
  g.imageSmoothingEnabled=false;
  const isClimb=pose==='climb',isRun=pose==='run',a=frame*TAU/6,
    sway=Math.sin(a)*1.6,breath=Math.sin(a)*.95;
  const px=(x,y,color)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),1,1);};
  const oval=(x,y,rx,ry,fill,outline)=>{
    for(let j=Math.floor(y-ry-1);j<=Math.ceil(y+ry+1);j++)
      for(let i=Math.floor(x-rx-1);i<=Math.ceil(x+rx+1);i++){
        const d=((i-x)/rx)**2+((j-y)/ry)**2;
        if(d<=1&&i>=0&&j>=0&&i<26&&j<26)
          px(i,j,d>.74?outline:fill);
      }
  };
  // Cauda volumosa e curva, na direcao oposta a cabeca, com movimento proprio.
  // A espessura diminui na ponta como o pelo de um esquilo pequeno.
  const root=isClimb?[11,20]:[9,19],
    tip=isClimb?[4+sway,15]:[4+sway,4+Math.sin(a+.9)];
  for(let i=0;i<=38;i++){
    const t=i/38,inv=1-t;
    const x=inv*inv*root[0]+2*inv*t*(isClimb?1.7:1.0)+t*t*tip[0];
    const y=inv*inv*root[1]+2*inv*t*(isClimb?24:14)+t*t*tip[1];
    const radius=1.1+2.6*Math.sin(Math.PI*Math.pow(t,.8));
    oval(x,y,radius,radius*(isClimb?1.08:.95),col.fur,col.edge);
    if(t>.22&&t<.85)px(x-.65,y-.8,col.sun);
  }
  // Patas traseiras sao sincronizadas com a corrida; aderem ao tronco na escalada.
  const stride=isRun?Math.round(Math.sin(a)*3):0;
  if(isClimb){
    oval(11,21+stride*.17,2.2,3,col.shade,col.edge);
    oval(18,21-stride*.17,2.2,3,col.shade,col.edge);
    oval(10,13,2.2,2,col.fur,col.edge);
    oval(19,12,2.2,2,col.fur,col.edge);
  }else{
    oval(8-stride,21,3,2,col.shade,col.edge);
    oval(18+stride,21,3,2,col.shade,col.edge);
  }
  const bodyX=isClimb?14:14,bodyY=isClimb?16:18;
  oval(bodyX,bodyY,isClimb?4.1:7.1,(isClimb?6:4.2)+breath*.68,col.fur,col.edge);
  oval(isClimb?16:17,isClimb?16:18,isClimb?1.8:3.0,
    (isClimb?4.2:2.9)+breath*.55,col.belly,col.fur);
  // Pelagem no dorso e brilho nos ombros, apenas alguns pixels discretos.
  for(const [dx,dy] of [[-4,-1],[-3,-2],[-2,-3],[0,-3]])
    px(bodyX+dx,bodyY+dy,col.sun);
  if(isRun){
    oval(13-stride*.35,21,2,1.4,col.shade,col.edge);
    oval(18+stride*.35,20,2,1.4,col.shade,col.edge);
  }else if(!isClimb){
    oval(18,19,2,2,col.fur,col.edge);
    px(19,20,col.belly);
  }
  const hx=isClimb?16:20,hy=isClimb?9:12;
  // Orelhas pequenas, interior rosado e focinho claro.
  oval(hx-3,hy-4,2,2.3,col.fur,col.edge);
  px(hx-3,hy-4,col.ear);
  oval(hx+.5,hy-3,1.5,2,col.fur,col.edge);
  oval(hx,hy,4,3.3,col.fur,col.edge);
  px(hx-1,hy-2,col.sun);
  oval(hx+2,hy+1,2.1,1.5,col.belly,col.fur);
  px(hx+3,hy+1,'#b47e7c'); // nariz
  px(hx+1,hy-1,col.eye);
  px(hx+1,hy-2,'#f1ddc2'); // brilho do olho
  // Bigodes delicados, perceptiveis apenas com zoom alto.
  px(hx+4,hy,col.shade);
  if(isClimb){
    // Dedos prendendo o tronco; alternam de altura durante a escalada.
    oval(11,12+(frame%2),2,1.4,col.fur,col.edge);
    oval(20,14-(frame%2),2,1.4,col.fur,col.edge);
  }
  return {img:c,ax:13,ay:24};
}
function ecoMakeSquirrelSprites(){
  return SQUIRREL_PALETTES.map((_,kind)=>{
    const poses={};
    for(const pose of ['idle','run','climb'])
      poses[pose]=Array.from({length:6},(_,frame)=>
        ecoSquirrelPixelSprite(kind,pose,frame));
    return poses;
  });
}
// Seleciona um caminho curto livre de agua, ruas e construcoes.
function ecoSquirrelEscape(s,player,rr){
  const dist=Math.max(.001,Math.hypot(s.x-player.x,s.y-player.y));
  const angle=Math.atan2(s.y-player.y,s.x-player.x);
  const tree=s.tree,treeDistance=Math.hypot(tree.x-player.x,tree.y-player.y);
  // Tronco seguro: o animal realmente sobe, nunca flutua direto ate a copa.
  if(treeDistance>6.5&&Math.hypot(s.x-tree.x,s.y-tree.y)<4&&rr()<.6){
    s.mode='toTree';s.goalX=tree.x;s.goalY=tree.y;
    s.goalZ=tree.sp.trunkH+Math.min(tree.sp.r*.24,.62);
    s.panic=.8;s.timer=0;return;
  }
  for(const d of [9,7,5,3]){
    for(const turn of [0,.40,-.40,.8,-.8,1.2,-1.2]){
      const a=angle+turn,x=s.x+Math.cos(a)*d,y=s.y+Math.sin(a)*d;
      if(Math.hypot(x-player.x)<dist+2||!ecoFree(x,y))continue;
      let clear=true;
      for(let k=1;k<=8;k++)
        if(!ecoFree(s.x+(x-s.x)*k/8,s.y+(y-s.y)*k/8)){
          clear=false;break;
        }
      if(!clear)continue;
      s.mode='flee';s.goalX=x;s.goalY=y;s.goalZ=.035;
      s.dir=a;s.panic=.8;s.timer=.65;return;
    }
  }
  // Sem corredor livre, suba o proprio tronco em vez de atravessar obstaculos.
  s.mode='toTree';s.goalX=tree.x;s.goalY=tree.y;
  s.goalZ=tree.sp.trunkH+Math.min(tree.sp.r*.22,.57);s.panic=.8;s.timer=.5;
}
function ecosystemInit(){
  const rr=ecosystem.rng=mulberry(world.seed^0x395f2b19);
  ecosystem.flowers=[];ecosystem.butterflies=[];ecosystem.squirrels=[];ecosystem.pollen=[];
  ecosystem.sprites=WILDFLOWER_COLORS.map((_,i)=>ecoFlowerSprite(i,rr));
  // Pequenos conjuntos de flores, e nao um tapete artificial uniforme.
  for(let i=0;i<5200&&ecosystem.flowers.length<860;i++){
    const x=1+rr()*(MAP-2),y=1+rr()*(MAP-2),f=forest(x,y);
    if(f<.36||f>.79||!ecoFree(x,y))continue;
    const type=(rr()*ecosystem.sprites.length)|0;
    ecosystem.flowers.push({x,y,sp:ecosystem.sprites[type],phase:rr()*TAU,
      density:.65+rr()*.35,kind:type});
  }
  // Borboletas preferem areas onde existem flores. Limite global e por camera.
  for(let i=0;i<90&&ecosystem.flowers.length;i++){
    const plant=ecosystem.flowers[(rr()*ecosystem.flowers.length)|0],a=rr()*TAU;
    ecosystem.butterflies.push({x:plant.x+Math.cos(a)*rr()*.7,
      y:plant.y+Math.sin(a)*rr()*.7,homeX:plant.x,homeY:plant.y,
      z:.4+rr()*.5,phase:rr()*TAU,heading:rr()*TAU,kind:(rr()*5)|0,
      speed:.18+rr()*.2,flight:rr()*TAU});
  }
  // Colocacao mais natural e visivel: animais preferem arvores, nao surgem
  // sobre a grama por teleporte. Prioriza exemplares proximos ao spawn quando
  // houver arvores la, depois distribui territorios pelo resto da floresta.
  ecosystem.squirrelSprites=ecoMakeSquirrelSprites();
  const trees=world.props.filter(p=>p.type==='tree'&&ecoFree(p.x,p.y));
  const distSpawn=t=>Math.hypot(t.x-world.spawn[0],t.y-world.spawn[1]);
  const near=trees.filter(t=>distSpawn(t)<24),far=trees.filter(t=>distSpawn(t)>=24);
  // Embaralha com RNG proprio para distribuir no mesmo seed sem repeticoes.
  const shuffle=a=>{
    for(let i=a.length-1;i>0;i--){
      const j=(rr()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  };
  const candidates=[...shuffle(near),...shuffle(far)];
  let closeSpawns=0;
  for(const t of candidates){
    if(ecosystem.squirrels.length>=105)break;
    const isNear=distSpawn(t)<24;
    if((!isNear||closeSpawns>=3)&&rr()>.64)continue;
    if(ecosystem.squirrels.some(s=>
      Math.hypot(s.homeX-t.x,s.homeY-t.y)<3.25))continue;
    let x=0,y=0,found=false;
    for(let trial=0;trial<4;trial++){
      const a=rr()*TAU,d=.35+rr()*1.2;
      x=t.x+Math.cos(a)*d;y=t.y+Math.sin(a)*d;
      if(ecoFree(x,y)){found=true;break;}
    }
    if(!found)continue;
    ecosystem.squirrels.push({x,y,z:.035,tree:t,
      homeX:t.x,homeY:t.y,goalX:x,goalY:y,goalZ:.035,
      phase:rr()*TAU,anim:rr()*6,dir:rr()*TAU,
      timer:1+rr()*3,kind:(rr()*3)|0,move:0,panic:0,mode:'forage'});
    if(isNear)closeSpawns++;
  }
  // Particulas leves de sementes/polen acompanham o vento perto da camera.
  for(let i=0;i<28;i++)ecosystem.pollen.push({x:0,y:0,z:.3+rr()*1.1,
    phase:rr()*TAU,size:.55+rr()*1.0,alpha:.2+rr()*.24,ready:false});
}

function ecosystemTick(dt,player,t){
  if(!dt)return;
  const rr=ecosystem.rng;ecosystem.time=t;
  for(const b of ecosystem.butterflies){
    if(Math.abs(b.x-player.x)>24||Math.abs(b.y-player.y)>24)continue;
    b.phase+=dt*10;b.flight+=dt*(1.3+b.speed);
    const flee=Math.hypot(b.x-player.x,b.y-player.y)<2.1;
    const a=flee?Math.atan2(b.y-player.y,b.x-player.x):
      b.heading+Math.sin(b.flight)*.65;
    const speed=b.speed*(flee?3.0:1);
    const nx=b.x+Math.cos(a)*speed*dt,ny=b.y+Math.sin(a)*speed*dt;
    if(ecoFree(nx,ny)&&Math.hypot(nx-b.homeX,ny-b.homeY)<2.9){
      b.x=nx;b.y=ny;
    }else b.heading+=Math.PI*.7;
    b.z=clamp(b.z+Math.sin(b.phase*.32)*dt*.1,.22,1.15);
  }
  for(const s of ecosystem.squirrels){
    if(Math.abs(s.x-player.x)>28||Math.abs(s.y-player.y)>28)continue;
    s.timer-=dt;s.panic=Math.max(0,s.panic-dt);
    const distance=Math.hypot(s.x-player.x,s.y-player.y),
      high=s.mode==='climb'||s.mode==='perch'||s.mode==='descend';
    if(distance<5.5&&!high&&s.panic<=0)
      ecoSquirrelEscape(s,player,rr);
    // Escalada fisica em etapas, da raiz ate a copa, e descida pelo tronco.
    if(s.mode==='climb'||s.mode==='descend'){
      const destination=s.mode==='climb'?s.goalZ:.035;
      const step=(s.mode==='climb'?2.6:2.3)*dt;
      s.z+=clamp(destination-s.z,-step,step);
      s.anim+=dt*13;
      s.move=1;
      if(Math.abs(s.z-destination)<.055){
        s.z=destination;
        if(s.mode==='climb'){
          s.mode='perch';s.timer=1.2+rr()*2.0;
        }else{
          s.mode='forage';s.timer=.3+rr()*.9;
        }
      }
      continue;
    }
    if(s.mode==='perch'){
      s.anim+=dt*4;
      s.move=0;
      if(distance>7&&s.timer<=0){
        s.mode='descend';s.goalZ=.035;
      }else if(s.timer<=0) s.timer=1+rr()*2.2;
      continue;
    }
    if(s.mode==='forage'&&s.timer<=0){
      if(rr()<.17){
        s.mode='toTree';s.goalX=s.tree.x;s.goalY=s.tree.y;
        s.goalZ=s.tree.sp.trunkH+Math.min(s.tree.sp.r*.28,.69);
      }else{
        const a=rr()*TAU,d=.7+rr()*2.65;
        s.goalX=s.homeX+Math.cos(a)*d;
        s.goalY=s.homeY+Math.sin(a)*d;
        s.goalZ=.035;
      }
      s.timer=1.15+rr()*2.5;
    }
    if(s.mode==='recover'&&s.timer<=0){
      s.mode='toTree';s.goalX=s.tree.x;s.goalY=s.tree.y;
      s.goalZ=s.tree.sp.trunkH+Math.min(s.tree.sp.r*.25,.64);
    }
    const dx=s.goalX-s.x,dy=s.goalY-s.y,d=Math.hypot(dx,dy);
    if(d>.07){
      const speed=s.mode==='flee'?6.2:s.mode==='toTree'?2.35:1.35,
        step=Math.min(d,speed*dt),a=Math.atan2(dy,dx),
        nx=s.x+Math.cos(a)*step,ny=s.y+Math.sin(a)*step;
      if(ecoFree(nx,ny)){
        s.x=nx;s.y=ny;s.dir=a;
        s.move=Math.min(1,s.move+dt*9);
      }else{
        s.timer=0;s.panic=0;s.mode='forage';s.move=0;
      }
    }else{
      s.move=Math.max(0,s.move-dt*6);
      if(s.mode==='toTree'){
        // O tronco e alcancado no chao, depois o esquilo sobe de verdade.
        s.x=s.tree.x;s.y=s.tree.y;s.mode='climb';
      }else if(s.mode==='flee'){
        s.mode='recover';s.timer=.45+rr()*.9;
      }
    }
    s.anim+=dt*(s.move>.1?(s.mode==='flee'?22:15):3.8);
    s.phase+=dt;
  }

  for(const p of ecosystem.pollen){
    if(!p.ready||Math.abs(p.x-player.x)>17||Math.abs(p.y-player.y)>16){
      p.x=player.x+(rr()-.5)*26;p.y=player.y+(rr()-.5)*22;p.ready=true;
    }
    p.phase+=dt;
    const gust=wind(t,p.x,p.y);
    p.x+=dt*(.11+gust*.23);
    p.y+=dt*(.04+gust*.13);
  }
}
function ecoDrawFlower(g,f,t){
  const p=proj(f.x,f.y,0),sc=cam.zoom/SPR,
    breeze=wind(t,f.x,f.y),shear=breeze*.09;
  drawSway(g,f.sp.img,f.sp.ax,f.sp.ay,p,sc*f.density,shear);
}
function ecoDrawButterfly(g,b,t){
  const p=proj(b.x,b.y,b.z+Math.sin(t*3.5+b.flight)*.08);
  const sc=clamp(cam.zoom*.11,2.1,8.4);
  const flap=.22+.78*Math.abs(Math.sin(b.phase));
  const palette=['#d5b86a','#e4d6b6','#b6a8c3','#b9c6b1','#c98b58'];
  g.save();g.translate(p.x,p.y);g.rotate(Math.sin(b.flight)*.28);
  g.fillStyle='rgba(25,25,18,.2)';g.beginPath();g.ellipse(1,2,sc*.5,sc*.14,0,0,TAU);g.fill();
  for(const side of [-1,1]){
    g.save();g.scale(side*flap,1);
    g.fillStyle='#443e32';g.beginPath();g.ellipse(sc*.32,-sc*.18,sc*.50,sc*.37,-.3,0,TAU);g.fill();
    g.fillStyle=palette[b.kind];g.beginPath();g.ellipse(sc*.32,-sc*.22,sc*.41,sc*.29,-.3,0,TAU);g.fill();
    g.fillStyle=palette[b.kind];g.beginPath();g.ellipse(sc*.24,sc*.13,sc*.30,sc*.23,.3,0,TAU);g.fill();
    g.restore();
  }
  g.strokeStyle='#3a3429';g.lineWidth=Math.max(.6,sc*.095);g.beginPath();g.moveTo(0,-sc*.35);g.lineTo(0,sc*.33);g.stroke();
  g.restore();
}
function ecoDrawSquirrel(g,s,t){
  // O sprite antigo tinha ~37 unidades de largura e era ampliado por zoom/40.
  // Este tem 26px em escala adaptada: continua pequeno, mas identificavel.
  const pose=s.mode==='climb'||s.mode==='descend'?'climb':
    s.move>.15?'run':'idle';
  const frames=ecosystem.squirrelSprites[s.kind][pose];
  const frame=Math.floor(Math.max(0,s.anim))%frames.length,sp=frames[frame];
  const sc=cam.zoom/SQUIRREL_SCALE_DIVISOR;
  const hop=pose==='run'?Math.abs(Math.sin(s.anim*.52))*.048:0;
  const p=proj(s.x,s.y,s.z+hop);
  const direction=Math.cos(s.dir-cam.ang)>=0?1:-1;
  g.save();
  g.imageSmoothingEnabled=false;
  // Sombra permanece no solo inclusive enquanto o esquilo sobe na arvore.
  const foot=proj(s.x,s.y,0);
  g.fillStyle='rgba(17,20,10,.32)';g.beginPath();
  g.ellipse(foot.x,foot.y+1.3,Math.max(1.5,cam.zoom*.037),
    Math.max(.55,cam.zoom*.016),0,0,TAU);g.fill();
  g.translate(p.x,p.y);g.scale(sc*direction,sc);
  g.drawImage(sp.img,-sp.ax,-sp.ay);
  g.restore();
  // Marcador de diagnostico somente quando ?wildlifeDebug=1.
  // Nao altera a experiencia normal, mas permite localizar bichos na floresta.
  if(SQUIRREL_DEBUG){
    g.save();g.strokeStyle='#ffe275';g.lineWidth=1.3;
    g.beginPath();g.arc(p.x,p.y-2,Math.max(7,cam.zoom*.11),0,TAU);g.stroke();
    g.restore();
  }
}

function ecosystemAddDrawables(list,g,t,player){
  const W=cam.W,H=cam.H,margin=cam.zoom*2.3;
  const visible=(x,y,z=0)=>{
    const p=proj(x,y,z);
    return p.x>-margin&&p.x<W+margin&&p.y>-margin&&p.y<H+margin;
  };
  for(const f of ecosystem.flowers)
    if(visible(f.x,f.y))list.push({d:depthOf(f.x,f.y)-.16,draw:()=>ecoDrawFlower(g,f,t)});
  for(const b of ecosystem.butterflies)
    if(visible(b.x,b.y,b.z))list.push({d:depthOf(b.x,b.y)+.35,draw:()=>ecoDrawButterfly(g,b,t)});
  for(const s of ecosystem.squirrels)
    if(visible(s.x,s.y,s.z))list.push({d:depthOf(s.x,s.y)+.03+(s.z>.2?.25:0),draw:()=>ecoDrawSquirrel(g,s,t)});
}
function ecosystemDrawPollen(g,t,night){
  if(night)return;
  for(const q of ecosystem.pollen){
    if(onRoad(q.x,q.y)||pondVal(q.x,q.y)<1.12)continue;
    const p=proj(q.x,q.y,q.z+Math.sin(t*.8+q.phase)*.1);
    if(p.x<0||p.y<0||p.x>cam.W||p.y>cam.H)continue;
    const gust=wind(t,q.x,q.y),radius=Math.max(.55,q.size*cam.zoom/55);
    g.globalAlpha=q.alpha*(.7+.3*Math.sin(q.phase*2)**2);
    g.strokeStyle='#e7ddaa';g.lineWidth=Math.max(.55,radius*.6);
    g.beginPath();g.moveTo(p.x,p.y);
    g.lineTo(p.x-radius*(1.5+Math.abs(gust)*2),p.y-radius*.55);g.stroke();
  }
  g.globalAlpha=1;
}

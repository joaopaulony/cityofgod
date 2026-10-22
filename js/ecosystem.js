// ecosystem.js — prados, polinizadores e pequenos animais 100% Canvas 2D.
// Sprites de flores pre-renderizados; somente animais proximos sao atualizados.
// Usa RNG proprio: a nova ambientacao nao altera a semente nem as casas do mapa.
'use strict';
const ecosystem={flowers:[],butterflies:[],squirrels:[],pollen:[],sprites:[],time:0,rng:null};
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
  // Esquilos pequenos ao redor da base das arvores, longe da rua e da agua.
  const trees=world.props.filter(p=>p.type==='tree'&&ecoFree(p.x,p.y));
  for(let i=0;i<trees.length&&ecosystem.squirrels.length<55;i++){
    const t=trees[(rr()*trees.length)|0];
    if(rr()>.26)continue;
    if(ecosystem.squirrels.some(s=>Math.hypot(s.homeX-t.x,s.homeY-t.y)<5))continue;
    const a=rr()*TAU,d=.55+rr()*1.25,x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;
    if(!ecoFree(x,y))continue;
    ecosystem.squirrels.push({x,y,homeX:t.x,homeY:t.y,
      goalX:x,goalY:y,phase:rr()*TAU,dir:rr()*TAU,
      timer:.5+rr()*3,kind:(rr()*3)|0,move:0});
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
    if(Math.abs(s.x-player.x)>23||Math.abs(s.y-player.y)>23)continue;
    s.timer-=dt;
    const danger=Math.hypot(s.x-player.x,s.y-player.y)<3;
    if(danger){
      const a=Math.atan2(s.y-player.y,s.x-player.x);
      const tx=s.x+Math.cos(a)*2.0,ty=s.y+Math.sin(a)*2.0;
      s.goalX=clamp(tx,s.homeX-2.7,s.homeX+2.7);
      s.goalY=clamp(ty,s.homeY-2.7,s.homeY+2.7);s.timer=.6;
    }else if(s.timer<=0){
      const a=rr()*TAU,d=rr()*1.8;
      s.goalX=s.homeX+Math.cos(a)*d;
      s.goalY=s.homeY+Math.sin(a)*d;
      s.timer=1.1+rr()*4;
    }
    const dx=s.goalX-s.x,dy=s.goalY-s.y,d=Math.hypot(dx,dy);
    if(d>.12){
      const speed=danger?2.2:.55,step=Math.min(d,speed*dt),a=Math.atan2(dy,dx);
      const nx=s.x+Math.cos(a)*step,ny=s.y+Math.sin(a)*step;
      if(ecoFree(nx,ny)){
        s.x=nx;s.y=ny;s.dir=a;s.move=Math.min(1,s.move+dt*6);
      }else{s.timer=0;s.move=0;}
    }else s.move=Math.max(0,s.move-dt*4);
    s.phase+=dt*(s.move>0.1?13:2.2);
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
  const p=proj(s.x,s.y,.06),sc=cam.zoom/40;
  const coats=[['#81533a','#b78560'],['#735946','#a98b6a'],['#9e6a42','#c3956e']],
    coat=coats[s.kind],hop=s.move*Math.abs(Math.sin(s.phase))*2.4;
  const facing=Math.cos(s.dir-cam.ang)>=0?1:-1;
  g.save();g.translate(p.x,p.y-hop*sc);g.scale(sc*facing,sc);
  // Sombra de contato e cauda grossa, com ponta afilada em curva.
  g.fillStyle='rgba(20,23,12,.26)';g.beginPath();g.ellipse(0,4,11,3,0,0,TAU);g.fill();
  g.strokeStyle='#57402f';g.lineCap='round';g.lineWidth=7;g.beginPath();
  g.moveTo(-6,-5);g.bezierCurveTo(-18,-6,-22,-25,-12,-27);g.stroke();
  g.strokeStyle=coat[0];g.lineWidth=5.5;g.beginPath();
  g.moveTo(-6,-5);g.bezierCurveTo(-17,-7,-20,-24,-12,-27);g.stroke();
  g.fillStyle=coat[0];g.beginPath();g.ellipse(0,-5,10,5.5,-.13,0,TAU);g.fill();
  g.fillStyle=coat[1];g.beginPath();g.ellipse(4,-6,5.4,3.5,0,0,TAU);g.fill();
  // Quatro patinhas alternando passada na corrida.
  g.strokeStyle='#49362b';g.lineWidth=2;g.beginPath();
  const stride=Math.sin(s.phase)*s.move*3;
  g.moveTo(-5,-2);g.lineTo(-7-stride,3);
  g.moveTo(3,-2);g.lineTo(5+stride,3);g.stroke();
  g.fillStyle=coat[0];g.beginPath();g.ellipse(9,-10,5.0,4.6,0,0,TAU);g.fill();
  g.beginPath();g.ellipse(7.2,-14,2.0,3.0,-.2,0,TAU);g.fill();
  g.fillStyle='#d6a89b';g.beginPath();g.ellipse(7.2,-14.3,.8,1.5,0,0,TAU);g.fill();
  g.fillStyle='#241f1a';g.beginPath();g.arc(11,-11,1.0,0,TAU);g.fill();
  g.fillStyle='#dcbca4';g.fillRect(12.7,-8.3,1.7,1.0);
  g.restore();
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
    if(visible(s.x,s.y))list.push({d:depthOf(s.x,s.y)+.03,draw:()=>ecoDrawSquirrel(g,s,t)});
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

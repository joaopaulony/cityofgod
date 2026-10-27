// multistorey.js — sobrados urbanos 2D isometricos, laje, comodos e escadas.
// Mantem os modelos antigos; cada sobrado usa a mesma rotacao/localizacao do lote.
'use strict';
const STOREY_HEIGHT=2.75;

// Sobrado familiar: hall/escada, sala, cozinha, jantar; quartos e banheiro em cima.
TPL.C={
  w:12,d:10,setback:3.4,yard:true,
  def:{h:STOREY_HEIGHT*2,storeys:2,floorHeight:STOREY_HEIGHT,
    roofKind:'hip',open:{
      S:{door:[5],win:[1,2,9,10]},N:{win:[1,3,8,10]},
      E:{win:[2,7]},W:{win:[2,7]}},
    inner:[{x1:6,y1:0,x2:6,y2:6,door:2},
      {x1:0,y1:5,x2:6,y2:5,door:2}],
    floors:[{x0:0,y0:0,x1:6,y1:10,kind:'wood',col:'#8f6b48'},
      {x0:6,y0:0,x1:12,y1:10,kind:'tile',col:'#d2c7ac'}]},
  furn:[
    {x:1.2,y:2,w:.7,d:2.4,h:.5,kind:'sofa',top:'#787663',side:'#605444'},
    {x:3.4,y:1.2,w:1.5,d:.5,h:.75,kind:'tv',top:'#655d53',side:'#443b35'},
    {x:3.5,y:7.4,w:1.8,d:1.15,h:.74,kind:'table',top:'#9b7752',side:'#64482f'},
    {x:8.2,y:.65,w:3.2,d:.6,h:.9,kind:'counter',top:'#dfd6c7',side:'#86715e'},
    {x:11.45,y:2.2,w:.7,d:.8,h:1.8,kind:'fridge',top:'#edece5',side:'#aaa99e'},
    {x:9.2,y:8,w:1.7,d:1.05,h:.73,kind:'table',top:'#9e7650',side:'#6f5136'}
  ],
  upper:{
    stair:{x:4.8,y:7.8},
    walls:[
      {x1:6,y1:0,x2:6,y2:10,door:6},
      {x1:0,y1:5,x2:6,y2:5,door:3},
      {x1:6,y1:5,x2:12,y2:5,door:3}
    ],
    furn:[
      {x:2,y:1.6,w:2.2,d:2.4,h:.55,kind:'bed',top:'#ded8ce',side:'#7e5d43'},
      {x:1.1,y:4.4,w:1,d:.45,h:.7,kind:'desk',top:'#a48b6d',side:'#6f573f'},
      {x:8.3,y:1.5,w:2.2,d:2.6,h:.55,kind:'bed',top:'#e6dbd2',side:'#746354'},
      {x:11.4,y:3.3,w:.6,d:1.6,h:1.8,kind:'wardrobe',top:'#827063',side:'#594538'},
      {x:9.4,y:8,w:1.35,d:.65,h:.78,kind:'sink',top:'#e4e2d9',side:'#acaaa2'},
      {x:11.3,y:8.3,w:.65,d:.8,h:.47,kind:'toilet',top:'#e5e5df',side:'#b8b7b1'}
    ],
    style:'#a78f70'
  }
};
// Sobrado compacto: hall/estar, cozinha, escada, 2 dormitorios, banheiro.
TPL.D={
  w:10,d:10,setback:2.9,yard:false,
  def:{h:STOREY_HEIGHT*2,storeys:2,floorHeight:STOREY_HEIGHT,
    roofKind:'gable',open:{
      S:{door:[4],win:[1,7,8]},N:{win:[2,7]},
      E:{win:[2,7]},W:{win:[2,7]}},
    inner:[{x1:5,y1:0,x2:5,y2:6,door:2},
      {x1:5,y1:6,x2:10,y2:6,door:2}],
    floors:[{x0:0,y0:0,x1:5,y1:10,kind:'wood',col:'#8a694b'},
      {x0:5,y0:0,x1:10,y1:10,kind:'tile',col:'#cec6b4'}]},
  furn:[
    {x:1,y:2,w:.65,d:2,h:.48,kind:'sofa',top:'#657d88',side:'#435661'},
    {x:3.7,y:1.1,w:1.2,d:.5,h:.75,kind:'tv',top:'#706454',side:'#41372d'},
    {x:7,y:.6,w:3.2,d:.55,h:.9,kind:'counter',top:'#e0d9c7',side:'#746557'},
    {x:9.35,y:3.8,w:.65,d:.65,h:1.8,kind:'fridge',top:'#e3e3dd',side:'#a5a39f'},
    {x:7.5,y:8.5,w:1.5,d:.75,h:.76,kind:'table',top:'#9d714f',side:'#63462f'}
  ],
  upper:{
    stair:{x:3,y:7.4},
    walls:[
      {x1:5,y1:0,x2:5,y2:10,door:6},
      {x1:0,y1:5,x2:5,y2:5,door:2},
      {x1:5,y1:5,x2:10,y2:5,door:2}
    ],
    furn:[
      {x:2,y:1.6,w:2,d:2.4,h:.54,kind:'bed',top:'#e5ddd2',side:'#826147'},
      {x:4.5,y:4,w:.65,d:1.4,h:1.85,kind:'wardrobe',top:'#917657',side:'#5d4935'},
      {x:7.2,y:1.4,w:2.1,d:2.3,h:.54,kind:'bed',top:'#d4dce2',side:'#6d7680'},
      {x:9.35,y:3.8,w:.65,d:.75,h:.7,kind:'desk',top:'#b29b78',side:'#736149'},
      {x:7.2,y:8,w:1.2,d:.65,h:.8,kind:'sink',top:'#e2e2de',side:'#a7a6a1'},
      {x:9.2,y:8.2,w:.65,d:.8,h:.45,kind:'toilet',top:'#e5e7e4',side:'#aaaead'}
    ],
    style:'#aaa28d'
  }
};
// Paredes do andar superior sao colisao separada (nunca afetam NPCs no chao).
function initUpperFloor(H,T,L,k){
  if(!T.upper)return;
  const u=T.upper,z=H.floorHeight;
  H.upper={z,walls:[],furniture:[],style:u.style};
  const bottom=L(u.stair.x,u.stair.y+.52),top=L(u.stair.x,u.stair.y-.52);
  H.stair={house:H,x:L(u.stair.x,u.stair.y)[0],
    y:L(u.stair.x,u.stair.y)[1],bottom,top,z,rot:k*Math.PI/2,local:u.stair};
  world.upperSegs=world.upperSegs||[];
  for(const wall of u.walls){
    const start=L(wall.x1,wall.y1),end=L(wall.x2,wall.y2),
      n=Math.round(Math.hypot(end[0]-start[0],end[1]-start[1])),
      dx=(end[0]-start[0])/n,dy=(end[1]-start[1])/n;
    for(let j=0;j<n;j++){
      const seg={x1:start[0]+dx*j,y1:start[1]+dy*j,
        x2:start[0]+dx*(j+1),y2:start[1]+dy*(j+1),
        house:H,ext:false,floor:1,z,door:j===wall.door,
        doorAnim:j===wall.door?{open:0,target:0}:null};
      H.upper.walls.push(seg);
      world.upperSegs.push(seg);
    }
  }
  // Porta do primeiro andar nao pode funcionar como um buraco no piso superior.
  for(const s of H.segs)if(s.ext&&s.door)world.upperSegs.push({
    x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,floor:1,house:H
  });
  for(const f of u.furn){
    const p=L(f.x,f.y),b=addBox({...f,x:p[0],y:p[1],z,rot:(f.rot||0)+k*Math.PI/2,
      house:H,floor:1,solid:false});
    H.upper.furniture.push(b);
    if(f.solid===false)continue;
    const corners=boxCorners(b);
    for(let i=0;i<4;i++)world.upperSegs.push({
      x1:corners[i][0],y1:corners[i][1],
      x2:corners[(i+1)%4][0],y2:corners[(i+1)%4][1],house:H,floor:1
    });
  }
  // Degraus geometricos em z crescente, como referencia visual da escada.
  // O jogador ativa F no patamar, subindo animadamente sem teleportar no eixo XY.
  H.upper.steps=Array.from({length:10},(_,i)=>{
    const p=L(u.stair.x,u.stair.y+.52-i*(1.04/9));
    return {x:p[0],y:p[1],z:z*(i/10),
      width:1.08,depth:.19};
  });
}
function upstairsHouseAt(x,y){
  return houses.find(H=>H.stair&&(H.architecture?H.contains(x,y):x>H.x0+.15&&x<H.x1-.15&&
    y>H.y0+.15&&y<H.y1-.15))||null;
}
function houseStairProximity(p){
  if(!p||p.stairTravel)return null;
  const H=upstairsHouseAt(p.x,p.y);
  if(!H?.stair)return null;
  if(H.architecture){
    const floor=p.floor||0,levels=H.architecture.levels,s=levels[floor]?.stair;
    if(!s)return null;
    const down=floor>0?Math.hypot(p.x-s.top[0],p.y-s.top[1]):Infinity;
    const up=floor<levels.length-1?Math.hypot(p.x-s.bottom[0],p.y-s.bottom[1]):Infinity;
    const distance=Math.min(down,up);
    return distance<1.1?{distance,label:down<up?'Descer escada':'Subir escada'}:null;
  }
  const distance=Math.hypot(p.x-H.stair.x,p.y-H.stair.y);
  return distance<1.05?{distance,label:p.floor===1?'Descer escada':'Subir escada'}:null;
}
function updateHouseStairs(p,dt,activate){
  if(p.stairTravel){
    const tr=p.stairTravel;
    tr.t=Math.min(1,tr.t+dt/1.55);
    // Caminha por uma transicao de subida suave, sem escada instantanea.
    const t=tr.t*tr.t*(3-2*tr.t);
    p.floorZ=tr.start+(tr.end-tr.start)*t;
    p.x=tr.fromX+(tr.toX-tr.fromX)*t;
    p.y=tr.fromY+(tr.toY-tr.fromY)*t;
    if(tr.t>=1){
      p.floor=tr.to;p.floorZ=tr.end;p.stairTravel=null;
    }
    return true;
  }
  if(!activate)return false;
  const H=upstairsHouseAt(p.x,p.y);
  if(H?.architecture){
    const floor=p.floor||0,level=H.architecture.levels[floor],s=level.stair;
    const down=floor>0&&Math.hypot(p.x-s.top[0],p.y-s.top[1])<1.1;
    const up=floor<H.architecture.levels.length-1&&Math.hypot(p.x-s.bottom[0],p.y-s.bottom[1])<1.1;
    if(!down&&!up)return false;
    const to=floor+(down?-1:1),target=down?s.bottom:s.top;
    p.stairTravel={to,start:p.floorZ||0,end:to*H.floorHeight,fromX:p.x,fromY:p.y,toX:target[0],toY:target[1],t:0};return true;
  }
  if(!H||Math.hypot(p.x-H.stair.x,p.y-H.stair.y)>1.05)return false;
  const to=p.floor===1?0:1;
  p.stairTravel={to,start:p.floorZ||0,
    end:to===1?H.stair.z:0,
    fromX:p.x,fromY:p.y,toX:to===1?H.stair.top[0]:H.stair.bottom[0],
    toY:to===1?H.stair.top[1]:H.stair.bottom[1],t:0};
  return true;
}
// Escada de madeira com degraus de espelho e corrimao, desenhada somente
// na casa em que o jogador entrou: nao se paga esse custo na rua.
function drawHouseStaircase(g,H){
  for(const step of H.upper.steps)drawBox(g,{
    x:step.x,y:step.y,z:step.z,w:step.width,d:step.depth,
    h:.17,rot:H.stair.rot,top:'#c8a47c',side:'#735139',kind:'step'
  });
  const p=H.upper.steps;
  for(const side of [-1,1]){
    const offset=side*.48,ang=H.stair.rot,
      ox=Math.cos(ang)*offset,oy=Math.sin(ang)*offset;
    const a=proj(p[0].x+ox,p[0].y+oy,.85),
      b=proj(p[p.length-1].x+ox,p[p.length-1].y+oy,H.stair.z+.72);
    g.strokeStyle='rgba(35,25,17,.84)';g.lineWidth=Math.max(2,cam.zoom*.048);
    g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
    g.strokeStyle='#a98152';g.lineWidth=Math.max(1,cam.zoom*.025);g.stroke();
  }
}
function drawHouseUpper(g,H){
  if(!H.upper)return;
  const z=H.upper.z;
  const base=[[H.x0+.12,H.y0+.12],[H.x1-.12,H.y0+.12],
    [H.x1-.12,H.y1-.12],[H.x0+.12,H.y1-.12]];
  // Laje com abertura verdadeira na escada (fill evenodd), sem tapar o vao.
  const holeX=H.stair.x,holeY=H.stair.y;
  g.beginPath();
  const outer=base.map(p=>proj(p[0],p[1],z));
  outer.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();
  const hole=[[holeX-.62,holeY-.80],[holeX+.62,holeY-.80],
    [holeX+.62,holeY+.80],[holeX-.62,holeY+.80]]
    .map(p=>proj(p[0],p[1],z));
  hole.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();
  g.fillStyle='#a68b69';g.fill('evenodd');
  g.strokeStyle='rgba(35,24,17,.72)';g.lineWidth=1.4;g.stroke();
  // Tabuas com ritmos alternados e linhas de iluminacao: textura assada por
  // geometria simples e visivel apenas quando o jogador esta no piso de cima.
  for(let x=H.x0+.14;x<H.x1-.14;x+=.35){
    const a=proj(x,H.y0+.16,z+.005),b=proj(x,H.y1-.16,z+.005);
    g.strokeStyle='rgba(58,42,26,.20)';g.lineWidth=Math.max(.5,cam.zoom*.008);
    g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
  }
  for(const seg of H.upper.walls){
    if(seg.door){
      // O arco e a folha da porta seguem os mesmos quadros da porta terrea.
      const p=proj((seg.x1+seg.x2)/2,(seg.y1+seg.y2)/2,z);
      const open=seg.doorAnim?seg.doorAnim.open:0;
      const q=[proj(seg.x1,seg.y1,z),proj(seg.x2,seg.y2,z),
        proj(seg.x2,seg.y2,z+1.9),proj(seg.x1,seg.y1,z+1.9)];
      if(open<.98)poly(g,q,'rgba(127,92,60,'+(1-open*.90)+')','#523f2d',.8);
      const top=proj((seg.x1+seg.x2)/2,(seg.y1+seg.y2)/2,z+2.1);
      g.strokeStyle='#745b41';g.lineWidth=Math.max(1,cam.zoom*.045);
      g.beginPath();g.moveTo(q[3].x,q[3].y);g.lineTo(top.x,top.y);
      g.lineTo(q[2].x,q[2].y);g.stroke();
      continue;
    }
    const n=[seg.y1-seg.y2,seg.x2-seg.x1];
    const outward=facingCam(n[0],n[1])>0;
    const h=outward?.52:1.28;
    const q=[proj(seg.x1,seg.y1,z),proj(seg.x2,seg.y2,z),
      proj(seg.x2,seg.y2,z+h),proj(seg.x1,seg.y1,z+h)];
    poly(g,q,outward?'#cdc2ae':'#e4dbcd','rgba(38,29,21,.65)',.7);
    const a=proj(seg.x1,seg.y1,z+.16),b=proj(seg.x2,seg.y2,z+.16);
    g.strokeStyle='#76604d';g.lineWidth=Math.max(1,cam.zoom*.036);
    g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
  }
  // Moveis sobem junto com a laje; composicao por profundidade local.
  for(const b of [...H.upper.furniture].sort((a,b)=>
    depthOf(a.x,a.y)-depthOf(b.x,b.y)))if(!props3d(b))drawBox(g,b);
  // Escada pode ser vista pelo vao e o corrimao continua no patamar.
  drawHouseStaircase(g,H);
}

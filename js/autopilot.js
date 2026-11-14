// autopilot.js — piloto automático a pé: o jogador vai sozinho até um destino pela CALÇADA, como um pedestre.
//  · rota: A* da malha de ruas (city-road-routing.js); cada ponto do eixo da rua é empurrado p/ o meio da calçada do lado
//    do destino (roadDist entre ROAD_W e ROAD_W+SIDE);
//  · travessias: todo trecho que passa pelo asfalto é uma faixa — o jogador para no meio-fio e só atravessa com o boneco
//    verde (semáforo a menos de 16 m) e sem carro em movimento por perto;
//  · saída de casa/prédio pela porta e chegada até a porta (e além: pontos extras dentro do prédio, ex.: a sala de aula);
//  · desvio de obstáculo (passo lateral), pulo de ponto travado e aviso se não houver caminho;
//  · qualquer tecla de andar (WASD/setas) devolve o controle na hora.
'use strict';
(function(root){
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 // ---------- planejamento (puro) ----------
 // route: pontos [x,y] do eixo das ruas; env: {roadDist, ROAD_W, SIDE, free(x,y)}; side: +1/-1 (direita/esquerda do sentido)
 function sidewalkPoint(px,py,nx,ny,env){
  const lo=env.ROAD_W+env.SIDE*.3,hi=env.ROAD_W+env.SIDE+.5,mid=env.ROAD_W+env.SIDE*.55;
  let best=null;
  for(let o=env.ROAD_W;o<=env.ROAD_W+12;o+=.25){
   const x=px+nx*o,y=py+ny*o,d=env.roadDist(x,y);
   if(d>=lo&&d<=hi&&(!env.free||env.free(x,y))){const s=Math.abs(d-mid);if(!best||s<best.s-.05)best={x,y,s};if(s<.3)break;}
  }
  return best?{x:best.x,y:best.y}:null;
 }
 function sideOf(a,b,p){return Math.sign((b[0]-a[0])*(p.y-a[1])-(b[1]-a[1])*(p.x-a[0]))||1;}
 function planSidewalk(route,dest,env,{step=5}={}){
  if(!route||route.length<2)return [];
  // densifica o eixo (um ponto a cada `step` metros) guardando a direção local
  const axis=[];
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.01)continue;
   const n=Math.max(1,Math.ceil(len/step));
   for(let k=i===1?0:1;k<=n;k++){const t=k/n;axis.push({x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,tx:(b[0]-a[0])/len,ty:(b[1]-a[1])/len});}
  }
  // lado da calçada: o do destino (chega sem atravessar no fim); a normal "direita" de (tx,ty) é (-ty,tx)
  const last=route[route.length-1],prev=route[route.length-2],side=sideOf(prev,last,dest);
  const out=[];
  for(const p of axis){
   const q=sidewalkPoint(p.x,p.y,-p.ty*side,p.tx*side,env);
   if(!q)continue;
   if(out.length&&dist(out[out.length-1],q)<1.2)continue;
   out.push(q);
  }
  return out;
 }
 // marca as travessias: o trecho entre dois pontos que encosta no asfalto
 function markCrossings(path,env){
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],len=dist(a,b),n=Math.max(2,Math.ceil(len/.5));let wet=false;
   for(let k=1;k<n;k++){const t=k/n;if(env.roadDist(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)<env.ROAD_W-.15){wet=true;break;}}
   b.cross=wet;
  }
  return path;
 }
 const api={sidewalkPoint,planSidewalk,markCrossings};
 root.CityAutopilotPlan=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window==='undefined')return;

 // ---------- condução do jogador (jogo) ----------
 let job=null,graph=null,graphSrc=null,hud=null;
 const env=()=>({roadDist,ROAD_W,SIDE,free:(x,y)=>!(typeof world!=='undefined'&&world.blocked&&world.blocked(x,y,.35))});
 function network(){
  const src=(typeof OW!=='undefined'&&world.open&&OW.cw?.roads?.length)?OW.cw.roads:(world.roads||[]);
  if(graph&&src===graphSrc)return graph;
  if(!window.CityRoadRouting)return null;
  graphSrc=src;graph=window.CityRoadRouting.build(src,world.seed);return graph;
 }
 // ---------- A* local em grade (fora da calçada: sair do lote, contornar muros, chegar à porta) ----------
 // célula livre = a colisão real do mundo não empurra um círculo de 0,32 m e não é água; prédios bloqueiam
 const GRID=.6;
 function passable(x,y,allow=null){
  if(typeof collide!=='function')return true;
  const q=collide(x,y,allow?.24:.32,0);if(Math.hypot(q[0]-x,q[1]-y)>.05)return false;   // dentro do prédio: raio do jogador (.28) com folga, entre carteiras
  if(typeof pondVal==='function'&&pondVal(x,y)<=1.02&&roadDist(x,y)>=ROAD_W+SIDE)return false;
  for(const H of (typeof houses!=='undefined'?houses:[]))if(H!==allow&&x>H.x0-.2&&x<H.x1+.2&&y>H.y0-.2&&y<H.y1+.2&&(!H.contains||H.contains(x,y,0)))return false;
  return true;
 }
 function clearLine(a,b,allow=null){const n=Math.max(2,Math.ceil(dist(a,b)/.3));for(let k=1;k<n;k++){const t=k/n;if(!passable(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,allow))return false;}return true;}
 // portas internas abrem com F (houses.js): no planejamento contam como abertas — o piloto abre ao passar (steer)
 const innerDoors=H=>(H?.architecture?.openingSegments||[]).filter(s=>s.door&&!s.ext&&s.doorAnim&&!s.doorAnim.manual&&!((s.floor||0)>0));
 function gridPath(a,b,maxCells=60000,allow=null,CELL=GRID){
  if(allow){const ds=innerDoors(allow),old=ds.map(s=>s.doorAnim.open);ds.forEach(s=>s.doorAnim.open=1);
   try{return gridPathRaw(a,b,maxCells,allow,CELL);}finally{ds.forEach((s,i)=>s.doorAnim.open=old[i]);}}
  return gridPathRaw(a,b,maxCells,allow,CELL);
 }
 function gridPathRaw(a,b,maxCells,allow,CELL){
  if(clearLine(a,b,allow))return [b];
  const pad=14,x0=Math.min(a.x,b.x)-pad,y0=Math.min(a.y,b.y)-pad,W=Math.ceil((Math.max(a.x,b.x)+pad-x0)/CELL),Hh=Math.ceil((Math.max(a.y,b.y)+pad-y0)/CELL);
  if(W*Hh>maxCells)return null;
  const idx=(i,j)=>j*W+i,cx=i=>x0+(i+.5)*CELL,cy=j=>y0+(j+.5)*CELL,ok=new Int8Array(W*Hh),g=new Float32Array(W*Hh).fill(Infinity),from=new Int32Array(W*Hh).fill(-1);
  const free=(i,j)=>{const k=idx(i,j);if(!ok[k])ok[k]=passable(cx(i),cy(j),allow)?1:2;return ok[k]===1;};
  const si=Math.floor((a.x-x0)/CELL),sj=Math.floor((a.y-y0)/CELL),ti=Math.floor((b.x-x0)/CELL),tj=Math.floor((b.y-y0)/CELL);
  const heap=[];const push=(f,k)=>{heap.push([f,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=f)break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[i][0]<=heap[c][0])break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return top;};
  const h=(i,j)=>Math.hypot(i-ti,j-tj);
  g[idx(si,sj)]=0;push(h(si,sj),idx(si,sj));let found=-1,n=0;
  while(heap.length&&n++<maxCells){
   const [,k]=pop(),i=k%W,j=(k/W)|0;if(i===ti&&j===tj){found=k;break;}
   for(const [di,dj,c] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]]){
    const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=W||nj>=Hh)continue;
    if(!(ni===ti&&nj===tj)&&!free(ni,nj))continue;
    if(di&&dj&&(!free(i+di,j)||!free(i,j+dj)))continue;   // sem cortar quina de parede
    const nk=idx(ni,nj),ng=g[k]+c;if(ng<g[nk]){g[nk]=ng;from[nk]=k;push(ng+h(ni,nj),nk);}
   }
  }
  if(found<0)return null;
  const cells=[];for(let k=found;k>=0&&k!==idx(si,sj);k=from[k])cells.push({x:cx(k%W),y:cy((k/W)|0)});cells.reverse();cells[cells.length-1]={x:b.x,y:b.y};
  // corta os degraus: segue reto enquanto a linha estiver livre
  const out=[];let cur=a;
  for(let i=0;i<cells.length;i++){const next=cells[i+1];if(next&&clearLine(cur,next,allow))continue;out.push(cells[i]);cur=cells[i];}
  return out;
 }
 // ponto logo fora/dentro da porta de um prédio (doorPt fica na fachada)
 const FRONT={S:[0,1],N:[0,-1],E:[1,0],W:[-1,0]};
 function doorPoints(H){
  if(!H?.doorPt)return null;
  const n=FRONT[H.frontSide||'S'],[x,y]=H.doorPt;
  return {out:{x:x+n[0]*1.6,y:y+n[1]*1.6},in:{x:x-n[0]*1.4,y:y-n[1]*1.4}};
 }
 const onAsphalt=q=>roadDist(q.x,q.y)<ROAD_W-.15;
 const houseAt=(x,y)=>(typeof houses!=='undefined'?houses:[]).find(H=>H.contains?H.contains(x,y,0):x>H.x0&&x<H.x1&&y>H.y0&&y<H.y1);
 // go({x,y,name,house?,after?:[pontos dentro do destino]}, {onArrive})
 function go(target,{onArrive=null,onFail=null}={}){
  const p=player;
  if(!p||p.dead)return {ok:false,text:'Indisponível agora.'};
  if(window.cityVehicles?.driver)return {ok:false,text:'Saia do veículo para usar o piloto automático.'};
  if((p.floor||0)>0)return {ok:false,text:'Desça para o térreo para usar o piloto automático.'};
  // já dentro do prédio de destino: só os pontos internos (corredor → sala)
  const inside=houseAt(p.x,p.y);
  if(inside&&target.house===inside)return walk(target.after?.length?target.after.slice(1):[{x:target.x,y:target.y}],target.name,onArrive)&&{ok:true,text:'Piloto automático: indo até '+(target.name||'o destino')+'.'};
  const net=network();if(!net)return {ok:false,text:'Mapa de ruas indisponível.'};
  const points=[];
  // 1) sair de onde está (prédio → porta)
  const here=houseAt(p.x,p.y),hd=here&&doorPoints(here);
  if(hd){
   // de dentro (sala, corredor) até a porta da rua: A* com as paredes internas e os móveis do próprio prédio
   let inner=gridPath({x:p.x,y:p.y},hd.in,90000,here,.25);   // grade fina: vãos de porta de ~1 m
   // preso entre móveis (ex.: entre carteiras): começa do ponto livre mais próximo que tem saída
   for(let r=.5;!inner&&r<=3;r+=.25)for(let k=0;k<16&&!inner;k++){
    const c={x:p.x+Math.cos(k/16*Math.PI*2)*r,y:p.y+Math.sin(k/16*Math.PI*2)*r};
    if(passable(c.x,c.y,here)){const g=gridPath(c,hd.in,40000,here,.25);if(g)inner=[c,...g];}
   }
   if(inner)for(const q of inner.slice(0,-1))points.push({...q,inside:true});
   points.push({...hd.in,inside:true},{...hd.out});
  }
  const from=points.length?points[points.length-1]:{x:p.x,y:p.y};
  // 2) destino: porta do prédio (se houver) e pontos internos
  const td=target.house&&doorPoints(target.house),goal=td?td.out:{x:target.x,y:target.y};
  const near=dist(from,goal)<35;
  let legs=[];
  if(!near){
   const r=net.route(from,goal);
   if(!r)return {ok:false,text:'Não encontrei um caminho pelas ruas até '+(target.name||'o destino')+'.'};
   legs=planSidewalk(r.points,goal,env());
   // a calçada pode começar "atrás" de onde a pessoa está: descarta pontos do começo que fazem voltar
   while(legs.length>2&&dist(from,legs[1])<dist(from,legs[0]))legs.shift();
   while(legs.length>2&&dist(goal,legs[legs.length-2])<dist(goal,legs[legs.length-1]))legs.pop();
  }
  // sair do lote até a calçada e da calçada até a porta: contornando muros e prédios (A* local)
  const lead=legs.length?gridPath(from,legs[0]):gridPath(from,goal);
  const tail=legs.length?gridPath(legs[legs.length-1],goal):null;
  if(legs.length&&lead)legs=[...lead.slice(0,-1),...legs];
  if(!legs.length&&lead)legs=lead.slice(0,-1);
  if(tail)legs=[...legs,...tail.slice(0,-1)];
  const path=markCrossings([...points.slice(0,-1),{...from},...legs,{...goal}],env());
  // (travessia = trecho que de fato passa pelo asfalto; markCrossings já amostrou cada trecho)
  if(td)path.push({...td.in,inside:true});
  for(const q of target.after||[])path.push({...q,inside:true});
  job={target,path,i:hd?0:1,onArrive,onFail,stuck:0,lastPos:{x:p.x,y:p.y},check:0,wait:0,waiting:false,side:0,sideT:0,total:path.reduce((s,q,i)=>i?s+dist(path[i-1],q):0,0),start:performance.now()};
  if(dist(path[0],p)<1)job.i=1;
  showHud();
  return {ok:true,text:'Piloto automático: indo até '+(target.name||'o destino')+' pela calçada.'};
 }
 // caminho curto por pontos (dentro de um prédio: corredor → porta → sala), sem rota de rua
 function walk(points,name,onArrive){
  const p=player;if(!p||!points?.length)return {ok:false,text:'Sem caminho.'};
  // entre um ponto e outro contorna paredes internas e móveis (A* fino, portas internas contam como abertas)
  const path=[];let cur={x:p.x,y:p.y};
  for(const q of points){const H=houseAt(q.x,q.y)||houseAt(cur.x,cur.y),g=H&&gridPath(cur,q,40000,H,.25);
   for(const k of (g||[q]).slice(0,-1))path.push({x:k.x,y:k.y,inside:true});path.push({x:q.x,y:q.y,inside:true});cur=q;}
  job={target:{name},path,i:0,onArrive,stuck:0,lastPos:{x:p.x,y:p.y},check:0,wait:0,waiting:false,side:0,sideT:0,start:performance.now(),indoor:true};
  showHud();return {ok:true};
 }
 function cancel(reason='Você assumiu o controle.'){
  if(!job)return;const j=job;job=null;hideHud();
  if(reason)window.CityUI?.notify?.('Piloto automático desligado. '+reason);
  j.onFail?.(reason);
 }
 // ---------- faixas de pedestre ----------
 // cada braço de cruzamento (decal 'xarm', miami-city.js) tem a zebra entre e+0,35 e e+3,35 m do centro, de lado a lado
 // da via; sem zebra (rua × rua sem PARE) a travessia é no mesmo lugar, na esquina. Devolve as pontas na calçada.
 function crosswalkEnds(d){
  const u=d.e+1.85,rx=d.dy,ry=-d.dx,v=d.hw+SIDE*.55;
  return [{x:d.x+d.dx*u-rx*v,y:d.y+d.dy*u-ry*v},{x:d.x+d.dx*u+rx*v,y:d.y+d.dy*u+ry*v}];
 }
 // troca a travessia a→b (que corta o asfalto) pela faixa de pedestre mais próxima da mesma via
 function alignCrossing(path,i){
  const a=path[i-1],b=path[i];if(!a||!b)return false;
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};let best=null;
  for(const d of world.decals||[]){
   if(d.kind!=='xarm'||Math.hypot(d.x-mid.x,d.y-mid.y)>120)continue;
   const rx=d.dy,ry=-d.dx,va=(a.x-d.x)*rx+(a.y-d.y)*ry,vb=(b.x-d.x)*rx+(b.y-d.y)*ry;
   if(va*vb>=0||Math.abs(va)<d.hw*.6||Math.abs(vb)<d.hw*.6)continue;   // a e b em lados opostos desta via
   const [e1,e2]=crosswalkEnds(d),near=va<0?e1:e2,far=va<0?e2:e1;
   // CTB art. 69: usa a faixa quando ela está a até 50 m; mais longe que isso, atravessa reto onde está (com cuidado)
   if(Math.hypot((e1.x+e2.x)/2-mid.x,(e1.y+e2.y)/2-mid.y)>50)continue;
   const cost=dist(a,near)+dist(near,far)+dist(far,b)+(d.zebra?0:12);
   if(!best||cost<best.cost)best={cost,near,far,d};
  }
  if(!best){
   // sem faixa a até 50 m: travessia perpendicular à via, a partir de onde está
   const rd=roadDist(a.x,a.y),gx=(roadDist(a.x+.5,a.y)-roadDist(a.x-.5,a.y)),gy=(roadDist(a.x,a.y+.5)-roadDist(a.x,a.y-.5)),gl=Math.hypot(gx,gy);
   if(gl>.3&&rd>=ROAD_W){const nx=-gx/gl,ny=-gy/gl;let w=ROAD_W*2+2;for(let k=0;k<40;k++){const x=a.x+nx*w,y=a.y+ny*w;if(roadDist(x,y)>=ROAD_W+SIDE*.3)break;w+=.5;}
    const c={x:a.x+nx*(w+SIDE*.3),y:a.y+ny*(w+SIDE*.3)};
    if(roadDist(c.x,c.y)>=ROAD_W&&dist(c,b)<dist(a,b)+8){path.splice(i,1,{...c,cross:true,aligned:true},{...b,cross:false,aligned:true});return true;}}
   b.aligned=true;return false;
  }
  const sig=(world.trafficSignals||[]).filter(s=>Math.hypot(s.x-best.far.x,s.y-best.far.y)<30&&Math.abs(s.ax*best.d.dx+s.ay*best.d.dy)>.7);
  path.splice(i,1,{...best.near,cross:false,aligned:true},{...best.far,cross:true,aligned:true,zebra:!!best.d.zebra,sigs:sig},{...b,cross:false,aligned:true});
  return true;
 }
 // semáforo e carros: com semáforo, só atravessa com o sinal vermelho para os carros desta via (boneco verde);
 // na zebra sem semáforo, espera os carros que vêm na direção da faixa passarem
 function canCross(a,b){
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},ph=typeof trafficPhase==='function'?trafficPhase(typeof T!=='undefined'?T:0):null;
  if(ph&&b.sigs?.length){if(b.sigs.some(s=>ph[s.group]!=='red'))return 'sinal';}
  else{const sig=(world.trafficSignals||[]).find(s=>Math.hypot(s.x-mid.x,s.y-mid.y)<16);if(sig&&ph&&ph.pedestrian!=='walk')return 'sinal';}
  const cars=[...(world.aiCars||[])];const own=window.cityVehicles?.car;if(own&&!window.cityVehicles.driver&&Math.abs(own.speed||0)>.5)cars.push(own);
  for(const c of cars){
   const sp=Math.abs(c.unit?.speed??c.speed??0);if(sp<.6)continue;
   const d=Math.hypot(c.x-mid.x,c.y-mid.y);if(d>14+sp*2.2)continue;
   // vindo na direção da faixa?
   const a=c.a??c.angle??0,vx=Math.cos(a)*Math.sign(c.unit?.speed??c.speed??1),vy=Math.sin(a)*Math.sign(c.unit?.speed??c.speed??1);
   if((mid.x-c.x)*vx+(mid.y-c.y)*vy>-2)return 'carro';
  }
  return null;
 }
 // chamado por updatePlayer (game.js) quando não há tecla de andar: devolve a direção a seguir ou null
 function steer(p,dt){
  if(!job)return null;
  if(p.dead||p.busted||window.cityVehicles?.driver){cancel('');return null;}
  // abre a porta interna que está logo à frente (como o jogador faria com F)
  const inH=houseAt(p.x,p.y);
  if(inH)for(const s of innerDoors(inH))if(s.doorAnim.target<1&&Math.hypot((s.x1+s.x2)/2-p.x,(s.y1+s.y2)/2-p.y)<1.7)s.doorAnim.target=1;
  const path=job.path;let q=path[job.i];
  // dentro de prédio o raio de chegada é pequeno: alinha com o vão da porta antes de passar (senão bate no batente)
  while(q&&dist(p,q)<(q.inside?.32:job.i===path.length-1?.7:1.1)){job.i++;q=path[job.i];job.waiting=false;}
  if(!q){const j=job;job=null;hideHud();window.CityUI?.notify?.('Você chegou: '+(j.target.name||'destino')+'.');j.onArrive?.();return null;}
  // travessia: leva até a faixa de pedestre (uma vez) e espera no meio-fio
  if(q.cross&&!q.aligned&&dist(p,q)<40&&alignCrossing(path,job.i)){q=path[job.i];}
  if(q.cross&&!q.approved){
   const why=canCross(path[job.i-1]||p,q);
   if(why){job.waiting=why;updateHud();p.face=Math.atan2(q.y-p.y,q.x-p.x);job.lastPos={x:p.x,y:p.y};job.stuck=0;return {w:[0,0],hold:true};}
   q.approved=true;job.waiting=false;
  }
  // travado = não chega mais perto do ponto: 1º passo lateral, depois replaneja (A*), depois pula o ponto; por fim desiste
  const dq=dist(p,q);
  if(job.target_i!==job.i){job.target_i=job.i;job.best=dq;job.noProg=0;job.tries=0;}
  if(dq<job.best-.25){job.best=dq;job.noProg=0;}else job.noProg+=dt;
  if(job.noProg>1.6&&job.sideT<=0&&job.tries===0){job.side=job.side?-job.side:1;job.sideT=.9;job.tries=1;job.noProg=0;}
  else if(job.noProg>2.2&&job.tries===1){
   job.tries=2;job.noProg=0;const det=job.indoor?null:gridPath({x:p.x,y:p.y},q);
   if(det&&det.length>1){path.splice(job.i,0,...det.slice(0,-1).map(d=>({...d})));job.target_i=-1;}
  }
  else if(job.noProg>2.5&&job.tries>=2){
   job.skips=(job.skips||0)+1;job.noProg=0;
   if(job.skips>4||job.i>=path.length-1){cancel('Caminho bloqueado — ande um pouco e chame de novo.');return null;}
   if(job.indoor||q.inside){p.x=q.x;p.y=q.y;}   // dentro do prédio (porta emperrada/batente): passa pelo vão
   job.i++;
  }
  let dx=q.x-p.x,dy=q.y-p.y;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  if(job.sideT>0){job.sideT-=dt;const s=job.side*.9;const ex=dx-dy*s,ey=dy+dx*s,el=Math.hypot(ex,ey);dx=ex/el;dy=ey/el;}
  if(performance.now()-(job.hudAt||0)>400)updateHud();
  return {w:[dx,dy],run:false};
 }
 function remaining(p){if(!job)return 0;let s=dist(p,job.path[job.i]||p);for(let i=job.i+1;i<job.path.length;i++)s+=dist(job.path[i-1],job.path[i]);return s;}
 // ---------- aviso na tela ----------
 function showHud(){
  if(!hud){
   const css=document.createElement('style');css.textContent=`#city-autopilot{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:42;display:flex;gap:10px;align-items:center;
 padding:8px 10px 8px 14px;border-radius:999px;background:rgba(255,255,255,.94);color:#1d2125;font:600 13px "Segoe UI",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)}
#city-autopilot[hidden]{display:none}#city-autopilot small{color:#6b737a;font-weight:500}#city-autopilot button{border:0;border-radius:999px;background:#1d2125;color:#fff;padding:6px 11px;font:inherit;cursor:pointer}`;
   document.head.append(css);hud=document.createElement('div');hud.id='city-autopilot';hud.setAttribute('role','status');
   hud.innerHTML='<span>🚶</span><span class="ap-text"></span><button type="button">Assumir</button>';
   hud.querySelector('button').addEventListener('click',()=>cancel(''));document.body.append(hud);
  }
  hud.hidden=false;updateHud();
 }
 function hideHud(){if(hud)hud.hidden=true;}
 function updateHud(){
  if(!hud||!job)return;job.hudAt=performance.now();
  const m=Math.round(remaining(player)),w=job.waiting==='sinal'?' · aguardando o sinal verde':job.waiting==='carro'?' · esperando o carro passar':'';
  hud.querySelector('.ap-text').innerHTML='Piloto automático → <b>'+(job.target.name||'destino')+'</b> <small>'+m+' m'+w+' · WASD assume</small>';
 }
 window.CityAutopilot={go,walk,cancel,steer,get active(){return !!job;},get job(){return job;},remaining,gridPath};
})(typeof globalThis!=='undefined'?globalThis:this);

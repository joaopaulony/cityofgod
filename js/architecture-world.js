// Installs the shared plan into the real streamed city, including its colliders.
'use strict';
// ---------- escadas: um lance por andar (f → f+1); vai-e-volta com 3+ andares; posição salva pelo dono no modo construção ----------
// spec (coordenadas da planta): {x,y} centro do 1º lance, axis 'y'|'x' (direção do lance), dir ±1 (sentido da subida)
const CityStairs=(()=>{
 const KEY='cityofgod.home-stairs.v1',RUN=1.35,HALF=.5;
 let saves=null;
 const load=()=>{if(saves)return saves;try{saves=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){saves={};}return saves;};
 const id=H=>(typeof world!=='undefined'?world.seed:'city')+':'+(typeof CityRealty!=='undefined'?CityRealty.id(H):H.seed);
 // ponto do lance: u ao longo da subida, v de lado
 const pt=(s,u,v)=>s.axis==='x'?[s.x+u,s.y+v]:[s.x+v,s.y+u];
 // lance do andar f a partir do spec: com 3+ andares os lances alternam de lado (1,05 m) e de sentido
 function flightOf(spec,f,count){
  const zig=count>2&&f%2,side=spec.side||1;
  const s={axis:spec.axis||'y',dir:(spec.dir||1)*(zig?-1:1),w:.92};
  const off=zig?1.05*side:0;s.x=spec.axis==='x'?spec.x:spec.x+off;s.y=spec.axis==='x'?spec.y+off:spec.y;
  return s;
 }
 // caixa (planta) que o lance ocupa: entrada (u=+RUN*dir) livre, laterais e fundo sólidos
 const box=s=>{const a=pt(s,RUN*s.dir+.05*s.dir,-HALF),b=pt(s,-RUN*s.dir-.05*s.dir,HALF);return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];};
 const inRect=(r,x0,y0,x1,y1,pad=0)=>x0>=r.x0+pad-1e-6&&y0>=r.y0+pad-1e-6&&x1<=r.x1-pad+1e-6&&y1<=r.y1-pad+1e-6;
 const segHit=(w,b,pad)=>{const minx=Math.min(w.a[0],w.b[0]),maxx=Math.max(w.a[0],w.b[0]),miny=Math.min(w.a[1],w.b[1]),maxy=Math.max(w.a[1],w.b[1]);return maxx>b[0]-pad&&minx<b[2]+pad&&maxy>b[1]-pad&&miny<b[3]+pad;};
 // cabe? cada lance dentro de um cômodo só (sem atravessar parede) nos dois andares que liga, longe das portas,
 // e com a entrada (embaixo) e a saída (em cima) desimpedidas
 function check(plan,spec){
  const n=plan.levels.length;if(n<2)return {ok:false,text:'Casa térrea: não há escada'};
  for(let f=0;f<n-1;f++){
   const s=flightOf(spec,f,n),b=box(s),ent=pt(s,(RUN+.7)*s.dir,0),ext=pt(s,-(RUN+.7)*s.dir,0);
   for(const L of [plan.levels[f],plan.levels[f+1]]){
    const room=L.rooms.find(r=>inRect(r,b[0],b[1],b[2],b[3],.04));
    if(!room)return {ok:false,text:'A escada precisa caber inteira num cômodo, sem atravessar parede'};
    for(const w of L.walls)for(const o of w.openings)if(o.kind==='door'){const len=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),px=w.a[0]+(w.b[0]-w.a[0])*o.at/len,py=w.a[1]+(w.b[1]-w.a[1])*o.at/len;
     if(px>b[0]-.9&&px<b[2]+.9&&py>b[1]-.9&&py<b[3]+.9)return {ok:false,text:'Não pode bloquear uma porta'};}
   }
   const inside=(L,p)=>L.rooms.some(r=>p[0]>r.x0+.25&&p[0]<r.x1-.25&&p[1]>r.y0+.25&&p[1]<r.y1-.25);
   if(!inside(plan.levels[f],ent))return {ok:false,text:'Deixe espaço livre no pé da escada'};
   if(!inside(plan.levels[f+1],ext))return {ok:false,text:'Deixe espaço livre no topo da escada'};
  }
  return {ok:true,text:'Clique para colocar a escada aqui · R gira'};
 }
 // padrão: encostada numa parede do corredor, do lado sem portas na frente, perto do meio
 function auto(plan){
  const L0=plan.levels[0],hall=L0.rooms.find(r=>r.id==='hall'),D=plan.depth;
  for(const y of [D*.45,D*.35,D*.55,D*.25,D*.65])for(const [x,side] of [[hall.x0+.56,1],[hall.x1-.56,-1],[(hall.x0+hall.x1)/2-.45,1]]){
   const spec={x,y,axis:'y',dir:1,side};if(check(plan,spec).ok)return spec;
  }
  return {x:(hall.x0+hall.x1)/2-.45,y:D*.45,axis:'y',dir:1,side:1};
 }
 function colliders(H,plan){
  const P=plan.toWorld;
  for(const o of H.stairSegs||[]){const a=o.floor?world.upperSegs:world.segs,i=a?.indexOf(o);if(i>=0)a.splice(i,1);const j=H.segs.indexOf(o);if(j>=0)H.segs.splice(j,1);}
  H.stairSegs=[];
  for(const level of plan.levels){
   const s=level.stair;if(!s||level.floor>=plan.levels.length-1)continue;
   const ub=(RUN+.03)*s.dir,ut=-(RUN+.03)*s.dir;
   const seg=(floor,a,b)=>{const p=P(...a),q=P(...b),o={x1:p[0],y1:p[1],x2:q[0],y2:q[1],house:H,floor,architecture:true,kind:'stairrail',h:(floor+1)*H.floorHeight,z:floor*H.floorHeight};
    if(floor)(world.upperSegs||(world.upperSegs=[])).push(o);else{world.segs.push(o);H.segs.push(o);}H.stairSegs.push(o);};
   // embaixo: laterais e o fundo (debaixo do lance); em cima: laterais e a borda do lado de baixo do vão
   for(const [floor,end] of [[level.floor,ut],[level.floor+1,ub]]){seg(floor,pt(s,ub,-HALF),pt(s,ut,-HALF));seg(floor,pt(s,ub,HALF),pt(s,ut,HALF));seg(floor,pt(s,end,-HALF),pt(s,end,HALF));}
  }
 }
 function apply(H,spec){
  const plan=H.architecture,P=plan.toWorld,n=plan.levels.length;
  for(const level of plan.levels){
   const s=flightOf(spec,level.floor,n);
   level.stair={...s,bottom:P(...pt(s,(RUN-.1)*s.dir,0)),top:P(...pt(s,-(RUN-.1)*s.dir,0)),center:P(s.x,s.y)};
  }
  plan.stairSpec=spec;plan.stairRev=(plan.stairRev||0)+1;colliders(H,plan);
 }
 function layout(H){const saved=load()[id(H)],plan=H.architecture;apply(H,saved&&check(plan,saved).ok?saved:auto(plan));}
 function save(H,spec){const c=check(H.architecture,spec);if(!c.ok)return c;apply(H,spec);load()[id(H)]=spec;try{localStorage.setItem(KEY,JSON.stringify(saves));}catch(_){}return {ok:true,text:'Escada posicionada'};}
 return {layout,check:(H,spec)=>check(H.architecture,spec),save,flightOf,box,pt,RUN,get spec(){return null;}};
})();
globalThis.CityStairs=CityStairs;
if(typeof addEventListener==='function'&&new URLSearchParams(location.search).has('architectureTest')){
 globalThis.cityArchitectureErrors=[];
 addEventListener('error',e=>globalThis.cityArchitectureErrors.push(e.message+' at '+e.filename+':'+e.lineno));
}
function remodelProperty(H){
 if(H.architecture||!globalThis.CityArchitecture)return H;
 // Fachada sempre virada p/ a rua mais próxima (sítios e fazendas ficam como estão).
 if(H.terminal||H.templateKey==='TERMINAL')H.frontSide='S'; // lado público; norte é o pátio cercado
 if(typeof roadDist==='function'&&!H.rural&&!H.country&&!H.civic&&!H.terminal&&H.templateKey!=='TERMINAL'){
  const c=[(H.x0+H.x1)/2,(H.y0+H.y1)/2],N={S:[0,1],N:[0,-1],E:[1,0],W:[-1,0]};
  const probe=k=>{const half=(k==='E'||k==='W'?H.x1-H.x0:H.y1-H.y0)/2+2,p=[c[0]+N[k][0]*half,c[1]+N[k][1]*half],q=H.toWorld?H.toWorld(...p):p;return roadDist(q[0],q[1]);};
  const cur=H.frontSide||'S',best=['S','N','E','W'].reduce((a,k)=>probe(k)<probe(a)?k:a,cur);
  if(best!==cur&&probe(best)<probe(cur)-1.5&&probe(best)<ROAD_W+SIDE+12)H.frontSide=best;
 }
 const fk=H.frontSide||'S',horizontal=fk==='S'||fk==='N';
 const W=horizontal?H.x1-H.x0:H.y1-H.y0,D=horizontal?H.y1-H.y0:H.x1-H.x0;
 if(W<6||D<6)return H;
 const kind=H.terminal||H.templateKey==='TERMINAL'?'airport':H.miaKind||(H.rural?'rural':H.brick||H.templateKey==='SHOP'?'shop':'house');
 const count=H.nFloors||H.storeys||1,height=kind==='warehouse'?Math.min(H.h,5.6):H.floorHeight||Math.min(3.3,Math.max(2.85,H.h/count));
 const plan=CityArchitecture.makePlan({width:W,depth:D,kind,seed:H.seed,floors:count,height});
 if(!plan.audit.passed)throw Error('Invalid architectural plan: '+plan.audit.problems.join(', '));
 const base=(u,v)=>fk==='S'?[H.x0+u,H.y0+v]:fk==='N'?[H.x1-u,H.y1-v]:fk==='E'?[H.x0+v,H.y1-u]:[H.x1-v,H.y0+u];
 const P=(u,v)=>{const p=base(u,v);return H.toWorld?H.toWorld(...p):p;};
 const origin=P(0,0),ex=P(1,0).map((n,i)=>n-origin[i]),ey=P(0,1).map((n,i)=>n-origin[i]);
 const local=(x,y)=>[(x-origin[0])*ex[0]+(y-origin[1])*ex[1],(x-origin[0])*ey[0]+(y-origin[1])*ey[1]];
 plan.toWorld=P;plan.toLocal=local;plan.angle=Math.atan2(ex[1],ex[0]);
 const erase=arr=>{let j=0;for(const o of arr||[])if(o.house!==H)arr[j++]=o;if(arr)arr.length=j;};
 erase(world.segs);erase(world.upperSegs);erase(boxes);
 H.architecture=plan;H.segs=[];H.floors=[];H.upper=null;H.stair=null;H.interactables=[];H.indoorLights=[];H.switches=[];
 H.h=count*height;H.floorHeight=height;H.lightOn=true;H._warm=true;
 H.contains=(x,y,floor=0)=>{const p=local(x,y),l=plan.levels[floor];return !!l&&[...l.rooms,...l.outdoor].some(r=>CityArchitecture.inside(r,...p));};
 H.solidFootprints=plan.levels[0].rooms.map(r=>[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]].map(p=>P(...p)));
 const putSegment=(level,wall,from,to,opening=null)=>{
  const L=Math.hypot(wall.b[0]-wall.a[0],wall.b[1]-wall.a[1]);
  const p=t=>P(wall.a[0]+(wall.b[0]-wall.a[0])*t/L,wall.a[1]+(wall.b[1]-wall.a[1])*t/L);
  const a=p(from),b=p(to),normal=[ex[0]*wall.normal[0]+ey[0]*wall.normal[1],ex[1]*wall.normal[0]+ey[1]*wall.normal[1]];
  const s={x1:a[0],y1:a[1],x2:b[0],y2:b[1],nx:normal[0],ny:normal[1],h:level.z+height,z:level.z,ext:wall.ext,house:H,floor:level.floor,architecture:true,side:normal[1]>.5?'S':normal[1]<-.5?'N':normal[0]<-.5?'W':'E',idx:0,door:opening?.kind==='door',window:opening?.kind==='window'};
  if(s.door){s.doorAnim={open:0,target:0};opening.segment=s;}
  if(s.window){s.windowAnim={open:0,target:0,manual:true};opening.segment=s;}
  if(level.floor)(world.upperSegs||(world.upperSegs=[])).push(s);else{world.segs.push(s);H.segs.push(s);}level.segments.push(s);
 };
 for(const level of plan.levels){
  level.segments=[];
  for(const wall of level.walls){const L=Math.hypot(wall.b[0]-wall.a[0],wall.b[1]-wall.a[1]);let cursor=0;
   for(const o of wall.openings){const a=o.at-o.width/2,b=o.at+o.width/2;if(a>cursor)putSegment(level,wall,cursor,a);putSegment(level,wall,a,b,o);cursor=b;}
   if(cursor<L-.001)putSegment(level,wall,cursor,L);
  }
  // Balcony perimeter is solid on the occupied floor; its doorway uses the
  // same animated portal as the renderer. No invisible enclosing rectangle.
  for(const r of level.outdoor)for(const [a,b] of [
   [[r.x0,r.y0],[r.x0,r.y1]],[[r.x0,r.rear?r.y0:r.y1],[r.x1,r.rear?r.y0:r.y1]],[[r.x1,r.y1],[r.x1,r.y0]]]){
   const wall={a,b,normal:[0,1],ext:true};putSegment(level,wall,0,Math.hypot(b[0]-a[0],b[1]-a[1]));
   const s=level.segments.at(-1);s.kind='balcony-rail';s.h=level.z+1.05;
  }
  // Em imóveis privados, instanciar apenas quando o jogador adquirir a propriedade.
  if(typeof CityRealty==='undefined'||CityRealty.canFurnish(H)){
    for(const f of level.furniture){const p=P(f.x,f.y),room=level.rooms.find(r=>r.id===f.room),center=P((room.x0+room.x1)/2,(room.y0+room.y1)/2);
     const b=addBox({...f,x:p[0],y:p[1],z:level.z,rot:plan.angle,house:H,floor:level.floor,architecture:true,roomCenter:center,solid:!f.overlay});H.interactables.push(b);
    }
  }
  const hall=level.rooms.find(r=>r.id==='hall'),center=P((hall.x0+hall.x1)/2,(hall.y0+hall.y1)/2);
  H.switches.push({x:center[0],y:center[1],floor:level.floor,kind:'switch',house:H});
  for(const r of level.rooms){const c=P((r.x0+r.x1)/2,(r.y0+r.y1)/2);H.indoorLights.push({x:c[0],y:c[1],floor:level.floor,z:level.z+2.4,r:Math.min(5,Math.hypot(r.x1-r.x0,r.y1-r.y0)*.6)});}
 }
 // Compra ativará a criação do mobiliário de todos os andares, sem reler assets.
 H.furnishOnPurchase=()=>{
   if(H._architectureFurnished)return;
   H._architectureFurnished=true;
   const newBoxes=[];
   for(const level of plan.levels)for(const f of level.furniture){
     const p=P(f.x,f.y),room=level.rooms.find(r=>r.id===f.room);
     const center=P((room.x0+room.x1)/2,(room.y0+room.y1)/2);
     const b=addBox({...f,x:p[0],y:p[1],z:level.z,rot:plan.angle,house:H,floor:level.floor,architecture:true,roomCenter:center,solid:!f.overlay});
     H.interactables.push(b);newBoxes.push(b);
   }
   if(typeof OW!=='undefined'&&OW.sectors)for(const sector of OW.sectors.values())
     if(sector.own?.houses?.includes(H)){(sector.own.boxes||(sector.own.boxes=[])).push(...newBoxes);break;}
 };
 if(typeof CityRealty==='undefined'||CityRealty.canFurnish(H))H._architectureFurnished=true;
 const first=plan.levels[0];H.doorPt=P(...first.entry);H.doorN=[ey[0],ey[1]];H.front=[H.doorPt[0]+ey[0]*1.8,H.doorPt[1]+ey[1]*1.8];if(H.walk)H.walk[0]=H.doorPt;
 if(typeof CityRealty!=='undefined'&&CityRealty.isOwned(H))H.furnishOnPurchase();
 plan.openingSegments=plan.levels.flatMap(level=>level.segments.filter(s=>s.doorAnim||s.windowAnim));
 if(count>1){H.stair={house:H,z:height,architecture:true};CityStairs.layout(H);}
 return H;
}

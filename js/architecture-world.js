// Installs the shared plan into the real streamed city, including its colliders.
'use strict';
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
  for(const f of level.furniture){const p=P(f.x,f.y),room=level.rooms.find(r=>r.id===f.room),center=P((room.x0+room.x1)/2,(room.y0+room.y1)/2);
   const b=addBox({...f,x:p[0],y:p[1],z:level.z,rot:plan.angle,house:H,floor:level.floor,architecture:true,roomCenter:center,solid:!f.overlay});H.interactables.push(b);
  }
  const hall=level.rooms.find(r=>r.id==='hall'),center=P((hall.x0+hall.x1)/2,(hall.y0+hall.y1)/2);
  H.switches.push({x:center[0],y:center[1],floor:level.floor,kind:'switch',house:H});
  for(const r of level.rooms){const c=P((r.x0+r.x1)/2,(r.y0+r.y1)/2);H.indoorLights.push({x:c[0],y:c[1],floor:level.floor,z:level.z+2.4,r:Math.min(5,Math.hypot(r.x1-r.x0,r.y1-r.y0)*.6)});}
 }
 const first=plan.levels[0];H.doorPt=P(...first.entry);H.doorN=[ey[0],ey[1]];H.front=[H.doorPt[0]+ey[0]*1.8,H.doorPt[1]+ey[1]*1.8];if(H.walk)H.walk[0]=H.doorPt;
 plan.openingSegments=plan.levels.flatMap(level=>level.segments.filter(s=>s.doorAnim||s.windowAnim));
 if(count>1){H.stair={house:H,z:height,architecture:true};
  for(const level of plan.levels){const hall=level.rooms.find(r=>r.id==='hall'),x=(hall.x0+hall.x1)/2-.45,y=D*.45;level.stair={x,y,bottom:P(x,y+1.25),top:P(x,y-1.25),center:P(x,y)};}
 }
 return H;
}

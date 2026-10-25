// Colisao para GLB 3D: footprint retangular orientado em metros do mundo.
// Nao usar world.blocked(): ele infla casas em 1,5m, moveis em 0,6m e
// bloqueia todo o quintal, mesmo sem paredes. Colisao so no volume solido.
const EPS=.035;
export function carFootprint(x,y,angle,length,width,margin=0){
 const c=Math.cos(angle),s=Math.sin(angle),l=length/2+margin,w=width/2+margin;
 return [[l,w],[l,-w],[-l,-w],[-l,w]].map(([u,v])=>[
  x+u*c-v*s,y+u*s+v*c
 ]);
}
function pointLocal(px,py,x,y,a){
 const dx=px-x,dy=py-y,c=Math.cos(a),s=Math.sin(a);
 return [dx*c+dy*s,-dx*s+dy*c];
}
function hitCircle(car,c,extra=0){
 const [x,y]=pointLocal(c.x,c.y,car.x,car.y,car.angle);
 const dx=Math.max(Math.abs(x)-car.length/2,0);
 const dy=Math.max(Math.abs(y)-car.width/2,0);
 return dx*dx+dy*dy<(c.r+extra)*(c.r+extra);
}
function hitSegment(car,wall,extra=EPS){
 // Paredes sao linhas finas: extrusar espessura real <10cm, sem margem fantasma.
 const a=pointLocal(wall.x1,wall.y1,car.x,car.y,car.angle);
 const b=pointLocal(wall.x2,wall.y2,car.x,car.y,car.angle);
 const ex=car.length/2+extra,ey=car.width/2+extra;
 let lo=0,hi=1;
 const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const [p,v,min,max] of [[a[0],dx,-ex,ex],[a[1],dy,-ey,ey]]){
  if(Math.abs(v)<1e-10){if(p<min||p>max)return false;continue;}
  let t0=(min-p)/v,t1=(max-p)/v;
  if(t0>t1)[t0,t1]=[t1,t0];
  lo=Math.max(lo,t0);hi=Math.min(hi,t1);
  if(lo>hi)return false;
 }
 return true;
}
function polyHit(A,B){
 for(const points of [A,B]){
  for(let i=0;i<points.length;i++){
   const p=points[i],q=points[(i+1)%points.length],
    nx=q[1]-p[1],ny=p[0]-q[0];
   let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;
   for(const v of A){const d=v[0]*nx+v[1]*ny;minA=Math.min(minA,d);maxA=Math.max(maxA,d);}
   for(const v of B){const d=v[0]*nx+v[1]*ny;minB=Math.min(minB,d);maxB=Math.max(maxB,d);}
   if(maxA<minB+1e-6||maxB<minA+1e-6)return false;
  }
 }
 return true;
}
export function carCollision(world,car,options={}){
 const margin=options.margin??EPS;
 const radius=Math.hypot(car.length/2,car.width/2)+margin;
 const record=(kind,object)=>({kind,object});
 const mapSize=options.mapSize??world.mapSize??160;
 const verts=carFootprint(car.x,car.y,car.angle,car.length,car.width,margin);
 if(verts.some(([x,y])=>x<.2||y<.2||x>mapSize-.2||y>mapSize-.2))
  return record('map',null);
 if(options.isWater){
  const probes=[[car.x,car.y],...verts];
  for(let i=0;i<4;i++){
   const a=verts[i],b=verts[(i+1)%4];
   probes.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);
  }
  if(probes.some(([x,y])=>options.isWater(x,y)))
   return record('water',null);
 }
 // Casa: superficie exata, sem a zona invisivel de 1,5m nem o quintal.
 for(const H of options.houses||[]){
  const bb=H.drawBounds||[H.x0,H.y0,H.x1,H.y1];
  if(car.x+radius<bb[0]||car.x-radius>bb[2]||
     car.y+radius<bb[1]||car.y-radius>bb[3])continue;
  if(H.solidFootprints){if(H.solidFootprints.some(poly=>polyHit(verts,poly)))return record('house',H);continue;}
  if(polyHit(verts,H.corners||[[H.x0,H.y0],[H.x1,H.y0],
    [H.x1,H.y1],[H.x0,H.y1]]))return record('house',H);
 }
 for(const s of world.segs||[]){
  if(s.house)continue; // casas ja cobertas por retangulo, ignore linhas de moveis duplicadas
  // Caixas já são testadas por OBB abaixo; seus quatro segmentos nunca são cercas.
  if(s.kind!=='fence'&&s.kind!=='garage'&&s.kind!=='ironfence')continue;   // paredes e portão das garagens também
  if(s.door&&s.doorAnim?.open>=.72)continue;
  if(Math.abs(s.x1-car.x)>radius+Math.abs(s.x2-s.x1)||
     Math.abs(s.y1-car.y)>radius+Math.abs(s.y2-s.y1))continue;
  if(hitSegment(car,s,margin+(s.kind==='fence'?.045:.06)))
   return record('fence',s);
 }
 // Bancadas, lixeiras e outras caixas fisicas, com orientacao propria.
 for(const b of options.boxes||[]){
  if(b.solid===false||b.floor===1||b.z>1.5||
     (world.roadDistFn&&world.roadDistFn(b.x,b.y)<3.68 && b.kind!=='vehicle'&&b.kind!=='parkedcar')||
     (b.house&&!b.exteriorFixture))continue;
  if(Math.hypot(b.x-car.x,b.y-car.y)>radius+Math.max(b.w,b.d))continue;
  const obstacle=carFootprint(b.x,b.y,b.rot||0,b.w,b.d,0);
  if(polyHit(verts,obstacle))return record('object',b);
 }
 for(const c of world.circles||[]){
  if(c===options.ignoreCircle||c.kind==='vehicle'||c.soft||c.kind==='bush'||c.kind==='rock')continue;
  // Nunca considerar colisores esquecidos no asfalto após a limpeza procedural.
  if(world.roadDistFn&&world.roadDistFn(c.x,c.y)<3.68)continue;
  if(Math.abs(c.x-car.x)>radius+c.r||
     Math.abs(c.y-car.y)>radius+c.r)continue;
  if(hitCircle(car,c,margin))return record(c.kind||'circle',c);
 }
 return null;
}
export function canPlaceCar(world,car,options={}){
 return !carCollision(world,car,options);
}
export function sweepCar(world,from,to,options={}){
 // Evita tunelamento ao acelerar e ao virar junto de quinas.
 const dist=Math.hypot(to.x-from.x,to.y-from.y);
 const angleDiff=Math.atan2(Math.sin(to.angle-from.angle),
                            Math.cos(to.angle-from.angle));
 const steps=Math.max(1,Math.ceil(Math.max(dist/.22,Math.abs(angleDiff)/.1)));
 let accepted={...from},impact=null;
 for(let i=1;i<=steps;i++){
  const t=i/steps,at={
   ...to,
   x:from.x+(to.x-from.x)*t,
   y:from.y+(to.y-from.y)*t,
   angle:from.angle+angleDiff*t
  };
  impact=carCollision(world,at,options);
  if(impact)break;
  accepted=at;
 }
 return {position:accepted,impact};
}

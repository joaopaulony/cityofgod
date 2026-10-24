// Geometria do passeio, asfalto e faixa verde usada por todos os setores de Miami.
(function(root){
'use strict';
const PROBES=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.71,.71],[.71,-.71],[-.71,.71],[-.71,-.71]];
function footprintClear(x,y,r,limit,distance){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 return PROBES.every(([a,b])=>distance(x+a*r,y+b*r)>=limit);
}
function verge(x,y,r,distance,roadWidth,sidewalkWidth){
 return footprintClear(x,y,r,roadWidth+sidewalkWidth+.3,distance);
}
function edgeFixture(x,y,r,distance,roadWidth){
 return footprintClear(x,y,r,roadWidth+.35,distance);
}
// A única via válida para a fachada é um segmento quase reto e paralelo ao prédio.
function alignedFront(road,index,frontWidth,minDot=.91) {
 const points=road?.pts;if(!points?.length)return false;
 const at=points[index];if(!at)return false;
 const ax=Math.abs(at.tx||0),ay=Math.abs(at.ty||0);
 if(Math.max(ax,ay)<minDot)return false;
 const delta=Math.max(2,Math.ceil(frontWidth));
 for(const step of [-delta,-Math.ceil(delta/2),Math.ceil(delta/2),delta]){
  const p=points[index+step];if(!p)return false;
  if((at.tx||0)*(p.tx||0)+(at.ty||0)*(p.ty||0)<.92)return false;
 }
 return true;
}
// Checa os lados, quinas e volume do prédio contra TODAS as vias (inclusive as curvas).
function clearBuilding(rect,distance,roadWidth,sidewalkWidth,margin=.5){
 const [x0,y0,x1,y1]=rect,lim=roadWidth+sidewalkWidth+margin;
 for(let x=x0;x<=x1+1e-6;x+=.75){
  if(distance(x,y0)<lim||distance(x,y1)<lim)return false;
 }
 for(let y=y0;y<=y1+1e-6;y+=.75){
  if(distance(x0,y)<lim||distance(x1,y)<lim)return false;
 }
 for(const x of [x0,x1,(x0+x1)*.5])
  for(const y of [y0,y1,(y0+y1)*.5])
   if(distance(x,y)<lim)return false;
 return true;
}
function clearVegetation(x,y,crownRadius,houses,margin=.55){
 for(const H of houses||[]){
  const dx=Math.max(H.x0-x,0,x-H.x1),dy=Math.max(H.y0-y,0,y-H.y1);
  if(dx*dx+dy*dy<(crownRadius+margin)**2)return false;
 }
 return true;
}
// A calçada é subdividida em faixa livre e margem externa. Mobiliário fino na borda do asfalto.
function curbFixture(x,y,r,distance,roadWidth,sidewalkWidth){
 const center=distance(x,y);
 return center>=roadWidth+r+.24 && center<=roadWidth+Math.min(1.05,sidewalkWidth-.15)
    && footprintClear(x,y,r,roadWidth+.18,distance);
}
function nearOtherRoad(x,y,roadId,index,threshold){
 if(!index?.map)return false;
 const cell=index.cell||16,ls=index.map.get(Math.floor(y/cell)*65536+Math.floor(x/cell));
 if(!ls)return false;
 for(const s of ls){
  if(s.id===roadId)continue;
  const ex=s.bx-s.ax,ey=s.by-s.ay,t=Math.max(0,Math.min(1,((x-s.ax)*ex+(y-s.ay)*ey)/(ex*ex+ey*ey||1)));
  const gap=Math.hypot(x-s.ax-t*ex,y-s.ay-t*ey);
  if(gap<(s.off||0)+threshold)return true;
 }
 return false;
}
// Profundidade máxima do acesso para não atravessar calçadas sinuosas nem chegar no asfalto.
// Ao menor sinal de curvatura, termina o piso antes da faixa pública.
function safeFrontDepth(x,y,n,half,maxDepth,distance,roadWidth,sidewalkWidth){
 let safe=0;
 for(let d=.25;d<=maxDepth+.0001;d+=.25){
   let ok=true;
   for(const frac of [-1,-.5,0,.5,1]){
     const tx=-n[1],ty=n[0],px=x+n[0]*d+tx*half*frac,py=y+n[1]*d+ty*half*frac;
     if(distance(px,py)<roadWidth+sidewalkWidth+.15){ok=false;break;}
   }
   if(!ok)break;
   safe=d;
 }
 return safe;
}
function judge(owned,distance,roadWidth,sidewalkWidth){
 const result={checked:0,roadHazards:0,blockedSidewalks:0,wrongFacades:0,examples:[]};
 const fail=(key,kind,x,y)=>{result[key]++;if(result.examples.length<12)result.examples.push({kind,x:+x.toFixed(1),y:+y.toFixed(1),issue:key});};
 for(const l of owned.lamps||[]){
   result.checked++;
   if(!curbFixture(l.x,l.y,.15,distance,roadWidth,sidewalkWidth))fail('roadHazards','lamp',l.x,l.y);
 }
 for(const b of owned.boxes||[]){
   if(!Number.isFinite(b.x)||!Number.isFinite(b.y)||b.kind==='vehicle'||b.house)continue;
   if(!['bench','hydrant','trashcan','busstop','bikerack','planter','bollard','newsbox','post','pallet','dumpster','mailbox'].includes(b.kind))continue;
   result.checked++;
   const r=Math.min(.7,Math.max(.15,Math.min(b.w||.4,b.d||.4)/2));
   if(!edgeFixture(b.x,b.y,r,distance,roadWidth))fail('roadHazards',b.kind,b.x,b.y);
   else if(['bench','planter','trashcan','pallet','dumpster'].includes(b.kind)&&
     !verge(b.x,b.y,r,distance,roadWidth,sidewalkWidth))fail('blockedSidewalks',b.kind,b.x,b.y);
 }
 for(const p of owned.props||[]){
   if(!['tree','bush','rock','tuft'].includes(p.type))continue;
   result.checked++;
   const r=p.type==='tuft'?.05:p.type==='tree'?.3:.12;
   if(!verge(p.x,p.y,r,distance,roadWidth,sidewalkWidth))fail('blockedSidewalks',p.type,p.x,p.y);
 }
 for(const h of owned.houses||[]){
   if(!h.doorPt||!h.doorN||h.country||h.rural)continue;
   result.checked++;
   const d0=distance(h.doorPt[0],h.doorPt[1]);
   const d1=distance(h.doorPt[0]+h.doorN[0]*2,h.doorPt[1]+h.doorN[1]*2);
   if(d1>d0+.3)fail('wrongFacades',h.miaKind||'building',h.doorPt[0],h.doorPt[1]);
 }
 result.passed=result.roadHazards===0&&result.blockedSidewalks===0&&result.wrongFacades===0;
 return result;
}
root.CityStreetLayout={footprintClear,verge,edgeFixture,alignedFront,clearBuilding,clearVegetation,curbFixture,nearOtherRoad,safeFrontDepth,judge};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CityStreetLayout;
})(globalThis);

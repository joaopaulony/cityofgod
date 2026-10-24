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
function judge(owned,distance,roadWidth,sidewalkWidth){
 const result={checked:0,roadHazards:0,blockedSidewalks:0,wrongFacades:0,examples:[]};
 const fail=(key,kind,x,y)=>{result[key]++;if(result.examples.length<12)result.examples.push({kind,x:+x.toFixed(1),y:+y.toFixed(1),issue:key});};
 for(const l of owned.lamps||[]){
   result.checked++;
   if(!edgeFixture(l.x,l.y,.15,distance,roadWidth))fail('roadHazards','lamp',l.x,l.y);
   else if(!verge(l.x,l.y,.15,distance,roadWidth,sidewalkWidth))fail('blockedSidewalks','lamp',l.x,l.y);
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
root.CityStreetLayout={footprintClear,verge,edgeFixture,judge};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CityStreetLayout;
})(globalThis);

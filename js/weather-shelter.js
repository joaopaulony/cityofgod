// Shared indoor/outdoor precipitation mask. Ground floor rooms, upper rooms
// and awnings stay dry; open balconies and open streets remain exposed.
(function(root){
 'use strict';
 let houses=()=>[],props=()=>[];
 function bind(getHouses,getProps){houses=typeof getHouses==='function'?getHouses:()=>getHouses||[];
  props=typeof getProps==='function'?getProps:()=>getProps||[];}
 const inRect=(r,x,y,pad=0)=>x>=r.x0-pad&&x<=r.x1+pad&&y>=r.y0-pad&&y<=r.y1+pad;
 function bounds(H){
  if(H.drawBounds)return {x0:H.drawBounds[0],y0:H.drawBounds[1],x1:H.drawBounds[2],y1:H.drawBounds[3]};
  if(H.corners){const xs=H.corners.map(p=>p[0]),ys=H.corners.map(p=>p[1]);
   return {x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};}
  return H;
 }
 function roofedHouse(H,x,y){
  if(!inRect(bounds(H),x,y,1))return false;
  if(H.architecture?.toLocal){
   const pt=H.architecture.toLocal(x,y);
   // Rooms, not balcony/outdoor polygons. The highest occupied floor has a roof;
   // lower floors are protected by the upper slab.
   return H.architecture.levels?.some(l=>l.rooms?.some(r=>inRect(r,pt[0],pt[1],.04)))||false;
  }
  if(typeof H.contains==='function')return !!H.contains(x,y,0);
  return inRect(H,x,y,.15);
 }
 function roofedProp(b,x,y){
  if(!['canopy','porchroof','portico','awning'].includes(b.kind)||!b.w||!b.d)return false;
  const dx=x-b.x,dy=y-b.y,a=b.rot||0,c=Math.cos(a),s=Math.sin(a);
  return Math.abs(dx*c+dy*s)<=b.w/2+.04&&Math.abs(-dx*s+dy*c)<=b.d/2+.04;
 }
 function nearby(x,y,rad=40){
  return (houses()||[]).filter(H=>{const b=bounds(H);return Number.isFinite(b.x0)&&
   b.x1>=x-rad&&b.x0<=x+rad&&b.y1>=y-rad&&b.y0<=y+rad;});
 }
 function isSheltered(x,y,z=0,near,nearProps){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  for(const H of near||nearby(x,y,1))if(roofedHouse(H,x,y))return true;
  for(const b of nearProps||props()||[])if(Math.abs(b.x-x)<(b.w||0)/2+.1&&roofedProp(b,x,y))return true;
  return false;
 }
 const rectPoints=r=>[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]];
 function regions(x,y,rad=55){
  const result=[];
  for(const H of nearby(x,y,rad)){
   if(H.architecture?.toWorld){
    const A=H.architecture;
    // The footprint is defined on level zero. Repeating upper-floor rooms in
    // an even-odd canvas mask would accidentally re-enable snow indoors.
    for(const r of A.levels?.[0]?.rooms||[])
     result.push(rectPoints(r).map(p=>A.toWorld(...p)));
   }else if(H.corners)result.push(H.corners);
   else if(H.toWorld)result.push(rectPoints(H).map(p=>H.toWorld(...p)));
   else result.push(rectPoints(H));
  }
  for(const b of props()||[])if(roofedProp(b,x,y)||Math.hypot(b.x-x,b.y-y)<rad+(b.w||0)){
   if(!['canopy','porchroof','portico','awning'].includes(b.kind))continue;
   const c=Math.cos(b.rot||0),s=Math.sin(b.rot||0),w=(b.w||0)/2,d=(b.d||0)/2;
   result.push([[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,v])=>[b.x+u*c-v*s,b.y+u*s+v*c]));
  }
  return result;
 }
 const api={bind,nearby,isSheltered,roofedHouse,roofedProp,regions};
 root.CityShelter=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);

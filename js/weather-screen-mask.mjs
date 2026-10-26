// Pure 2D screen-space mask: hide precipitation that projects onto an
// occupied cutaway house even if its world XY lies outside the house.
// This is necessary for isometric cameras without a visible roof depth buffer.
export function hull2D(points){
 const ps=points.filter(p=>p?.length===2&&p.every(Number.isFinite))
  .map(p=>[p[0],p[1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 if(ps.length<3)return [];
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[],hi=[];
 for(const p of ps){while(lo.length>=2&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
 for(let i=ps.length-1;i>=0;i--){const p=ps[i];
  while(hi.length>=2&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);
 }
 return lo.slice(0,-1).concat(hi.slice(0,-1));
}
export function isScreenMasked(masks,x,y){
 for(const m of masks){
  if(x<m.minX||x>m.maxX||y<m.minY||y>m.maxY)continue;
  let inside=false;
  const p=m.hull;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
   const a=p[i],b=p[j];
   if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  if(inside)return true;
 }
 return false;
}
export function occupiedHouseScreens(houses,project){
 const shapes=[];
 for(const H of houses||[]){
  if(!H.inside||!H.architecture?.toWorld)continue;
  const A=H.architecture,footprint=[[0,0],[A.width,0],[A.width,A.depth],[0,A.depth]];
  const roofHeight=Math.max(2.5,H.h||A.levels?.length*(H.floorHeight||A.floorHeight||3)||3)+.4;
  const pts=[];
  for(const elevation of [0,roofHeight])
   for(const pt of footprint){
    const world=A.toWorld(...pt);
    pts.push(project(world[0],world[1],elevation));
   }
  const h=hull2D(pts);
  if(h.length<3)continue;
  shapes.push({hull:h,minX:Math.min(...h.map(p=>p[0]))-.007,maxX:Math.max(...h.map(p=>p[0]))+.007,
   minY:Math.min(...h.map(p=>p[1]))-.007,maxY:Math.max(...h.map(p=>p[1]))+.007});
 }
 return shapes;
}

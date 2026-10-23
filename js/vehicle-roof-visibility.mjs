// Roof/GLB cutaway uses the SAME 2D projection and exact procedurally
// generated roof triangles as the visual renderer. No screenshots or masks
// baked from the GLB. Camera angle / zoom may vary continuously.
export function projectVehiclePoint(cam,x,y,z=0){
 const dx=x-cam.x,dy=y-cam.y;
 return {x:cam.W/2+(Math.cos(cam.ang)*dx-Math.sin(cam.ang)*dy)*cam.zoom,
  y:cam.H/2+(Math.sin(cam.ang)*dx+Math.cos(cam.ang)*dy)*.5*cam.zoom
    -z*.86*cam.zoom};
}
export function cameraSurfaceDepth(cam,p){
 return .8660254037844386*(Math.sin(cam.ang)*(p[0]-cam.x)+
  Math.cos(cam.ang)*(p[1]-cam.y))+.5*p[2];
}
function triangleCoordinates(p,a,b,c){
 const ax=b.x-a.x,ay=b.y-a.y,bx=c.x-a.x,by=c.y-a.y,
   den=ax*by-ay*bx;
 if(Math.abs(den)<1e-7)return null;
 const px=p.x-a.x,py=p.y-a.y,
  u=(px*by-py*bx)/den,v=(ax*py-ay*px)/den;
 if(u<-.0001||v<-.0001||u+v>1.0001)return null;
 return [1-u-v,u,v];
}
export function roofCoverageForCar(cam,car,house,roof){
 if(house.inside||!roof?.faces?.length)return 0;
 const cx=(house.x0+house.x1)/2,cy=(house.y0+house.y1)/2;
 const maxDist=Math.hypot(house.x1-house.x0,house.y1-house.y0)/2+7;
 if(Math.hypot(car.x-cx,car.y-cy)>maxDist)return 0;
 const c=Math.cos(car.angle),s=Math.sin(car.angle),
   length=car.length||4.5,width=car.width||1.8;
 const triangles=[];
 for(const f of roof.faces){
  const p=f.p;
  if(!p||p.length<3)continue;
  for(let i=1;i<p.length-1;i++){
   const verts=[p[0],p[i],p[i+1]];
   triangles.push({
    screen:verts.map(v=>projectVehiclePoint(cam,...v)),
    depth:verts.map(v=>cameraSurfaceDepth(cam,v))
   });
  }
 }
 let covered=0,total=0;
 // Samples include bumper, roof and windows: a single tyre or distant
 // eave pixel does not trigger a huge house cutaway.
 for(const z of [.55,1.05,1.55])
  for(const u of [-.36,0,.36])
   for(const v of [-.30,.30]){
    const px=car.x+(u*length)*c-(v*width)*s,
      py=car.y+(u*length)*s+(v*width)*c;
    const p=projectVehiclePoint(cam,px,py,z);
    const carDepth=cameraSurfaceDepth(cam,[px,py,z]);
    total++;
    if(triangles.some(t=>{
      const bary=triangleCoordinates(p,...t.screen);
      if(!bary)return false;
      const roofDepth=t.depth.reduce((sum,d,i)=>sum+d*bary[i],0);
      return roofDepth>carDepth+.045;
    }))covered++;
   }
 return covered/total;
}
export function selectVehicleRoofCutaways(cam,car,houses,getRoof){
 const result=new Set();
 for(const H of houses){
  if(H.inside||H.roofKind==='flat')continue;
  const roof=getRoof(H);
  if(roofCoverageForCar(cam,car,H,roof)>=.13)result.add(H);
 }
 return result;
}

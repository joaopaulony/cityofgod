// Animation choices and traversal planning have no dependency on the renderer.
export function chooseCharacterClip(a){
 if(a.traversal)return 'vault_low';
 if(a.jump){
  if(a.jump.t<.18)return 'jump_start';
  return a.jump.t<a.jump.duration-.18?'jump_air':'jump_land';
 }
 if(a.reloadT>=0)return a.crouching?'rifle_crouch_reload':'rifle_reload';
 if(a.armed&&a.recoilT<.16)return a.crouching?'rifle_crouch_fire':'rifle_fire';
 const moving=a.speed>.12,aim=a.armed&&(a.aiming||a.aimHold>0);
 if(a.crouching)return a.armed?(moving?'rifle_crouch_walk':'rifle_crouch_aim'):(moving?'crouch_walk':'crouch');
 if(moving){
  if(a.running)return a.armed?'rifle_run':'run';
  if(aim){
   const delta=Math.atan2(Math.sin(a.moveA-a.face),Math.cos(a.moveA-a.face));
   if(Math.abs(delta)>2.3)return 'rifle_walk_back';
   if(Math.abs(delta)>.65)return delta>0?'rifle_strafe_right':'rifle_strafe_left';
   return 'rifle_walk';
  }
  return a.armed?'rifle_walk':'walk';
 }
 return aim?'rifle_aim':a.armed?'rifle_idle':'idle';
}
export function pointSegmentDistance(x,y,s){
 const dx=s.x2-s.x1,dy=s.y2-s.y1,l2=dx*dx+dy*dy;
 const t=l2?Math.max(0,Math.min(1,((x-s.x1)*dx+(y-s.y1)*dy)/l2)):0;
 return Math.hypot(x-s.x1-t*dx,y-s.y1-t*dy);
}
export function planLowVault(a,segs,clear){
 if(a.floor||a.stairTravel||a.jump||a.traversal||a.crouching)return null;
 const fx=Math.cos(a.face),fy=Math.sin(a.face),candidates=[];
 for(const s of segs){
  if(s.house||s.door||!['fence','wall'].includes(s.kind)||!(s.h>=.45&&s.h<=1.55))continue;
  const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy);if(len<.8)continue;
  const nx=-dy/len,ny=dx/len,dist=(a.x-s.x1)*nx+(a.y-s.y1)*ny,approach=fx*nx+fy*ny;
  if(Math.abs(approach)<.55||dist*approach>=0)continue;
  const travel=-dist/approach;if(travel<.22||travel>1.15)continue;
  const hx=a.x+fx*travel,hy=a.y+fy*travel,u=((hx-s.x1)*dx+(hy-s.y1)*dy)/(len*len);
  if(u*len<.32||(1-u)*len<.32)continue;
  const total=travel+.68/Math.abs(approach),x=a.x+fx*total,y=a.y+fy*total;
  let safe=true;
  for(let i=0;i<=24;i++)if(!clear(a.x+(x-a.x)*i/24,a.y+(y-a.y)*i/24,s)){safe=false;break;}
  let lo=0,hi=1;
  for(let i=0;i<18;i++){const m=(lo+hi)/2;if(m*m*(3-2*m)<travel/total)lo=m;else hi=m;}
  const height=(s.h+.12)/Math.sin(Math.PI*(lo+hi)/2);
  if(safe)candidates.push({kind:'vault',fromX:a.x,fromY:a.y,x,y,t:0,duration:1.1,height,segment:s,distance:travel});
 }
 return candidates.sort((a,b)=>a.distance-b.distance)[0]||null;
}
export function stepTraversal(a,dt,clear){
 const v=a.traversal;if(!v)return false;
 v.t=Math.min(v.duration,v.t+dt);const u=v.t/v.duration,s=u*u*(3-2*u);
 const x=v.fromX+(v.x-v.fromX)*s,y=v.fromY+(v.y-v.fromY)*s;
 // World streaming / moving cars may obstruct a previously safe trajectory.
 if(!clear(x,y,v.segment)){
  a.x=v.fromX;a.y=v.fromY;a.traversal=null;a.actionZ=0;return true;
 }
 a.x=x;a.y=y;a.actionZ=Math.sin(Math.PI*u)*v.height;
 if(u>=1){a.traversal=null;a.actionZ=0;}
 return true;
}

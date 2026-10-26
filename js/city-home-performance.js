// City Home: authored procedural choreography and furniture interaction sockets.
// World coordinates are X,Y horizontal, Z vertical; no external animation assets.
'use strict';
const CityHomePerformance=(()=>{
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
 const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 const lerp=(a,b,w)=>a+(b-a)*w;
 const vec=(p,q,w)=>p.map((v,i)=>lerp(v,q[i],w));
 const durations={sit:5.2,sleep:9.2,cook:7.4,watch:5.2,work:5.8,
   eat:4.3,wash:4.8,toilet:5.1};
 const duration=kind=>durations[kind]||4.4;
 const position=(item,u=0,v=0)=>{
  const c=Math.cos(item.rot||0),s=Math.sin(item.rot||0);
  return {x:item.x+u*c-v*s,y:item.y+u*s+v*c};
 };
 const axes=item=>{
  const c=Math.cos(item.rot||0),s=Math.sin(item.rot||0);
  return {u:[c,s,0],v:[-s,c,0]};
 };
 const local=(H,x,y)=>H.architecture?.toLocal?.(x,y)||[x-H.x0,y-H.y0];
 function approach(H,actor,item,kind){
  if(!window.CityHomeNav)return null;
  const f=item.floor||0,bed=kind==='sleep',seat=kind==='sit'||kind==='toilet';
  // Sofa faces +V; chair and toilet face -V; bed entered from the side. Seated actors rotate to face outward before moving hips backwards.
  const front=item.kind==='chair'||item.kind==='toilet'?-1:1;
  const clearance=seat?.52:.34;
  const choices=bed?[[item.w/2+.56,0],[-item.w/2-.56,0]]:
   [[0,front*(item.d/2+clearance)],[-Math.min(item.w*.18,.35),front*(item.d/2+clearance)],
    [Math.min(item.w*.18,.35),front*(item.d/2+clearance)]];
  if(!bed&&!seat)choices.push([item.w/2+.54,0],[-item.w/2-.54,0]);
  let best=null;
  for(const [u,v] of choices){
   const p=position(item,u,v),loc=local(H,p.x,p.y);
   if(!CityHomeNav.inside(H,f,loc[0],loc[1])||
     CityHomeNav.furnitureBlocked(H,f,loc[0],loc[1],null))continue;
   const path=CityHomeNav.route(H,actor,p,f,null);
   if(!path)continue;
   const last=path.goal;
   if(!last||Math.hypot(last[0]-p.x,last[1]-p.y)>.68)continue;
   const l=local(H,last[0],last[1]);
   // Validate the final segment, including doorway and fixture clearance.
   if(!CityHomeNav.doorway(H,f,l,loc))continue;
   let clear=true;
   for(let i=1;i<=4;i++){
    const q=local(H,lerp(last[0],p.x,i/4),lerp(last[1],p.y,i/4));
    if(!CityHomeNav.inside(H,f,q[0],q[1])||
      CityHomeNav.furnitureBlocked(H,f,q[0],q[1],null)){clear=false;break;}
   }
   if(!clear)continue;
   const heading=Math.atan2(item.y-p.y,item.x-p.x)+(seat&&!bed?Math.PI:0);
   const candidate={...path,points:[...path.points,{x:p.x,y:p.y}],
     stand:p,face:heading,seat:seat||bed,socket:{u,v}};
   if(!best||candidate.distance<best.distance)best=candidate;
  }
  return best;
 }
 function sample(kind,elapsed,durationTotal){
  const u=clamp(elapsed/Math.max(.1,durationTotal)),enter=ease(u/.2),leave=ease((1-u)/.2);
  const occupied=Math.min(enter,leave);
  const reclining=kind==='sleep'?Math.min(ease((u-.22)/.29),ease((.83-u)/.18)):0;
  return {u,occupied,reclining,breathe:Math.sin(elapsed*2.15)*.008,
   reach:ease((u-.12)/.12)*ease((.91-u)/.13),
   phase:elapsed*5.4};
 }
 function move(J,key,target,w){
  if(J[key]&&target)J[key]=vec(J[key],target,clamp(w));
 }
 function poleIK(A,T,l1,l2,pole){
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]);
  const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0);
  const norm=v=>{const l=Math.hypot(...v)||1;return mul(v,1/l);};
  const raw=sub(T,A),r=Math.hypot(...raw),d=clamp(r,.012,l1+l2-.002);
  const dir=norm(raw),proj=mul(dir,dot(pole,dir)),n=norm(sub(pole,proj));
  const along=(l1*l1-l2*l2+d*d)/(2*d),off=Math.sqrt(Math.max(0,l1*l1-along*along));
  return {mid:add(A,add(mul(dir,along),mul(n,off))),end:add(A,mul(dir,d))};
 }
 function arm(J,side,target,weight,fwd){
  const sh=J['sh'+side];if(!sh)return;
  // Clamp arm reach to prevent arm stretching or hands penetrating far objects.
  const d=target.map((v,i)=>v-sh[i]),length=Math.hypot(...d)||1;
  const hand=length>.565?sh.map((v,i)=>v+d[i]*.565/length):target;
  const forward=fwd,sign=side==='L'?1:-1;
  const pole=[-forward[0]+sign*(-forward[1])*.75,-forward[1]+sign*forward[0]*.75,-.65];
  const elbow=poleIK(sh,hand,.29,.28,pole);
  move(J,'elb'+side,elbow.mid,weight);move(J,'hand'+side,elbow.end,weight);
 }
 function apply(a,J){
  const state=a?.homeAction;
  if(!state||!J||!state.item||!Number.isFinite(state.duration))return J;
  const item=state.item,kind=state.kind,anim=sample(kind,state.t||0,state.duration);
  const {v}=axes(item),fwd=[Math.cos(a.face),Math.sin(a.face),0];
  const floor=0,baseZ=J.pelvis?.[2]||.93;
  if(['sit','sleep','toilet'].includes(kind)){
   // Contact targets derive from the *actual* current furniture footprint.
   const bed=kind==='sleep',toilet=kind==='toilet';
   const seatSide=state.socket?.u<0?-1:1;
   const target=bed?position(item,seatSide*(item.w/2-.16),item.d*.17):
     position(item,0,['sofa','couch','sectional'].includes(item.kind)?.10:0);
   const seatHeight=bed?Math.min(.55,Math.max(.32,item.h*.73)):toilet?.43:item.kind==='chair'?.45:.43;
   const seatWeight=anim.occupied,reclineWeight=anim.reclining;
   const pelvis=[target.x,target.y,seatHeight+anim.breathe*seatWeight];
   // The feet must follow the sit-down step instead of staying at the distant
   // walking socket: otherwise the thighs are longer than the IK chain.
   const footLine=position(item,0,(item.kind==='chair'||toilet?-1:1)*(item.d/2+.16));
   const lateral=[-fwd[1],fwd[0],0],body=[...pelvis];
   const newChest=[body[0]+fwd[0]*.06,body[1]+fwd[1]*.06,body[2]+.47];
   const neck=[newChest[0],newChest[1],newChest[2]+.12],head=[neck[0]+fwd[0]*.025,neck[1]+fwd[1]*.025,neck[2]+.14];
   const original={...J};
   move(J,'pelvis',pelvis,seatWeight);
   for(const side of ['L','R']){
    const sign=side==='L'?1:-1;
    const hip=[pelvis[0]+lateral[0]*sign*.11,pelvis[1]+lateral[1]*sign*.11,pelvis[2]];
    move(J,'hip'+side,hip,seatWeight);
    const baseHip=J['hip'+side];
    const planted=original['ank'+side];
    const foot=bed?planted:[footLine.x+lateral[0]*sign*.11,
      footLine.y+lateral[1]*sign*.11,.08];
    const anchor=vec(planted,foot,seatWeight);
    const knee=poleIK(baseHip,anchor,.46,.45,[fwd[0],fwd[1],.25]);
    move(J,'knee'+side,knee.mid,seatWeight);
    if(!bed){
     move(J,'ank'+side,knee.end,seatWeight);
     move(J,'toe'+side,[knee.end[0]+fwd[0]*.16,knee.end[1]+fwd[1]*.16,.03],seatWeight);
    }
   }
   move(J,'chest',newChest,seatWeight);move(J,'neck',neck,seatWeight);move(J,'head',head,seatWeight);
   for(const side of ['L','R']){
    const sign=side==='L'?1:-1,sh=[newChest[0]+lateral[0]*sign*.19,newChest[1]+lateral[1]*sign*.19,newChest[2]+.11];
    move(J,'sh'+side,sh,seatWeight);
    const knee=J['knee'+side];
    arm(J,side,[knee[0],knee[1],knee[2]+.09],seatWeight,fwd);
   }
   if(bed&&reclineWeight>0){
    const direction=[-v[0],-v[1],0],foot=[v[0],v[1],0];
    // Bed GLB surface is at 0.52-0.60 m with a blanket at 0.57 m;
    // lift the joint above the blanket so the torso doesn't sink into it.
    const sleepPelvis=[target.x,target.y,Math.max(.64,item.h*.93)];
    const sleepChest=[sleepPelvis[0]+direction[0]*.44,sleepPelvis[1]+direction[1]*.44,sleepPelvis[2]+.04+anim.breathe];
    const sleepNeck=[sleepChest[0]+direction[0]*.12,sleepChest[1]+direction[1]*.12,sleepChest[2]+.015];
    const sleepHead=[sleepNeck[0]+direction[0]*.15,sleepNeck[1]+direction[1]*.15,sleepNeck[2]+.04];
    const side=[-direction[1],direction[0]];
    move(J,'pelvis',sleepPelvis,reclineWeight);move(J,'chest',sleepChest,reclineWeight);
    move(J,'neck',sleepNeck,reclineWeight);move(J,'head',sleepHead,reclineWeight);
    for(const [s,sign] of [['L',1],['R',-1]]){
     const hip=[sleepPelvis[0]+side[0]*sign*.1,sleepPelvis[1]+side[1]*sign*.1,sleepPelvis[2]];
     const knee=[hip[0]+foot[0]*.43,hip[1]+foot[1]*.43,sleepPelvis[2]+.10];
     const ank=[hip[0]+foot[0]*.78,hip[1]+foot[1]*.78,sleepPelvis[2]+.02];
     move(J,'hip'+s,hip,reclineWeight);move(J,'knee'+s,knee,reclineWeight);
     move(J,'ank'+s,ank,reclineWeight);
     move(J,'toe'+s,[ank[0]+foot[0]*.12,ank[1]+foot[1]*.12,ank[2]],reclineWeight);
     const sh=[sleepChest[0]+side[0]*sign*.19,sleepChest[1]+side[1]*sign*.19,sleepChest[2]];
     move(J,'sh'+s,sh,reclineWeight);
     arm(J,s,[sleepPelvis[0]+side[0]*sign*.12,sleepPelvis[1]+side[1]*sign*.12,sleepPelvis[2]+.13],
       reclineWeight,direction);
    }
   }
   return J;
  }
  if(['cook','wash','eat','work'].includes(kind)){
   const active=anim.reach;
   if(!active)return J;
   const mid=position(item,0,item.d*.12),left=[-fwd[1],fwd[0]];
   const reachHeight=kind==='cook'?Math.min(1.04,Math.max(.82,item.h+.03)):kind==='wash'?.92:kind==='work'?.75:1.42;
   const swing=Math.sin(anim.phase),r=Math.cos(anim.phase*.72);
   move(J,'chest',[J.chest[0]+fwd[0]*.055,J.chest[1]+fwd[1]*.055,J.chest[2]-.025],active);
   for(const [side,sign] of [['L',1],['R',-1]]){
    const target=kind==='eat'
      ?[J.head[0]+fwd[0]*.12+left[0]*sign*.09,J.head[1]+fwd[1]*.12+left[1]*sign*.09,J.head[2]-.11+Math.max(0,swing)*.09]
      :[mid.x+left[0]*(sign*.13+swing*.065),mid.y+left[1]*(sign*.13+swing*.065),
        reachHeight+.05*Math.sin(anim.phase+sign*1.6)];
    arm(J,side,target,active,fwd);
   }
   J.headFwd=[fwd[0]*.97,fwd[1]*.97,-.23];
  }
  return J;
 }
 return {duration,approach,sample,apply,version:'2.0'};
})();
window.CityHomePerformance=CityHomePerformance;

import * as THREE from 'three';

// Retarget the game's domestic IK to Mixamo, including cartoon/base variants.
// Restore the animation frame before the next mixer update, avoiding residual
// bone translations after getting up or cancelling an activity.
export function createDomesticRig(root){
 root.updateMatrixWorld(true);
 const links=[['Hips','pelvis','chest'],['Spine','spineLow','spineMid'],['Spine1','spineMid','spineHigh'],['Spine2','spineHigh','neck'],['Neck','neck','head'],['Head','head','headTop']];
 // Game XY -> Three XZ reverses handedness; anatomical sides swap.
 for(const [side,letter] of [['Left','R'],['Right','L']])links.push(
  [side+'Shoulder','neck','sh'+letter],[side+'Arm','sh'+letter,'elb'+letter],
  [side+'ForeArm','elb'+letter,'hand'+letter],[side+'Hand','hand'+letter,'finger'+letter],
  [side+'UpLeg','hip'+letter,'knee'+letter],[side+'Leg','knee'+letter,'ank'+letter],[side+'Foot','ank'+letter,'toe'+letter]);
 const rootQ=root.getWorldQuaternion(new THREE.Quaternion()),inv=rootQ.clone().invert();
 const entries=links.map(([name,from,to])=>{
  const bone=root.getObjectByName('mixamorig'+name);if(!bone)return null;
  const p=bone.getWorldPosition(new THREE.Vector3());
  // The GLB includes zero-length helper bones (e.g. LeftForeArm_1).
  // They cannot define an anatomical axis; prefer the actual next joint.
  const next=name==='Hips'?'Spine':name==='Head'?'HeadTop_End':name.endsWith('Hand')?name.replace('Hand','HandMiddle1'):null;
  const child=(next&&root.getObjectByName('mixamorig'+next))||bone.children.find(o=>o.isBone&&o.getWorldPosition(new THREE.Vector3()).distanceTo(p)>1e-5);
  const dir=child?child.getWorldPosition(new THREE.Vector3()).sub(p).normalize():new THREE.Vector3(0,1,0);
  return {name,bone,from,to,length:child?child.getWorldPosition(new THREE.Vector3()).distanceTo(p):.1,dir:dir.applyQuaternion(inv),bind:inv.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))};
 }).filter(Boolean);
 let previous=[];
 return {
  restore(){for(const [b,p,q] of previous){b.position.copy(p);b.quaternion.copy(q);}previous=[];},
  update(a){
   if(!a.homeAction||!a.J)return;
   const pts={},z=(a.floorZ||0)+(a.actionZ||0);
   for(const [key,p] of Object.entries(a.J))if(Array.isArray(p)&&p.length===3)pts[key]=new THREE.Vector3(p[0],p[2]+z,p[1]);
   for(const [name,f] of [['spineLow',.22],['spineMid',.52],['spineHigh',.85]])pts[name]=pts.pelvis.clone().lerp(pts.chest,f);
   const up=pts.neck.clone().sub(pts.chest).normalize();
   pts.headTop=pts.head.clone().addScaledVector(up,.18);
   for(const l of ['L','R']){
    const sip=a.homeAction.kind==='drink'&&l==='R'||a.homeAction.kind==='fridge'&&l==='L';
    const forward=new THREE.Vector3(Math.cos(a.face),0,Math.sin(a.face));
    pts['finger'+l]=pts['hand'+l].clone().addScaledVector(forward,sip?.025:.10);
    pts['finger'+l].y+=sip?.10:a.homeAction.kind==='sleep'?0:-.02;
   }
   root.updateMatrixWorld(true);const qRoot=root.getWorldQuaternion(new THREE.Quaternion());
   for(const e of entries)previous.push([e.bone,e.bone.position.clone(),e.bone.quaternion.clone()]);
   const orient=(e,from,to)=>{
    const q=new THREE.Quaternion().setFromUnitVectors(e.dir.clone().applyQuaternion(qRoot),to.clone().sub(from).normalize());
    q.multiply(qRoot.clone().multiply(e.bind));
    e.bone.quaternion.copy(e.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    e.bone.updateMatrixWorld(true);
   };
   // Only move the pelvis. Native local offsets keep skin and joints connected.
   const hip=entries.find(e=>e.name==='Hips');
   hip.bone.position.copy(hip.bone.parent.worldToLocal(pts.pelvis.clone()));
   for(const e of entries.slice(0,6))orient(e,pts[e.from],pts[e.to]);
   const get=name=>entries.find(e=>e.name===name);
   const solve=(base,target,l1,l2,pole)=>{
    const axis=target.clone().sub(base),distance=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
    pole=pole.clone().sub(base);pole.addScaledVector(axis,-pole.dot(axis));
    if(pole.lengthSq()<1e-8)pole.set(1,0,0);pole.normalize();
    return {mid:base.clone().addScaledVector(axis,along).addScaledVector(pole,height),end:base.clone().addScaledVector(axis,distance)};
   };
   for(const [side,l] of [['Left','R'],['Right','L']]){
    for(const [upper,lower,end,target,pole] of [
     [get(side+'Arm'),get(side+'ForeArm'),get(side+'Hand'),pts['hand'+l],pts['elb'+l]],
     [get(side+'UpLeg'),get(side+'Leg'),get(side+'Foot'),pts['ank'+l],pts['knee'+l]]]){
      const base=upper.bone.getWorldPosition(new THREE.Vector3()),ik=solve(base,target,upper.length,lower.length,pole);
      orient(upper,base,ik.mid);orient(lower,ik.mid,ik.end);
      const desired=end.name.endsWith('Hand')?pts['finger'+l].clone().sub(pts['hand'+l]):pts['toe'+l].clone().sub(pts['ank'+l]);
      orient(end,ik.end,ik.end.clone().add(desired));
    }
   }
   a.domesticHands={};
   for(const [side,l] of [['Left','R'],['Right','L']]){
     const p=get(side+'Hand').bone.getWorldPosition(new THREE.Vector3());
     a.domesticHands[l]=[p.x,p.z,p.y-z];
     if((a.homeAction.kind==='drink'||a.homeAction.kind==='cook')&&l==='R'){
       const forward=new THREE.Vector3(Math.cos(a.face),0,Math.sin(a.face));
       const center=p.clone().addScaledVector(forward,.075);center.y+=a.homeAction.kind==='drink'?.075:-.04;
       for(const finger of ['Index','Middle','Ring','Pinky'])for(let n=1;n<=3;n++){
         const b=root.getObjectByName('mixamorig'+side+'Hand'+finger+n);
         const child=root.getObjectByName('mixamorig'+side+'Hand'+finger+(n+1));
         if(!b||!child)continue;
         previous.push([b,b.position.clone(),b.quaternion.clone()]);
         const at=b.getWorldPosition(new THREE.Vector3()),dir=child.getWorldPosition(new THREE.Vector3()).sub(at).normalize();
         const target=center.clone().sub(at).normalize(),world=b.getWorldQuaternion(new THREE.Quaternion());
         const q=new THREE.Quaternion().setFromUnitVectors(dir,target).multiply(world);
         b.quaternion.slerp(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q),.75);b.updateMatrixWorld(true);
       }
     }
   }
  }
 };
}

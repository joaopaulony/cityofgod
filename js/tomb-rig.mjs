import * as THREE from 'three';

// Bind the native Tomb/PZ skeleton to the game's original IK joints. No PZ
// animation files are needed: reload, recoil and locomotion keep their timing.
export function createTombRig(root){
 root.updateMatrixWorld(true);
 const bones=new Map();root.traverse(o=>{if(o.isBone)bones.set(o.name,o);});
 const links=[
  ['Pelvis','pelvis','spine'],['Spine','spine','chest'],['Spine1','chest','neck'],
  ['Neck','neck','headPivot'],['Head','headPivot','headTop'],
  ['L_Clavicle','clavL','shL'],['L_UpperArm','shL','elbL'],['L_Forearm','elbL','handL'],['L_Hand','handL','fingerL'],
  ['R_Clavicle','clavR','shR'],['R_UpperArm','shR','elbR'],['R_Forearm','elbR','handR'],['R_Hand','handR','fingerR'],
  ['L_Thigh','hipL','kneeL'],['L_Calf','kneeL','ankL'],['L_Foot','ankL','toeL'],
  ['R_Thigh','hipR','kneeR'],['R_Calf','kneeR','ankR'],['R_Foot','ankR','toeR']
 ];
 const childNames={Pelvis:'Spine',Spine:'Spine1',Spine1:'Neck',Neck:'Head',Head:null,L_Hand:'L_Finger1',R_Hand:'R_Finger1'};
 const entries=links.map(([name,from,to])=>{
  const bone=bones.get('Bip01_'+name);if(!bone)throw Error('Missing Tomb bone '+name);
  const child=childNames[name]?bones.get('Bip01_'+childNames[name]):bone.children.find(b=>b.isBone);
  const pos=bone.getWorldPosition(new THREE.Vector3());
  const direction=child?child.getWorldPosition(new THREE.Vector3()).sub(pos).normalize():new THREE.Vector3(0,1,0);
  return {bone,from,to,bind:bone.getWorldQuaternion(new THREE.Quaternion()),direction};
 });
 const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),rootQ=new THREE.Quaternion(),restQ=new THREE.Quaternion(),restD=new THREE.Vector3(),direction=new THREE.Vector3(),position=new THREE.Vector3();
 const to3=p=>new THREE.Vector3(p[0],p[2],p[1]);
 function update(a){
  if(!a.J)return;
  const j=a.J,z=(a.floorZ||0)+(a.actionZ||0),points={};
  for(const [name,p] of Object.entries(j))if(Array.isArray(p)&&p.length===3)points[name]=to3(p).add(new THREE.Vector3(0,z,0));
  const mix=(a,b,t)=>a.clone().lerp(b,t);
  points.spine=mix(points.pelvis,points.chest,.24);
  points.headPivot=mix(points.neck,points.head,.18);
  points.headTop=points.headPivot.clone().add(new THREE.Vector3(0,.2,0));
  for(const s of ['L','R']){
   points['clav'+s]=mix(points.neck,points['sh'+s],.12);
   points['finger'+s]=points['hand'+s].clone().add(points['hand'+s].clone().sub(points['elb'+s]).normalize().multiplyScalar(.12));
  }
  root.getWorldQuaternion(rootQ);
  for(const e of entries){
   const from=points[e.from],to=points[e.to];if(!from||!to)continue;
   restD.copy(e.direction).applyQuaternion(rootQ);
   direction.copy(to).sub(from).normalize();
   q.setFromUnitVectors(restD,direction);
   restQ.copy(rootQ).multiply(e.bind);q.multiply(restQ);
   e.bone.parent.getWorldQuaternion(parentQ).invert();
   e.bone.quaternion.copy(parentQ.multiply(q));
   position.copy(from);e.bone.parent.worldToLocal(position);e.bone.position.copy(position);
   e.bone.updateMatrixWorld(true);
  }
 }
 return {update,bones:entries.length};
}

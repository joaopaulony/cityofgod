// Rodas 3D verdadeiras: pivô de direção sobre eixo vertical e rolamento
// sobre o eixo longitudinal da roda. Nenhum frame pre-renderizado.
const ROLES=['fl','fr','rl','rr'];
export function classifyWheelName(name=''){
 const s=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const role of ROLES)
  if(s===('wheel'+role)||s===('tyre'+role)||s===('tire'+role)||
    s===('roda'+role)||s===('rim'+role))return role;
 const isWheel=/wheel|tire|tyre|roda|pneu|rim/.test(s);
 if(!isWheel)return null;
 const front=/front|diante|^f/.test(s),rear=/rear|back|tras|^r/.test(s),
       left=/left|esquer|^l/.test(s),right=/right|direit|^r/.test(s);
 return (front!==rear&&left!==right)?(front?'f':'r')+(left?'l':'r'):null;
}
export function wheelRadiusFromBox(box){
 if(!box||!Number.isFinite(box.max.y)||!Number.isFinite(box.min.y))return .32;
 return Math.max(.2,Math.min(.65,(box.max.y-box.min.y)/2));
}
export function createWheelRig(root,THREE){
 const wheels=new Map(),original=[];
 root.traverse(node=>{
  if(!node.isObject3D && !node.isMesh && !node.isGroup)return;
  const role=classifyWheelName(node.name||'');
  if(!role||wheels.has(role))return;
  // O pivô de cada roda do pack já está no centro do eixo.
  const box=new THREE.Box3().setFromObject(node);
  const radius=wheelRadiusFromBox(box);
  node.rotation.order='YXZ';
  const base={x:node.rotation.x,y:node.rotation.y,z:node.rotation.z};
  wheels.set(role,{node,role,radius,base,spin:0,steer:0});
  original.push(node.name);
 });
 return {
  wheels,original,
  complete:ROLES.every(r=>wheels.has(r)),
  metadata:ROLES.map(role=>{
   const w=wheels.get(role);
   return {role,name:w?.node.name||null,radius:w?.radius||0};
  })
 };
}
export function stepWheelRig(rig,deltaDistance,steerAngle){
 if(!rig?.wheels?.size)return;
 for(const [role,w] of rig.wheels){
  const front=role[0]==='f';
  const steer=front?-steerAngle:0;
  w.spin+=deltaDistance/Math.max(.2,w.radius);
  w.steer=steer;
  w.node.rotation.order='YXZ';
  w.node.rotation.set(w.base.x+w.spin,w.base.y+steer,w.base.z,'YXZ');
 }
}
export function resetWheelRig(rig){
 if(!rig)return;
 for(const w of rig.wheels.values()){
  w.spin=0;w.steer=0;
  w.node.rotation.set(w.base.x,w.base.y,w.base.z,'YXZ');
 }
}

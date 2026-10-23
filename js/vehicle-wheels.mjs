// Animacao real de rodas GLB: preserva quaternions originais de cada no.
// Nunca sobrescrever euler/order de arquivos de artistas com outro sistema.
const ROLES=['fl','fr','rl','rr'];
const LEGACY=/^(FL|FR|RL|RR)_\d+$/i;
const SPIN_PART=/^(tyre|tire|rim|disc)/i;
const qIdent=()=>({x:0,y:0,z:0,w:1});
function copyQ(node){
 const q=node?.quaternion;
 return q?{x:q.x,y:q.y,z:q.z,w:q.w}:qIdent();
}
function multiplyQ(a,b){
 return {
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z
 };
}
function axisQ(axis,angle){
 const s=Math.sin(angle*.5),c=Math.cos(angle*.5);
 return axis==='x'?{x:s,y:0,z:0,w:c}:{x:0,y:s,z:0,w:c};
}
function applyQ(node,q){
 if(!node?.quaternion?.set)
  throw Error('GLB wheel node requires quaternion transform');
 node.quaternion.set(q.x,q.y,q.z,q.w);
}
function legacyWheelRole(name=''){
 const match=LEGACY.exec(name);
 return match?match[1].toLowerCase():null;
}
export function classifyWheelName(name=''){
 const s=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 // Somente codigos completos: "Rim1.004_11" NAO e roda traseira direita.
 // Modelos Comrade usam wheel_fl/fr/rl/rr com pivots originais.
 const explicit=/^(?:wheel|tyre|tire|roda|pneu|rim)(fl|fr|rl|rr)$/.exec(s);
 if(explicit)return explicit[1];
 const words=/^(?:wheel|tyre|tire|roda|pneu)(frontleft|frontright|rearleft|rearright|leftfront|rightfront|leftrear|rightrear)$/.exec(s);
 if(!words)return null;
 return {frontleft:'fl',frontright:'fr',rearleft:'rl',rearright:'rr',
  leftfront:'fl',rightfront:'fr',leftrear:'rl',rightrear:'rr'}[words[1]];
}
export function wheelRadiusFromBox(box){
 if(!box||!Number.isFinite(box.max?.y)||!Number.isFinite(box.min?.y))
  return .32;
 return Math.max(.2,Math.min(.65,(box.max.y-box.min.y)/2));
}
export function createWheelRig(root,THREE,options={}){
 const wheelMap=new Map(),original=[];
 const forward=options.forward==='+Z'?'+Z':'-Z';
 // Pack Comrade: carro aponta -Z; roda deve girar no sentido -X ao andar.
 // Silvia: frente +Z, entao sinal inverso no eixo +X.
 const spinSign=forward==='+Z'?1:-1;
 root.traverse(node=>{
  if(!node.isObject3D&&!node.isMesh&&!node.isGroup)return;
  const name=node.name||'';
  const role=legacyWheelRole(name)||classifyWheelName(name);
  if(!role||wheelMap.has(role))return;
  const legacy=!!legacyWheelRole(name);
  const radius=wheelRadiusFromBox(new THREE.Box3().setFromObject(node));
  const spinning=[];
  if(legacy){
   // Aro, pneu e disco compartilham o eixo do pai FL/FR/RL/RR,
   // enquanto a pinca (Cal) permanece imovel.
   for(const child of node.children||[]){
    if(!SPIN_PART.test(child.name||''))continue;
    spinning.push({node:child,baseQuaternion:copyQ(child)});
   }
  }
  wheelMap.set(role,{
   node,role,radius,baseQuaternion:copyQ(node),
   spin:0,steer:0,spinning,legacy
  });
  original.push(name);
 });
 return {
  wheels:wheelMap,original,forward,spinSign,
  complete:ROLES.every(role=>wheelMap.has(role)),
  metadata:ROLES.map(role=>{
   const w=wheelMap.get(role);
   return {role,name:w?.node.name||null,radius:w?.radius||0,
    spinningParts:w?.spinning.map(x=>x.node.name)||[]};
  })
 };
}
export function stepWheelRig(rig,deltaDistance,steerAngle){
 if(!rig?.wheels?.size)return;
 for(const [role,w] of rig.wheels){
  const steering=role[0]==='f'?-steerAngle:0;
  const travel=Number.isFinite(deltaDistance)?deltaDistance:0;
  w.spin+=rig.spinSign*travel/Math.max(.2,w.radius);
  w.steer=steering;
  const steeringQ=axisQ('y',steering);
  // Premultiplicar o angulo de direcao no espaco do eixo (e nao euler XYZ).
  // Assim a orientacao original do GLB nao e sobrescrita.
  if(w.legacy){
   applyQ(w.node,multiplyQ(steeringQ,w.baseQuaternion));
   const spinQ=axisQ('x',w.spin);
   for(const piece of w.spinning){
    // qSpin * qOriginal gira a peca no eixo do conjunto, sem alterar
    // sua inclinacao inicial (especialmente Disc com base de ~78 graus).
    applyQ(piece.node,multiplyQ(spinQ,piece.baseQuaternion));
   }
  }else{
   const spinQ=axisQ('x',w.spin);
   applyQ(w.node,multiplyQ(
    multiplyQ(steeringQ,w.baseQuaternion),spinQ));
  }
 }
}
export function resetWheelRig(rig){
 if(!rig)return;
 for(const w of rig.wheels.values()){
  w.spin=0;w.steer=0;
  applyQ(w.node,w.baseQuaternion);
  for(const piece of w.spinning)
   applyQ(piece.node,piece.baseQuaternion);
 }
}

import * as T from 'three';
import {petBreed,petColor} from './pet-catalog.mjs';

// A real articulated quadruped. Every foot is a child of its lower leg;
// animation rotates joints and never detaches or stretches limb meshes.
const sphere=new T.SphereGeometry(1,16,12),cone=new T.ConeGeometry(1,1,12),cylinder=new T.CylinderGeometry(1,1,1,12);
const materialCache=new Map();
const mat=color=>{if(!materialCache.has(color))materialCache.set(color,new T.MeshStandardMaterial({color,roughness:.86}));return materialCache.get(color);};
export function buildPet(id,colorId){
 const breed=petBreed(id);if(!breed)throw Error('Raça de pet inválida');
 const c=petColor(breed,colorId),cat=breed.species==='cat',rott=id==='rottweiler',york=id==='yorkshire',pom=id==='pomeranian',fluffy=breed.fur==='fluffy';
 const root=new T.Group();root.name='Pet:'+id;
 const body=new T.Group();body.position.y=breed.height;root.add(body);
 const ell=(parent,color,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(sphere,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const len=breed.body,w=breed.width,h=breed.height;
 ell(body,c.coat,0,.035,0,len*.56,cat?.102:rott?.185:.11,w);
 ell(body,cat?c.patch:c.coat,len*.24,.025,0,len*.29,cat?.115:rott?.20:.13,w*1.04);
 if(rott){ell(body,c.patch,len*.39,-.055,0,.075,.10,w*.83);}
 if(york){ell(body,c.patch,len*.24,.035,0,.115,.115,w*1.06);ell(body,c.coat,-.04,.05,0,.17,.12,w*1.08);}
 const neck=new T.Group();neck.position.set(len*.43,.09,0);body.add(neck);
 ell(neck,pom?c.muzzle:cat?c.coat:c.patch,-.015,-.005,0,breed.head*.75,breed.head*1.13,breed.head*.76);
 const head=new T.Group();head.position.set(.025,cat?.065:.085,0);neck.add(head);
 const r=breed.head;
 ell(head,id==='siamese'?c.patch:york?c.patch:c.coat,0,0,0,r,cat?r*.86:r*.93,r*.83);
 const muzzleX=cat?r*.75:r*.88,muzzleLen=cat?r*.34:rott?r*.68:r*.55;
 ell(head,id==='siamese'?c.patch:c.muzzle,muzzleX,-r*.25,0,muzzleLen,r*(rott?.39:.31),r*(rott?.58:.46));
 if(cat){
   for(const s of [-1,1])ell(head,c.muzzle,r*.76,-r*.25,s*r*.22,r*.32,r*.28,r*.28);
 }
 ell(head,cat?'#9b6869':'#222329',muzzleX+muzzleLen*.83,-r*.14,0,r*.15,r*.12,r*.23);
 const ears=[],eyes=[];
 for(const side of [-1,1]){
  const ear=new T.Group();ear.position.set(-r*.23,r*.57,side*r*.66);head.add(ear);ears.push(ear);
  if(breed.ears==='folded'){
   ear.position.y=r*.46;
   const points=[-.42,.08,0,.30,.06,0,.35,-.40,side*.25,-.08,-.86,side*.33,-.42,-.42,side*.25];
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points.map(v=>v*r),3));geometry.setIndex([0,1,2,0,2,3,0,3,4]);geometry.computeVertexNormals();
   const flap=new T.Mesh(geometry,new T.MeshStandardMaterial({color:c.coat,roughness:.9,side:T.DoubleSide}));flap.castShadow=true;ear.add(flap);
  }else{
   const mesh=new T.Mesh(cone,mat(id==='siamese'?c.patch:york?c.patch:c.coat));mesh.scale.set(r*.46,r*(cat?1.05:.91),r*.33);mesh.position.y=r*.30;mesh.rotation.x=side*.15;ear.add(mesh);
   const inner=new T.Mesh(cone,mat(cat?'#bd9291':c.muzzle));inner.scale.set(r*.26,r*.63,r*.07);inner.position.set(r*.18,r*.30,0);inner.rotation.z=-.28;ear.add(inner);
  }
  eyes.push(ell(head,'#24262a',r*.64,r*.14,side*r*.56,r*.21,r*.20,r*.115));
  eyes.push(ell(head,c.eyes,r*.74,r*.15,side*r*.60,r*.12,r*.135,r*.08));
  eyes.push(ell(head,'#11191e',r*.80,r*.15,side*r*.61,r*(cat?.033:.065),r*.10,r*.055));
  eyes.push(ell(head,'#ffffff',r*.83,r*.20,side*r*.62,r*.04,r*.04,r*.035));
  if(rott)ell(head,c.patch,r*.52,r*.43,side*r*.58,r*.22,r*.09,r*.13);
 }
 // Fur follows the body/head. Deterministic clumps avoid floating hair.
 if(fluffy||york){
  const amount=fluffy?60:22;
  for(let i=0;i<amount;i++){
   const a=i*2.399963,x=((i*7%19)/18-.5)*len*.92,y=Math.sin(a)*.06,z=Math.cos(a)*w*.77;
   const fur=ell(body,i%9===0?c.patch:c.coat,x,.025+y,z,len*(fluffy?.11:.085),fluffy?.045:.075,w*.30);fur.rotation.z=fluffy?Math.sin(a)*.25:-.18;
  }
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12;
   ell(neck,pom||i%3===0?c.muzzle:c.coat,-.02+(i%2)*r*.25,Math.sin(a)*r*.68,Math.cos(a)*r*.85,r*.48,r*.38,r*.38);
  }
  if(york){for(const s of [-1,1])ell(head,c.muzzle,r*.35,-r*.53,s*r*.57,r*.67,r*.43,r*.40);}
 }
 // Small whiskers are actual curves, shared by the cat's head transform.
 if(cat)for(const s of [-1,1])for(let i=0;i<3;i++){
  const points=[new T.Vector3(r*.77,-r*.25,s*r*.25),new T.Vector3(r*.87,-r*.25+(i-1)*r*.17,s*r*1.35)];
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:c.muzzle}));head.add(line);
 }
 const legs=[];
 for(const front of [true,false])for(const side of [-1,1]){
  const pivot=new T.Group();pivot.position.set((front?1:-1)*len*.32,-.025,side*w*.74);body.add(pivot);
  const upperLength=(h-.045)*.53,lowerLength=(h-.045)*.50,thick=rott?.055:cat?.026:.032;
  const upper=ell(pivot,c.coat,0,-upperLength/2,0,thick,upperLength*.61,thick);
  const lower=new T.Group();lower.position.y=-upperLength;pivot.add(lower);
  ell(lower,id==='siamese'||rott?c.patch:c.coat,0,-lowerLength/2,0,thick*.76,lowerLength*.59,thick*.76);
  const paw=new T.Group();paw.position.y=-lowerLength;lower.add(paw);
  ell(paw,rott||id==='siamese'?c.patch:c.muzzle,.015,0,0,thick*1.24,.026,thick*1.07);
  legs.push({pivot,lower,paw,upperLength,lowerLength,front,side,upper});
 }
 const tail=[];let parent=body;
 const tailLength=breed.tail==='curl'?.38:cat?.45:rott?.40:.27,segments=9;
 for(let i=0;i<segments;i++){
  const joint=new T.Group();joint.position.set(i? -tailLength/segments:-len*.48,i?0:.06,0);parent.add(joint);
  const radius=(breed.tail==='plume'||breed.tail==='feather'||breed.tail==='curl'?.045:.022)*(1-i/segments*.72)*(rott?1.15:1);
  const color=id==='siamese'?c.patch:breed.tail==='curl'?c.muzzle:c.coat;
  const tube=new T.Mesh(cylinder,mat(color));tube.rotation.z=Math.PI/2;tube.scale.set(radius,tailLength/segments*1.03,radius);tube.position.x=-tailLength/segments*.5;tube.castShadow=true;joint.add(tube);
  ell(joint,color,0,0,0,radius,radius,radius);
  tail.push(joint);parent=joint;
 }
 let smoothedPose=0;
 for(const eye of eyes)eye.userData.height=eye.scale.y;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function animate(pet,dt=1/60){
  const time=pet.clock||0,speed=pet.speed||0,phase=pet.phase||0,moving=speed>.045;
  const asleep=pet.action==='sleep',sitting=pet.action==='sit'||pet.action==='wait';
  const target=asleep?1:sitting?.54:0;smoothedPose+=(target-smoothedPose)*(1-Math.exp(-Math.max(0,dt)*8));
  if(dt===0)smoothedPose=target;
  const rest=smoothedPose,breath=Math.sin(time*2.2)*.003;
  body.position.y=h-rest*h*(sitting?.46:.63)+breath+(moving?Math.sin(phase*2)*.009:0);
  body.rotation.set(0,cat&&moving?Math.sin(phase)*.035:0,sitting?.65*rest:0);
  neck.rotation.z=pet.action==='sniff'?-.60:asleep?-.48:moving?Math.sin(phase*2)*.025:Math.sin(time*.8)*.06;
  head.rotation.y=clamp(pet.look||0,-.45,.45);head.rotation.z=asleep?-.20:0;
  for(const eye of eyes)eye.scale.y=eye.userData.height*(asleep?.10:1);
  for(const [i,e] of ears.entries())e.rotation.x=(i?1:-1)*.06*Math.sin(time*2+i*2);
  for(const leg of legs){
   const diagonal=(leg.front?0:Math.PI)+(leg.side>0?Math.PI:0),p=phase+diagonal;
   let x=moving?Math.cos(p)*clamp(speed*.075,.035,.13):0;
   let lift=moving?Math.max(0,Math.sin(p))*(cat?.047:.055):0;
   if(sitting&&!leg.front){x=-.065;lift=.035;}if(asleep){x=leg.front?.08:-.07;lift=.015;}
   const cs=Math.cos(body.rotation.z),sn=Math.sin(body.rotation.z),px=leg.pivot.position.x,py=leg.pivot.position.y;
   const dx=px+x-(px*cs-py*sn),dy=.029+lift-(body.position.y+px*sn+py*cs);
   x=dx*cs+dy*sn;const y=-dx*sn+dy*cs;
   const distance=clamp(Math.hypot(x,y),.012,leg.upperLength+leg.lowerLength-.001);
   const bend=Math.acos(clamp((leg.upperLength**2+distance**2-leg.lowerLength**2)/(2*leg.upperLength*distance),-1,1));
   const angle=Math.atan2(x,-y),sign=leg.front?1:-1;
   leg.pivot.rotation.z=angle+sign*bend;
   const knee=sign*(Math.PI-Math.acos(clamp((leg.upperLength**2+leg.lowerLength**2-distance**2)/(2*leg.upperLength*leg.lowerLength),-1,1)));
   leg.lower.rotation.z=-knee;leg.paw.rotation.z=-body.rotation.z-leg.pivot.rotation.z-leg.lower.rotation.z;
  }
  for(let i=0;i<tail.length;i++){
   const curl=breed.tail==='curl';
   tail[i].rotation.z=asleep?(i===0?.12:0):curl?-.36:cat?(i===0?-.75:.06):i===0?-.35:.06;
   tail[i].rotation.y=asleep?.10:Math.sin(time*(cat?1.8:5)-i*.55)*(cat?.12:.16)*(moving?1:.6);
  }
 }
 animate({clock:0,speed:0,action:'idle'},0);
 return {root,body,head,legs,tail,breed,colors:c,animate,dispose(){root.traverse(o=>{if(o.isLine||o.isMesh&&o.geometry!==sphere&&o.geometry!==cone&&o.geometry!==cylinder){o.geometry.dispose();o.material.dispose();}});root.removeFromParent();}};
}

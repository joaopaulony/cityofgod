// tools/import-quaternius.mjs — importa os packs CC0 da Quaternius p/ assets/characters/modular/:
//   Ultimate Modular Men + Ultimate Modular Women (peças head/body/legs/feet de cada personagem, mesmo esqueleto por sexo)
//   Universal Animation Library 1 e 2 (Standard, esqueleto estilo UE: pelvis/spine_01/thigh_l...)
//   + os clipes rifle/vault do Mixamo que o jogo já usava (assets/characters/rigs/mixamo)
//
// Uso: node tools/import-quaternius.mjs <pasta com men/ women/ ual1/ ual2/>
//
// O rig dos personagens Quaternius tem controles de IK (Root, Body, pés soltos sob o Root, PT = pole target) e os nós
// do .gltf não estão na pose de repouso. Aqui ele vira um esqueleto limpo, já com os nomes do Mixamo (o resto do jogo —
// mãos/armas, golpes procedurais, retarget — procura mixamorigRightHand etc.):
//   Hips → Spine → Spine1 → Spine2 → Neck → Head / Shoulder → Arm → ForeArm → Hand → dedos;  Hips → UpLeg → Leg → Foot
// Body e Root (que têm peso de pele na pélvis) são fundidos no Hips. A pose de repouso sai das inverseBindMatrices.
// As animações da UAL e do Mixamo são retargetadas aqui (retargetMixamo do próprio jogo, js/npc-roster.mjs) e gravadas
// já no esqueleto final: no jogo não há retarget nenhum, os clipes tocam direto.
import fs from 'node:fs';
import path from 'node:path';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {loadGLTF,THREE} from './quaternius/load-three.mjs';
import {retargetMixamo,STYLE} from '../js/npc-roster.mjs';

const SRC=process.argv[2];
if(!SRC){console.error('uso: node tools/import-quaternius.mjs <pasta-dos-packs>');process.exit(1);}
const OUT='assets/characters/modular';
fs.mkdirSync(OUT,{recursive:true});
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const FPS=30;
const HEIGHT={male:1.80,female:1.70};   // altura (topo da cabeça do personagem "casual") depois da escala

// ---------- nomes ----------
const SIDE={L:'Left',R:'Right'};
function qToMixamo(n){
 const m=n.match(/^(\D+?)(\d?)\.?(L|R)$/);   // o three tira o ponto do nome ("Shoulder.L" → "ShoulderL")
 const fixed={Hips:'Hips',Abdomen:'Spine',Torso:'Spine1',Chest:'Spine2',Neck:'Neck',Head:'Head'};
 if(fixed[n])return 'mixamorig'+fixed[n];
 if(!m)return null;
 const [,base,num,s]=m,side=SIDE[s];
 const limb={Shoulder:'Shoulder',UpperArm:'Arm',LowerArm:'ForeArm',Wrist:'Hand',UpperLeg:'UpLeg',LowerLeg:'Leg',Foot:'Foot'}[base];
 if(limb&&!num)return 'mixamorig'+side+limb;
 if(['Thumb','Index','Middle','Ring','Pinky'].includes(base))return 'mixamorig'+side+'Hand'+base+num;
 return null;   // PT (pole target) e afins
}
const Q_MERGE={Body:'mixamorigHips',Root:'mixamorigHips'};
function ualToMixamo(n){
 const fixed={pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck_01:'Neck',Head:'Head'};
 if(fixed[n])return 'mixamorig'+fixed[n];
 let m=n.match(/^(clavicle|upperarm|lowerarm|hand|thigh|calf|foot|ball)_(l|r)$/);
 if(m)return 'mixamorig'+SIDE[m[2].toUpperCase()]+{clavicle:'Shoulder',upperarm:'Arm',lowerarm:'ForeArm',hand:'Hand',thigh:'UpLeg',calf:'Leg',foot:'Foot',ball:'ToeBase'}[m[1]];
 m=n.match(/^(thumb|index|middle|ring|pinky)_0(\d)(?:_leaf)?_(l|r)$/);
 if(m)return 'mixamorig'+SIDE[m[3].toUpperCase()]+'Hand'+m[1][0].toUpperCase()+m[1].slice(1)+m[2];
 return null;   // root, ball_leaf
}

// ---------- esqueleto: pose de repouso (mundo) a partir do bind ----------
function bindWorld(skinned){
 const out=new Map();
 skinned.skeleton.bones.forEach((b,i)=>out.set(b.name,skinned.bindMatrix.clone().multiply(skinned.skeleton.boneInverses[i].clone().invert())));
 return out;
}
const scaleT=(m,k)=>{const r=m.clone();r.elements[12]*=k;r.elements[13]*=k;r.elements[14]*=k;return r;};
// monta Bones do three com nomes novos: spec = [{name, parent, world(Matrix4)}] em ordem pai→filho
function buildBones(spec){
 const bones=new Map(),root=new THREE.Group();root.name='Armature';
 for(const s of spec){
  const b=new THREE.Bone();b.name=s.name;
  const pw=s.parent?spec.find(x=>x.name===s.parent).world:new THREE.Matrix4();
  pw.clone().invert().multiply(s.world).decompose(b.position,b.quaternion,b.scale);b.scale.set(1,1,1);
  (s.parent?bones.get(s.parent):root).add(b);bones.set(s.name,b);
 }
 root.updateMatrixWorld(true);
 return {root,bones};
}
// ordena por profundidade p/ que o pai venha antes
function ordered(list,parentOf){
 const depth=n=>{let d=0;for(let p=parentOf(n);p;p=parentOf(p))d++;return d;};
 return [...list].sort((a,b)=>depth(a)-depth(b));
}

// ---------- amostragem de clipes no espaço de mundo (pose por quadro) e reconstrução na hierarquia nova ----------
// sample(clip,root,fn): toca o clipe no root (cena do three) em FPS e chama fn(i,t) depois de atualizar o mundo
function sampleClip(clip,root,fn){
 const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(clip);action.play();
 const n=Math.max(2,Math.round(clip.duration*FPS)+1),times=[];
 for(let i=0;i<n;i++){const t=Math.min(clip.duration,i/FPS);times.push(t);mixer.setTime(t);root.updateMatrixWorld(true);fn(i,t);}
 action.stop();mixer.uncacheRoot(root);
 return times;
}
// converte um clipe tocado num esqueleto-fonte em clipe do esqueleto novo (spec): mapa nomeNovo→Bone-fonte,
// world'(t) = mundo do osso fonte (com escala k nas translações); local = pai'⁻¹·world'
function rebuildClip(clip,srcRoot,spec,srcOf,k,name){
 const tracks=new Map(spec.map(s=>[s.name,[]])),hips=[];
 const times=sampleClip(clip,srcRoot,()=>{
  const W=new Map();
  for(const s of spec){
   const src=srcOf(s.name);
   W.set(s.name,src?scaleT(src.matrixWorld,k):(s.parent?W.get(s.parent).clone().multiply(s.restLocal):s.world.clone()));
   const pw=s.parent?W.get(s.parent):new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
   pw.clone().invert().multiply(W.get(s.name)).decompose(p,q,sc);q.normalize();
   tracks.get(s.name).push(q);
   if(!s.parent)hips.push(p);
  }
 });
 return makeClip(name,clip.duration,times,tracks,hips,spec[0].name);
}
function makeClip(name,duration,times,tracks,hips,hipsName){
 const out=[];
 for(const [bone,qs] of tracks){
  const v=new Float32Array(qs.length*4);qs.forEach((q,i)=>{if(i&&q.dot(qs[i-1])<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(v,i*4);});
  out.push(new THREE.QuaternionKeyframeTrack(bone+'.quaternion',times,v));
 }
 if(hips){const v=new Float32Array(hips.length*3);hips.forEach((p,i)=>p.toArray(v,i*3));out.push(new THREE.VectorKeyframeTrack(hipsName+'.position',times,v));}
 return new THREE.AnimationClip(name,duration,out);
}
// trilhas constantes viram 1 chave (dedos parados etc.): o arquivo cai a menos da metade
function compact(clip){
 for(const t of clip.tracks){
  const s=t.getValueSize(),v=t.values;let same=true;
  for(let i=s;i<v.length&&same;i++)if(Math.abs(v[i]-v[i%s])>2e-4)same=false;
  if(same){t.times=new Float32Array([0]);t.values=v.slice(0,s);}
  else{t.times=Float32Array.from(t.times);t.values=Float32Array.from(t.values);}
 }
 return clip;
}

// ---------- catálogo dos clipes ----------
const ONE_SHOT_MIXAMO=new Set(['jump_start','jump_land','vault_low','rifle_fire','rifle_reload','rifle_crouch_fire','rifle_crouch_reload']);
const MIXAMO_KEEP=/^(rifle_|vault_low)/;   // locomoção vem da UAL (feita p/ estes personagens)
// UAL → nomes do jogo; o resto vira snake_case sem o _loop
const UAL_NAME={Idle_Loop:'idle_ual',Walk_Loop:'walk_ual',Jog_Fwd_Loop:'jog',Sprint_Loop:'sprint',Crouch_Idle_Loop:'crouch',Crouch_Fwd_Loop:'crouch_walk',
 Jump_Start:'jump_start',Jump_Loop:'jump_air',Jump_Land:'jump_land',Walk_Formal_Loop:'walk_formal'};
const ualName=n=>UAL_NAME[n]||n.replace(/_Loop$/,'').replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/__+/g,'_');
// dedos da UAL: o repouso da mão do manequim é bem diferente (dedos curvos e abertos) e a variação inteira deixava
// a mão em garra; metade da curva já dá a mão solta/fechada dos clipes
const FINGER_DAMP=Object.fromEntries(['Left','Right'].flatMap(s=>['Thumb','Index','Middle','Ring','Pinky'].flatMap(f=>[1,2,3,4].map(i=>[s+'Hand'+f+i,.45]))));
// o manequim da UAL é masculino e de quadril estreito: nos corpos Quaternius (mais pernas, quadril mais largo) os pés
// ficavam abertos demais nas poses em pé; as coxas fecham alguns graus (perna inteira, sem dobrar o joelho)
const LEG_IN={male:2,female:4};
const Q_SKIP=/^(Idle_Sword|Sword_Slash)$/;

function footSpeed(clip,target){
 const feet=['mixamorigLeftFoot','mixamorigRightFoot'].map(n=>target.bones.get(n)),samples=feet.map(()=>[]);
 sampleClip(clip,target.root,(i,t)=>feet.forEach((f,k)=>samples[k].push([t,f.getWorldPosition(new THREE.Vector3())])));
 const v=[];
 for(const s of samples){const minY=Math.min(...s.map(x=>x[1].y));
  for(let i=1;i<s.length;i++){const [t0,a]=s[i-1],[t1,b]=s[i];if(a.y>minY+.03||b.y>minY+.03||t1<=t0)continue;v.push(Math.hypot(b.x-a.x,b.z-a.z)/(t1-t0));}}
 v.sort((a,b)=>a-b);return v.length?v[v.length>>1]:0;
}
async function importSex(sex){
 const dir=path.join(SRC,sex==='male'?'men':'women','Individual Characters','glTF');
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.gltf')).sort();
 console.log('\n##',sex,files.length,'personagens');
 // 1) esqueleto do primeiro personagem (todos do sexo compartilham o mesmo bind)
 const first=await loadGLTF(path.join(dir,files[0]));
 let skinned=null;first.scene.traverse(o=>{if(o.isSkinnedMesh&&!skinned)skinned=o;});
 first.scene.updateMatrixWorld(true);
 const bind=bindWorld(skinned);
 // altura: topo do personagem (malhas na pose de repouso)
 const box=new THREE.Box3();first.scene.traverse(o=>{if(o.isSkinnedMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox);}});
 const k=HEIGHT[sex]/box.max.y;
 console.log('altura original',box.max.y.toFixed(3),'escala',k.toFixed(4));
 // spec do esqueleto novo
 const qNames=[...bind.keys()].filter(n=>qToMixamo(n));
 const qParent=new Map();skinned.skeleton.bones.forEach(b=>qParent.set(b.name,b.parent?.isBone?b.parent.name:null));
 const newParentOf=q=>{
  if(/^Foot\.?(L|R)$/.test(q))return qToMixamo('LowerLeg.'+q.slice(-1));
  for(let p=qParent.get(q);p;p=qParent.get(p)){if(qToMixamo(p))return qToMixamo(p);if(Q_MERGE[p])return Q_MERGE[p]===qToMixamo(q)?null:Q_MERGE[p];}
  return null;
 };
 const byNew=new Map(qNames.map(q=>[qToMixamo(q),q]));
 const order=ordered([...byNew.keys()],n=>newParentOf(byNew.get(n)));
 const spec=order.map(n=>({name:n,q:byNew.get(n),parent:newParentOf(byNew.get(n)),world:scaleT(bind.get(byNew.get(n)),k)}));
 for(const s of spec)s.restLocal=(s.parent?spec.find(x=>x.name===s.parent).world:new THREE.Matrix4()).clone().invert().multiply(s.world);
 console.log('ossos',spec.length,'raiz',spec[0].name);
 const target=buildBones(spec);
 // malha "fantasma" p/ o restPose(fromBind) do retarget
 {const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0],4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0],4));
  const m=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());target.root.add(m);target.root.updateMatrixWorld(true);m.bind(new THREE.Skeleton(spec.map(s=>target.bones.get(s.name))));}

 // 2) clipes
 const clips=[],meta={};
 const add=(clip,info)=>{clips.push(compact(clip));meta[clip.name]={duration:+clip.duration.toFixed(3),...info};};
 // 2a) clipes do próprio pack (já no esqueleto Quaternius): só reconstrói na hierarquia nova
 const qBone=new Map();first.scene.traverse(o=>{if(o.isBone)qBone.set(o.name,o);});
 for(const c of first.animations){
  if(Q_SKIP.test(c.name))continue;
  // parado/andar/correr do próprio pack ficam com os nomes do jogo: feitos p/ estes corpos, são os mais naturais
  const name={Idle:'idle',Walk:'walk',Run:'run'}[c.name]||'q_'+c.name.toLowerCase().replace('recieve','receive');
  add(rebuildClip(c,first.scene,spec,n=>qBone.get(byNew.get(n)),k,name),{loop:/^(Idle|Run|Walk)/.test(c.name),source:'quaternius-modular'});
 }
 // 2b) UAL 1 e 2 → esqueleto "mixamo" intermediário → retargetMixamo p/ o personagem
 for(const [lib,file] of [['ual1','Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'],['ual2','Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb']]){
  const g=await loadGLTF(path.join(SRC,lib,file));
  let sm=null;g.scene.traverse(o=>{if(o.isSkinnedMesh&&!sm)sm=o;});g.scene.updateMatrixWorld(true);
  const ub=bindWorld(sm),uBone=new Map();g.scene.traverse(o=>{if(o.isBone)uBone.set(o.name,o);});
  const uParent=n=>{for(let p=uBone.get(n).parent;p&&p.isBone;p=p.parent)if(ualToMixamo(p.name))return ualToMixamo(p.name);return null;};
  const names=[...ub.keys()].filter(n=>ualToMixamo(n)),byM=new Map(names.map(n=>[ualToMixamo(n),n]));
  const uspec=ordered([...byM.keys()],m=>uParent(byM.get(m))).map(m=>({name:m,parent:uParent(byM.get(m)),world:ub.get(byM.get(m)).clone()}));
  for(const s of uspec)s.restLocal=(s.parent?uspec.find(x=>x.name===s.parent).world:new THREE.Matrix4()).clone().invert().multiply(s.world);
  const src=buildBones(uspec);
  // velocidade da locomoção (m/s) a partir da versão com root motion
  let rm=null;try{rm=await loadGLTF(path.join(SRC,lib,file.replace('.glb','_RM.glb')));}catch{}
  for(const c of g.animations){
   if(c.name==='A_TPose')continue;
   const mid=rebuildClip(c,g.scene,uspec,m=>uBone.get(byM.get(m)),1,c.name);
   const name=ualName(c.name);
   const out=retargetMixamo(mid,src.root,target.root,name,{style:{[c.name]:{legIn:LEG_IN[sex]}},armOut:null,damp:FINGER_DAMP});
   let speed=0;
   const r=rm?.animations.find(a=>a.name===c.name),tr=r?.tracks.find(t=>t.name==='root.position');
   if(tr&&/Loop/.test(c.name)){const v=tr.values,n=v.length/3,dx=v[(n-1)*3]-v[0],dz=v[(n-1)*3+2]-v[2],dy=v[(n-1)*3+1]-v[1];
    // root do RM está no espaço Z-up do root (rotação -90° em X): o chão é XY
    speed=Math.hypot(dx,dy,dz)/c.duration*(spec[0].world.elements[13]/uspec[0].world.elements[13]);}
   add(out,{loop:/Loop/.test(c.name),source:lib,original:c.name,...(speed>.2?{speed:+speed.toFixed(2)}:{})});
  }
 }
 // 2c) Mixamo (rifle, transpor muro) — os mesmos clipes de antes
 {
  const lib=await loadGLTF(sex==='male'?'assets/characters/rigs/mixamo/david.rig.glb':'assets/characters/rigs/mixamo/megan.rig.glb');
  const SPEED={rifle_walk:1.4,rifle_run:3.9,rifle_walk_back:1.2,rifle_strafe_left:1.3,rifle_strafe_right:1.3,rifle_crouch_walk:.9};
  for(const c of lib.animations){
   if(!MIXAMO_KEEP.test(c.name))continue;
   const out=retargetMixamo(c,lib.scene,target.root,c.name,{style:STYLE[sex],armOut:null});
   add(out,{loop:!ONE_SHOT_MIXAMO.has(c.name),source:'mixamo',...(SPEED[c.name]?{speed:SPEED[c.name]}:{})});
  }
 }
 // 2d) dedos: nos clipes retargetados (UAL, Mixamo) a mão das bibliotecas tem outra anatomia e os dedos saíam tortos.
 // Eles passam a usar poses autorais do próprio pack: mão relaxada (idle nativo) ou empunhando (idle com pistola),
 // conforme o clipe segura algo. Os clipes do pack (q_*, idle/walk/run) ficam com os dedos que já têm.
 {
  const FINGER=/^mixamorig(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)\d$/;
  const pose=(clipName,t,side)=>{
   const c=clips.find(x=>x.name===clipName),out=new Map();
   for(const tr of c.tracks){const m=tr.name.match(/^(.+)\.quaternion$/);if(!m||!FINGER.test(m[1]))continue;
    out.set(m[1],Array.from(tr.createInterpolant().evaluate(Math.min(t,tr.times[tr.times.length-1]))));}
   return out;
  };
  const relaxed=pose('idle',0),gun=pose('q_idle_gun',0);
  // mão que empunha: a direita do idle com pistola (dedos fechados, indicador no gatilho); a esquerda é o espelho
  // (o rig é simétrico: espelhar no plano x troca o sinal de y e z do quatérnio local)
  const grip=new Map();
  for(const [n,q] of gun)if(n.startsWith('mixamorigRight')){grip.set(n,q);grip.set(n.replace('Right','Left'),[q[0],-q[1],-q[2],q[3]]);}
  const HOLDS=/^(rifle_|pistol_|punch|melee|push|walk_carry|tree_chopping|idle_torch|idle_lantern|idle_rail|climb|driving|farm_|chest_open|pick_up|sword|shield|overhand|consume|idle_talking_phone|fixing)/;
  for(const clip of clips){
   if(meta[clip.name].source==='quaternius-modular')continue;
   const use=HOLDS.test(clip.name)?grip:relaxed;
   clip.tracks=clip.tracks.filter(t=>!FINGER.test(t.name.replace('.quaternion','')));
   for(const [n,q] of use)clip.tracks.push(new THREE.QuaternionKeyframeTrack(n+'.quaternion',new Float32Array([0]),new Float32Array(q)));
   meta[clip.name].hands=use===grip?'grip':'relaxed';
  }
 }
 // velocidade (m/s) de cada clipe de locomoção pela passada: o pé apoiado no chão desliza p/ trás na velocidade do corpo
 for(const clip of clips){
  if(!/walk|run|jog|sprint/.test(clip.name)||!meta[clip.name].loop||meta[clip.name].speed)continue;   // UAL: root motion; Mixamo: valores de sempre
  const v=footSpeed(clip,target);if(v>.2)meta[clip.name].speed=+v.toFixed(2);
 }
 console.log('clipes',clips.length,Object.entries(meta).filter(([,m])=>m.speed).map(([n,m])=>n+'='+m.speed).join(' '));

 // 3) documento final
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Scene'),root=doc.getRoot();
 const arm=doc.createNode('Armature');scene.addChild(arm);
 const nodes=new Map();
 for(const s of spec){
  const b=target.bones.get(s.name),n=doc.createNode(s.name).setTranslation(b.position.toArray()).setRotation(b.quaternion.toArray());
  nodes.set(s.name,n);(s.parent?nodes.get(s.parent):arm).addChild(n);
 }
 const skin=doc.createSkin('Skeleton').setSkeleton(nodes.get(spec[0].name));
 const ibm=new Float32Array(spec.length*16);
 spec.forEach((s,i)=>{skin.addJoint(nodes.get(s.name));s.world.clone().invert().toArray(ibm,i*16);});
 skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
 const jointIndex=new Map(spec.map((s,i)=>[s.name,i]));
 const qIndex=q=>jointIndex.get(qToMixamo(q)||Q_MERGE[q]||'mixamorigHips')??jointIndex.get('mixamorigHips');
 // materiais: um por (nome, cor)
 const mats=new Map(),parts=[];
 const hex=c=>'#'+c.slice(0,3).map(x=>Math.round(Math.pow(x,1/2.2)*255).toString(16).padStart(2,'0')).join('');
 for(const f of files){
  const src=await io.read(path.join(dir,f)),charId=f.replace('.gltf','').toLowerCase().replace('spacesuit','space_suit');
  for(const n of src.getRoot().listNodes()){
   const mesh=n.getMesh(),sk=n.getSkin();if(!mesh||!sk)continue;
   const raw=n.getName(),slotM=raw.match(/_(Head|Body|Legs|Pants|Feet)$/);
   let slot=slotM?{Head:'head',Body:'body',Legs:'legs',Pants:'legs',Feet:'feet'}[slotM[1]]:null,id=charId;
   if(!slot){if(/backpack/i.test(raw)){slot='acc';id='backpack';}else continue;}   // armas (Pistol/Sword) ficam de fora
   if(parts.some(p=>p.slot===slot&&p.id===id))continue;
   const joints=sk.listJoints().map(j=>qIndex(j.getName()));
   const out=doc.createMesh(slot+'-'+id),info={slot,id,source:f,triangles:0,materials:[]};
   for(const p of mesh.listPrimitives()){
    const pos=p.getAttribute('POSITION').getArray().slice(),nor=p.getAttribute('NORMAL')?.getArray().slice();
    for(let i=0;i<pos.length;i++)pos[i]*=k;
    const J=p.getAttribute('JOINTS_0'),Wt=p.getAttribute('WEIGHTS_0'),cnt=J.getCount(),jo=new Uint8Array(cnt*4),wo=new Float32Array(cnt*4);
    for(let v=0;v<cnt;v++){
     const a=J.getElement(v,[]),w=Wt.getElement(v,[]),acc=new Map();
     for(let c=0;c<4;c++)if(w[c]>0)acc.set(joints[a[c]],(acc.get(joints[a[c]])||0)+w[c]);
     const e=[...acc].sort((x,y)=>y[1]-x[1]).slice(0,4),sum=e.reduce((s,x)=>s+x[1],0)||1;
     e.forEach(([j,ww],c)=>{jo[v*4+c]=j;wo[v*4+c]=ww/sum;});
    }
    const idx=p.getIndices()?.getArray(),tris=idx?idx.length/3:cnt/3;info.triangles+=tris;
    const sm=p.getMaterial(),col=sm.getBaseColorFactor(),key=sm.getName()+hex(col);
    if(!mats.has(key))mats.set(key,doc.createMaterial(sm.getName()).setBaseColorFactor(col).setMetallicFactor(/metal|gold|visor/i.test(sm.getName())?.6:0).setRoughnessFactor(/metal|gold|visor/i.test(sm.getName())?.45:.85));
    const prim=doc.createPrimitive().setMaterial(mats.get(key))
     .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
     .setAttribute('JOINTS_0',doc.createAccessor().setType('VEC4').setArray(jo).setBuffer(buffer))
     .setAttribute('WEIGHTS_0',doc.createAccessor().setType('VEC4').setArray(wo).setBuffer(buffer));
    if(nor)prim.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer));
    if(idx)prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.length<65536?Uint16Array.from(idx):Uint32Array.from(idx)).setBuffer(buffer));
    out.addPrimitive(prim);
    info.materials.push({name:sm.getName(),color:hex(col),triangles:tris});
   }
   const node=doc.createNode(slot+'-'+id).setMesh(out).setSkin(skin).setExtras({slot,part:id});arm.addChild(node);
   parts.push(info);
  }
 }
 // animações
 for(const clip of clips){
  const a=doc.createAnimation(clip.name);
  for(const t of clip.tracks){
   const [bone,prop]=t.name.split('.'),node=nodes.get(bone);if(!node)continue;
   const s=doc.createAnimationSampler().setInterpolation('LINEAR')
    .setInput(doc.createAccessor().setType('SCALAR').setArray(Float32Array.from(t.times)).setBuffer(buffer))
    .setOutput(doc.createAccessor().setType(prop==='quaternion'?'VEC4':'VEC3').setArray(Float32Array.from(t.values)).setBuffer(buffer));
   a.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(prop==='quaternion'?'rotation':'translation').setSampler(s));
  }
 }
 const file=path.join(OUT,sex+'.glb');
 // compacta (EXT_meshopt_compression, o jogo já usa o MeshoptDecoder nos veículos): malhas e animações
 await doc.transform(dedup(),prune({keepLeaves:true}),meshopt({encoder:MeshoptEncoder,level:'medium'}));
 await io.write(file,doc);
 const bytes=fs.statSync(file).size;
 console.log('gravado',file,(bytes/1e6).toFixed(2),'MB',parts.length,'peças');
 return {file:sex+'.glb',bytes,height:HEIGHT[sex],scale:+k.toFixed(4),bones:spec.length,parts,clips:meta};
}

const manifest={schema:1,source:'Quaternius — Ultimate Modular Men/Women, Universal Animation Library 1 e 2 (CC0); clipes rifle/vault: Mixamo',
 generated:new Date().toISOString().slice(0,10),male:await importSex('male'),female:await importSex('female')};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,1));
console.log('\nmanifest.json ok');

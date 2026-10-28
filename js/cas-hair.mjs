// Hairstyles: optional, lazily-loaded GLB accessories attached to the head bone.
// Keep this provider resilient when the licensed binary pack is not installed yet.
const HAIR_ID=/^hair-(?:0[1-9]|1[0-9]|2[01])$/;
const FILE=/^hair-(?:0[1-9]|1[0-9]|2[01])\.glb$/;
export function validateCASHairCatalog(raw){
 if(!raw||raw.schema!==1||!Array.isArray(raw.styles))throw Error('CAS hair: schema 1 esperado');
 const known=new Set(),styles=[];
 for(const spec of raw.styles){
  if(!spec||!HAIR_ID.test(spec.id)||!FILE.test(spec.file)||spec.file!==spec.id+'.glb'||known.has(spec.id))
   throw Error('CAS hair: entrada duplicada ou caminho inválido');
  known.add(spec.id);
  styles.push({id:spec.id,label:String(spec.label||spec.id).slice(0,42),file:spec.file,
   triangles:Math.max(0,Math.floor(Number(spec.triangles)||0))});
 }
 if(styles.length>64)throw Error('CAS hair: quantidade acima do limite');
 return styles;
}
export async function loadCASHairSystem(loader){
 const warnings=[];let styles=[];
 try{
  const response=await fetch('assets/characters/hair/manifest.json',{cache:'no-store'});
  if(response.ok)styles=validateCASHairCatalog(await response.json());
  else if(response.status!==404)warnings.push('Cabelos: catálogo HTTP '+response.status);
 }catch(error){warnings.push('Cabelos: '+String(error.message||error));}
 const items=new Map(styles.map(s=>[s.id,s])),cache=new Map(),mounted=new WeakMap();
 function tint(object,color){
  if(!object)return;
  object.traverse(node=>{
   if(!node.isMesh)return;
   for(const material of Array.isArray(node.material)?node.material:[node.material])
    if(material?.color)material.color.set(color);
  });
 }
 function release(root){
  const current=mounted.get(root);
  if(!current)return;
  current.token++;
  for(const mesh of current.originalHair||[])mesh.visible=true;
  if(current.object){
   current.object.parent?.remove(current.object);
   current.object.traverse(node=>{
    if(!node.isMesh)return;
    for(const mat of Array.isArray(node.material)?node.material:[node.material])mat?.dispose();
   });
  }
  mounted.delete(root);
 }
 async function set(root,id,color){
  if(!root)return;
  const wanted=items.has(id)?id:'none';
  const old=mounted.get(root);
  if(old?.id===wanted){
   tint(old.object,color);
   return;
  }
  release(root);
  if(wanted==='none')return;
  const state={token:0,id:wanted,object:null};
  mounted.set(root,state);
  try{
   let request=cache.get(wanted);
   if(!request){
    request=loader.loadAsync('assets/characters/hair/'+items.get(wanted).file)
     .catch(error=>{cache.delete(wanted);throw error;});
    cache.set(wanted,request);
   }
   const gltf=await request;
   if(mounted.get(root)!==state)return;
   const head=root.getObjectByName('mixamorigHead')||
    root.getObjectByName('Head')||root.getObjectByName('head');
   if(!head)throw Error('osso Head não encontrado no personagem');
   const object=gltf.scene.clone(true);
   object.traverse(node=>{
    if(!node.isMesh)return;
    node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
    node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
   });
   // Mixamo's imported armature uses a nested 0.01 transform. A
   // standalone hair GLB uses metre-scale coordinates. Compensate the bone
   // hierarchy scale, otherwise every hairstyle is ~100x too small.
   root.updateMatrixWorld(true);
   const boneWorldScale=head.getWorldScale(new (head.scale.constructor)());
   const sx=Math.abs(boneWorldScale.x),sy=Math.abs(boneWorldScale.y),sz=Math.abs(boneWorldScale.z);
   if(Math.min(sx,sy,sz)<.00001)throw Error('escala do osso Head inválida');
   const quat=head.getWorldQuaternion(head.quaternion.clone());
   const target=head.getWorldPosition(head.position.clone());
   target.y+=.13;
   head.add(object);
   object.position.copy(head.worldToLocal(target));
   object.quaternion.copy(quat).invert();
   object.scale.set(1/sx,1/sy,1/sz);
   // When a new hairstyle is equipped, do not render the baked-in original
   // Mixamo hair through it. Restore the original when the addon is removed.
   state.originalHair=[];
   root.traverse(node=>{
    if(node!==object&&node.isMesh&&/(?:^|[_-])hair(?:$|[_-])/i.test(node.name)){
     state.originalHair.push(node);node.visible=false;
    }
   });
   state.object=object;
   tint(object,color);
  }catch(error){
   if(mounted.get(root)===state){
    mounted.delete(root);
    const message='Cabelo '+wanted+': '+String(error.message||error);
    if(!warnings.includes(message))warnings.push(message);
   }
  }
 }
 return {styles,warnings,set,release};
}

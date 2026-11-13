// furniture-3d.mjs — móveis do Ultimate Home Interior Pack (Quaternius, CC0) no sistema de móveis instanciados
// (props-3d.mjs). Carrega assets/furniture/quaternius/furniture.glb (tools/import-furniture.mjs) e:
//  - registra cada móvel como tipo "qf_<arquivo>" (loja e decoração: city-home.js lê js/furniture-quaternius.js);
//  - troca os móveis procedurais das casas da cidade pelos do pack (sofá, cama, cadeira, fogão, vaso...), ajustados
//    à planta de cada tipo com a proporção do modelo (def.uniform).
// Cada modelo vira geometria com cor por vértice (cores planas do pack); o tingimento da loja/casa pinta o material
// principal (o de maior área: o tecido do sofá, a madeira do armário...).
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const DIR='assets/furniture/quaternius/';
// tipo procedural → [móvel do pack, giro em graus]. Geladeira fica a procedural (porta animada), assim como balcão
// e armário (o pack não tem peças do tamanho que as plantas das casas pedem).
export const REPLACE=Object.freeze({
 sofa:['qf_couch_medium2'],couch:['qf_couch_small1'],sectional:['qf_couch_l'],chair:['qf_chair_3'],
 bed:['qf_bed_king'],mattress:['qf_bed_single'],shelf:['qf_shelf_large'],table:['qf_table_roundsmall'],
 stove:['qf_kitchen_oven'],sink:['qf_kitchen_sink'],toilet:['qf_bathroom_toilet'],shower:['qf_bathroom_shower1'],
 plant:['qf_houseplant_4',0,{drop:/^Wood$/}],   // sem as estacas de madeira do modelo (espetos saindo da folhagem)
lamp:['qf_light_floor1'],lampdesk:['qf_light_desk'],rug:['qf_carpet_1',90],mirror:['qf_bathroom_mirror1'],
});
const FABRIC=/couch|bed|carpet|curtain/,METAL=/light_|fridge|oven|washing|trashcan/;

export async function loadQuaterniusFurniture(THREE,M,{fabric,metal}={}){
 const [manifest,gltf]=await Promise.all([
  fetch(DIR+'manifest.json').then(r=>{if(!r.ok)throw Error('manifesto dos móveis: '+r.status);return r.json();}),
  (await MeshoptDecoder.ready,new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(DIR+'furniture.glb')),
 ]);
 const changed=new Set();
 // peças de cada móvel: [geometria, cor linear, nome do material]
 const pieces=new Map();
 for(const node of gltf.scene.children){
  const list=[];
  node.updateMatrixWorld(true);
  // matriz inteira do nó: a compactação (meshopt/quantização) guarda as posições normalizadas e põe a escala e o
  // deslocamento no nó — só a rotação deixava o móvel no tamanho errado e enterrado no chão
  node.updateMatrixWorld(true);   // a posição do nó É o deslocamento da quantização (os itens ficam na origem)
  node.traverse(o=>{
   if(!o.isMesh)return;
   // atributos quantizados (Int16/Int8 normalizados) viram Float32 antes de aplicar a matriz
   const g=new THREE.BufferGeometry(),float=a=>{const out=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){out[i*3]=a.getX(i);out[i*3+1]=a.getY(i);out[i*3+2]=a.getZ(i);}return new THREE.BufferAttribute(out,3);};
   g.setAttribute('position',float(o.geometry.attributes.position));
   if(o.geometry.attributes.normal)g.setAttribute('normal',float(o.geometry.attributes.normal));
   if(o.geometry.index)g.setIndex(o.geometry.index.clone());
   g.applyMatrix4(o.matrixWorld);if(g.attributes.normal)g.normalizeNormals();
   list.push([g,o.material.color.clone(),o.material.name]);
  });
  pieces.set(node.name,list);
 }
 const build=(item,list,tint,{scale=1,turn=0,drop=null}={})=>k=>{
  for(const [g,color,name] of list){
   if(drop&&drop.test(name))continue;
   const geo=g.clone();
   if(turn)geo.rotateY(turn*Math.PI/180);
   if(scale!==1)geo.scale(scale,scale,scale);
   k.raw(geo,tint&&name===item.primary?tint:color);
  }
 };
 for(const [kind,item] of Object.entries(manifest.items)){
  const list=pieces.get(item.file);if(!list)continue;
  M[kind]={dims:[item.w,item.h,item.d],face:item.face,tinted:true,make(k,c){build(item,list,c)(k);}};
  if(FABRIC.test(kind))fabric?.add(kind);else if(METAL.test(kind))metal?.add(kind);
  changed.add(kind);
 }
 // procedurais → pack: o modelo cabe na planta do tipo (largura × profundidade), sem passar de 15% de aumento
 for(const [kind,[q,turn=0,opt={}]] of Object.entries(REPLACE)){
  const old=M[kind],item=manifest.items[q],list=pieces.get(item?.file);if(!old||!item||!list)continue;
  const [W,,D]=old.dims,w=turn%180?item.d:item.w,d=turn%180?item.w:item.d,s=Math.min(1.15,Math.max(.7,Math.min(W/w,D/d)));
  M[kind]={...old,uniform:true,dims:[W,item.h*s,D],make(k,c){build(item,list,c,{scale:s,turn,drop:opt.drop})(k);}};
  if(FABRIC.test(q))fabric?.add(kind);
  changed.add(kind);
 }
 return changed;
}

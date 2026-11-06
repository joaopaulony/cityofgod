// tools/import-furniture.mjs — importa o Ultimate Home Interior Pack (Quaternius, CC0) p/ o jogo:
//   assets/furniture/quaternius/furniture.glb  — um nó por móvel, uma primitiva por material (cores planas do pack)
//   assets/furniture/quaternius/manifest.json  — medidas reais, material principal (o que a loja tinge), categoria, preço
//   js/furniture-quaternius.js                 — o catálogo da loja (script clássico, lido por city-home.js)
// Uso: node tools/import-furniture.mjs <pasta OBJ do pack>
// O pack só tem .blend/.fbx/.obj: aqui vale o OBJ + MTL (Kd = cor base linear do Blender). As unidades do pack variam
// (portas com 4,2, luminárias/plantas já em metros): cada item tem a sua escala abaixo. Frente do móvel = +z.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

const SRC=process.argv[2];
if(!SRC){console.error('uso: node tools/import-furniture.mjs <pasta OBJ>');process.exit(1);}
const OUT='assets/furniture/quaternius';
fs.mkdirSync(OUT,{recursive:true});

// [arquivo, nome na loja, categoria, preço (R$), escala, giro (graus em y p/ a frente ficar em +z), opções]
// pendurado: a peça fica na parede, com a base a tantos metros do chão (espelho, toalha)
const ITEMS=[
 ['Couch_Small1','Sofá compacto','Sala',890,.5],['Couch_Small2','Poltrona','Sala',540,.5],
 ['Couch_Medium1','Sofá 2 lugares azul','Sala',1290,.5],['Couch_Medium2','Sofá 2 lugares','Sala',1190,.5],
 ['Couch_Large1','Sofá 3 lugares','Sala',1890,.5],['Couch_Large2','Sofá 3 lugares reto','Sala',1790,.5],['Couch_Large3','Sofá-cama baixo','Sala',1590,.5],
 ['Couch_L','Sofá em L','Sala',2690,.5],['Fireplace','Lareira','Sala',2400,.5],
 ['Chair_1','Cadeira de madeira','Sala',190,.5],['Chair_2','Cadeira estofada','Sala',260,.5],['Chair_3','Cadeira de jantar','Sala',240,.5],['Chair_4','Cadeira clássica','Sala',230,.5],
 ['Stool','Banqueta','Cozinha',150,.5],
 ['Table_RoundSmall','Mesa redonda','Sala',620,.65],['Table_RoundSmall2','Mesa redonda com toalha','Sala',680,.65],['Table_RoundLarge','Mesa oval grande','Sala',980,.65],
 ['Bed_Single','Cama de solteiro','Quarto',890,.5],['Bed_King','Cama king','Quarto',2490,.5],['Bed_Bunk','Beliche','Quarto',1490,.5],
 ['NightStand_1','Criado-mudo','Quarto',220,.5],['NightStand_2','Criado-mudo com gaveta','Quarto',260,.5],['NightStand_3','Criado-mudo duplo','Quarto',280,.5],
 ['Drawer_1','Cômoda baixa','Quarto',640,.5],['Drawer_2','Cômoda larga','Quarto',780,.5],['Drawer_3','Aparador','Quarto',860,.5],['Drawer_4','Cômoda alta','Quarto',820,.5],['Drawer_5','Cômoda 3 gavetas','Quarto',690,.5],
 ['Bookshelf','Estante de livros','Decoração',720,.5],['Shelf_1','Estante estreita','Decoração',380,.5],['Shelf_2','Estante média','Decoração',460,.5],['Shelf_Large','Estante grande','Decoração',980,.5],
 ['Shelf_Small1','Prateleira longa','Decoração',160,.5],['Shelf_Small2','Prateleira','Decoração',110,.5],['Shelf_Small3','Prateleira simples','Decoração',90,.5],
 ['Carpet_1','Tapete retangular','Decoração',260,.5],['Carpet_2','Tapete quadrado','Decoração',300,.5],['Carpet_Round','Tapete redondo','Decoração',280,.5],
 ['Curtains_Single','Cortina','Decoração',230,.5],['Curtains_Double','Cortina dupla','Decoração',390,.5],
 ['Houseplant_1','Vaso de folhagem','Decoração',120,1],['Houseplant_2','Suculenta','Decoração',45,1],['Houseplant_3','Planta em vaso alto','Decoração',140,1],['Houseplant_4','Planta espada','Decoração',150,1],
 ['Houseplant_5','Vaso de flores','Decoração',90,1],['Houseplant_6','Samambaia','Decoração',210,1],['Houseplant_7','Palmeira de vaso','Decoração',260,1],['Houseplant_8','Árvore de interior','Decoração',340,1],
 ['Light_Floor1','Luminária de pé','Iluminação',420,1],['Light_Floor2','Luminária pequena','Iluminação',190,1],['Light_Floor3','Luminária cúpula','Iluminação',230,1],['Light_Floor4','Luminária cilíndrica','Iluminação',210,1],
 ['Light_Stand1','Luminária de pé alta','Iluminação',520,.5],['Light_Stand2','Luminária de pé moderna','Iluminação',560,.5],['Light_Desk','Luminária de mesa','Iluminação',160,1],
 ['Kitchen_Fridge','Geladeira retrô','Cozinha',2600,.5],['Kitchen_Oven','Fogão','Cozinha',1090,.5],['Kitchen_Oven_Large','Fogão grande','Cozinha',1490,.5],['Kitchen_Sink','Pia com gabinete','Cozinha',740,.5],
 ['Kitchen_1Drawers','Balcão 1 gaveta','Cozinha',380,.5],['Kitchen_2Drawers','Balcão 2 gavetas','Cozinha',420,.5],['Kitchen_3Drawers','Balcão 3 gavetas','Cozinha',460,.5],
 ['Kitchen_Cabinet1','Balcão com porta','Cozinha',400,.5],['Kitchen_Cabinet2','Balcão com portas','Cozinha',430,.5],['Kitchen_CabinetSmall','Balcão pequeno','Cozinha',300,.5],
 ['Bathroom_Toilet','Vaso sanitário com caixa','Banheiro',640,.5],['Bathroom_Toilet2','Vaso sanitário compacto','Banheiro',520,.5],['Bathroom_Sink','Pia de banheiro','Banheiro',480,.5],
 ['Bathroom_Bathtub','Banheira','Banheiro',2900,.5],['Bathroom_Shower1','Box com chuveiro','Banheiro',1690,.5],['Bathroom_WashingMachine','Máquina de lavar','Banheiro',1890,.5],
 ['Bathroom_Mirror1','Espelho de parede','Banheiro',230,1,0,{hang:1.15}],['Bathroom_Mirror2','Espelho redondo','Banheiro',190,1,0,{hang:1.2}],['Bathroom_Towel','Toalheiro','Banheiro',90,1,0,{hang:.9}],
 ['Bathroom_ToiletPaper','Papel higiênico','Banheiro',15,1,0,{hang:.6}],['Bathroom_ToiletPaperPile','Pilha de papel higiênico','Banheiro',25,1],
 ['Trashcan_Small1','Lixeira pequena','Cozinha',60,.5],['Trashcan_Small2','Lixeira com pedal','Cozinha',85,.5],['Trashcan_Cylindric','Lixeira cilíndrica','Cozinha',95,.5],
 ['Trashcan_Large','Lixeira grande','Cozinha',180,.5],['Trashcan_Green','Contêiner de lixo','Decoração',320,.5],
 ['Column_SquareSmall','Pedestal','Decoração',260,.5],['Column_Round1','Pedestal redondo','Decoração',290,.5],
];
// cômodos que pedem que a frente fique virada p/ o centro (props-3d: face)
const FACE=id=>/^(Couch|Chair|Bed|Kitchen|Bathroom_(Toilet|Sink|WashingMachine)|Drawer|NightStand|Bookshelf|Shelf|Fireplace|Light_Desk)/.test(id)?'short':'any';

// ---------- MTL: cor base de cada material ----------
function readMTL(file){
 const out={};let cur=null;
 if(!fs.existsSync(file))return out;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const m=line.trim().split(/\s+/);
  if(m[0]==='newmtl')cur=out[m[1]]={kd:[.8,.8,.8],d:1};
  else if(cur&&m[0]==='Kd')cur.kd=m.slice(1,4).map(Number);
  else if(cur&&m[0]==='d')cur.d=Number(m[1]);
 }
 return out;
}
const hex=c=>'#'+c.map(x=>Math.round(Math.pow(Math.max(0,Math.min(1,x)),1/2.2)*255).toString(16).padStart(2,'0')).join('');

await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Furniture'),mats=new Map(),manifest={schema:1,source:'Quaternius — Ultimate Home Interior Pack (CC0)',items:{}};
const loader=new OBJLoader();
for(const [file,name,category,price,scale,turn=0,opt={}] of ITEMS){
 const objFile=path.join(SRC,file+'.obj');if(!fs.existsSync(objFile)){console.warn('falta',file);continue;}
 const mtl=readMTL(path.join(SRC,file+'.mtl')),group=loader.parse(fs.readFileSync(objFile,'utf8'));
 // geometria por material
 const byMat=new Map();
 group.updateMatrixWorld(true);
 group.traverse(o=>{
  if(!o.isMesh)return;
  const list=Array.isArray(o.material)?o.material:[o.material],g=o.geometry.clone().applyMatrix4(o.matrixWorld);
  const groups=g.groups.length?g.groups:[{start:0,count:g.attributes.position.count,materialIndex:0}];
  for(const gr of groups){
   const part=new THREE.BufferGeometry(),n=gr.count;
   for(const a of ['position','normal']){const src=g.attributes[a];if(!src)continue;part.setAttribute(a,new THREE.Float32BufferAttribute(src.array.slice(gr.start*3,(gr.start+n)*3),3));}
   const mname=list[gr.materialIndex]?.name||'Default';(byMat.get(mname)||byMat.set(mname,[]).get(mname)).push(part);
  }
 });
 // escala, giro, base no chão e centro em x/z
 const merged=[...byMat].map(([m,parts])=>[m,mergeGeometries(parts)]);
 const box=new THREE.Box3();
 for(const [,g] of merged){g.scale(scale,scale,scale);if(turn)g.rotateY(THREE.MathUtils.degToRad(turn));g.computeBoundingBox();box.union(g.boundingBox);}
 const c=box.getCenter(new THREE.Vector3()),lift=opt.hang!=null?opt.hang-box.min.y:-box.min.y;
 for(const [,g] of merged)g.translate(-c.x,lift,-c.z);
 const size=box.getSize(new THREE.Vector3()),h=opt.hang!=null?opt.hang+size.y:size.y;
 // material principal = o de maior área (é o que a loja deixa trocar de cor)
 const area=g=>{const p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),cc=new THREE.Vector3();let s=0;for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);cc.fromBufferAttribute(p,i+2);s+=b.sub(a).cross(cc.sub(a)).length()/2;}return s;};
 const ranked=merged.map(([m,g])=>[m,area(g)]).sort((x,y)=>y[1]-x[1]),primary=ranked[0][0];
 const mesh=doc.createMesh(file);let tris=0;
 for(const [m,g0] of merged){
  const g=mergeVertices(g0,1e-5),kd=mtl[m]?.kd||[.8,.8,.8],key=m+hex(kd);
  if(!mats.has(key))mats.set(key,doc.createMaterial(m).setBaseColorFactor([...kd,1]).setRoughnessFactor(/metal|gold|chrome|steel/i.test(m)?.4:.8).setMetallicFactor(/metal|gold|chrome|steel/i.test(m)?.5:0));
  const prim=doc.createPrimitive().setMaterial(mats.get(key))
   .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(g.attributes.position.array)).setBuffer(buffer));
  if(g.attributes.normal)prim.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(g.attributes.normal.array)).setBuffer(buffer));
  const idx=g.index.array;prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.length<65536&&g.attributes.position.count<65536?Uint16Array.from(idx):Uint32Array.from(idx)).setBuffer(buffer));
  tris+=idx.length/3;mesh.addPrimitive(prim);
 }
 scene.addChild(doc.createNode(file).setMesh(mesh));
 const kind='qf_'+file.toLowerCase();
 const prim=mtl[primary]?.kd||[.8,.8,.8],second=mtl[ranked[1]?.[0]]?.kd||prim;
 manifest.items[kind]={file,name,category,price,w:+size.x.toFixed(3),d:+size.z.toFixed(3),h:+h.toFixed(3),face:FACE(file),primary,top:hex(prim),side:hex(second),
  materials:Object.fromEntries(merged.map(([m])=>[m,hex(mtl[m]?.kd||[.8,.8,.8])])),triangles:tris,...(opt.hang!=null?{hang:opt.hang}:{})};
}
await doc.transform(dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write(path.join(OUT,'furniture.glb'),doc);
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,1));
// catálogo da loja no formato de city-home.js: [kind, nome, categoria, preço, w, d, h, top, side]
const rows=Object.entries(manifest.items).map(([k,v])=>[k,v.name,v.category,v.price,v.w,v.d,v.h,v.top,v.side]);
fs.writeFileSync('js/furniture-quaternius.js','// Gerado por tools/import-furniture.mjs — móveis do Ultimate Home Interior Pack (Quaternius, CC0) na loja e nas casas.\n'+
 '// [tipo, nome, categoria, preço, largura, profundidade, altura, cor principal, cor secundária] (medidas em metros)\n'+
 "'use strict';\nglobalThis.QUATERNIUS_FURNITURE=Object.freeze(\n"+JSON.stringify(rows).replace(/\],\[/g,'],\n[')+');\n');
console.log(Object.keys(manifest.items).length,'móveis',(fs.statSync(path.join(OUT,'furniture.glb')).size/1e6).toFixed(2),'MB');

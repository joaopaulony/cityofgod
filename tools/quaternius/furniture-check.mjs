// Confere o furniture.glb como o jogo lê (furniture-3d.mjs): medidas e base no chão de cada móvel x manifesto.
import fs from 'node:fs';
import {loadGLTF,THREE} from './load-three.mjs';
const man=JSON.parse(fs.readFileSync('assets/furniture/quaternius/manifest.json','utf8')).items;
const g=await loadGLTF('assets/furniture/quaternius/furniture.glb');let bad=0;
for(const node of g.scene.children){
 node.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();
 node.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld);box.expandByPoint(v);}});
 const m=Object.values(man).find(x=>x.file===node.name),s=box.getSize(new THREE.Vector3());
 const err=Math.max(Math.abs(s.x-m.w),Math.abs(s.z-m.d),Math.abs(box.max.y-m.h));const base=m.hang?0:box.min.y;
 if(err>.02||Math.abs(base)>.01){bad++;console.log(node.name,'w',s.x.toFixed(2),m.w,'d',s.z.toFixed(2),m.d,'top',box.max.y.toFixed(2),m.h,'base',box.min.y.toFixed(3));}
}
console.log(g.scene.children.length,'móveis,',bad,'fora da medida');

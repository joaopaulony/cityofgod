import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
// Inspection only: body textures are supplied separately by the mod.
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const b=readFileSync(process.argv[2]);
const root=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
root.updateMatrixWorld(true);
root.traverse(o=>{
 if(o.isSkinnedMesh)console.log(JSON.stringify({mesh:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.name),bones:o.skeleton.bones.map(b=>({name:b.name,parent:b.parent?.name,pos:b.getWorldPosition(new THREE.Vector3()).toArray()}))}));
});
console.log('bounds',new THREE.Box3().setFromObject(root).min.toArray(),new THREE.Box3().setFromObject(root).max.toArray());
console.log('animations',root.animations.map(a=>a.name));
root.traverse(o=>{if(o.isMesh)console.log('mesh matrix',o.matrixWorld.elements,'geoBox',o.geometry.boundingBox,'uv',o.geometry.attributes.uv?.count);});

import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
THREE.TextureLoader.prototype.load=function(url){const t=new THREE.Texture();t.userData.sourceURL=url;return t;};
const b=readFileSync(process.argv[2]);const root=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');root.updateMatrixWorld(true);
root.traverse(o=>{if(o.isMesh)console.log(JSON.stringify({name:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,bones:o.skeleton?.bones.map(b=>b.name),materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,color:m.color?.getHexString(),map:!!m.map,normal:!!m.normalMap,spec:!!m.specularMap,alphaTest:m.alphaTest,opacity:m.opacity}))}));});
console.log('bounds',new THREE.Box3().setFromObject(root).min.toArray(),new THREE.Box3().setFromObject(root).max.toArray());console.log('animations',root.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length})));

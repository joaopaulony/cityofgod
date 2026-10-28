// Diagnostic for procedural hand bones: inspect rest-pose axes before attaching phalanges.
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const files=['male.rig.glb','female.rig.glb'];
for(const file of files){
 const bytes=await readFile('assets/characters/rigs/reborn/'+file);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const root=gltf.scene;root.updateMatrixWorld(true);
 console.log('RIG',file);
 for(const name of ['LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand']){
  const bone=root.getObjectByName(name);
  if(!bone){console.log('MISSING',name);continue;}
  const pos=bone.getWorldPosition(new THREE.Vector3()),rot=bone.getWorldQuaternion(new THREE.Quaternion());
  const children=bone.children.filter(x=>x.isBone).map(b=>({name:b.name,p:b.position.toArray().map(x=>+x.toFixed(4))}));
  console.log(JSON.stringify({name,parent:bone.parent?.name,localP:bone.position.toArray().map(x=>+x.toFixed(4)),localQ:bone.quaternion.toArray().map(x=>+x.toFixed(4)),worldP:pos.toArray().map(x=>+x.toFixed(4)),worldQ:rot.toArray().map(x=>+x.toFixed(4)),children}));
 }
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const base=new URL('../assets/characters/mixamo/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
assert.deepEqual(manifest.models.map(m=>m.id).sort(),['david','megan']);
for(const spec of manifest.models)test(spec.id+': textures, independent skeleton and playable in-place animations',async()=>{
 for(const material of Object.values(spec.materials))for(const key of ['map','normalMap'])if(material[key])assert.ok((await stat(new URL(material[key],base))).size>1000);
 const b=await readFile(new URL(spec.file,base));const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const originalHip=gltf.scene.getObjectByName('mixamorigHips'),copy=clone(gltf.scene),hip=copy.getObjectByName('mixamorigHips');
 assert.notEqual(hip,originalHip);
 copy.updateMatrixWorld(true);const rest=hip.getWorldPosition(new THREE.Vector3());
 const mixer=new THREE.AnimationMixer(copy);let meshes=0;copy.traverse(o=>{if(o.isSkinnedMesh)meshes++;});assert.ok(meshes>=3);
 for(const clip of gltf.animations){
  assert.ok(clip.duration>.1);assert.ok(clip.tracks.length>=40);
  for(const track of clip.tracks){assert.ok(copy.getObjectByName(track.name.split('.')[0]),track.name);assert.ok(Array.from(track.values).every(Number.isFinite));}
  const action=mixer.clipAction(clip).play();
  for(const time of [.1,clip.duration*.5,clip.duration*.9]){
   mixer.setTime(time);copy.updateMatrixWorld(true);
   const p=hip.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(p.x-rest.x)<.001&&Math.abs(p.z-rest.z)<.001,clip.name+' root motion');
   assert.ok(p.y>.25&&p.y<1.5,clip.name+' pelvis height '+p.y);
   copy.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();assert.ok(Array.from(o.skeleton.boneMatrices).every(Number.isFinite));}});
  }
  action.stop();
 }
 const pose=name=>{mixer.stopAllAction();mixer.clipAction(gltf.animations.find(c=>c.name===name)).play();mixer.setTime(.1);copy.updateMatrixWorld(true);return hip.getWorldPosition(new THREE.Vector3()).y;};
 const standing=pose('idle');
 for(const side of ['Left','Right'])assert.ok(copy.getObjectByName('mixamorig'+side+'Hand').getWorldPosition(new THREE.Vector3()).y<copy.getObjectByName('mixamorig'+side+'Shoulder').getWorldPosition(new THREE.Vector3()).y-.15,'unarmed arms must hang down');
 assert.ok(pose('crouch')<standing-.2,'crouch must actually lower the body');
 assert.ok(pose('rifle_crouch_reload')<standing-.2,'reload must retain crouched legs');
});

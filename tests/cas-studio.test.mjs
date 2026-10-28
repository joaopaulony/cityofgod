import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizeCAS} from '../js/cas-profile.mjs';
import {FACE_KEYS,OUTFITS,applyCASVisual,applyFaceMorphs,applyWardrobe,applyAccessories,createCASEmoteClips,releaseCASVisual,CAS_EMOTES} from '../js/cas-studio.mjs';

function testBody(){
 const root=new THREE.Group(),verts=new Float32Array(1600*3);
 for(let i=0;i<1600;i++){
  const base=i*3, t=i/1599;
  verts[base]=Math.sin(i*2.41)*5;
  verts[base+1]=t*175;
  verts[base+2]=10+Math.cos(i)*2;
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial({color:0xffffff}));
 mesh.name='Ch28_Body';root.add(mesh);return {root,mesh,geo};
}

test('morphs faciais podem mudar e voltar sem alterar a geometria original',()=>{
 const {root,mesh,geo}=testBody();
 const output=applyFaceMorphs(root,{faceWidth:0.5,jaw:-0.4,nose:.2,eyes:.9,cheeks:-1});
 assert.equal(output.meshes.length,1);
 assert.equal(mesh.geometry.morphAttributes.position.length,FACE_KEYS.length*2);
 assert.notEqual(mesh.geometry,geo);
 assert.equal(mesh.morphTargetInfluences[0],.5);
 assert.equal(mesh.morphTargetInfluences[3],.4);
 assert.equal(mesh.morphTargetInfluences[8],0);
 assert.equal(mesh.morphTargetInfluences[9],1);
 const delta=mesh.geometry.morphAttributes.position[0].array;
 assert.ok(delta.some(n=>n!==0),'Blendshape deve modificar vértices próximos ao rosto');
 releaseCASVisual(root);
 assert.equal(mesh.geometry,geo);
});

test('roupas reais recebem cores sem tingir a malha de pele',()=>{
 const root=new THREE.Group(),skin=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'#ab8677'})),
 top=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'#ffffff',map:new THREE.Texture()}));
 skin.name='Ch22_Body';top.name='Ch22_Shirt';
 root.add(skin,top);
 applyWardrobe(root,{top:'#b54839',bottom:'#223344',shoes:'#eeeeee'});
 assert.equal(top.material.map,null);
 assert.equal(top.material.color.getHexString(),'b54839');
 assert.equal(skin.material.color.getHexString(),'ab8677');
 assert.equal(Object.keys(OUTFITS).length,4);
});

test('acessório 3D pode ser aplicado e removido',()=>{
 const root=new THREE.Group(),head=new THREE.Bone();head.name='mixamorigHead';root.add(head);
 applyAccessories(root,normalizeCAS({accessory:'glasses',accessoryColor:'#114455'}));
 assert.equal(head.children.length,1);
 assert.equal(head.children[0].name,'CASAccessory_glasses');
 applyAccessories(root,normalizeCAS({accessory:'none'}));
 assert.equal(head.children.length,0);
});

test('seis gestos geram clipes esqueléticos reais com tracks de ossos',()=>{
 const root=new THREE.Group();
 for(const key of ['LeftArm','RightArm','LeftForeArm','RightForeArm','RightHand','Spine','Spine2','Head','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg']){
  const bone=new THREE.Bone();bone.name='mixamorig'+key;root.add(bone);
 }
 const clips=createCASEmoteClips(root);
 assert.equal(clips.length,Object.keys(CAS_EMOTES).length);
 assert.ok(clips.every(c=>c instanceof THREE.AnimationClip&&c.tracks.length>0&&c.duration>0));
 assert.ok(clips.find(c=>c.name==='cas_wave').tracks.some(t=>/RightArm/.test(t.name)));
});

test('perfil descarta acessório desconhecido e limita face aos valores seguros',()=>{
 const x=normalizeCAS({accessory:'../../glasses',faceWidth:8,nose:-6,outfit:'fake',shoes:'#ffccdd'});
 assert.equal(x.accessory,'none');assert.equal(x.faceWidth,1);assert.equal(x.nose,-1);
 assert.equal(x.outfit,'casual');assert.equal(x.shoes,'#ffccdd');
});

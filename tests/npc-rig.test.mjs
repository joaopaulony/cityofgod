// Portão do rig modular: cada GLB de sexo tem um só esqueleto (nomes Mixamo, pés presos à perna), todas as peças
// vinculadas a ele com pesos normalizados, e as animações apontam só p/ ossos que existem.
// Uso: node --test tests/npc-rig.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {fileURLToPath} from 'node:url';

const manifest=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../assets/characters/modular/manifest.json',import.meta.url),'utf8'));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const sex of ['male','female']){
 test(sex+': um esqueleto, peças vinculadas e animações válidas',async()=>{
  const doc=await io.read(fileURLToPath(new URL('../assets/characters/modular/'+manifest[sex].file,import.meta.url)));
  const root=doc.getRoot(),skins=root.listSkins();
  // a quantização (meshopt) dá a cada peça a própria skin, mas todas com os MESMOS nós de osso
  const first=skins[0].listJoints();
  for(const s of skins)assert.ok(s.listJoints().length===first.length&&s.listJoints().every((j,i)=>j===first[i]),'um esqueleto por sexo');
  const joints=new Set(first.map(j=>j.getName()));
  for(const b of ['mixamorigHips','mixamorigSpine2','mixamorigHead','mixamorigRightHand','mixamorigLeftHand','mixamorigRightForeArm','mixamorigRightHandMiddle1','mixamorigLeftFoot'])assert.ok(joints.has(b),b);
  // pé filho da perna (no pack original ele ficava solto, preso ao Root por IK)
  const foot=root.listNodes().find(n=>n.getName()==='mixamorigLeftFoot');
  assert.equal(root.listNodes().find(n=>n.listChildren().includes(foot))?.getName(),'mixamorigLeftLeg');
  const parts=root.listNodes().filter(n=>n.getMesh());
  assert.equal(parts.length,manifest[sex].parts.length);
  for(const n of parts){
   assert.equal(n.getSkin().listJoints()[0],first[0],n.getName()+' sem o esqueleto');
   for(const p of n.getMesh().listPrimitives()){
    const w=p.getAttribute('WEIGHTS_0');
    for(let i=0;i<w.getCount();i+=97){const v=w.getElement(i,[]);const s=v.reduce((a,b)=>a+b,0);assert.ok(Math.abs(s-1)<.02,n.getName()+' peso '+s);}
   }
  }
  const anims=root.listAnimations();
  assert.equal(anims.length,Object.keys(manifest[sex].clips).length);
  for(const a of anims)for(const c of a.listChannels())assert.ok(joints.has(c.getTargetNode().getName()),a.getName()+' → '+c.getTargetNode().getName());
 });
}
test('morte: o corpo termina deitado sobre o chão (nem enterrado, nem em pé)',async()=>{
 const {execFileSync}=await import('node:child_process');
 for(const sex of ['male','female']){
  const out=execFileSync(process.execPath,['tools/quaternius/death-check.mjs',sex],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  for(const clip of ['death_shot','death_car']){
   const end=out.split('\n').find(l=>l.startsWith(clip)).trim().split(/\s+/).pop().split(':')[1].split('/').map(Number);
   assert.ok(end[0]>-0.15,`${sex} ${clip}: fundo do corpo ${end[0]} m`);
   assert.ok(end[1]<0.6,`${sex} ${clip}: topo do corpo ${end[1]} m (deveria estar deitado)`);
  }
 }
});

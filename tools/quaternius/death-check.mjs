// Confere os clipes procedurais (procedural-anim.mjs) no esqueleto modular: ponto mais baixo e mais alto do corpo
// (skinning na CPU) ao longo do clipe — o corpo caído deve ficar deitado sobre o chão (y≈0), nem enterrado nem flutuando.
// Uso: node tools/quaternius/death-check.mjs [male|female]
import {loadGLTF,THREE} from './load-three.mjs';
import {makeCombatClips} from '../../js/procedural-anim.mjs';
const sex=process.argv[2]||'male';
const g=await loadGLTF('assets/characters/modular/'+sex+'.glb');
const keep=new Set(['head-casual_hoodie','body-casual_hoodie','legs-casual_hoodie','feet-casual_hoodie','head-casual','body-casual','legs-casual','feet-casual']);
const drop=[];g.scene.traverse(o=>{if(o.userData?.slot&&!keep.has(o.name))drop.push(o);});drop.forEach(o=>o.parent.remove(o));
const meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const v=new THREE.Vector3();
function span(){g.scene.updateMatrixWorld(true);let lo=1e9,hi=-1e9;for(const s of meshes){const n=s.geometry.attributes.position.count;for(let i=0;i<n;i+=2){s.getVertexPosition(i,v);v.applyMatrix4(s.matrixWorld);lo=Math.min(lo,v.y);hi=Math.max(hi,v.y);}}return [lo,hi];}
const clips=makeCombatClips(g.scene,1.8),mixer=new THREE.AnimationMixer(g.scene);
for(const c of clips.filter(c=>/death|kneel/.test(c.name))){
 mixer.stopAllAction();const a=mixer.clipAction(c);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();
 const out=[];for(const f of [0,.25,.5,.75,1]){mixer.setTime(c.duration*f);const [lo,hi]=span();out.push(f+':'+lo.toFixed(2)+'/'+hi.toFixed(2));}
 console.log(c.name.padEnd(12),out.join('  '));
}

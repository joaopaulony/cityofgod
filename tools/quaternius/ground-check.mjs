// Mede o chão: em cada clipe, o ponto mais baixo dos pés (skinning na CPU) em relação a y=0.
// Uso: node tools/quaternius/ground-check.mjs [male|female] [clipes...]
import {loadGLTF,THREE} from './load-three.mjs';
const sex=process.argv[2]||'male',only=process.argv.slice(3);
const g=await loadGLTF('assets/characters/modular/'+sex+'.glb');
const want=new Set(['feet-casual_hoodie','feet-casual','legs-casual_hoodie','legs-casual']);
const meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh&&want.has((o.userData.slot?o:o.parent).name))meshes.push(o);});
const v=new THREE.Vector3();
function low(){g.scene.updateMatrixWorld(true);let m=1e9;for(const s of meshes){const n=s.geometry.attributes.position.count;for(let i=0;i<n;i+=3){s.getVertexPosition(i,v);v.applyMatrix4(s.matrixWorld);if(v.y<m)m=v.y;}}return m;}
const mixer=new THREE.AnimationMixer(g.scene);
console.log('repouso',low().toFixed(3));
for(const c of g.animations){
 if(only.length&&!only.includes(c.name))continue;
 mixer.stopAllAction();const a=mixer.clipAction(c);a.play();let mn=1e9,mx=-1e9;
 for(let t=0;t<=c.duration;t+=c.duration/12){mixer.setTime(t);const y=low();mn=Math.min(mn,y);mx=Math.max(mx,y);}
 console.log(c.name.padEnd(22),'min',mn.toFixed(3),'max',mx.toFixed(3));a.stop();
}

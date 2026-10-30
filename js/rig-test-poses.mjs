// rig-test-poses.mjs — poses de teste do rig em eixos do MUNDO (iguais p/ qualquer personagem, independentes dos eixos
// locais de cada osso): [osso, eixo, graus], aplicadas em ordem sobre o repouso. Personagem de frente p/ +Z,
// esquerda do personagem = +X. Usadas por tools/rig-audit.mjs e tests/rig-compare.html.
import * as THREE from 'three';
export const TEST_POSES=Object.freeze({
 arms:{label:'braços abaixados',steps:[['LeftArm','z',-75],['RightArm','z',75]]},
 armsup:{label:'braços erguidos',steps:[['LeftArm','z',55],['RightArm','z',-55]]},
 elbows:{label:'cotovelos 90°',steps:[['LeftArm','z',-75],['RightArm','z',75],['LeftForeArm','x',-90],['RightForeArm','x',-90]]},
 neck:{label:'pescoço/cabeça',steps:[['Neck','x',15],['Neck','y',25],['Head','x',15],['Head','y',20]]},
 legs:{label:'quadril 60° / joelho 90°',steps:[['LeftUpLeg','x',-60],['LeftLeg','x',90]]},
 // mão fechada: cada falange dobra p/ a palma (mãos em pose T, palma p/ baixo)
 fist:{label:'mão fechada',steps:['Left','Right'].flatMap(s=>{const k=s==='Left'?-1:1;return [
  ...['Index','Middle','Ring','Pinky'].flatMap(f=>[[s+'Hand'+f+'1','z',50*k],[s+'Hand'+f+'2','z',60*k],[s+'Hand'+f+'3','z',40*k]]),
  [s+'HandThumb2','x',30],[s+'HandThumb3','x',30]];})},
});
const AX={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
export function applyTestPose(root,pose){
 for(const [name,axis,deg] of pose.steps){
  const b=root.getObjectByName('mixamorig'+name);if(!b)continue;root.updateMatrixWorld(true);
  const w=b.getWorldQuaternion(new THREE.Quaternion()),p=b.parent.getWorldQuaternion(new THREE.Quaternion());
  const r=new THREE.Quaternion().setFromAxisAngle(AX[axis],THREE.MathUtils.degToRad(deg));
  b.quaternion.copy(p.invert().multiply(r).multiply(w));
 }
 root.updateMatrixWorld(true);
}

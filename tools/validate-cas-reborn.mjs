import {readFile} from 'node:fs/promises';
const root='assets/characters/reborn/';
const required=['male','female','walk','run','jump'];
let reference=null;
for(const name of required){
 const bytes=await readFile(root+name+'.glb');
 if(bytes.length<1000||bytes.length>5_000_000)throw Error('CAS Reborn: invalid size '+name);
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid GLB '+name);
 const n=v.getUint32(12,true);
 const json=JSON.parse(bytes.subarray(20,20+n).toString('utf8'));
 if(!json.skins?.length||!json.animations?.length)throw Error(name+' missing skin or animation');
 const joints=json.skins[0].joints.map(i=>json.nodes[i].name).sort();
 for(const b of ['Hips','Head','LeftArm','RightArm','LeftLeg','RightLeg'])if(!joints.includes(b))throw Error(name+' missing '+b);
 if(reference&&joints.join('|')!==reference.join('|'))throw Error(name+' incompatible bone naming');
 reference||=joints;
 console.log('Reborn validated:',name,bytes.length,'bytes',json.animations.map(c=>c.name));
}

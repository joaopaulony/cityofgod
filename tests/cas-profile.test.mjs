import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCAS,validateCASManifest,readCAS,writeCAS,CAS_KEY} from '../js/cas-profile.mjs';
import {matchCASClips,casCapabilities} from '../js/cas-assets.mjs';

test('CAS normaliza valores inválidos sem poluir o perfil',()=>{
 const p=normalizeCAS({sex:'invalid',height:3,build:0,skin:'javascript:evil',name:'<Alex>',hair:'#FFaa00'});
 assert.equal(p.sex,'male');assert.equal(p.height,1.1);assert.equal(p.build,.86);
 assert.equal(p.name,'Alex');assert.equal(p.hair,'#ffaa00');
 assert.notEqual(p.skin,'javascript:evil');
});
test('CAS persiste duas bases e aparência',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 writeCAS(storage,{sex:'female',height:1.04,top:'#123456'});
 assert.equal(JSON.parse(data.get(CAS_KEY)).sex,'female');
 assert.equal(readCAS(storage).height,1.04);
 assert.equal(readCAS(storage).top,'#123456');
});
test('CAS impede path traversal e nomes perigosos',()=>{
 assert.throws(()=>validateCASManifest({schema:1,models:[{sex:'male',file:'../secret.glb',rig:'generic'}]}));
 assert.throws(()=>validateCASManifest({schema:1,models:[{sex:'male',file:'a.glb',rig:'generic'},{sex:'male',file:'b.glb',rig:'generic'}]}));
 assert.equal(validateCASManifest({schema:1,models:[{sex:'female',file:'female.glb',rig:'generic',materialSlots:{skin:['Skin']}}]}).length,1);
});
test('CAS identifica clipes humanoides e capacidades de materiais',()=>{
 const clips=matchCASClips([{name:'Idle',duration:2},{name:'Walking',duration:1},{name:'Running',duration:.5}]);
 assert.equal(clips.idle.name,'Idle');assert.equal(clips.walk.name,'Walking');
 assert.equal(clips.run.loop,true);
 assert.deepEqual(casCapabilities({materialSlots:{hair:['Hair'],skin:[]}}),{skin:false,hair:true,top:false,bottom:false});
});

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


test('CAS mantém identidade, idade, estilo e origem em valores seguros',()=>{
 const p=normalizeCAS({name:' <Maria> ',age:29,background:'litoral',style:'urbano',sex:'female'});
 assert.equal(p.name,'Maria');assert.equal(p.age,29);
 assert.equal(p.background,'litoral');assert.equal(p.style,'urbano');
 const invalid=normalizeCAS({age:-90,background:'../../root',style:'javascript:',name:'  '});
 assert.equal(invalid.age,18);assert.equal(invalid.background,'bairro');
 assert.equal(invalid.style,'casual');assert.equal(invalid.name,'Alex');
});
test('CAS preserva novos campos durante escrita e leitura local',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 writeCAS(storage,{name:'Sofia',age:34,sex:'female',background:'centro',style:'social',height:1.06});
 const profile=readCAS(storage);
 assert.equal(profile.name,'Sofia');assert.equal(profile.age,34);
 assert.equal(profile.sex,'female');assert.equal(profile.background,'centro');assert.equal(profile.style,'social');
 assert.equal(profile.height,1.06);
});

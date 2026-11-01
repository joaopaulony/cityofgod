import test from 'node:test';
import assert from 'node:assert/strict';
import {CAS_KEY,normalizeCAS} from '../js/cas-profile.mjs';
import {ROSTER_KEY,MAX_CHARACTERS,normalizeRoster,readRoster,addCharacter,selectCharacter,updateCharacter,deleteCharacter,activeCharacter,persistRoster} from '../js/cas-roster.mjs';

const storage=()=>{
 const data=new Map();
 return {getItem:key=>data.get(key)||null,setItem:(key,val)=>data.set(key,val),_data:data};
};
test('migra personagem v1 para roster sem modificar os dados antigos',()=>{
 const s=storage();s.setItem(CAS_KEY,JSON.stringify(normalizeCAS({name:'Maria',sex:'female'})));
 const roster=readRoster(s);
 assert.equal(roster.characters.length,1);
 assert.equal(roster.activeId,'character-legacy');
 assert.equal(activeCharacter(roster).name,'Maria');
 assert.equal(JSON.parse(s.getItem(CAS_KEY)).name,'Maria');
});
test('cria, seleciona, salva e restaura até 3 personagens distintos',()=>{
 const s=storage(),first=addCharacter(normalizeRoster(null),{name:'Pedro',sex:'male'});
 let roster=addCharacter(first,{name:'Lia',sex:'female'});
 roster=addCharacter(roster,{name:'Rafael'});
 assert.equal(roster.characters.length,MAX_CHARACTERS);
 assert.throws(()=>addCharacter(roster,{name:'Um quarto'}),/Máximo/);
 const ids=roster.characters.map(x=>x.id);
 roster=selectCharacter(roster,ids[1]);
 roster=updateCharacter(roster,{name:'Lia Nova',sex:'female',hairStyle:'hair-02'});
 persistRoster(s,roster);
 const restored=readRoster(s);
 assert.equal(restored.activeId,ids[1]);
 assert.equal(activeCharacter(restored).name,'Lia Nova');
 assert.equal(restored.characters.find(x=>x.id===ids[0]).profile.name,'Pedro');
 assert.equal(restored.characters.find(x=>x.id===ids[2]).profile.name,'Rafael');
 assert.equal(JSON.parse(s.getItem(CAS_KEY)).name,'Lia Nova');
});
test('exclui personagem ativo e recupera outro sem perder perfil',()=>{
 let r=addCharacter(normalizeRoster(null),{name:'André'});
 r=addCharacter(r,{name:'Bianca'});
 const active=r.activeId;
 r=deleteCharacter(r,active);
 assert.equal(r.characters.length,1);
 assert.equal(activeCharacter(r).name,'André');
 r=deleteCharacter(r,r.activeId);
 assert.equal(r.characters.length,0);
 assert.equal(r.activeId,null);
});
test('validação rejeita IDs inesperados, duplicatas, entradas em excesso e armazenamento inválido',()=>{
 const raw={activeId:'../../x',characters:[
 {id:'character-a',profile:{name:'Um'}},
 {id:'character-a',profile:{name:'Duplicado'}},
 {id:'../../etc/passwd',profile:{name:'Perigo'}},
 {id:'character-b',profile:{name:'Dois'}},
 {id:'character-c',profile:{name:'Três'}},
 {id:'character-d',profile:{name:'Quatro'}}
 ]};
 const r=normalizeRoster(raw);
 assert.deepEqual(r.characters.map(x=>x.id),['character-a','character-b','character-c']);
 assert.equal(r.activeId,'character-a');
 const s=storage();s.setItem(ROSTER_KEY,'{malformed');
 assert.deepEqual(readRoster(s).characters,[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('personagens do autor (assets/npcs) no esqueleto Mixamo, sem os loaders antigos de CC3/Reborn',()=>{
 const src=read('js/character-webgl.mjs');
 assert.match(src,/loadRoster/);
 assert.match(src,/chooseCharacterClip/);
 assert.match(src,/installCASCreator/);
 assert.match(src,/bridge\.driving\(\)/);            // o corpo some ao dirigir
 assert.doesNotMatch(src,/loadRebornAssets|street-crown/);
 assert.doesNotMatch(src,/async function initCC3/);
 const roster=JSON.parse(read('assets/npcs/roster.json'));
 assert.equal(roster.characters.length,52);
 for(const c of roster.characters){
  // nome e sobrenome do arquivo (o Miguel, protagonista, vem só com o primeiro nome)
  if(c.id!=='miguel')assert.match(c.name,/^\S+ \S+/,'nome e sobrenome: '+c.id);
  assert.ok(['player','civil','gang','service','worker'].includes(c.role));
  assert.ok(c.height>1.5&&c.height<1.9,'escala real: '+c.id);
 }
});
test('só os 52 personagens do roster: nada dos sistemas antigos (CC3, Reborn, Tomb, cartoon, base realista)',()=>{
 for(const p of ['js/cas-reborn.mjs','js/cc3-rig.mjs','js/cartoon-character.mjs','assets/characters/rigs/reborn','assets/characters/rigs/tomb','assets/characters/rigs/player.rig.glb'])
  assert.equal(existsSync(new URL('../'+p,import.meta.url)),false,p);
 assert.ok(existsSync(new URL('../assets/characters/rigs/mixamo/david.rig.glb',import.meta.url)));   // animações
 assert.ok(existsSync(new URL('../assets/characters/rigs/mixamo/megan.rig.glb',import.meta.url)));
});

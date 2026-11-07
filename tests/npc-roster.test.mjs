import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {normalizeLook,lookKey,randomLook,materialRole,primaryCloth,FANTASY} from '../js/modular-characters.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('assets/characters/modular/manifest.json'));
const roster=JSON.parse(read('assets/characters/modular/roster.json'));

test('personagens modulares Quaternius: sistema de personagens usa o roster modular',()=>{
 const src=read('js/character-webgl.mjs');
 assert.match(src,/loadRoster/);
 assert.match(src,/chooseCharacterClip/);
 assert.match(src,/installCASCreator/);
 assert.match(src,/installEmoteMenu/);
 assert.match(src,/bridge\.driving\(\)/);            // o corpo some ao dirigir
 assert.doesNotMatch(src,/loadRebornAssets|street-crown/);
 assert.equal(existsSync(new URL('../assets/npcs',import.meta.url)),false,'bonecos antigos removidos');
});
test('elenco: 52 pessoas com nome e sobrenome, papel válido e visual de peças existentes',()=>{
 assert.equal(roster.characters.length,52);
 for(const c of roster.characters){
  if(c.id!=='miguel')assert.match(c.name,/^\S+ \S+/,'nome e sobrenome: '+c.id);
  assert.ok(['player','civil','gang','service','worker'].includes(c.role));
  assert.ok(c.height>1.5&&c.height<1.9,'escala real: '+c.id);
  const parts=manifest[c.sex].parts;
  for(const slot of ['head','body','legs','feet'])assert.ok(parts.some(p=>p.slot===slot&&p.id===c.look[slot]),c.id+' '+slot+'='+c.look[slot]);
  assert.deepEqual(normalizeLook(c.look,manifest),c.look,'visual já normalizado: '+c.id);
 }
 // moradores e gangues não usam peças de fantasia (rei, traje espacial, bruxa...)
 for(const c of roster.characters.filter(c=>['civil','gang'].includes(c.role)))
  for(const slot of ['head','body','legs','feet'])assert.ok(!FANTASY[c.sex].has(c.look[slot]),c.id+' usa '+c.look[slot]);
});
test('manifesto: peças dos dois sexos, esqueleto Mixamo e as animações que o jogo pede',()=>{
 for(const sex of ['male','female']){
  const m=manifest[sex];
  assert.ok(existsSync(new URL('../assets/characters/modular/'+m.file,import.meta.url)));
  assert.ok(m.bones>=50);
  for(const slot of ['head','body','legs','feet'])assert.ok(m.parts.filter(p=>p.slot===slot).length>=10,sex+' '+slot);
  // tudo o que chooseCharacterClip/pickClips toca
  for(const clip of ['idle','walk','run','crouch','crouch_walk','jump_start','jump_air','jump_land','vault_low','rifle_idle','rifle_aim','rifle_walk','rifle_run',
   'rifle_walk_back','rifle_strafe_left','rifle_strafe_right','rifle_fire','rifle_reload','rifle_crouch_aim','rifle_crouch_walk','rifle_crouch_fire','rifle_crouch_reload','fixing_kneeling','walk_carry'])
   assert.ok(m.clips[clip],sex+': falta '+clip);
  assert.ok(Object.keys(m.clips).length>=100,'biblioteca completa');
  assert.ok(m.clips.walk.speed>.5&&m.clips.run.speed>m.clips.walk.speed,'velocidade da passada');
 }
});
test('visual: normaliza peças inválidas, cores e gera chave estável',()=>{
 const l=normalizeLook({sex:'female',head:'../etc',body:'casual',legs:'nao-existe',feet:'punk',skin:'javascript:',hair:'#ABCDEF',top:''},manifest);
 assert.equal(l.sex,'female');assert.equal(l.head,'casual');assert.equal(l.legs,'casual');assert.equal(l.feet,'punk');
 assert.match(l.skin,/^#[0-9a-f]{6}$/);assert.equal(l.hair,'#abcdef');assert.equal(l.top,'');
 assert.equal(lookKey(l),lookKey({...l}));
 const a=randomLook('male','seed-1',manifest),b=randomLook('male','seed-1',manifest);
 assert.deepEqual(a,b,'sorteio determinístico pela semente');
});
test('materiais: pele, cabelo e cor principal da roupa',()=>{
 assert.equal(materialRole('head','casual_hoodie','Skin','male'),'skin');
 assert.equal(materialRole('head','casual_hoodie','Hair','male'),'hair');
 assert.equal(materialRole('head','formal','Red','female'),'hair');
 assert.equal(materialRole('head','farmer','Beige','male'),'hat');
 const suit=manifest.male.parts.find(p=>p.slot==='body'&&p.id==='suit');
 assert.equal(primaryCloth(suit,'male'),'Suit');
});
test('cores por parte da roupa: só materiais pintáveis da peça escolhida',async()=>{
 const {paintable}=await import('../js/modular-characters.mjs');
 assert.deepEqual(paintable(manifest,'male','body','suit').map(m=>m.name),['Suit','White','Tie']);
 const l=normalizeLook({sex:'male',body:'suit',tints:{body:{Tie:'#FF0000',Skin:'#000000',Nada:'#00ff00'},legs:{X:'#123456'}}},manifest);
 assert.deepEqual(l.tints,{body:{Tie:'#ff0000'}},'pele e materiais de outra peça ficam de fora');
 assert.notEqual(lookKey(l),lookKey({...l,tints:{}}),'a cor entra na chave do visual');
});
test('móveis do pack: medidas do manifesto e base no chão (lidos como o jogo lê)',async()=>{
 const {execFileSync}=await import('node:child_process');
 const out=execFileSync(process.execPath,['tools/quaternius/furniture-check.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.match(out,/, 0 fora da medida/);
});

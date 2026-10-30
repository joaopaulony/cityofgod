import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSocialSim,factionAffinity} from '../js/social-sim.mjs';
import {NPC_STORIES} from '../js/npc-stories.mjs';
const roster=JSON.parse(readFileSync(new URL('../assets/npcs/roster.json',import.meta.url))).characters;
const make=opts=>createSocialSim(roster,{random:()=>0,...opts});
test('todos os personagens têm história própria',()=>{assert.equal(roster.length,52);for(const c of roster)assert.ok(NPC_STORIES[c.id]?.length>90,c.id);assert.equal(new Set(Object.values(NPC_STORIES)).size,52);});
test('rivalidade é recíproca e não afeta jogador por seu visual',()=>{assert.equal(factionAffinity('last-kings','novelis-crew'),-48);assert.equal(factionAffinity('policia','last-kings'),-38);const s=make();assert.equal(s.relation('player','christopher-brown').friend,0);assert.equal(s.relation('christopher-brown','ana-paula-novli'),s.relation('ana-paula-novli','christopher-brown'));});
test('romance exige vínculo forte e namoro é exclusivo',()=>{
 const s=make(),id='aiko-sakura';assert.equal(s.interact('player',id,'flirt').ok,false);
 s.interact('player',id,'greet');s.tick(1);assert.equal(s.interact('player',id,'chat').ok,false);for(let i=0;i<5;i++)s.tick(1);
 const r=s.relation('player',id);Object.assign(r,{friend:70,trust:60,intimacy:55,romance:75});
 assert.equal(s.interact('player',id,'date').accepted,true);for(let i=0;i<5;i++)s.tick(1);
 Object.assign(s.relation('player','jessica-alves'),{friend:70,trust:60,intimacy:55,romance:75});
 assert.equal(s.interact('player','jessica-alves','date').ok,false);
 assert.equal(s.interact('player',id,'breakup').ok,true);assert.equal(r.dating,false);
});
test('ofensas criam inimizade e memória; repetição tem retorno menor',()=>{const s=make(),id='aiko-sakura';s.interact('player',id,'insult');for(let i=0;i<5;i++)s.tick(1);s.interact('player',id,'insult');const r=s.relation('player',id);assert.equal(r.friend,-21.6);assert.equal(r.memories.length,2);for(let i=0;i<5;i++)s.tick(1);assert.equal(s.interact('player',id,'apologize').ok,true);assert.ok(r.trust<0);});
test('vínculos sobrevivem ao recarregamento e storage indisponível não quebra simulação',()=>{let data;const storage={getItem:()=>data,setItem:(_,v)=>data=v};const s=make({storage});s.interact('player','aiko-sakura','greet');s.save();const loaded=make({storage});assert.equal(loaded.relation('player','aiko-sakura').friend,5);assert.equal(loaded.relation('player','aiko-sakura').memories.length,1);assert.doesNotThrow(()=>make({storage:{getItem(){throw Error();}}}));});
test('quem namora quase nunca recusa carinho e um "hoje não" não trava o romance por 90 s',async()=>{
 const {romanticRefusalChance}=await import('../js/social-sim.mjs');
 assert.ok(romanticRefusalChance({dating:true,romance:100})<=.03);
 assert.ok(romanticRefusalChance({dating:false,romance:0})>romanticRefusalChance({dating:false,romance:80}));
 // sorteio no topo (recusa) entre namorados: pausa curta
 let draw=0;const s=createSocialSim(roster,{random:()=>draw}),id=roster[0].id,r=s.relation('player',id);
 Object.assign(r,{friend:100,trust:100,intimacy:100,romance:100,dating:true});
 draw=.99;const res=s.interact('player',id,'kiss');assert.equal(res.accepted,false);
 for(let k=0;k<25;k++)s.tick(1);draw=0;
 assert.equal(s.interact('player',id,'kiss').accepted,true,'depois de ~20 s o casal volta a se beijar');
});
test('flertar com outra pessoa magoa quem namora com o jogador',()=>{
 const s=make(),[A,B]=[roster[0].id,roster[1].id];
 for(const id of [A,B])Object.assign(s.relation('player',id),{friend:100,trust:100,intimacy:100,romance:100});
 assert.equal(s.interact('player',A,'date').accepted,true);for(let k=0;k<30;k++)s.tick(1);
 assert.equal(s.interact('player',B,'flirt').accepted,true);
 const ra=s.relation('player',A);assert.ok(ra.trust<100&&ra.romance<100,'parceira perde confiança e romance');
 assert.match(ra.memories.at(-1).text,/trocou carinhos/);assert.equal(ra.dating,true,'não termina sozinho');
});

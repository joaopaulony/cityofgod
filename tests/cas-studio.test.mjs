import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAS_EMOTES,EMOTE_GROUPS,emoteClipSpecs,emoteDuration} from '../js/cas-studio.mjs';

const manifest=JSON.parse(readFileSync(new URL('../assets/characters/modular/manifest.json',import.meta.url),'utf8'));

test('todo gesto aponta p/ um clipe real dos dois sexos',()=>{
 for(const sex of ['male','female'])for(const [id,e] of Object.entries(CAS_EMOTES))
  assert.ok(manifest[sex].clips[e.clip],sex+': gesto '+id+' sem o clipe '+e.clip);
 for(const e of Object.values(CAS_EMOTES))assert.ok(EMOTE_GROUPS[e.group],'grupo '+e.group);
 assert.ok(Object.keys(CAS_EMOTES).length>=25);
});
test('gestos viram entradas cas_<id> com laço e duração',()=>{
 const clips=Object.fromEntries(Object.entries(manifest.male.clips).map(([n,c])=>[n,{name:n,duration:c.duration,loop:!!c.loop,speed:c.speed||0}]));
 const specs=emoteClipSpecs(clips);
 assert.equal(specs.cas_wave.name,'q_wave');assert.equal(specs.cas_wave.loop,false);
 assert.equal(specs.cas_dance.name,'dance');assert.equal(specs.cas_dance.loop,true);
 assert.equal(specs.cas_sit.name,'sitting_idle');   // sentar em casa (pickClips → cas_sit)
 assert.ok(emoteDuration('wave',specs)>.5);
 assert.equal(emoteDuration('dance',specs),CAS_EMOTES.dance.duration);
 assert.deepEqual(emoteClipSpecs({}),{},'sem clipes, sem gestos');
});

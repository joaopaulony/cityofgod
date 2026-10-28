import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResidents} from '../js/cas-population.mjs';
test('residents deterministic and within budget',()=>{
 const a=createResidents(42,12),b=createResidents(42,12);
 assert.deepEqual(a,b);assert.equal(a.length,12);
 assert.equal(new Set(a.map(x=>x.id)).size,a.length);
 assert.equal(new Set(a.map(x=>x.name)).size,a.length);
 assert.ok(a.some(x=>x.sex==='female')&&a.some(x=>x.sex==='male'));
 assert.ok(a.every(x=>x.walkSpeed>0&&x.walkSpeed<2));
 assert.equal(createResidents(42,999).length,16);
});

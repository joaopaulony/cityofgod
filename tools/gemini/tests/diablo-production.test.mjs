import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog,counts,productionPrompt,taskById,DIABLO_DIRECTIONS,DIABLO_PROJECT} from '../diablo-production.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const rows=catalog();
test('Inventory exact counts, unique IDs, complete 8-view coverage',()=>{
 assert.equal(counts.total,136);
 assert.deepEqual(counts,{base:8,lighting:32,moving:64,masks:32,total:136});
 assert.equal(rows.length,136);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 for(const direction of DIABLO_DIRECTIONS){
   const items=rows.filter(t=>t.direction===direction);
   assert.equal(items.length,17,direction);
   assert.equal(items.filter(t=>t.kind==='base').length,1);
   assert.equal(items.filter(t=>t.kind==='lighting').length,4);
   assert.equal(items.filter(t=>t.kind==='moving').length,8);
   assert.equal(items.filter(t=>t.kind==='mask').length,4);
 }
});
test('No automatic payment or auto-approval; named tasks have dependencies',()=>{
 assert.equal(DIABLO_PROJECT.stage,'PREPRODUCTION_NOT_APPROVED');
 for(const t of rows){
   assert.equal(t.status,'PENDING_ART_REVIEW');
   assert.equal(t.billable,false);
   assert.ok(t.output.endsWith('.png'));
   assert.ok(t.dependencies.length>0);
   assert.match(productionPrompt(t),/CHECK MANUALLY/);
 }
});
test('Front cannot turn into back; rear must have lamps and must not become bonnet',()=>{
 for(const direction of ['front','front-left','front-right']){
  const text=productionPrompt('base__'+direction).toLowerCase();
  assert.match(text,/front/);
  assert.match(text,/rear/);
  assert.match(text,/pop-up/);
  assert.match(text,/no red tail lamps|round red tail lamps|four round rear taillights/);
 }
 for(const direction of ['rear','rear-left','rear-right']){
  const text=productionPrompt('base__'+direction).toLowerCase();
  assert.match(text,/taillight/);
  assert.match(text,/engine/);
  assert.match(text,/front/);
 }
});
test('Left and right profiles point in opposite explicitly stated directions',()=>{
 const left=productionPrompt('base__left');
 const right=productionPrompt('base__right');
 assert.match(left,/FRONT points to the LEFT/);
 assert.match(right,/FRONT points to the RIGHT/);
});
test('All tasks protect body hue, wheels, glass, cleanliness and real transparency',()=>{
 for(const task of rows){
  const p=productionPrompt(task);
  for(const phrase of [
   '#704080','NO dirt','wheel','glass','transparent','manual'
  ])assert.ok(p.toLowerCase().includes(phrase.toLowerCase()),task.id+': '+phrase);
 }
});
test('Open and half-open use identical hinge, never change car identity',()=>{
 for(const part of ['door-left','door-right','hood','rear-cover']){
  const half=productionPrompt(part+'__half__front-left');
  const open=productionPrompt(part+'__open__front-left');
  assert.match(half,/HALF OPEN/);
  assert.match(open,/FULLY OPEN/);
  assert.match(open,/hinge/i);
 }
});
test('Masks are explicitly offline without Gemini calls',()=>{
 const masks=rows.filter(t=>t.kind==='mask');
 assert.equal(masks.length,32);
 for(const m of masks){
  assert.match(m.method,/offline|canvas/);
  assert.match(productionPrompt(m),/mask|masking|paint|segmentation|contact shadow/i);
 }
});
test('Unknown tasks are refused rather than turning into a paid hallucination',()=>{
 assert.throws(()=>taskById('base__diagonal'));
 assert.throws(()=>productionPrompt('rear-front__right'));
});
test('Exporter produces 136 text prompts, CSV and manifest without a key',()=>{
 const dest=path.join(root,'artifacts/diablo-production-test');
 const processResult=spawnSync(process.execPath,[
  path.join(here,'../export-diablo-production.mjs'),dest
 ],{cwd:root,env:{...process.env,GEMINI_API_KEY:''},encoding:'utf8',timeout:10000});
 assert.equal(processResult.status,0,processResult.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(dest,'asset-manifest.json'),'utf8'));
 assert.equal(manifest.artifacts.length,136);
 assert.equal(manifest.approvedImages,0);
 assert.ok(manifest.approvalRequired);
 const csv=fs.readFileSync(path.join(dest,'asset-checklist.csv'),'utf8');
 assert.equal(csv.split('\n').filter(Boolean).length,137);
 for(const task of rows){
  const f=path.join(dest,'prompts',task.kind,task.id+'.txt');
  assert.ok(fs.statSync(f).size>800,task.id);
 }
});

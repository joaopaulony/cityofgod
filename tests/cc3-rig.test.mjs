import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {CC3_BONE_LINKS,CC3_REQUIRED,inspectCC3Bones} from '../js/cc3-mapping.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const available=new Set([
 'CC_Base_BoneRoot','CC_Base_Hip','CC_Base_Pelvis','CC_Base_Waist',
 'CC_Base_Spine01','CC_Base_Spine02','CC_Base_NeckTwist01','CC_Base_Head',
 'CC_Base_L_Clavicle','CC_Base_L_Upperarm','CC_Base_L_Forearm','CC_Base_L_Hand',
 'CC_Base_R_Clavicle','CC_Base_R_Upperarm','CC_Base_R_Forearm','CC_Base_R_Hand',
 'CC_Base_L_Thigh','CC_Base_L_Calf','CC_Base_L_Foot',
 'CC_Base_R_Thigh','CC_Base_R_Calf','CC_Base_R_Foot',
 'CC_Base_L_Index1','CC_Base_R_Index1','CC_Base_L_ToeBase','CC_Base_R_ToeBase'
]);
test('both uploaded CC3 skeletons expose all essential animation bones',()=>{
 const report=inspectCC3Bones(available);
 assert.equal(report.ok,true);
 assert.deepEqual(report.missing,[]);
 assert.ok(report.available>=20);
 assert.equal(report.total,CC3_BONE_LINKS.length);
 assert.ok(CC3_REQUIRED.every(n=>n.startsWith('CC_Base_')));
});
test('adapter rejects incomplete rigs instead of distorting skinned meshes',()=>{
 const report=inspectCC3Bones(['CC_Base_Hip','CC_Base_Head']);
 assert.equal(report.ok,false);
 assert.ok(report.missing.includes('CC_Base_L_Thigh'));
 assert.ok(report.missing.includes('CC_Base_R_Upperarm'));
});
test('base animations are procedural, damped and preserve twist inheritance',()=>{
 const code=read('js/cc3-rig.mjs');
 assert.match(code,/1-Math\.exp\(/);
 assert.match(code,/bone\.quaternion\.slerp/);
 assert.match(code,/e\.bone\.parent\.getWorldQuaternion/);
 assert.match(code,/CC3_BONE_LINKS/);
 assert.match(code,/smoothing/);
});
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
test('conversion workflow is valid Python, never includes raw user FBX',()=>{
 const path=new URL('../tools/convert_cc3_bodies.py',import.meta.url);
 assert.ok(existsSync(path));
 const check=spawnSync(process.env.PYTHON || 'python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],
   {encoding:'utf8',timeout:15000,input:readFileSync(path,'utf8')});
 if(check.error?.code==='ENOENT')return; // Python may not be installed in Node-only CI.
 assert.equal(check.status,0,check.stderr);
 const source=read('tools/convert_cc3_bodies.py');
 assert.match(source,/CC_Base_Hip/);
 assert.match(source,/use_anim=False/);
 assert.match(source,/export_animations=False/);
 assert.match(source,/max-head-texture/);
 assert.match(source,/Safe|safe_extract/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {slug,validate,buildPrompt,models,directions,assetTypes} from '../prompts.mjs';
import {loadReference} from '../generate-assets.mjs';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function opts(overrides={}){
  return {type:'car',name:'Daytona roxo',details:'',direction:'front-left',
    size:'1K',ratio:'1:1',model:models[0],cutout:false,...overrides};
}
test('Every asset type and direction gets detailed and consistent prompts',()=>{
  for(const type of assetTypes){
    const prompt=buildPrompt(opts({type}));
    assert.match(prompt,/CITY OF GOD/);
    assert.match(prompt,/orthographic/i);
    assert.match(prompt,/Full silhouette visible/i);
    assert.match(prompt,/NOT voxel blocks/i);
  }
  for(const direction of directions) assert.ok(buildPrompt(opts({direction})).length>500);
});
test('Car prompt checks wheel depth, fender occlusion and distinctive shape',()=>{
  const p=buildPrompt(opts({details:'carro roxo, asa traseira branca'}));
  assert.match(p,/visible wheel depth and tread/);
  assert.match(p,/fender occlusion/);
  assert.match(p,/carro roxo, asa traseira branca/);
});
test('Chroma key background is generated only when requested',()=>{
  assert.doesNotMatch(buildPrompt(opts()),/chroma key green/);
  assert.match(buildPrompt(opts({cutout:true})),/#00FF00/);
});
test('Slug prevents path traversal',()=>{
  assert.equal(slug('../../My Sports Car!'),'my-sports-car');
  assert.equal(slug('  Éclipse azul  '),'eclipse-azul');
});
test('Reject invalid model, size, direction, type and overlong descriptions',()=>{
  for(const config of [
    {model:'hack-model'}, {size:'8K'}, {ratio:'19:31'},
    {direction:'diagonal'}, {type:'other'}, {name:''},
    {details:'x'.repeat(1801)}
  ]) assert.throws(()=>validate(opts(config)));
});
test('Reject untrusted references and nonexistent image',async()=>{
  await assert.rejects(()=>loadReference('../.git/config'),/assets\/references/);
  await assert.rejects(()=>loadReference('README.md'),/assets\/references/);
  await assert.rejects(()=>loadReference('assets/references/../../README.md'),/fora da pasta/);
  await assert.rejects(()=>loadReference('assets/references/no-such.png'),/ENOENT/);
});
test('Dry run does not need secret or call Gemini',()=>{
  const env={...process.env,GEMINI_API_KEY:'',DRY_RUN:'true',
    ASSET_TYPE:'car',ASSET_NAME:'dry-run-ci-check'};
  const result=spawnSync(process.execPath,['generate-assets.mjs'],{
    cwd:dir,env,encoding:'utf8',timeout:12000
  });
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/DRY RUN/);
  const manifestPath=path.resolve(dir,'../../assets/generated/car/dry-run-ci-check-'+
    (process.env.GITHUB_RUN_ID||'local')+'/manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  assert.equal(manifest.status,'dry-run');
  assert.ok(!fs.existsSync(path.join(path.dirname(manifestPath),'asset.png')));
});
test('Live generation refuses missing secret before a paid API call',()=>{
  const result=spawnSync(process.execPath,[
    'generate-assets.mjs','--name','no-key-test'
  ],{cwd:dir,env:{...process.env,GEMINI_API_KEY:'',DRY_RUN:'false'},
    encoding:'utf8',timeout:12000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/GEMINI_API_KEY nao esta definida/);
});

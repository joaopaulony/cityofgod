#!/usr/bin/env node
// Automated City Home judge. It measures code and behavioral regressions,
// not subjective photorealism or FPS (which need an actual browser review).
'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const src={nav:read('js/city-home-nav.js'),routine:read('js/city-home-routine.js'),
 kitchen:read('js/city-home-kitchen.js'),visitors:read('js/city-home-visitors.js'),
 ui:read('js/city-home-ui.js'),plusUI:read('js/city-home-plus-ui.js'),
 plus:read('js/city-home-plus.js'),core:read('js/city-home.js'),
 props:read('js/props-3d.mjs'),arch:read('js/architecture-3d.mjs'),
 game:read('js/game.js'),html:read('index.html')};
const has=(name,pattern)=>pattern.test(src[name]);
const rubric=[
 ['Navegação e colisões',[
  has('nav',/function route\(/),has('nav',/function crossing\(/),has('nav',/function doorway\(/),
  has('nav',/furnitureBlocked/),has('nav',/ACTOR_RADIUS/),has('nav',/heur=/),
  has('nav',/nx\*ny>14000/),has('nav',/function approach/),has('nav',/No corner-cutting/),
  has('nav',/kind==='door'/)]],
 ['Movimentos e atividades',[
  has('routine',/function start/),has('routine',/function tick/),
  has('routine',/function cancel/),has('routine',/manual\|\|/),
  has('routine',/completeActivity/),has('routine',/replans<2/),
  has('routine',/armed=task\.wasArmed/),has('game',/CityHomeRoutine\?\.tick/),
  has('plus',/window\.CityHomeRoutine/),has('routine',/stage='pose'/)]],
 ['Economia e culinária',[
  has('kitchen',/function bundle/),has('kitchen',/CityLife\.debit/),
  has('kitchen',/function prepare/),has('kitchen',/function cook/),
  has('kitchen',/function eat/),has('kitchen',/localStorage\.setItem/),
  has('kitchen',/portions--/),has('plus',/CityHomeKitchen\.prepare/),
  has('plus',/CityHomeKitchen\?\.cook/),has('plusUI',/pantrybuy/)]],
 ['NPCs e visitas locais',[
  has('visitors',/function invite/),has('visitors',/guests\.includes/),
  has('visitors',/CityHomeNav\.approach/),has('visitors',/phase:'arriving'/),
  has('visitors',/phase='walk'/),has('visitors',/phase='seated'/),
  has('visitors',/function stop/),has('visitors',/active\.delete/),
  has('game',/CityHomeVisitors\?\.tick/),has('plusUI',/npcvisit/)]],
 ['Materiais e miniaturas (técnico)',[
  has('props',/MeshStandardMaterial/),has('props',/matHomeFabric/),
  has('props',/matHomeWood/),has('props',/matHomeCeramic/),
  has('props',/matHomeSteel/),has('props',/normalMap:wovenNormal/),
  has('props',/vertexColors:true/),has('props',/InstancedMesh/),
  has('props',/MeshLambertMaterial/),has('props',/thumbnail\(name,color\)/)]],
 ['Editor e imóveis',[
  has('core',/function snap\(/),has('core',/function restoreDesign/),
  has('core',/function mountOn/),has('ui',/data-home-action="duplicate"/),
  has('ui',/CityHome\.buy\(H,item\.kind,item\.top\)/),
  has('plus',/function listing\(/),has('plus',/status:'draft'/),
  has('plusUI',/city-home-listing-price/),has('plusUI',/applyplan/),
  has('plus',/function capture\(/)]],
 ['Permissões e persistência',[
  has('core',/CityRealty\.isOwned/),has('kitchen',/CityHome\.owned\(H\)/),
  has('plus',/function withdrawListing/),has('plus',/localStorage\.setItem/),
  has('visitors',/CityHome\?\.owned/),has('plusUI',/não transferem propriedade/),
  has('core',/cityofgod\.home-furniture/),has('kitchen',/cityofgod\.home-pantry/),
  has('plus',/cityofgod\.home-plus/),has('core',/undoLog\.delete/)]],
 ['Desempenho e integração',[
  has('props',/wovenData=new Uint8Array\(48\*48\*4\)/),
  has('props',/photoCache\.size>72/),has('arch',/slice\(0,2\)/),
  has('nav',/nx\*ny>14000/),has('routine',/t\.replans<2/),
  has('core',/MAX=220/),has('game',/manualHomeInput/),
  has('html',/src="js\/city-home-nav\.js"/),
  has('html',/src="js\/city-home-kitchen\.js"/),
  has('html',/src="js\/city-home-visitors\.js"/)]]
];
const suites=['tests/city-home-journey.test.cjs','tests/city-home-plus.test.cjs',
 'tests/city-home.test.cjs','tests/city-home-polish.test.cjs'];
const regress=cp.spawnSync(process.execPath,['--test',...suites],{encoding:'utf8',timeout:90000,
 maxBuffer:4*1024*1024});
const output=(regress.stdout||'')+'\n'+(regress.stderr||'');
const failed=regress.status!==0||/# fail [1-9]/.test(output);
const scoreLines=[];
let rejected=false;
console.log('\nCITY HOME — JUIZ TÉCNICO AUTOMATIZADO\n');
for(const [area,probes] of rubric){
 const pass=probes.filter(Boolean).length,score=+((10*pass/probes.length)).toFixed(1);
 scoreLines.push({area,score,passed:pass,total:probes.length});
 if(score<=8){rejected=true;console.error('REPROVADO',area,score+'/10',pass+'/'+probes.length);}
 else console.log('APROVADO ',area,score+'/10',pass+'/'+probes.length);
}
const run=output.match(/# tests (\d+)/),passes=output.match(/# pass (\d+)/),fails=output.match(/# fail (\d+)/);
console.log('\nRegressões: '+(run?.[1]||'?')+' casos, '+(passes?.[1]||'?')+' aprovados, '+(fails?.[1]||'?')+' falhas.');
if(failed){rejected=true;console.error(output.slice(-12000));}
const report={passed:!rejected,threshold:'strictly greater than 8.0',regressions:{
 cases:Number(run?.[1]||0),passed:Number(passes?.[1]||0),failed:Number(fails?.[1]||0)},grades:scoreLines,
 limitations:'Static/behavioral technical audit only; browser screenshots and empirical FPS not graded.'};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/city-home-judge.json',JSON.stringify(report,null,2));
console.log('\n'+(rejected?'JULGADOR: REPROVADO':'JULGADOR: APROVADO')+
 ' (avaliação técnica; realismo visual e FPS precisam de inspeção separada)\n');
if(rejected)process.exitCode=1;

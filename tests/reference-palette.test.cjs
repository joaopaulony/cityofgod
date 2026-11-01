'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context=vm.createContext({});
vm.runInContext(read('js/visual-palette.js'),context);
const pal=vm.runInContext('VISUAL_REFERENCE',context);
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lum=h=>rgb(h).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
function allHex(obj){
 if(typeof obj==='string')return /^#[0-9a-f]{6}$/i.test(obj);
 if(Array.isArray(obj))return obj.every(allHex);
 if(obj&&typeof obj==='object')return Object.values(obj).every(allHex);
 return false;
}
test('reference has exact authorized daylight anchors and revision ID',()=>{
 assert.equal(pal.id,'cityofgod-illustrated-daylight-v1');
 assert.equal(pal.anchors.asphalt,'#393536');
 assert.equal(pal.anchors.sidewalk,'#c5b6a5');
 assert.equal(pal.anchors.leafSun,'#a3bc65');
 assert.equal(pal.anchors.warmWall,'#dcc3a9');
 assert.ok(allHex(pal.anchors));assert.ok(allHex(pal.terrain));
 assert.ok(allHex(pal.canopy));assert.ok(allHex(pal.needles));
});
test('asphalt dark and sidewalk light, green shadow to sun transitions',()=>{
 assert.ok(lum(pal.terrain.walk)-lum(pal.terrain.asph)>60);
 assert.ok(lum(pal.terrain.lush)>lum(pal.terrain.moss));
 assert.ok(pal.canopy.every(p=>
  Object.keys(p).length===6&&lum(p.deep)<lum(p.shade)&&
  lum(p.shade)<lum(p.body)&&lum(p.body)<lum(p.mid)&&
  lum(p.mid)<lum(p.sun)&&lum(p.sun)<lum(p.glint)));
 for(const p of pal.canopy){
  for(const h of [p.body,p.mid,p.sun]){
   const [r,g,b]=rgb(h);
   assert.ok(g>r&&g>b,'foliage must remain green '+h);
  }
 }
 assert.ok(lum(pal.anchors.terracotta)<lum(pal.anchors.warmWall));
});
test('terrain, foliage and building colors consume same central palette',()=>{
 const terrain=read('js/terrain.js'),world=read('js/world.js'),
  archi=read('js/archi.js'),core=read('js/core.js');
 assert.match(terrain,/Object\.entries\(VISUAL_REFERENCE\.terrain\)/);
 assert.match(world,/LEAF_PALETTES = VISUAL_REFERENCE\.canopy/);
 assert.match(world,/NEEDLE_PALETTES = VISUAL_REFERENCE\.needles/);
 assert.match(archi,/PLASTERS = VISUAL_REFERENCE\.architecture\.plasters/);
 assert.match(archi,/ROOF_MATS = VISUAL_REFERENCE\.architecture\.roofs/);
 assert.match(core,/INK = VISUAL_REFERENCE\.anchors\.outline/);
});
test('saturation and contrast only, alpha WebGL compositing unaffected',()=>{
 const html=read('index.html');
 const glb=read('js/vehicle-webgl.mjs');
 assert.match(html,/src="js\/visual-palette\.js"/);
 assert.ok(html.indexOf('visual-palette.js')<html.indexOf('js/core.js'));
 assert.match(html,/#view[\s\S]{0,130}filter: saturate\(1\.12\) contrast\(1\.075\)/);
 assert.match(html,/#vehicle3d[^\n]*filter: saturate\(1\.085\) contrast\(1\.045\)/);
 assert.match(glb,/WebGLRenderer\(\{canvas,alpha:true/);
 assert.match(glb,/new THREE\.DirectionalLight\(0xffe0b7,2\.7\)/);
 assert.doesNotMatch(glb,/toDataURL|toBlob/);
});
test('visual quality judge has required reference and actual browser checks',()=>{
 const judge=read('tests/visual-quality-judge.cjs');
 const browser=read('tests/vegetation-browser.cjs');
 assert.match(judge,/Paleta oficial de cores da referencia visual/);
 for(const term of ['paletteTerrainMatch','paletteFoliageMatch',
  'paletteArchitectureMatch','grade2D','grade3D','referencePaletteValid']){
  assert.ok(judge.includes(term),term);
  assert.ok(browser.includes(term),term);
 }
 assert.match(browser,/VISUAL_REFERENCE/);
 assert.match(browser,/getComputedStyle\(document\.querySelector\('#vehicle3d'\)\)/);
});

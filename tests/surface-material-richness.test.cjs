const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/surface-detail.js','utf8');
const textures=fs.readFileSync('js/textures.js','utf8');
const gpu=fs.readFileSync('js/ground-gpu.js','utf8');
const arch=fs.readFileSync('js/architecture-materials.mjs','utf8');
const world=fs.readFileSync('js/terrain.js','utf8');

function init(){
 const calls={draw:0,fill:0,stroke:0};
 const context=()=>({drawImage:()=>calls.draw++,fillRect:()=>calls.fill++,
    fill:()=>calls.fill++,stroke:()=>calls.stroke++,beginPath:()=>{},closePath:()=>{},save:()=>{},restore:()=>{},
    moveTo:()=>{},lineTo:()=>{},ellipse:()=>{},arc:()=>{},
    set globalAlpha(v){},set strokeStyle(v){},set lineWidth(v){},set lineCap(v){},set lineJoin(v){},set fillStyle(v){},
    getImageData:(x,y,w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=128;data[i+1]=128;data[i+2]=255;data[i+3]=255;}return {data}},
    putImageData:()=>{}});
 const document={createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext:()=>context()};}};
 const root={document};root.window=root;root.globalThis=root;
 vm.runInNewContext(source,root);
 return {detail:root.CitySurfaceDetails,calls};
}
test('14 existing material families with at least 140 designed realistic surface features',()=>{
 const {detail}=init(),entries=Object.entries(detail.recipes);
 assert.equal(entries.length,14);
 assert.equal(entries.reduce((sum,[,names])=>sum+names.length,0),168);
 for(const [,names] of entries)assert.equal(new Set(names).size,12);
});
test('all color surfaces receive baked marks with no additional scene objects or textures',()=>{
 const {detail,calls}=init();
 for(const name of Object.keys(detail.recipes)){
  const o=detail.enrich({width:64,height:64},name,'color');
  assert.equal(o.width,64);assert.equal(o.height,64);
 }
 assert.ok(detail.stats.stamps>1000,detail.stats.stamps);
 assert.equal(detail.stats.materialEffects,168);
 assert.equal(detail.stats.materials.length,14);
 assert.ok(calls.draw>=14&&calls.stroke+calls.fill>500);
});
test('existing normal maps receive numeric relief without adding new map files',()=>{
 const {detail}=init();
 for(const name of ['plaster','stone','concrete','tile','wood','roof']){
  assert.ok(detail.enrich({width:64,height:64},name,'normal'));
 }
 assert.equal(detail.stats.processed,6);
});
test('all three ground paths reuse enriched pixels even with Urban Ink active',()=>{
 assert.match(textures,/CitySurfaceDetails\?\.enrich/);
 assert.match(world,/const tex = typeof GTEX !== 'undefined' && GTEX\.ready/);
 assert.match(gpu,/wantTextures\(\);\s*ready = true/);
 assert.match(gpu,/const enriched=window\.CitySurfaceDetails\?\.enrich/);
 assert.match(arch,/CitySurfaceDetails\?\.enrich/);
});
test('all changes modify existing material maps, without additional meshes or render passes',()=>{
 assert.doesNotMatch(source,/new THREE\.|renderer\.render\(|scene\.add\(/);
 assert.match(arch,/image\.image=enriched;image\.needsUpdate=true/);
 assert.match(gpu,/gl\.texImage2D\(gl\.TEXTURE_2D, 0, gl\.RGBA, gl\.RGBA, gl\.UNSIGNED_BYTE, enriched\)/);
 assert.match(world,/Math\.imul\(Xp\|0,73856093\)/);
});

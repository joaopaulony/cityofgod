const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const webgl=fs.readFileSync('js/vehicle-webgl.mjs','utf8');
const ink=fs.readFileSync('js/urban-ink.mjs','utf8');
const world=fs.readFileSync('js/game.js','utf8');

test('WebGL enables hardware MSAA for player and NPC meshes',()=>{
 assert.match(webgl,/WebGLRenderer\(\{canvas,alpha:true,antialias:true/);
 assert.match(ink,/samples: 4/);
 assert.match(ink,/samples = renderer\.capabilities\.isWebGL2 \? q\.msaa : 0/);
});
test('balanced mode preserves more silhouette detail without using extra scene passes',()=>{
 assert.match(webgl,/balanced:\{ratio:1\.1,shadow:2048,min:\.68,max:1\.14\}/);
 assert.match(webgl,/high:\{ratio:1\.5,shadow:4096,min:1,max:1\.1\}/);
 assert.match(webgl,/const ratio=Math\.max\(\.5,Math\.min\(2,q\.ratio\*dyn\.scale\)\)/);
 assert.match(webgl,/if\(!urbanInk\?\.render\(\)\)renderer\.render\(scene,viewCamera\)/);
});
test('adaptive AA reduces 3D sampling during GPU pressure and restores it with FPS headroom',()=>{
 assert.match(webgl,/dyn\.ema>20&&cpu<dyn\.ema\*\.6/);
 assert.match(webgl,/dyn\.scale=Math\.max\(q\.min/);
 assert.match(webgl,/dyn\.scale=Math\.min\(q\.max/);
 assert.match(webgl,/dyn\.fast>3200/);
});
test('Urban Ink does not erase MSAA alpha coverage at character contours',()=>{
 assert.match(ink,/float silhouetteCoverage/);
 assert.match(ink,/resolvedCoverage/);
 assert.match(ink,/cC == 2\.0 \? resolvedCoverage : 1\.0/);
 assert.match(ink,/u\.uAA\.value = q\.msaa > 0 \? 1 : 0/);
});
test('Canvas world image interpolation stays enabled after ground drawing',()=>{
 assert.match(world,/g\.imageSmoothingEnabled = true/);
 assert.match(world,/drawGround\(g,W,H\);[\s\S]{0,230}g\.imageSmoothingEnabled=true/);
});

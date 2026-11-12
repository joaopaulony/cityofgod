const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=fs.readFileSync('js/core.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const webgl=fs.readFileSync('js/vehicle-webgl.mjs','utf8');
const motion=fs.readFileSync('js/camera-motion.js','utf8');
const editor=fs.readFileSync('js/city-home-ui.js','utf8');
const front=fs.readFileSync('js/front-end.js','utf8');

function camera(){
 const def=core.slice(core.indexOf('const CAMERA_ELEVATION_MIN'),core.indexOf('// mundo -> tela.'));
 const ctx={Math,VISUAL_REFERENCE:{anchors:{outline:'#222'}}};return vm.runInNewContext(def+';({cam,TILT_MIN,TILT_MAX,CAMERA_DEFAULT_TILT,CAMERA_ELEVATION_MIN,CAMERA_ELEVATION_MAX})',ctx);
}
test('Zomboid-style elevation is constrained to 28–60° with a 35° default',()=>{
 const c=camera();
 assert.equal(c.CAMERA_ELEVATION_MIN,28);
 assert.equal(c.CAMERA_ELEVATION_MAX,60);
 assert.ok(Math.abs(Math.asin(c.TILT_MIN)*180/Math.PI-28)<1e-9);
 assert.ok(Math.abs(Math.asin(c.TILT_MAX)*180/Math.PI-60)<1e-9);
 assert.ok(Math.abs(Math.asin(c.cam.tilt)*180/Math.PI-35)<1e-9);
});
test('unrestricted yaw and pitch limits remain stable after repeated updates',()=>{
 const c=camera(),cam=c.cam;
 cam.ttilt=-3;cam.tang=34*Math.PI;cam.ang=34*Math.PI;
 cam.update(1/60);assert.ok(cam.ttilt>=c.TILT_MIN&&cam.ttilt<=c.TILT_MAX);
 assert.ok(Math.abs(cam.tang)<16*Math.PI);
 cam.ttilt=99;for(let i=0;i<150;i++)cam.update(1/60);
 assert.ok(Math.abs(cam.tilt-c.TILT_MAX)<0.001);
 assert.ok(Math.abs(cam.ang-cam.tang)<.01);
});
test('mouse rotation is continuous and cannot leak into shooting, menus or maps',()=>{
 assert.match(game,/cam\.tang \+= dx\*\.007/);
 assert.match(game,/CAMERA_ELEVATION_MIN,CAMERA_ELEVATION_MAX/);
 assert.match(game,/orbitLocked\(\)/);
 assert.match(game,/e\.button===1 \|\| \(e\.button===2&&e\.altKey/);
 assert.match(game,/if\(e\.button===orbitButton\) stopOrbit/);
 assert.match(game,/addEventListener\('blur', stopOrbit\)/);
 assert.match(game,/if\(wmap\.open\)/);
});
test('middle mouse works in F7 without hijacking right-mouse furniture pan',()=>{
 assert.match(game,/e\.altKey&&!window\.CityHomeUI\?\.active/);
 assert.match(editor,/if\(e\.button===2\)\{pan=/);
 assert.doesNotMatch(game,/\|\| !!window\.CityHomeUI\?\.active \|\| !!window\.CityRealty/);
});
test('2D and WebGL use the interpolated pitch on the same frame',()=>{
 assert.match(webgl,/Math\.asin\(Math\.max\(\.01,Math\.min\(\.99,c\.tilt\)\)\)/);
 assert.doesNotMatch(webgl,/Math\.asin\(c\.ttilt/);
 assert.match(core,/TILT = this\.tilt; HZ = Math\.sqrt\(1 - TILT \* TILT\)/);
});
test('manual orbit overrides auto-follow briefly and provides keyboard recovery',()=>{
 assert.match(motion,/function pauseManual\(seconds=6\)/);
 assert.match(motion,/shake, pauseManual, moveDir/);
 assert.match(game,/input\.hit\('home'\)/);
 assert.match(game,/cam\.ttilt=CAMERA_DEFAULT_TILT/);
 assert.match(front,/Segurar botão do meio \+ arrastar/);
 assert.match(front,/Inclinar câmera \(28°–60°\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {projectMediaFace,MEDIA_SCREEN_FACES} from '../js/media-screen-projection.mjs';
const camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,120);
camera.position.set(0,3,18);camera.lookAt(0,.6,0);camera.updateMatrixWorld();
const viewport={left:15,top:25,width:1200,height:800};
test('TV surface is projected from exact geometry in THREE orthographic camera',()=>{
 const matrix=new THREE.Matrix4().identity();
 const p=projectMediaFace(THREE,'tv',matrix,camera,viewport);
 assert.ok(p);assert.ok(p.width>80&&p.height>40&&p.area>5000);
 assert.ok(p.tl.x<p.tr.x);assert.ok(p.tl.y<p.bl.y);
 assert.ok(Math.abs(p.bl.x-p.tl.x)<2);
 const screen=projectMediaFace(THREE,'screen',matrix,camera,viewport);
 assert.ok(screen);assert.ok(screen.tl.y>p.tl.y);
});
test('TV translates and rotates according to the rendered instance, not the 2D game projection',()=>{
 const id=projectMediaFace(THREE,'tv',new THREE.Matrix4().identity(),camera,viewport);
 const moved=projectMediaFace(THREE,'tv',new THREE.Matrix4().makeTranslation(2,0,0),camera,viewport);
 assert.ok(moved.tl.x>id.tl.x+120);
 const ang=new THREE.Matrix4().makeRotationY(.9);
 const rotated=projectMediaFace(THREE,'tv',ang,camera,viewport);
 assert.ok(rotated&&Math.abs(rotated.tr.x-rotated.tl.x)<id.width);
});
test('back face and nearly edge-on camera cannot display floating YouTube overlay',()=>{
 const back=new THREE.Matrix4().makeRotationY(Math.PI);
 assert.equal(projectMediaFace(THREE,'tv',back,camera,viewport),null);
 const side=new THREE.Matrix4().makeRotationY(Math.PI/2);
 assert.equal(projectMediaFace(THREE,'tv',side,camera,viewport),null);
});
test('3D projection respects camera orbit and viewport origin',()=>{
 const angled=new THREE.OrthographicCamera(-6,6,4,-4,.1,120);
 angled.position.set(8,7,12);angled.lookAt(0,.6,0);angled.updateMatrixWorld();
 const p=projectMediaFace(THREE,'tv',new THREE.Matrix4(),angled,viewport);
 assert.ok(p);assert.ok(Math.abs(p.tr.y-p.tl.y)>5);
 const shifted=projectMediaFace(THREE,'tv',new THREE.Matrix4(),angled,{left:105,top:65,width:1200,height:800});
 assert.equal(Math.round(shifted.tl.x-p.tl.x),90);assert.equal(Math.round(shifted.tl.y-p.tl.y),40);
});
test('actual mesh authored TV face bounds stay aligned to original assets',()=>{
 assert.deepEqual(MEDIA_SCREEN_FACES.tv.tl,[-.5,1.18,-.053]);
 assert.deepEqual(MEDIA_SCREEN_FACES.screen.br,[.57,.03,.007]);
});

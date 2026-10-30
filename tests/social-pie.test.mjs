import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOCIAL_TREE,pieOptions,pieLayout,actionUnavailable} from '../js/social-pie-model.mjs';
import {createSocialSim,SOCIAL_ACTIONS} from '../js/social-sim.mjs';
import * as THREE from 'three';
import {pickSocialActor} from '../js/social-picking.mjs';
const roster=[{id:'aiko-sakura',name:'Aiko Sakura',group:'urbano'}];
test('all branches lead to real social actions without cycles',()=>{
 const reached=new Set();function visit(id,path=[]){assert.ok(!path.includes(id),'cycle: '+id);const options=pieOptions(id);assert.ok(options.length>0&&options.length<=8);for(const o of options){if(o.branch)visit(o.id,[...path,id]);else{assert.ok(SOCIAL_ACTIONS[o.id]);reached.add(o.id);}}}visit('root');for(const id of Object.keys(SOCIAL_ACTIONS))assert.ok(reached.has(id),id);
 assert.ok(SOCIAL_TREE.friendly.children.includes('deep'));
});
test('fan pills stay inside viewport at every edge on desktop and mobile',()=>{
 for(const [w,h] of [[1366,900],[934,712],[390,844],[360,640],[700,400]])for(const anchor of [{x:0,y:0},{x:w,y:h},{x:w/2,y:h/2}])for(let n=1;n<=8;n++){
  const layout=pieLayout(w,h,anchor,n);for(const slot of layout.slots){const x=layout.x+slot.x,y=layout.y+slot.y;assert.ok(x-layout.buttonWidth/2>=0,`${w} left`);assert.ok(x+layout.buttonWidth/2<=w,`${w} right`);assert.ok(y-22>=0,`${h} top`);assert.ok(y+22<=h,`${h} bottom`);}
 }
});
test('contextual locks explain range, weapon, cooldown and relationship status',()=>{
 const s=createSocialSim(roster);assert.match(actionUnavailable(s,'aiko-sakura','chat',{inRange:false}),/Aproxime/);assert.match(actionUnavailable(s,'aiko-sakura','chat',{blocked:true}),/arma/);assert.match(actionUnavailable(s,'aiko-sakura','breakup'),/não estão/);assert.match(actionUnavailable(s,'aiko-sakura','apologize'),/ofensa/);s.interact('player','aiko-sakura','greet');assert.match(actionUnavailable(s,'aiko-sakura','chat'),/Aguarde/);
});
test('story and faction leaves return character-specific dialogue and save a memory',()=>{
 const s=createSocialSim(roster);Object.assign(s.relation('player','aiko-sakura'),{friend:30,trust:20,intimacy:10});const r=s.interact('player','aiko-sakura','story');assert.ok(r.text.includes('jardim'));assert.equal(s.relation('player','aiko-sakura').memories[0].action,'story');
});
test('3D picking selects nearest body, ignores bubbles, removed actors and empty ground',()=>{
 const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,0,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const actors=[{lookId:'front'},{lookId:'back'}],entries=new Map();
 for(const [i,a] of actors.entries()){const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,.5),new THREE.MeshBasicMaterial());root.add(mesh);root.position.z=-i*2;root.updateMatrixWorld(true);entries.set(a,{root});}
 const rect={left:0,top:0,width:500,height:500},ray=new THREE.Raycaster();
 assert.equal(pickSocialActor(ray,actors,entries,camera,rect,250,250),actors[0]);
 actors[0].leaving=true;assert.equal(pickSocialActor(ray,actors,entries,camera,rect,250,250),actors[1]);
 assert.equal(pickSocialActor(ray,actors,entries,camera,rect,10,10),null);
 entries.get(actors[1]).root.visible=false;assert.equal(pickSocialActor(ray,actors,entries,camera,rect,250,250),null);
 for(const {root} of entries.values())root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

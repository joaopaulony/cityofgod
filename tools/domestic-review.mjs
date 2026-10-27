import * as THREE from 'three';
import {createCharacterSystem} from '../js/character-webgl.mjs';
import {createProps} from '../js/props-3d.mjs';
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9edf0');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.01,100);
scene.add(new THREE.HemisphereLight(0xffffff,0x8b929c,2.3));
const light=new THREE.DirectionalLight(0xfff4e6,3);light.position.set(2,5,4);light.castShadow=true;scene.add(light);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({color:0xd2d9d8,roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const player=makeActor({name:'Jogador',x:0,y:.8,face:-Math.PI/2,armed:false,clock:1});
const house={inside:true,x0:-4,x1:4,y0:-4,y1:4,seed:1,architecture:{}};
const bridge={player,actors:[player],cam:{x:0,y:0,W:1000,H:760,zoom:80,tilt:.5},houses:[house],boxes:[],world:{version:1,segs:[],circles:[]},mapSize:100,roads:[],props3d:()=>true,driving:()=>false,hit:()=>false,pondVal:()=>2,onRoad:()=>true,collide:(x,y)=>[x,y]};
const characters=createCharacterSystem(scene,bridge),props=createProps(THREE,scene,bridge);
const info={sit:['Sentar','chair',.5,.55,.85],sleep:['Deitar','bed',1.6,2.1,.55],drink:['Beber água','sink',.72,.6,.9],cook:['Cozinhar','stove',.76,.65,.94],fridge:['Abrir geladeira','fridge',.85,.82,1.75]};
window.reviewPose=(kind='sit',t=1.5,angle='front')=>{
 const [title,itemKind,w,d,h]=info[kind];
 bridge.boxes=[{kind:itemKind,x:0,y:0,z:0,w,d,h,rot:0,homeManaged:true,homeId:'review',house,top:'#8297a7'}];bridge.world.version++;
 const seated=kind==='sit',sleep=kind==='sleep';
 Object.assign(player,{x:0,y:seated||sleep?0:d/2+(kind==='cook'?.30:.42),face:sleep?Math.PI/2:-Math.PI/2,walkW:0,runW:0,speed:0,phase:0,
 homeAction:{kind,t,duration:6,managed:true,surface:sleep?h*1.05:h*.55,itemId:'review',item:bridge.boxes[0],house}});
 if(kind==='fridge'){
   const u=Math.max(0,Math.min(1,(t-.35)/.7,(6-t-.35)/.7)),w=u*u*(3-2*u);player.x=.15-.5*w;player.y-=.11;player.y+=.34*w;
 }
 player.pose=animate(player,0);player.J=solveSkeleton(player,player.pose);
 characters.update(0);props.update(performance.now(),1);
 const target=new THREE.Vector3(0,.85,0),pos=angle==='side'?[4,2.2,1.6]:[-3,2.2,3.5];
 if(sleep){target.y=.45;pos[0]*=1.15;pos[2]*=1.15;}
 camera.position.set(...pos);camera.lookAt(target);renderer.render(scene,camera);
 document.querySelector('#title').textContent=title+' · '+(angle==='side'?'vista lateral':'outro ângulo');
 document.querySelector('#status').textContent=`${kind} · ${t.toFixed(2)} s · ${characters.provider}`;
 return {kind,joints:player.J,hands:player.domesticHands,errors:characters.errors};
};
function ready(){if(!characters.ready){requestAnimationFrame(ready);return;}window.reviewPose();window.reviewReady=true;}
ready();

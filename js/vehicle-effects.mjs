export function createVehicleEffects(THREE,scene){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const g=canvas.getContext('2d'),grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(220,220,215,.8)');grad.addColorStop(1,'rgba(220,220,215,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(canvas),particles=Array.from({length:64},()=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));m.visible=false;scene.add(m);return{mesh:m,life:0};});
 const marks=Array.from({length:160},()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(.18,.55),new THREE.MeshBasicMaterial({color:0x252525,transparent:true,opacity:.5,depthWrite:false}));m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);return{mesh:m,life:0};});
 let pi=0,mi=0,clock=0;
 return{update(dt,car,driving,length=4.7){
  for(const p of particles)if(p.life>0){p.life-=dt;p.mesh.visible=p.life>0;p.mesh.position.y+=dt*.6;p.mesh.scale.addScalar(dt*.85);p.mesh.material.opacity=Math.max(0,p.life/1.6)*.5;}
  for(const m of marks)if(m.life>0){m.life-=dt;m.mesh.visible=m.life>0;m.mesh.material.opacity=Math.min(.45,m.life/10);}
  clock+=dt;if(!driving||!car.drifting||clock<.06)return;clock=0;
  for(const side of [-1,1]){const ca=Math.cos(car.angle),sa=Math.sin(car.angle),x=car.x-ca*length*.3-sa*side*.7,z=car.y-sa*length*.3+ca*side*.7;
   const p=particles[pi++%particles.length];p.life=1.6;p.mesh.visible=true;p.mesh.position.set(x,.2,z);p.mesh.scale.setScalar(.45);
   const m=marks[mi++%marks.length];m.life=22;m.mesh.visible=true;m.mesh.position.set(x,.035,z);m.mesh.rotation.z=-car.angle-Math.PI/2;
  }
 }};
}

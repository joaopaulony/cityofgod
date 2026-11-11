// Low-cost animated 3D displays placed directly on television/monitor meshes.
export function createHomeDisplays(THREE,scene,bridge){
 const c=document.createElement('canvas');c.width=256;c.height=144;
 const g=c.getContext('2d'),tex=new THREE.CanvasTexture(c);
 tex.colorSpace=THREE.SRGBColorSpace;
 const geom=new THREE.PlaneGeometry(1,1);
 const screens=Array.from({length:10},()=>{
   const m=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({
      map:tex,toneMapped:false,side:THREE.DoubleSide,depthWrite:false,transparent:false
   }));
   m.visible=false;m.renderOrder=11;m.frustumCulled=false;scene.add(m);return m;
 });
 const up=new THREE.Vector3(0,1,0),state={active:true,visible:0,frames:0};
 let last=-1;
 function paint(seconds){
   g.fillStyle='#07152b';g.fillRect(0,0,256,144);
   const gradient=g.createLinearGradient(0,0,256,144);
   gradient.addColorStop(0,'#124e70');gradient.addColorStop(1,'#061426');
   g.fillStyle=gradient;g.fillRect(4,4,248,136);
   const t=seconds*.85,x=126+Math.sin(t)*55;
   g.fillStyle='#efb15a';g.beginPath();g.arc(x,55,25,0,Math.PI*2);g.fill();
   for(let i=0;i<5;i++){
     const by=68+i*11;
     g.fillStyle=i%2?'#1797bc':'#18466a';
     g.fillRect(4+(i*26+seconds*21)%130,by,165,13);
   }
   g.fillStyle='#03182a';g.fillRect(4,108,248,31);
   g.fillStyle='#cbeef6';g.font='bold 15px system-ui';
   g.fillText('CITY LIVE',12,127);
   g.fillStyle='#f4c76f';g.fillRect(150,113,87,4);
   g.fillStyle='#6acddd';g.fillRect(150,122,Math.max(8,30+26*Math.sin(t*1.7)),4);
   tex.needsUpdate=true;state.frames++;
 }
 function update(seconds){
   if(seconds-last>=.09||last<0){paint(seconds);last=seconds;}
   let i=0;const p=bridge.player;
   for(const H of bridge.houses||[]){
     if(!H.inside||!H.contains?.(p.x,p.y,p.floor||0))continue;
     if(window.CityHomePlus&&window.CityHome?.owned(H)&&!CityHomePlus.powerOn(H))continue;
     for(const b of H.interactables||[]){
       if(i>=screens.length)break;
       if(!b.screenOn||!['tv','screen'].includes(b.kind)||(b.floor||0)!==(p.floor||0))continue;
       if(Math.hypot(b.x-p.x,b.y-p.y)>20)continue;
       const face=Array.isArray(b.faceW)?b.faceW:null;
       const angle=face?Math.atan2(face[0],face[1]):-(b.rot||0);
       const dirX=Math.sin(angle),dirZ=Math.cos(angle);
       const width=Math.max(.42,Math.min(2.4,(b.along||b.w||1.1)*.82));
       const height=Math.max(.24,Math.min(1.05,(b.h||.7)*(b.kind==='tv'?.31:.76)));
       const y=(b.z||0)+(b.h||.7)*(b.kind==='tv'?.77:.55);
       const m=screens[i++];
       m.visible=true;m.position.set(b.x+dirX*.035,y,b.y+dirZ*.035);
       m.quaternion.setFromAxisAngle(up,angle);
       m.scale.set(width,height,1);
     }
   }
   for(;i<screens.length;i++)screens[i].visible=false;
   state.visible=screens.filter(m=>m.visible).length;
 }
 return {state,update};
}

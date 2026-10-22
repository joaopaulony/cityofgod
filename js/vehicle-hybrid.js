'use strict';
// Render hibrido: fisica, luz e colisao procedurais; carroceria rasterizada.
// O manifesto descreve renders 3D feitos com camera fixa em 3/4 (TILT=.5).
// Frame 0 aponta para a direita da tela, com passos horarios subsequentes.
const VEHICLE_HYBRID_MANIFESTS=Object.freeze({
 skyline:'assets/vehicles/skyline-1992/manifest.json'
});
const vehicleHybrid={
 atlases:new Map(),
 states:new Map(),
 preview:false
};

function vehicleHybridFrameIndex(worldAngle,cameraAngle,directions,offset=0){
 const circle=Math.PI*2;
 const value=((worldAngle+cameraAngle+offset)%circle+circle)%circle;
 return Math.floor(value/circle*directions+.5)%directions;
}

function vehicleHybridValidate(config){
 if(!config||!Number.isInteger(config.directions)||
   ![8,16,32].includes(config.directions)||
   !Number.isInteger(config.columns)||config.columns<1||config.columns>16||
   !Number.isInteger(config.frameWidth)||config.frameWidth<64||config.frameWidth>2048||
   !Number.isInteger(config.frameHeight)||config.frameHeight<64||config.frameHeight>2048||
   config.columns*config.rows<config.directions||
   !Number.isInteger(config.rows)||config.rows<1||config.rows>16||
   !Number.isFinite(config.referenceZoom)||config.referenceZoom<=0||
   !config.pivot||!Number.isFinite(config.pivot.x)||
   !Number.isFinite(config.pivot.y)||
   config.pivot.x<0||config.pivot.x>config.frameWidth||
   config.pivot.y<0||config.pivot.y>config.frameHeight){
  throw Error('Invalid vehicle atlas layout');
 }
 if(config.images&&typeof config.images!=='object')
  throw Error('Invalid vehicle sprite layers');
 return config;
}

// Arquivos relativos SOMENTE a pasta do manifesto; sem URLs remotas.
function vehicleHybridLayerURL(manifestPath,filename){
 if(typeof filename!=='string'||
   !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:png|webp)$/.test(filename))
  throw Error('Invalid vehicle sprite filename');
 return manifestPath.slice(0,manifestPath.lastIndexOf('/')+1)+filename;
}

function vehicleHybridOpenImage(src){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(Error('Vehicle sprite unavailable'));
  image.src=src;
 });
}

async function vehicleHybridLoad(model,manifestPath){
 try{
  const response=await fetch(manifestPath,{cache:'no-cache'});
  if(!response.ok)throw Error('Vehicle manifest HTTP '+response.status);
  const config=vehicleHybridValidate(await response.json());
  if(config.model!==model)throw Error('Vehicle atlas model mismatch');
  // Sem PNG de Blender aprovado, usar sempre a arte procedural.
  if(config.enabled!==true){
   vehicleHybrid.atlases.delete(model);
   vehicleHybrid.states.set(model,'procedural-fallback');
   return false;
  }
  if(!config.images||!config.images.body)throw Error('Vehicle body layer missing');
  const keys=['body','shadow','headlights','brakes','left','right'];
  const imageEntries=await Promise.all(keys.map(async key=>{
   if(!config.images[key])return [key,null];
   try{
    const img=await vehicleHybridOpenImage(vehicleHybridLayerURL(
      manifestPath,config.images[key]));
    if(img.naturalWidth<config.columns*config.frameWidth||
       img.naturalHeight<config.rows*config.frameHeight)
     throw Error('Atlas '+key+' has incomplete frames');
    return [key,img];
   }catch(error){
    if(key==='body')throw error;
    console.warn('Optional vehicle layer skipped:',key,error.message);
    return [key,null];
   }
  }));
  vehicleHybrid.atlases.set(model,{
   config,images:Object.fromEntries(imageEntries),bakedShadow:false
  });
  vehicleHybrid.states.set(model,'spritesheet-ready');
  return true;
 }catch(error){
  vehicleHybrid.atlases.delete(model);
  vehicleHybrid.states.set(model,'procedural-fallback');
  console.warn('Hybrid car renderer fallback for '+model+':',error.message);
  return false;
 }
}

function vehicleHybridLayer(g,atlas,name,frame,p,scale){
 const image=atlas.images[name];if(!image)return false;
 const spec=atlas.config,sw=spec.frameWidth,sh=spec.frameHeight;
 const sourceX=frame%spec.columns*sw,
  sourceY=Math.floor(frame/spec.columns)*sh;
 g.drawImage(image,sourceX,sourceY,sw,sh,
   p.x-spec.pivot.x*scale,p.y-spec.pivot.y*scale,
   sw*scale,sh*scale);
 return true;
}

function vehicleHybridShadow(g,b){
 const m=carModel(b),L=m.len/2,w=m.w/2,
  p=carProject(b,0,0,.01),u=carProject(b,L+.30,0,.01),
  v=carProject(b,0,w+.28,.01);
 g.save();
 g.transform(u.x-p.x,u.y-p.y,v.x-p.x,v.y-p.y,p.x,p.y);
 const gradient=g.createRadialGradient(0,0,.1,0,0,1);
 gradient.addColorStop(0,'rgba(8,12,14,.38)');
 gradient.addColorStop(.75,'rgba(8,12,14,.20)');
 gradient.addColorStop(1,'rgba(8,12,14,0)');
 g.fillStyle=gradient;g.beginPath();g.arc(0,0,1,0,Math.PI*2);
 g.fill();g.restore();
}

function vehicleHybridDynamicLamps(g,b,t,layers){
 const m=carModel(b),L=m.len/2,w=m.w/2,
  blink=Math.floor(t*2.8)%2===0;
 for(const side of [-1,1]){
  if(b.headlights&&!layers.headlights)
   carLamp(g,b,L-.05,side*w*.71,m.hood-.20,'front',true);
  if((b.brake||b.headlights)&&!layers.brakes)
   carLamp(g,b,-L+.05,side*w*.71,m.deck-.20,'rear',true);
  const name=side<0?'left':'right';
  if(blink&&(b.hazards||b.indicator===side)&&!layers[name]){
   carLamp(g,b,L-.10,side*w*m.noseW*.57,.71,'turn',true);
   carLamp(g,b,-L+.10,side*w*m.tailW*.58,.77,'turn',true);
  }
 }
}

function vehicleHybridDraw(g,b,t=0){
 const atlas=vehicleHybrid.atlases.get(b.model);
 if(!atlas||!atlas.images.body)return false;
 const spec=atlas.config,p=proj(b.x,b.y,0),
  frame=vehicleHybridFrameIndex(b.rot,cam.ang,
    spec.directions,spec.angleOffset||0),
  scale=cam.zoom/spec.referenceZoom;
 g.save();
 g.imageSmoothingEnabled=true;
 if('imageSmoothingQuality' in g)g.imageSmoothingQuality='high';
 if(!vehicleHybridLayer(g,atlas,'shadow',frame,p,scale)&&!atlas.bakedShadow)
  vehicleHybridShadow(g,b);
 vehicleHybridLayer(g,atlas,'body',frame,p,scale);
 const drawn={};
 if(b.headlights)drawn.headlights=vehicleHybridLayer(
   g,atlas,'headlights',frame,p,scale);
 if(b.brake)drawn.brakes=vehicleHybridLayer(g,atlas,'brakes',frame,p,scale);
 if(Math.floor(t*2.8)%2===0){
  if(b.hazards||b.indicator===-1)
   drawn.left=vehicleHybridLayer(g,atlas,'left',frame,p,scale);
  if(b.hazards||b.indicator===1)
   drawn.right=vehicleHybridLayer(g,atlas,'right',frame,p,scale);
 }
 vehicleHybridDynamicLamps(g,b,t,drawn);
 g.restore();
 return true;
}

// Atlas de teste: 16 vistas rasterizadas UMA VEZ do desenho procedural atual.
// Serve para validar o loader, giros e pivots; NAO e arte 3D do Blender.
function vehicleHybridBuildDemo(model='skyline'){
 const original=vehicleSystem.cars.find(c=>c.model===model);
 if(!original)return false;
 const size=384,cols=4,dirs=16,zoom=76,
  canvas=makeCanvas(cols*size,cols*size),
  g=canvas.getContext('2d'),
  frameCanvas=makeCanvas(size,size),fg=frameCanvas.getContext('2d'),
  saved={x:cam.x,y:cam.y,W:cam.W,H:cam.H,
   zoom:cam.zoom,ang:cam.ang,cos:cam.cos,sin:cam.sin};
 try{
  cam.x=original.x;cam.y=original.y;
  cam.W=cam.H=size;cam.zoom=zoom;cam.ang=0;cam.cos=1;cam.sin=0;
  for(let i=0;i<dirs;i++){
   fg.clearRect(0,0,size,size);
   const snapshot={...original,rot:i*Math.PI*2/dirs,
    speed:0,engine:false,headlights:false,
    brake:false,indicator:0,hazards:false,odometer:0};
   carDraw(fg,snapshot,0,false);
   g.drawImage(frameCanvas,i%cols*size,Math.floor(i/cols)*size);
  }
 }finally{
  Object.assign(cam,saved);
 }
 vehicleHybrid.atlases.set(model,{
  config:{model,directions:dirs,columns:cols,rows:cols,
   frameWidth:size,frameHeight:size,
   pivot:{x:size/2,y:size/2},referenceZoom:zoom},
  images:{body:canvas},bakedShadow:true
 });
 vehicleHybrid.states.set(model,'procedural-preview');
 vehicleHybrid.preview=true;
 return true;
}

function vehicleHybridInit(){
 const mode=new URLSearchParams(location.search).get('hybrid');
 if(mode==='off')return;
 if(mode==='demo'){
  vehicleHybridBuildDemo('skyline');
  return;
 }
 for(const [model,path] of Object.entries(VEHICLE_HYBRID_MANIFESTS))
  vehicleHybridLoad(model,path);
}

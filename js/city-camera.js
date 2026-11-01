// CityCamera: captura o Canvas 2D + WebGL NO quadro renderizado.
// O buffer WebGL só é garantido imediatamente após renderer.render().
'use strict';
const CityCamera=(()=>{
 let preview='',lastCanvas=null,mode='selfie',zoom=2.2,panX=0,panY=0,pending=null,shotAt=0;
 const state=()=>({preview,mode,zoom,panX,panY});
 function configure(next){
   if(next.mode && ['selfie','world'].includes(next.mode))mode=next.mode;
   if(Number.isFinite(next.zoom))zoom=Math.max(1,Math.min(4,next.zoom));
   if(Number.isFinite(next.panX))panX=Math.max(-100,Math.min(100,next.panX));
   if(Number.isFinite(next.panY))panY=Math.max(-100,Math.min(100,next.panY));
 }
 function request(){
   if(pending)return pending.promise;
   let resolve;
   const promise=new Promise(r=>resolve=r);
   pending={resolve,promise};
   return promise;
 }
 function afterRender(view,webgl){
   if(!pending||!view)return;
   const resolve=pending.resolve;pending=null;
   try{
     const portrait=mode==='selfie',w=portrait?720:960,h=portrait?960:540;
     const cv=document.createElement('canvas');cv.width=w;cv.height=h;
     const c=cv.getContext('2d',{alpha:false});c.fillStyle='#111c29';c.fillRect(0,0,w,h);
     const ww=view.width,hh=view.height;
     // Centro baseado na posição real da cabeça / tronco do personagem.
     const pos=typeof proj==='function' && typeof player!=='undefined'
       ?proj(player.x,player.y,portrait?1.1:.4):{x:ww/2,y:hh/2};
     const srcAspect=w/h,renderZoom=portrait?Math.max(1.35,zoom):zoom;
     let sh=Math.min(hh,ww/srcAspect)/renderZoom,sw=sh*srcAspect;
     const x=(portrait?pos.x:ww/2)+panX*.0025*ww;
     const y=(portrait?pos.y:hh/2)+panY*.0025*hh;
     const sx=Math.max(0,Math.min(ww-sw,x-sw/2)),sy=Math.max(0,Math.min(hh-sh,y-sh/2));
     // WebGL usa outro pixel ratio, mas ambas as telas cobrem exatamente o viewport.
     c.drawImage(view,sx,sy,sw,sh,0,0,w,h);
     if(webgl && webgl.width && webgl.height){
       c.drawImage(webgl,sx*webgl.width/ww,sy*webgl.height/hh,
         sw*webgl.width/ww,sh*webgl.height/hh,0,0,w,h);
     }
     c.textAlign='right';c.font='600 15px system-ui';c.strokeStyle='#0009';c.lineWidth=3;
     c.fillStyle='#fff';c.strokeText('CITY OF GOD · '+(portrait?'SELFIE':'FOTO'),w-16,h-20);
     c.fillText('CITY OF GOD · '+(portrait?'SELFIE':'FOTO'),w-16,h-20);
     lastCanvas=cv;shotAt=Date.now();preview=cv.toDataURL('image/jpeg',.83);
     resolve({ok:true,text:'Foto pronta — escolha o enquadramento ou salve'});
   }catch(e){resolve({ok:false,text:'Captura 3D indisponível: '+String(e?.message||e).slice(0,70)});}
 }
 function thumbnail(){
   if(!lastCanvas)return null;
   const cv=document.createElement('canvas');cv.width=320;cv.height=240;
   cv.getContext('2d').drawImage(lastCanvas,0,0,320,240);
   return cv.toDataURL('image/jpeg',.62);
 }
 function download(){
   if(!lastCanvas)return {ok:false,text:'Capture uma foto primeiro'};
   const a=document.createElement('a');a.download='citycam-'+shotAt+'.png';a.href=lastCanvas.toDataURL('image/png');
   document.body.append(a);a.click();a.remove();return {ok:true,text:'Foto exportada'};
 }
 return {configure,request,afterRender,thumbnail,download,state,get photo(){return preview;}};
})();
window.CityCamera=CityCamera;
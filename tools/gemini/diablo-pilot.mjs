#!/usr/bin/env node
// One-time controlled paid render of Diablo pilot. Triggered by a dedicated
// workflow path, NEVER on normal commits, PRs or gameplay. No access in browser.
import fs from 'node:fs/promises';
import path from 'node:path';
import {GoogleGenAI} from '@google/genai';
import sharp from 'sharp';

const root=process.cwd();
const refPath=path.join(root,'assets/generated/car/superesportivo-roxo-39819274197/asset.png');
const out=path.join(root,'assets/vehicles/diablo');
const dirs=['front-left','front','front-right','right','rear-right','rear','rear-left','left'];
const paid=dirs.filter(d=>d!=='front-left');
const orientations={
 front:'front of the car directly facing camera, elevated orthographic view, see grille and windshield',
 'front-right':'front bumper closest to camera at right side, see car right side, elevated 3/4',
 right:'right-side orthographic elevated profile, front of car on right side of image',
 'rear-right':'rear bumper closest to camera at right side, see the right side and rear wing',
 rear:'rear of the car directly facing camera, elevated orthographic view, see engine bay and rear wing',
 'rear-left':'rear bumper closest to camera at left side, see left side of car and wing',
 left:'left-side orthographic elevated profile, front of car on left side of image'
};
async function makeCutout(src,dst){
 const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,C=info.channels;
 // Preserve original transparency and remove ONLY vivid artificial green,
 // as seen in first generated purple hero; no pixel-level detail erosion.
 let oldGreen=0,opaque=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*C,red=data[k],green=data[k+1],blue=data[k+2];
  if(data[k+3]===0)continue;opaque++;
  if(green>35&&green>red*1.55&&green>blue*1.55){
    // Shadows green are NOT part of the game vehicle.
    data[k+3]=0;oldGreen++;
  }
 }
 // If Nano Banana returns an opaque flat background, remove only the
 // contiguous edge-connected backdrop. Never erase similarly colored wheels
 // and dark grilles inside the vehicle silhouette.
 let edgeOpaque=0;
 for(let x=0;x<w;x++){if(data[(x)*C+3]>50)edgeOpaque++;
  if(data[((h-1)*w+x)*C+3]>50)edgeOpaque++;}
 for(let y=0;y<h;y++){if(data[(y*w)*C+3]>50)edgeOpaque++;
  if(data[(y*w+w-1)*C+3]>50)edgeOpaque++;}
 if(edgeOpaque/(2*(w+h))>.20){
  const corner=(x,y)=>{const k=(y*w+x)*C;return [data[k],data[k+1],data[k+2]];};
  const samples=[corner(0,0),corner(w-1,0),corner(0,h-1),corner(w-1,h-1)];
  const avg=[0,1,2].map(i=>Math.round(samples.reduce((sum,c)=>sum+c[i],0)/4));
  const maxCornerDist=Math.max(...samples.map(c=>Math.max(...c.map((v,i)=>Math.abs(v-avg[i])))));
  if(maxCornerDist>42)throw Error('Gemini returned a non-transparent irregular background: manual rework required');
  const queue=new Int32Array(w*h),visited=new Uint8Array(w*h);
  let head=0,tail=0;
  const push=(x,y)=>{
   if(x<0||x>=w||y<0||y>=h)return;
   const loc=y*w+x;if(visited[loc])return;
   const k=loc*C;
   const closeness=Math.max(Math.abs(data[k]-avg[0]),Math.abs(data[k+1]-avg[1]),Math.abs(data[k+2]-avg[2]));
   if(data[k+3]>40&&closeness>40)return;
   visited[loc]=1;queue[tail++]=loc;
  };
  for(let x=0;x<w;x++){push(x,0);push(x,h-1);}
  for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
  while(head<tail){
   const loc=queue[head++],x=loc%w,y=Math.floor(loc/w);
   data[loc*C+3]=0;
   push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);
  }
 }
 let transparentEdge=0;
 for(let x=0;x<w;x++){
  if(data[x*C+3]<50)transparentEdge++;
  if(data[((h-1)*w+x)*C+3]<50)transparentEdge++;
 }
 for(let y=0;y<h;y++){
  if(data[(y*w)*C+3]<50)transparentEdge++;
  if(data[(y*w+w-1)*C+3]<50)transparentEdge++;
 }
 if(transparentEdge/(2*(w+h))<.80)
  throw Error('PNG lacks sufficient transparent edges: rejected before game integration');
 let minX=w,minY=h,maxX=-1,maxY=-1,remaining=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*C;
  if(data[k+3]>10){remaining++;minX=Math.min(minX,x);minY=Math.min(minY,y);
   maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 }
 if(remaining<12000 || minX>=maxX || minY>=maxY){
  throw Error('Image has no useful cutout; stopping to avoid bad game assets');
 }
 if(oldGreen>opaque*.55)throw Error('Image mostly green; likely failed input');
 const margin=16;
 minX=Math.max(0,minX-margin);maxX=Math.min(w-1,maxX+margin);
 minY=Math.max(0,minY-margin);maxY=Math.min(h-1,maxY+margin);
 const crop=await sharp(data,{raw:{width:w,height:h,channels:C}})
  .extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1})
  .png().toBuffer();
 const meta=await sharp(crop).metadata();
 const scale=Math.min(708/meta.width,430/meta.height);
 const resized=await sharp(crop).resize(Math.max(1,Math.round(meta.width*scale)),
   Math.max(1,Math.round(meta.height*scale))).png().toBuffer();
 const outMeta=await sharp(resized).metadata();
 const left=Math.round((768-outMeta.width)/2),
   top=Math.max(0,Math.min(500-outMeta.height,
    Math.round((512-outMeta.height)*.45)));
 const finished=await sharp({create:{width:768,height:512,channels:4,
   background:{r:0,g:0,b:0,alpha:0}}})
   .composite([{input:resized,left,top}]).png().toBuffer();
 await fs.mkdir(path.dirname(dst),{recursive:true});
 await fs.writeFile(dst,finished);
 return {width:768,height:512,subjects:remaining,removedGreen:oldGreen};
}
function promptFor(direction){
 return [
  'Generate exactly ONE faithful alternative camera view of the SAME game car shown in the attached reference image.',
  'It is a clean showroom-condition 1990s Lamborghini Diablo inspired purple supercar with a large rear wing, low wedge-shaped hood, popup light covers, original alloy wheel style, accurate body proportions.',
  'IMPORTANT: EXACT same purple paint, same model, wing, vent arrangement, glass and wheelbase as reference. Do not redesign the vehicle.',
  'Camera rotation ONLY: '+orientations[direction]+'.',
  'Visually consistent isometric 2D 3/4 game sprite, orthographic camera, camera elevation about 35 degrees, realistic game illustration with crisp outlines and subtle shading.',
  'Paint polished, clean and maintained, NO dust, mud, dirt, wear, scratches, rust, decals, typography or watermarks.',
  'Tires physically thick, correctly attached under wheelarches, correct number of visible wheels and coherent occlusion. Doors and hoods CLOSED.',
  'Transparent background. Entire vehicle visible with breathing room; completely remove contact shadows and the green halo. Do not add grass, road, pavement or scenery.',
  'ONE vehicle only; no collage, no multi-view grid, no title, no lettering.'
 ].join('\n');
}
async function main(){
 const requested=process.env.CONFIRM_PAID_DiABLO;
 const key=process.env.GEMINI_API_KEY;
 if(requested!=='diablo-pilot-7-calls-approved' || !key)
  throw Error('Paid pilot explicit confirmation or GEMINI_API_KEY missing');
 const base=await fs.readFile(refPath);
 const ref=base.toString('base64');
 await fs.mkdir(path.join(out,'directions'),{recursive:true});
 const done={};
 const first=await makeCutout(base,path.join(out,'directions/front-left.png'));
 done['front-left']=first;
 const client=new GoogleGenAI({apiKey:key});
 for(const direction of paid){
  const dst=path.join(out,'directions',direction+'.png');
  // No retries: one paid call maximum per direction. Idempotent if file exists.
  try{const file=await fs.stat(dst);if(file.size>15000){
    done[direction]={existing:true};console.log('Existing '+direction);continue;
  }}catch{}
  console.log('Calling Nano Banana for Diablo view '+direction);
  const res=await client.interactions.create({
   model:'gemini-nano-banana-2.1',
   input:[
     {type:'image',mime_type:'image/png',data:ref},
     {type:'text',text:promptFor(direction)}
   ],
   response_format:{type:'image',mime_type:'image/png',aspect_ratio:'1:1',image_size:'1K'}
  });
  const blocks=res.output_image?.data?[res.output_image]:
    (res.steps||[]).flatMap(s=>s.type==='model_output'?s.content||[]:[]);
  const image=blocks.find(b=>b.data &&(!b.type||b.type==='image'));
  if(!image)throw Error('No image was returned for '+direction+'; halting without retry');
  const bytes=Buffer.from(image.data,'base64');
  done[direction]=await makeCutout(bytes,dst);
  console.log('Created '+direction+' bytes '+bytes.length);
 }
 const manifest={
   id:'diablo',name:'Lamborghini Diablo (piloto)',source:'gemini-nano-banana-2.1',
   licenseNote:'Generated by user-authorized paid Google Gemini API. Review recommended.',
   reference:'assets/generated/car/superesportivo-roxo-39819274197/asset.png',
   viewResolution:[768,512],directions:dirs,orientation:'8-way fixed view',
   paintMask:'hue-derived runtime (purple family)',shadowRemoved:true,
   wheels:'procedural rotation overlay',movingParts:'procedural interpolated hinges',
   spriteBase:'assets/vehicles/diablo/directions',createdAt:new Date().toISOString(),
   generated:done
 };
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Diablo pilot successfully generated: '+Object.keys(done).length+' directions.');
}
main().catch(e=>{
 const k=process.env.GEMINI_API_KEY||'';
 console.error('Diablo generation stopped: '+String(e.message||e).replaceAll(k||'\0','[secret]'));
 process.exitCode=1;
});

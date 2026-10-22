#!/usr/bin/env node
// Block misleading "eight directions" where AI simply recycled one diagonal.
import sharp from 'sharp';
import path from 'node:path';
const root=path.join(process.cwd(),'assets/vehicles/diablo/directions');
const dirs=['front-left','front','front-right','right','rear-right','rear','rear-left','left'];
const masks={};
for(const dir of dirs){
 const f=path.join(root,dir+'.png');
 const {data,info}=await sharp(f).resize(96,64).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const a=new Uint8Array(96*64);let count=0;
 for(let k=0;k<a.length;k++){const alpha=data[k*info.channels+3];a[k]=alpha>110?1:0;count+=a[k];}
 if(count<650||count>4300)throw Error(dir+' invalid sprite silhouette coverage '+count);
 masks[dir]=a;
}
function iou(a,b){
 const x=masks[a],y=masks[b];let union=0,intersection=0;
 for(let k=0;k<x.length;k++){
  if(x[k]||y[k])union++;
  if(x[k]&&y[k])intersection++;
 }
 return intersection/Math.max(1,union);
}
const required=[
 ['front-left','front-right',.78],
 ['rear-left','rear-right',.78],
 ['left','right',.89],
 ['front-left','right',.84],
 ['rear-left','rear',.84],
 ['front-left','front',.76]
];
const metrics=required.map(([a,b,max])=>({pair:a+' vs '+b,iou:iou(a,b),limit:max}));
for(const m of metrics){
 console.log(m.pair+': '+m.iou.toFixed(3)+' (max '+m.limit+')');
 if(m.iou>m.limit)throw Error('Rejected duplicate/wrong camera angle for '+m.pair);
}
console.log('PASS: Diablo silhouettes differ in the required camera directions.');

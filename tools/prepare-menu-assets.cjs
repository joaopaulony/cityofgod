// Format conversion only: keep the generated artwork and alpha unchanged.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=path.join(root,'artifacts/menu-source/v1'),out=path.join(root,'assets/menu/v1');
 await fs.mkdir(out,{recursive:true});
 const definitions=[
  {id:'logo',file:'logo.webp',role:'wordmark',alpha:true},
  {id:'bairro-entardecer',file:'bairro-entardecer.webp',role:'title-background'},
  {id:'avenida-noturna',file:'avenida-noturna.webp',role:'loading-background'},
  {id:'cotidiano-em-casa',file:'cotidiano-em-casa.webp',role:'loading-background'}
 ];
 const assets=[];
 for(const entry of definitions){
  const original=path.join(source,entry.id+'.png'),destination=path.join(out,entry.file);
  const image=sharp(original);
  await (entry.alpha?image.webp({lossless:true}):image.webp({quality:88,effort:6})).toFile(destination);
  const meta=await sharp(destination).metadata(),stats=entry.alpha?await sharp(destination).stats():null;
  if(entry.alpha&&(!meta.hasAlpha||stats.isOpaque))throw Error('Logo must retain real transparency');
  const {size:bytes}=await fs.stat(destination);
  assets.push({...entry,width:meta.width,height:meta.height,bytes});
 }
 const manifest={version:1,name:'City of God',status:'implemented-front-end',generator:'Built-in image_gen',
  reference:'artifacts/menu-source/v1/conceito-aprovado.png',prompts:'artifacts/menu-source/v1/prompts.json',
  note:'Separate production artwork consumed by js/front-end.js and css/front-end.css. Multiplayer remains a coming-soon notice.',assets};
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(assets,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});

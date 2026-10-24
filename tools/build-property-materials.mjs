// Original, reproducible seamless architectural surfaces; no API or downloads.
// Two metres per tile. Height derivatives generate tangent-space normals.
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../assets/textures/architecture/',import.meta.url),N=512;
await mkdir(out,{recursive:true});
const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t;
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7+71.8)*43758.5453);
function noise(x,y,period){const i=Math.floor(x),j=Math.floor(y),u=fract(x),v=fract(y),s=u*u*(3-2*u),t=v*v*(3-2*v),h=(a,b)=>hash((a+period)%period,(b+period)%period);return mix(mix(h(i,j),h(i+1,j),s),mix(h(i,j+1),h(i+1,j+1),s),t);}
const specs={
 plaster:{color:[238,233,221],rough:.93,strength:1.5},
 stone:{color:[211,203,185],rough:.86,strength:2.3},
 concrete:{color:[207,204,194],rough:.94,strength:1.8},
 tile:{color:[233,229,219],rough:.50,strength:2},
 wood:{color:[220,193,151],rough:.69,strength:1.5},
 roof:{color:[235,222,204],rough:.83,strength:3.5}
};
for(const [name,spec] of Object.entries(specs)){
 const height=new Float32Array(N*N),rgb=Buffer.alloc(N*N*3),rough=Buffer.alloc(N*N),norm=Buffer.alloc(N*N*3);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const u=x/N,v=y/N,fine=hash(x,y),cloud=noise(u*8,v*8,8),medium=noise(u*64,v*64,64);
  let relief=.45+medium*.09+fine*.045,tone=.93+(cloud-.5)*.12+(fine-.5)*.055,r=spec.rough;
  if(name==='plaster'){relief+=(noise(u*128,v*128,128)-.5)*.11;tone=.96+(cloud-.5)*.035+(medium-.5)*.035+(fine-.5)*.025;}
  if(name==='concrete'){const pores=fine>.975?.18:0;relief-=pores;tone-=pores*.7;}
  if(name==='stone'||name==='tile'){
   const rows=name==='stone'?6:4,cols=name==='stone'?3:4,row=Math.floor(v*rows),a=fract(u*cols+(name==='stone'&&row%2?.5:0)),b=fract(v*rows),edge=Math.min(a,1-a,b,1-b),joint=edge<.018;
   relief=joint?.15:.63+medium*.08+fine*.035;tone*=joint?.55:.96+hash(Math.floor(u*cols+(row%2?.5:0)),row)*.08;r=joint?.98:spec.rough;
   if(name==='tile')tone+=Math.sin(u*45+cloud*8+v*18)*.018;
  }
  if(name==='wood'){
   const row=Math.floor(v*10),a=fract(u*2+(row%2?.5:0)),b=fract(v*10),joint=Math.min(a,1-a,b,1-b)<.012;
   const grain=Math.sin(v*1400+noise(u*4,v*4,4)*18)*.5+.5;
   relief=joint?.10:.5+grain*.07;tone*=joint?.5:.85+grain*.10+hash(row,2)*.13;
  }
  if(name==='roof'){
   const row=Math.floor(v*6),a=fract(u*8+(row%2?.5:0)),b=fract(v*6),ridge=Math.sin(a*Math.PI),joint=a<.03||a>.97||b<.06;
   relief=joint?.12:.34+ridge*.38+b*.12;tone*=joint?.56:.85+ridge*.14+hash(Math.floor(u*8+(row%2?.5:0)),row)*.10;
  }
  const p=y*N+x;height[p]=relief;rough[p]=Math.round(Math.min(1,r+(fine-.5)*.06)*255);
  for(let c=0;c<3;c++)rgb[p*3+c]=Math.max(0,Math.min(255,Math.round(spec.color[c]*tone)));
 }
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const at=(a,b)=>height[((b+N)%N)*N+(a+N)%N],dx=(at(x-1,y)-at(x+1,y))*spec.strength,dy=(at(x,y-1)-at(x,y+1))*spec.strength,len=Math.hypot(dx,dy,1),p=(y*N+x)*3;
  norm[p]=Math.round((dx/len*.5+.5)*255);norm[p+1]=Math.round((dy/len*.5+.5)*255);norm[p+2]=Math.round((1/len*.5+.5)*255);
 }
 for(const [suffix,data,channels] of [['color',rgb,3],['normal',norm,3],['roughness',rough,1]])await sharp(data,{raw:{width:N,height:N,channels}}).webp({quality:suffix==='normal'?95:88}).toFile(fileURLToPath(new URL(`${name}-${suffix}.webp`,out)));
}
await writeFile(new URL('manifest.json',out),JSON.stringify({author:'City of God',license:'Project-original procedural textures',tileMetres:2,resolution:N,materials:Object.keys(specs),maps:['color','normal','roughness'],generator:'tools/build-property-materials.mjs'},null,2));
console.log('Created six seamless material sets (color, normal, roughness).');

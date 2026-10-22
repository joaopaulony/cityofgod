#!/usr/bin/env node
// Two paid camera-angle corrections with side/rear pose references;
// opposite views are free deterministic mirrors.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {GoogleGenAI} from '@google/genai';
import {makeCutout} from './diablo-pilot.mjs';
const base=path.join(process.cwd(),'assets/vehicles/diablo/directions'),
 original=path.join(process.cwd(),'assets/generated/car/superesportivo-roxo-39819274197/asset.png');
function pose(type){
 const isSide=type==='right';
 const shapes=isSide?[
 '<path d="M85 609 L135 547 L332 510 L446 415 L680 415 L780 510 L918 568 L940 642 L869 677 L151 677 L82 638 Z" fill="#79508a" stroke="#151119" stroke-width="14"/>',
 '<path d="M410 515 L486 437 L668 437 L758 516 Z" fill="#78949f" stroke="#161b23" stroke-width="10"/>',
 '<path d="M586 435 L586 512" stroke="#111" stroke-width="12"/>',
 '<path d="M112 482 L286 482 L292 504 L100 504 Z" fill="#54305e" stroke="#151119" stroke-width="12"/>',
 '<circle cx="252" cy="657" r="87" fill="#171b1e" stroke="#50565b" stroke-width="7"/>',
 '<circle cx="252" cy="657" r="48" fill="#9ca3a6"/>',
 '<circle cx="791" cy="657" r="87" fill="#171b1e" stroke="#50565b" stroke-width="7"/>',
 '<circle cx="791" cy="657" r="48" fill="#9ca3a6"/>',
 '<path d="M845 545 L918 566" stroke="#f6e5a8" stroke-width="22"/>'
 ]:[
 '<path d="M250 338 L774 338 L846 492 L890 657 L836 765 L185 765 L134 657 L175 492 Z" fill="#79508a" stroke="#14151b" stroke-width="16"/>',
 '<path d="M266 378 L758 378 L782 516 L243 516 Z" fill="#526872" stroke="#222" stroke-width="11"/>',
 '<path d="M170 365 L853 365 L853 399 L170 399 Z" fill="#8f6b9c" stroke="#141218" stroke-width="14"/>',
 '<path d="M185 608 L835 608" stroke="#26222b" stroke-width="36"/>',
 '<circle cx="260" cy="610" r="32" fill="#c93e43"/>',
 '<circle cx="338" cy="610" r="32" fill="#dc463c"/>',
 '<circle cx="686" cy="610" r="32" fill="#dc463c"/>',
 '<circle cx="765" cy="610" r="32" fill="#c93e43"/>',
 '<path d="M185 720 L835 720" stroke="#3a303d" stroke-width="26"/>',
 '<ellipse cx="201" cy="747" rx="40" ry="61" fill="#151719"/>',
 '<ellipse cx="823" cy="747" rx="40" ry="61" fill="#151719"/>'
 ];
 return ['<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">',
 '<rect width="1024" height="1024" fill="#fafafa"/>',
 '<text x="512" y="135" text-anchor="middle" font-size="50" fill="#111">'+
 (isSide?'TARGET: RIGHT SIDE PROFILE':'TARGET: REAR FACE STRAIGHT ON')+'</text>',
 '<text x="512" y="191" text-anchor="middle" font-size="27" fill="#111">'+
 (isSide?'FRONT POINTS RIGHT, ONE ROW OF WHEELS':'BOTH RED TAIL LIGHTS VISIBLE, SYMMETRICAL')+'</text>',
 ...shapes,'</svg>'].join('\n');
}
async function generate(ai,ref,type){
 const png=await sharp(Buffer.from(pose(type))).png().toBuffer();
 const instructions=[
 'Change the CAMERA of the FIRST reference vehicle to the angle shown in the SECOND pose drawing.',
 'FIRST reference = exact model/style/materials. SECOND = orientation guide ONLY, do not copy its primitive graphic style.',
 'Diablo purple Italian wedge sports car, pristine paint, tall rear wing, pop-up headlamp covers, clean alloy wheels with physical tire thickness.',
 type==='right'?'RIGHT SIDE ORTHOGRAPHIC PROFILE, front bumper points RIGHT; NO diagonal 3/4 view and no front-facing grille.':
 'REAR VIEW, CAMERA DIRECTLY BEHIND THE CAR, near-perfect LEFT/RIGHT symmetry, visible back bumper, tail lamps and high spoiler, ZERO front hood.',
 'Realistic painted 2D isometric game sprite, consistent clean daytime light, camera elevated ~35 degrees, physically correct details.',
 'NO dirt, scratches, mud, rust, decals, extra shadows, scenery or green patches.',
 'TRANSPARENT background, isolated full car, no text, no UI, no collage.',
 ].join(' ');
 console.log('Paid pose correction: '+type);
 const res=await ai.interactions.create({
  model:'gemini-nano-banana-2.1',
  input:[{type:'image',mime_type:'image/png',data:ref.toString('base64')},
   {type:'image',mime_type:'image/png',data:png.toString('base64')},
   {type:'text',text:instructions}],
  response_format:{type:'image',aspect_ratio:'1:1',image_size:'1K'}
 });
 const blocks=res.output_image?.data?[res.output_image]:
  (res.steps||[]).flatMap(s=>s.type==='model_output'?s.content||[]:[]);
 const item=blocks.find(x=>x.data&&(!x.type||x.type==='image'));
 if(!item)throw Error('Gemini returned no image for '+type);
 return makeCutout(Buffer.from(item.data,'base64'),path.join(base,type+'.png'));
}
async function main(){
 if(process.env.CONFIRM_DIABLO_REANGLE!=='yes-two-paid-calls'||!process.env.GEMINI_API_KEY)
  throw Error('Two-call paid authorization or secret missing');
 const ref=await fs.readFile(original);
 const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY}),result={};
 for(const type of ['right','rear'])result[type]=await generate(ai,ref,type);
 for(const [from,to] of [['front-left','front-right'],['rear-left','rear-right'],['right','left']]){
  const bytes=await sharp(path.join(base,from+'.png')).flop().png().toBuffer();
  await fs.writeFile(path.join(base,to+'.png'),bytes);
  result[to]={mirroredFrom:from};
 }
 const mf=path.join(process.cwd(),'assets/vehicles/diablo/manifest.json');
 const json=JSON.parse(await fs.readFile(mf,'utf8'));
 json.directionCorrection='dual image pose guide + deterministic side mirrors';
 json.generated={...json.generated,...result};
 await fs.writeFile(mf,JSON.stringify(json,null,2));
 console.log('Two paid poses corrected; 3 symmetric mirrors applied.');
}
main().catch(error=>{
 const k=process.env.GEMINI_API_KEY||'';
 console.error(String(error.message||error).replaceAll(k||'\0','[secret]'));
 process.exitCode=1;
});

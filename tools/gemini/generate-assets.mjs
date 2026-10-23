#!/usr/bin/env node
// Manual, cost-controlled generation for City of God. The browser game
// NEVER imports this Node script and NEVER receives the Gemini API key.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPrompt, validate, slug, assetTypes, directions, models, imageSizes, ratios
} from './prompts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const referenceBase = path.join(repoRoot, 'assets/references');
const outputBase = path.join(repoRoot, 'assets/generated');
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

function argValue(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function chosen(flag, envName, fallback) {
  return argValue(flag) ?? process.env[envName] ?? fallback;
}
function asBool(value) {
  return ['yes', 'true', '1', 'on'].includes(String(value || '').toLowerCase());
}
function inside(base, target) {
  const rel = path.relative(base, target);
  return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function mimeFromPath(file) {
  const ext = path.extname(file).toLowerCase();
  return ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
    '.webp':'image/webp'})[ext] || null;
}
export function optionsFromEnvironment() {
  return {
    type: chosen('type', 'ASSET_TYPE', 'character'),
    name: chosen('name', 'ASSET_NAME', 'urban-resident'),
    details: chosen('details', 'ASSET_DETAILS', ''),
    direction: chosen('direction', 'ASSET_DIRECTION', 'front-left'),
    model: chosen('model', 'GEMINI_MODEL', models[0]),
    size: chosen('size', 'IMAGE_SIZE', '1K'),
    ratio: chosen('ratio', 'ASPECT_RATIO', '1:1'),
    reference: chosen('reference', 'REFERENCE_PATH', ''),
    dryRun: asBool(chosen('dry-run', 'DRY_RUN', false)),
    cutout: asBool(chosen('cutout', 'CUTOUT', false))
  };
}
export async function loadReference(relative) {
  if (!relative) return null;
  const name = String(relative).replace(/\\/g, '/');
  if (name.length > 190 || !name.startsWith('assets/references/')) {
    throw Error('Imagem de referencia deve estar dentro de assets/references/');
  }
  const absolute = path.resolve(repoRoot, name);
  if (!inside(referenceBase, absolute)) throw Error('Caminho da referencia fora da pasta permitida');
  const real = await fs.realpath(absolute);
  if (!inside(referenceBase, real)) throw Error('Referencia resolve para fora da pasta');
  const mime_type = mimeFromPath(real);
  if (!mime_type) throw Error('Referencia deve ser PNG, JPG ou WebP');
  const stat = await fs.stat(real);
  if (!stat.isFile() || stat.size > MAX_REFERENCE_BYTES || stat.size < 80) {
    throw Error('Referencia invalida: arquivo de imagem entre 80 bytes e 10 MB');
  }
  return {mime_type, data:(await fs.readFile(real)).toString('base64'), relative:name};
}
function imageBlock(interaction) {
  if (interaction?.output_image?.data) return interaction.output_image;
  for (const step of interaction?.steps || []) {
    if (step.type !== 'model_output') continue;
    for (const item of step.content || []) {
      if (item.type === 'image' && item.data) return item;
    }
  }
  throw Error('Gemini nao devolveu imagem; consulte o uso e as permissoes do modelo');
}
async function rasterProcess(bytes, cutout) {
  const {default: sharp} = await import('sharp');
  const meta = await sharp(bytes).metadata();
  if (!['png','jpeg','webp'].includes(meta.format) ||
      !meta.width || !meta.height || meta.width < 256 || meta.height < 256 ||
      meta.width > 8192 || meta.height > 8192) {
    throw Error('Imagem gerada tem formato/dimensoes invalidos');
  }
  if (!cutout) return {png:await sharp(bytes).png().toBuffer(),meta,removed:false};
  const {data,info} = await sharp(bytes).ensureAlpha()
    .raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height;
  const isGreen=(r,g,b)=>g>130&&g>r*1.42&&g>b*1.35;
  let greenEdge=0,edgeCount=0;
  for(let y=0;y<h;y+=Math.max(1,Math.floor(h/100))){
    for(const x of [0,w-1]){
      const i=(y*w+x)*info.channels;
      greenEdge+=isGreen(data[i],data[i+1],data[i+2])?1:0;edgeCount++;
    }
  }
  for(let x=0;x<w;x+=Math.max(1,Math.floor(w/100))){
    for(const y of [0,h-1]){
      const i=(y*w+x)*info.channels;
      greenEdge+=isGreen(data[i],data[i+1],data[i+2])?1:0;edgeCount++;
    }
  }
  if(greenEdge/edgeCount<.55) {
    throw Error('Recorte cancelado: Gemini nao produziu fundo verde uniforme suficiente. Refaça sem cutout ou melhore o prompt.');
  }
  for(let i=0;i<data.length;i+=info.channels){
    const r=data[i],g=data[i+1],b=data[i+2];
    if(isGreen(r,g,b)){
      // Reduced green spill on anti-aliased silhouette edges.
      const dominance=Math.min(g-r,g-b);
      const opacity=Math.min(1,Math.max(0,(dominance-18)/75));
      data[i+3]=Math.round(data[i+3]*(1-opacity));
      if(data[i+3]===0){data[i]=0;data[i+1]=0;data[i+2]=0;}
    }
  }
  const png=await sharp(data,{raw:{width:w,height:h,channels:info.channels}})
    .png().toBuffer();
  return {png,meta,removed:true};
}
export async function run(o=optionsFromEnvironment()) {
  validate(o);
  if (!assetTypes.includes(o.type) || !directions.includes(o.direction) ||
      !imageSizes.includes(o.size) || !ratios.includes(o.ratio)) throw Error('Parametros invalidos');
  // Hard safety guard: only one requested image and one billable API call.
  const prompt = buildPrompt(o);
  const folder=path.join(outputBase,o.type,slug(o.name)+'-'+slug(process.env.GITHUB_RUN_ID||'local'));
  if (!inside(outputBase,folder)) throw Error('Caminho de saida invalido');
  await fs.mkdir(folder,{recursive:true});
  const reference=await loadReference(o.reference);
  const manifest={
    status:o.dryRun?'dry-run':'generated',
    name:o.name,assetType:o.type,model:o.model,
    direction:o.direction,imageSize:o.size,aspectRatio:o.ratio,
    referencePath:reference?.relative||null,cutout:o.cutout,
    time:new Date().toISOString(),
    note:'Single AI output. Human review required before game integration.'
  };
  await fs.writeFile(path.join(folder,'prompt.txt'),prompt,'utf8');
  if (o.dryRun) {
    await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
    console.log('DRY RUN (no API call and no Gemini charges): '+folder);
    return manifest;
  }
  const apiKey=process.env.GEMINI_API_KEY;
  if (!apiKey) throw Error('GEMINI_API_KEY nao esta definida: configure o Secret no GitHub');
  const {GoogleGenAI}=await import('@google/genai');
  const ai=new GoogleGenAI({apiKey});
  const input=reference
    ? [{type:'text',text:prompt},{type:'image',mime_type:reference.mime_type,data:reference.data}]
    : prompt;
  console.log('Gerando UMA imagem: '+o.type+' / '+o.name+' / '+o.model);
  // Exactly ONE generation. No automatic retries or loops charging credits.
  const interaction=await ai.interactions.create({
    model:o.model,input,
    response_format:{type:'image',aspect_ratio:o.ratio,image_size:o.size}
  });
  const result=imageBlock(interaction);
  const bytes=Buffer.from(result.data,'base64');
  if(bytes.length<1000||bytes.length>25*1024*1024)throw Error('Resposta da imagem invalida');
  const processed=await rasterProcess(bytes,o.cutout);
  const ext=({png:'png',jpeg:'jpg',webp:'webp'})[processed.meta.format];
  await fs.writeFile(path.join(folder,'original.'+ext),bytes);
  await fs.writeFile(path.join(folder,'asset.png'),processed.png);
  Object.assign(manifest,{
    width:processed.meta.width,height:processed.meta.height,
    original:'original.'+ext,image:'asset.png',
    transparentBackgroundProcessed:processed.removed,
    pixelsVerified:true
  });
  await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log('Imagem criada para revisao: '+folder+'/asset.png ('+
    processed.meta.width+'x'+processed.meta.height+')');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  run().catch(error=>{
    // Never print request objects or secrets.
    const key=process.env.GEMINI_API_KEY||'';
    const message=String(error?.message||error).replaceAll(key||'\0','[REDACTED]');
    console.error('Falha na geracao: '+message);
    process.exitCode=1;
  });
}

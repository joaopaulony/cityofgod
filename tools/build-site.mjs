// Publish only the game's static runtime, never tooling, raw imports or secrets.
import {cp,mkdir,readdir,readFile,writeFile,rm,lstat,stat} from 'node:fs/promises';
import {auditVehicleAssets} from './audit-vehicle-assets.mjs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'dist');
if(dirname(out)!==root||out===root)throw Error('Invalid build output directory');
const existing=await lstat(out).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
if(existing?.isSymbolicLink())throw Error('Refusing to replace symlinked build output');
if(existing)await rm(out,{recursive:true});
await mkdir(out);
const html=(await readdir(root)).filter(n=>n.endsWith('.html'));
for(const name of [...html,'gameplay.gif','js','css','assets'])await cp(join(root,name),join(out,name),{recursive:true,filter:src=>!/(?:^|[\\/])(?:generated|references|\.env(?:\.[^\\/]*)?|\.git|node_modules)(?:[\\/]|$)/.test(src)});
for(const name of html){const body=await readFile(join(out,name),'utf8');
 for(const [,href] of body.matchAll(/<link\\b[^>]*\\brel=["']stylesheet["'][^>]*\\bhref=["']([^"']+)["']/g)){
  if(!/^(https?:|data:)/.test(href))await stat(resolve(out,href));
 }
 for(const [,src] of body.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)){
  if(/^(https?:|data:)/.test(src))continue;
  if(!((await stat(resolve(out,src))).isFile()))throw Error(`Missing script: ${src}`);
 }
}
const manifest=JSON.parse(await readFile(join(out,'assets/textures/architecture/manifest.json'),'utf8'));
for(const material of manifest.materials)for(const map of manifest.maps)await stat(join(out,`assets/textures/architecture/${material}-${map}.webp`));
// Métricas derivadas dos GLBs reais, não valores estimados.
const vehicleMetrics=await auditVehicleAssets();
await writeFile(join(out,'assets/vehicles/metrics.json'),JSON.stringify(vehicleMetrics,null,2)+'\n');
console.log('Vehicle audit: '+vehicleMetrics.summary.models+' GLBs, '+
  vehicleMetrics.summary.trianglesAllUniqueModels+' real source triangles.');
console.log('Static deployment ready in dist/: HTML, scripts, models, textures and credits.');

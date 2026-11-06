// Otimiza texturas dos GLBs do jogo (Fase 2 do docs/PLANO-DE-OTIMIZACAO.md).
//   node tools/optimize-assets.mjs            → processa todos os grupos
//   node tools/optimize-assets.mjs npcs       → só um grupo
// Lê sempre do ORIGINAL (pasta source de cada grupo) e grava a versão do jogo: dá p/ rodar de novo com outra
// configuração sem perder qualidade acumulada. Texturas: no máximo MAX px (sem aumentar as menores) e WebP
// (EXT_texture_webp, lido nativo pelo GLTFLoader). Mapas normais em WebP sem perda (perda neles vira "relevo sujo").
import {readdir,mkdir,stat,rename,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,textureCompress} from '@gltf-transform/functions';
import sharp from 'sharp';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// source: originais (não vão p/ o site) · out: o que o jogo carrega. Personagens: tools/import-quaternius.mjs já compacta.
export const GROUPS={
 vehicles:{source:'assets/references/glb-originals/vehicles',out:'assets/vehicles/live',max:1024,quality:88}
};
const exists=p=>access(p).then(()=>true,()=>false);

export async function optimizeFile(io,src,dst,{max,quality}){
 const doc=await io.read(src);
 await doc.transform(
  dedup(),prune(),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[max,max],slots:/^(?!normalTexture).*/,quality,effort:85}),
  textureCompress({encoder:sharp,targetFormat:'webp',resize:[max,max],slots:/^normalTexture$/,lossless:true,effort:85})
 );
 await io.write(dst,doc);
}

async function run(names){
 await MeshoptDecoder.ready;await MeshoptEncoder.ready;   // modelos que já vieram com malha compactada (meshopt)
 // vértices em blocos separados como no original: o jogo (amassados do carro, auditoria do rig) lê position.array direto
 const io=new NodeIO().setVertexLayout(VertexLayout.SEPARATE).registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
 for(const name of names){
  const g=GROUPS[name];if(!g)throw Error('grupo desconhecido: '+name);
  const source=join(root,g.source),out=join(root,g.out);
  await mkdir(source,{recursive:true});
  // primeira vez: os arquivos do jogo ainda são os originais → vão p/ a pasta source
  for(const f of (await readdir(out)).filter(f=>f.endsWith('.glb')))
   if(!await exists(join(source,f)))await rename(join(out,f),join(source,f));
  let before=0,after=0;
  for(const f of (await readdir(source)).filter(f=>f.endsWith('.glb')).sort()){
   const a=(await stat(join(source,f))).size;
   await optimizeFile(io,join(source,f),join(out,f),g);
   const b=(await stat(join(out,f))).size;before+=a;after+=b;
   console.log(name.padEnd(9),f.padEnd(34),(a/1048576).toFixed(2).padStart(6),'MB →',(b/1048576).toFixed(2).padStart(5),'MB');
  }
  console.log(name,'total',(before/1048576).toFixed(1),'MB →',(after/1048576).toFixed(1),'MB\n');
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 run(process.argv.slice(2).length?process.argv.slice(2):Object.keys(GROUPS)).catch(e=>{console.error(e);process.exitCode=1;});

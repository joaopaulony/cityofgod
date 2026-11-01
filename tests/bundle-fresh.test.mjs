// O jogo carrega personagens, retarget, estilo e vida social de js/vehicle-webgl.bundle.js (esbuild junta os .mjs).
// Se alguém muda um .mjs e não roda `npm run build`, quem abre o jogo pelo repositório recebe o código antigo, enquanto
// as páginas de teste (que importam os .mjs direto) mostram o novo. Este teste refaz o bundle em memória e compara.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
test('js/vehicle-webgl.bundle.js está em dia com os módulos (rode npm run build)',async()=>{
 const out=await build({entryPoints:['js/vehicle-webgl.mjs'],bundle:true,minify:true,format:'esm',write:false,logLevel:'silent'});
 const fresh=out.outputFiles[0].text.replace(/\r\n/g,'\n'),committed=readFileSync('js/vehicle-webgl.bundle.js','utf8').replace(/\r\n/g,'\n');
 assert.ok(fresh===committed,'bundle desatualizado: rode npm run build e inclua js/vehicle-webgl.bundle.js no commit');
});

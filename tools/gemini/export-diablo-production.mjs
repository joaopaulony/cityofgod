#!/usr/bin/env node
// FREE export: generates checklist and prompts; NEVER calls Gemini or network.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog,counts,DIABLO_PROJECT,productionPrompt,taskById} from './diablo-production.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const folder=process.argv[2]&&!process.argv[2].startsWith('--')?path.resolve(process.argv[2]):path.join(root,'artifacts/diablo-production-prompts-v2');
if(!folder.startsWith(root+path.sep))throw Error('Output must be inside repository');
const rows=catalog();
if(rows.length!==counts.total||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Invalid catalog or duplicate task ID');
await fs.mkdir(folder,{recursive:true});
const csvEscape=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const headers=['id','priority','kind','direction','part','frame','method','output','reference','status','dependencies'];
const csv=[headers.join(','),...rows.map(t=>headers.map(k=>csvEscape(Array.isArray(t[k])?t[k].join('|'):t[k])).join(','))].join('\n')+'\n';
const manifest={
 ...DIABLO_PROJECT,generatedAt:new Date().toISOString(),
 approvedImages:0,approvalRequired:true,
 billing:'ZERO API calls from this exporter; tasks are specifications until visual approval',
 counts,artifacts:rows
};
await fs.writeFile(path.join(folder,'asset-checklist.csv'),csv);
await fs.writeFile(path.join(folder,'asset-manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(folder,'PRODUCTION-README.md'),[
 '# City of God - Lamborghini Diablo: pacote de prompts',
 '',
 'Este pacote contem '+counts.total+' ESPECIFICACOES de asset, nao imagens prontas.',
 '',
 '## Quantidades',
 '- 8 vistas-base (P0)',
 '- 32 sobreposicoes de farol/freio/setas (P1)',
 '- 64 quadros de pecas moveis (meio-aberto e aberto) (P2)',
 '- 32 mascaras de pintura/vidro/rodas/sombra (P1, produzidas offline)',
 '',
 '## Ordem correta',
 '1. Validar a identidade-mestra limpa e aprovar o mesmo carro visualmente.',
 '2. Criar somente as 8 vistas-base; revisar frente/traseira, roxo, pneus e transparencia.',
 '3. Separar mascaras POR VISTA a partir dos sprites aprovados. Nao pagar Gemini para mascaras.',
 '4. Para luzes, preferir sobreposicoes Canvas 2D e pontos ancorados em cada vista em vez de gerar 32 carros completos.',
 '5. Para portas/capo/tampa, usar referencias da mesma direcao e revisar alinhamento de dobradicas; gerar so keyframes necessarios.',
 '6. Nunca inserir imagens na main sem conferir galeria e gameplay real.',
 '',
 '## Problemas do piloto anterior',
 '- Frente/traseira trocadas em algumas geracoes.',
 '- Tons de roxo inconsistentes.',
 '- Rodas com buracos de transparencia e recorte de paralama.',
 '- Aprovacao tecnica 100/100 sem validar fidelidade visual.',
 '',
 'Cada prompt exige as pecas corretas para a orientacao e protege a cor, pneus e alpha.',
 '',
 '## Arquivos',
 '- asset-manifest.json: tarefas/status/dependencias.',
 '- asset-checklist.csv: abrir no Excel ou GitHub.',
 '- prompts/: um TXT para cada tarefa.',
 '- prompt-index.md: indice por etapa.',
 '',
 'Sem chamadas pagas. Esses arquivos sao especificacoes, nao sprites aprovados.'
 ].join('\n')+'\n');
const groups=new Map();
for(const task of rows){
 const sub=path.join(folder,'prompts',task.kind);
 await fs.mkdir(sub,{recursive:true});
 await fs.writeFile(path.join(sub,task.id+'.txt'),productionPrompt(task)+'\n','utf8');
 if(!groups.has(task.priority))groups.set(task.priority,[]);
 groups.get(task.priority).push(task);
}
const index=[
 '# Indice de prompts - Lamborghini Diablo',
 '',
 'Gerado offline a partir de tools/gemini/diablo-production.mjs.',
 '',
 '| Etapa | Quantidade |',
 '|---|---:|',
 ...Object.entries(counts).map(([key,val])=>'| '+key+' | '+val+' |'),
 '',
 ...['P0','P1','P2'].flatMap(p=>[
  '## '+p,
  ...groups.get(p).map(t=>'- '+t.id+' => prompts/'+t.kind+'/'+t.id+'.txt')
 ])
].join('\n');
await fs.writeFile(path.join(folder,'prompt-index.md'),index+'\n');
if(process.argv.includes('--print')){
 const idx=process.argv.indexOf('--print');
 console.log(productionPrompt(taskById(process.argv[idx+1])));
}else console.log('FREE DIABLO PROMPT PACK: '+counts.total+' tasks exported to '+folder);

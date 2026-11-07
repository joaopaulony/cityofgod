import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

// Pedido do jogador: nenhuma marquise, toldo, pórtico ou pilar quadrado na frente das construções.
// Bancos de ponto de ônibus, a cobertura das bombas do posto e a do terminal do aeroporto ficam (não são fachada).
const files=readdirSync(new URL('../js/',import.meta.url)).filter(f=>/\.(m?js)$/.test(f)&&!f.includes('bundle'));
const src=Object.fromEntries(files.map(f=>[f,readFileSync(new URL('../js/'+f,import.meta.url),'utf8')]));

test('nenhum gerador cria marquise, toldo, pórtico ou coluna de fachada',()=>{
 const banned=/kind:\s*'(canopy|porchroof|portico|column|awning|civic-canopy|civic-column)'/;
 for(const [f,t] of Object.entries(src))
  t.split('\n').forEach((l,i)=>{if(/addBox\(/.test(l)&&banned.test(l))assert.fail(f+':'+(i+1)+' cria '+l.match(banned)[0]);});
});

test('arquitetura 3D sem pórtico civil, toldo de loja nem forro com postes na porta',()=>{
 const t=src['architecture-3d.mjs'];
 assert.doesNotMatch(t,/CylinderGeometry\(\.27,\.34/,'colunas do pórtico civil');
 assert.doesNotMatch(t,/Slatted shop shade/,'toldo listrado das lojas');
 assert.doesNotMatch(t,/wallKit\.box\(x0,2\.45,y0,x1,2\.56,y1/,'forro de madeira do recuo da porta');
});

test('fachadas pintadas sem toldo',()=>{
 assert.doesNotMatch(src['miami-facades.js'],/awning\(/);
});

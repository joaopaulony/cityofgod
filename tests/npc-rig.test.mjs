// Portão do rig: antes de qualquer animação, cada personagem precisa estar vinculado aos 65 ossos com pesos e matrizes
// de bind corretos e, com todas as animações desligadas, a malha skinada tem de coincidir com a geometria original
// (tolerância 1 mm por vértice). Uso: node --test tests/npc-rig.test.mjs   (NPC_RIG_ALL=1 testa os 52; padrão: as bases)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadGLB,auditStructure,restDeviation} from '../tools/rig-audit.mjs';
const roster=JSON.parse(fs.readFileSync(new URL('../assets/npcs/roster.json',import.meta.url),'utf8'));
const ids=process.env.NPC_RIG_ALL?roster.characters.map(c=>c.id):['character-principal-base','char-principal-base'];
for(const id of ids){
 const meta=roster.characters.find(c=>c.id===id);
 test(id+': 65 ossos vinculados, pesos válidos e repouso idêntico à malha original',async()=>{
  const g=await loadGLB(fileURLToPath(new URL('../assets/npcs/'+meta.file,import.meta.url)));
  const s=auditStructure(g.scene);
  assert.deepEqual(s.issues,[],s.issues.join(' | '));
  assert.ok(s.bindErr<1e-4,'bind '+s.bindErr);
  assert.ok(s.deformBones>=22,'ossos que deformam: '+s.deformBones);
  const r=restDeviation(g.scene);
  assert.ok(r.maxMm<=1,'desvio no repouso '+r.maxMm+' mm');
 });
}

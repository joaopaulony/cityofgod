# City of God — CAS (Character-A-Sim) / Higgsfield GLB

## Estado da primeira versão

- O CAS é o modo padrão do City of God; para testar o renderizador antigo: `?characters=mixamo`.
- O jogo usa **duas bases provisórias já existentes**, David (masculina) e Megan (feminina), com animações Mixamo. Elas **não são modelos gerados pelo Higgsfield** e têm aproximadamente 48 mil e 55 mil triângulos; portanto, ainda **não atingem** nossa meta final de low-poly realista.
- O editor oferece nome, seleção da base, altura, constituição física, prévia 3D rotacionável, animação Idle e cores **somente quando houver materiais independentes**.
- O perfil é salvo em `localStorage` sob `cityofgod.cas.v1`. Ainda não há sincronização multiplayer.
- Novos GLBs devem ser aprovados e copiados manualmente para o repositório. O jogo não envia prompts, não gera modelos online e não usa créditos da Higgsfield.

## Contrato de exportação dos novos GLBs

Gerar **dois personagens**, um masculino e outro feminino:
- Aparência: low-poly realista, proporções adultas humanas, corpo completo, postura A ou T, sem arma embutida;
- Aproximadamente **8.000 a 20.000 triângulos por personagem** (meta, não limite absoluto); LOD futuro para NPCs;
- GLB com PBR, textura preferencial de 1K, no máximo 2K, sem mapas de 4K desnecessários;
- Uma única armature e uma ou mais `SkinnedMesh`, com pesos e ossos íntegros;
- Bones compatíveis com Mixamo quando possível (melhor suporte para tiro e ações domésticas);
- Clipes identificáveis `Idle`, `Walk`, `Run` obrigatórios; recomendados `Crouch`, `CrouchWalk`, `JumpStart`, `JumpAir`, `JumpLand`, `Vault`, `RifleAim`, `RifleFire`, `RifleReload`;
- Materiais separados para pele, cabelo, camiseta e calça, nomeados com precisão para permitir recoloração;
- Direitos para uso e distribuição no jogo confirmados antes do commit.

## Importar os arquivos

1. Colocar `male.glb` e `female.glb` em `assets/characters/cas/`.
2. Editar `assets/characters/cas/manifest.json`. Exemplo:

```json
{
  "schema": 1,
  "models": [
    {
      "sex": "male",
      "file": "male.glb",
      "rig": "mixamo",
      "materialSlots": {
        "skin": ["Skin"],
        "hair": ["Hair"],
        "top": ["Shirt"],
        "bottom": ["Pants"]
      },
      "clips": {"idle": "Idle", "walk": "Walk", "run": "Run"}
    },
    {
      "sex": "female",
      "file": "female.glb",
      "rig": "mixamo",
      "materialSlots": {
        "skin": ["Skin"],
        "hair": ["Hair"],
        "top": ["Shirt"],
        "bottom": ["Pants"]
      },
      "clips": {"idle": "Idle", "walk": "Walk", "run": "Run"}
    }
  ]
}
```

3. Se o modelo usa um esqueleto diferente, configurar `"rig": "generic"`. Ele pode executar clipes embutidos, mas **não terá automaticamente o mesmo suporte a armas e IK doméstico do rig Mixamo**: é necessário retargeting.
4. O loader valida GLB, skinned meshes, ossos, animações essenciais e limite preventivo de 60 mil triângulos. Uma base com erro não substitui a versão provisória funcional.
5. Após atualizar a branch, executar `npm run test:cas` e `npm run build:site`. O deploy Vercel gera o bundle a partir dos módulos-fonte.

## Etapas seguintes (ainda não implementadas)

- Geração e aprovação visual dos modelos **Higgsfield reais** (masculino + feminino).
- Sistema modular de cabelo, roupas e acessórios com encaixe ao esqueleto.
- Morph targets específicos para rosto e corpo (olhos, nariz, mandíbula, braços, cintura etc.).
- Acompanhamento de consumo de memória/GPU e LOD de NPCs.
- Persistência do visual em servidor quando houver contas/multiplayer.

**Nota:** escala global (altura/constituição) é um recurso inicial e não substitui ajustes anatômicos/morph targets típicos do CAS do The Sims 4.

# Pets da casa

Abra **F8** ou o botão **Pets**. Entre em uma residência sua para adicionar até seis animais à família, escolhendo nome e pelagem. A adoção não cobra dinheiro do personagem.

O catálogo contém Yorkshire, Rottweiler, Lulu da Pomerânia, gato felpudo, gato esguio e Siamês. Cada tipo tem três pelagens. Os modelos 3D têm quatro pernas articuladas, orelhas e cauda animadas; as patas usam IK com comprimentos fixos. As atividades incluem caminhada, corrida, farejar, sentar, descansar e dormir.

Em casa, os animais escolhem destinos navegáveis e alternam movimentos com descanso. **Chamar para passear** faz o pet seguir o caminho percorrido pelo dono; **Esperar aqui** interrompe o trajeto; **Voltar para casa** usa o caminho de volta. Os comandos também estão disponíveis para todos os animais. Portas fechadas manualmente continuam bloqueando a passagem. Os pets usam as escadas existentes e esperam ao entrar em um veículo.

O cadastro é salvo no navegador por imóvel e mapa. Ao recarregar, os animais reaparecem em pontos livres da própria casa. O passeio é uma simulação local: não há serviço remoto nem sincronização multiplayer. Em um setor distante e descarregado, os pets que ficaram em casa deixam de ser simulados; os que acompanham o dono continuam ativos.

## Verificação

- `npm run test:pets`: catálogo, persistência, anatomia das patas, A*, saída/retorno pela porta, grupo de seis, veículo, escadas e descarregamento de setor.
- `tools/test-pets-browser.cjs`: adoção pelo painel, seis modelos na casa real, chamada, passeio com os colisores reais, recarga e atalhos. Executa em um contexto isolado do navegador.
- `tools/pets-review.html`: inspeção visual dos seis modelos e suas pelagens no servidor local.
- `artifacts/pets/`: capturas reais e relatório da verificação no navegador.

As ferramentas de captura usam Playwright, Sharp e Microsoft Edge. O runtime de desenvolvimento pode fornecê-los por `NODE_PATH`.

## Animais Quaternius — 12 novos modelos originais (CC0)

Adicionados ao catálogo de pets existente: **Husky, Shiba Inu, lobo, raposa, alpaca,
touro, vaca, veado, cervo macho, burro, cavalo e cavalo branco**. Os seis pets
procedurais anteriores permanecem disponíveis, totalizando 18 opções de catálogo
(cavalo branco é variante da espécie cavalo).

Arquivos em `assets/pets/quaternius/*.gltf`, com esqueleto e animações reais do
[Ultimate Animated Animals da Quaternius](https://quaternius.com/packs/ultimateanimatedanimals.html)
sob [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Todos usam buffers embutidos para carregamento local/offline, sem CDN. O módulo
`js/quaternius-pet.mjs` carrega no máximo duas malhas ao mesmo tempo, reutiliza
o template, clona o esqueleto para cada instância, adapta a escala ao City of God
e reproduz os clips com `AnimationMixer`. Em caso de falha, mantém o pet
procedural existente como fallback sem excluir o animal do save.

**Animações disponíveis por animal:** idle, caminhada (Walk), galope (Gallop),
alimentação (Eating), ataques e transições presentes no pacote. Farejar usa a
animação de cabeça baixa. O pacote **não fornece clips nativos de sentar ou
dormir**; esses estados usam uma pose alternativa de repouso do modelo.
Os seis pets originais mantêm as poses procedurais com IK.

Três variantes de pelagem para cada novo animal aplicam tons sutis sobre os
materiais originais; são variantes cosméticas e não modelos adicionais.
A adoção continua sendo gratuita e limitada a seis animais por casa.
Animais grandes usam escala estilizada para conviver com os interiores, não
dimensões zootécnicas realistas.

**Testar:** `node --test tests/pets.test.mjs tests/quaternius-pets.test.mjs`.
Visualização real: `tools/quaternius-review.html` e
`tools/test-quaternius-browser.cjs`, que geram capturas de 12 animações e
três pets adotados na casa com Playwright/Chrome. O teste visual não equivale
à publicação na `main`; inspecionar prints antes de liberar.

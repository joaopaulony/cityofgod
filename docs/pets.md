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

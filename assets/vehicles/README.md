# City of God — piloto de veículos com sprites 2D

## Escopo confirmado
Lamborghini Diablo (primeiro piloto), Ford Mustang GT, Ford Ranger Raptor 4x4, Mercedes-AMG G63 e Chevrolet Opala **coupé de duas portas**. Todos devem ter pintura **limpa** sem sujeira pesada, com volume na lataria/rodas e aparência de jogo isométrico realista. Metadados e especificações da frota ficam em [fleet-plan.json](fleet-plan.json).

## Implementação inicial do piloto

A Diablo usa arte do Nano Banana como referência-mestra, gerada previamente pelo proprietário do repositório. A pipeline `tools/gemini/diablo-pilot.mjs` reutiliza a referência e gera as **outras 7 vistas** uma única vez, sob um acionador específico com aprovação do proprietário. Cada saída é normalizada para PNG transparente de 768×512 pixels. **Não executa geração paga em todo commit.**

O jogo continua usando Canvas 2D. O módulo `js/vehicle-sprites.js` carrega as direções quando o manifesto e os sprites existem; se não houver um sprite, usa automaticamente o antigo veículo procedural. O veículo original permanece com física, direção, faróis, colisões e áudio existentes.

**As camadas móveis são provisoriamente geometria animada sobre o sprite.** O piloto não deve ser apresentado como uma spritesheet completa de peças articuladas recortadas com perfeição. Precisamos da revisão visual das 8 direções e das quatro peças antes de liberar a animação definitiva de qualidade. O controlador e estados já estão separados para permitir substituir esses overlays por sprites editados futuramente.

## Controles (perto da Diablo ou dirigindo)
- F: entrar ou sair
- O / U: abrir/fechar porta esquerda e direita
- P: levantar/baixar capô (motor desligado)
- J: abrir/fechar tampa do motor traseiro
- [ / ]: mudar a cor da pintura, sem gerar imagens novas
- W/S/A/D: acelerar, frear/ré, esterçar
- X: ligar/desligar motor; L: faróis; Z/C: setas; B: alerta; H: buzina

As portas e tampas não podem ser acionadas em movimento. A pintura é recolorida em cache na área roxa dos pixels de lataria; rodas, vidros e detalhes ficam sem alteração.

## QA, custos e segurança
- O segredo `GEMINI_API_KEY` nunca entra no bundle do jogo.
- Os testes de arquitetura, navegação e veículos continuam gratuitos.
- A geração paga do piloto usa disparo GitHub Actions exclusivamente no branch `feat/diablo-pilot-isometric-sprites`, alterando o arquivo `tools/gemini/trigger-diablo-once.txt`. Não dispara na branch main nem no merge do PR.
- Máximo de 7 requisições de imagem; sem tentativas de retry automático. A primeira vista foi gerada anteriormente pelo proprietário e é reutilizada.
- As imagens geradas são gravadas no branch de revisão antes de qualquer merge.
- Todos os sprites devem ser inspecionados em 8 direções para continuidade das portas, rodas, escala, sombras, limpeza e transparência.

**Próximo passo artístico após o piloto:** melhorar a consistência dos ângulos e gerar peças separadas (portas, capô, tampa traseira), garantindo que os quadros sejam adequados ao Canvas 2D. Só então replicar o pipeline para os outros quatro modelos.

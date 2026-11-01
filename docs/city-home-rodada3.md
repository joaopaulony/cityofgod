# City Home — Rodada 3 / Construção avançada / Vida social

## Objetivo

Tornar o interior das propriedades realmente utilizável, com navegação
automática dos personagens por portas e cômodos, rotinas domésticas,
refinamento PBR e preparação segura de sistemas sociais e imobiliários.

## Entregas

### Interação doméstica

- A* local na planta da casa, com grid de 0,55 m e no máximo 14.000 células.
- Verificação de portas (sem atravessar paredes) e colisões com móveis.
- Escolha de posição livre ao lado do móvel.
- Caminhada autônoma, orientação do corpo, pose procedural e resultado só no fim.
- Cancelamento por WASD, veículo, perda de propriedade ou falta de caminho.
- Controle dos efeitos de saúde, energia e higiene pelo CityLife, sem aplicar
  benefícios antes da aproximação.

### Cozinha

- Despensa por residência com estoque e quatro receitas.
- Ingredientes comprados com moeda local do jogo, sem cobrar duas vezes.
- Uma receita só é consumida após a animação terminar.
- Refeições prontas são consumidas individualmente, sem comida infinita.

### Renderização

- Materiais compartilhados MeshStandard PBR para tecido, madeira, cerâmica e metal.
- Mapa normal procedural leve e reutilizado para estofados.
- Móveis e lâmpadas continuam instanciados/limitados onde possível;
  objetos da rua preservam shader Lambert mais barato.
- Material técnico de qualidade não significa FPS medido nem inspeção visual.

### Visitas locais

- Lucas e Ana podem ser convidados se estiverem na lista local ou no modo amigos.
- Visitas roteirizadas com chegada, caminhada até o assento e despedida.
- Retornam às posições originais e não alteram as propriedades de outros jogadores.
- Não é multiplayer real; autenticação, permissões e sincronização entre pessoas
  continuam exigindo backend.

### Construção e imobiliária

- Duplicar móvel compra uma nova unidade pelo preço original e deposita no estoque.
- Bellavista Realty permite criar rascunho local de anúncio de venda ou aluguel.
- Nenhuma venda/aluguel real, transferência de propriedade ou cobrança de aluguel
  é executada sem servidor transacional.

## Julgador

Executar:
```bash
npm run judge:home
node --test tests/*.test.*
npm run build:site
```

Julgador de **oito categorias**: navegação, animações/atividades, culinária,
visitas, PBR técnico, editor/imóveis, persistência/permissões e performance/integração.

**Critérios de aprovação**: cada nota estritamente maior que 8/10 e ZERO
falhas na suíte City Home. A avaliação depende de testes e auditoria estática;
não substitui teste visual manual, análise empírica de FPS, stress multiplayer,
licenças de modelos 3D ou auditoria de segurança de backend.

## Segurança e privacidade

Tudo nesta fase usa armazenamento local do browser, sem conta autenticada.
O jogador não obtém acesso real a residências alheias por colocar um nome
na lista de convidados. Rascunhos imobiliários não movimentam dinheiro,
e a visita de NPCs é uma simulação local.

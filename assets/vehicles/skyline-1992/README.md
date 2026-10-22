# City of God — piloto híbrido de veículos em Canvas 2D

O sistema `js/vehicle-hybrid.js` está instalado e ligado ao desenho dos carros em
`js/houses.js`. A física, dirigibilidade, colisão, faróis e som continuam
implementados nos mesmos objetos procedurais de `js/vehicle-drive.js`.

## Testar agora, SEM comprar assets

Abra `index.html?hybrid=demo` (ou acrescente `&hybrid=demo` à URL
com outros parâmetros). O **cupê japonês 1992** terá as 16 vistas
`0, 22.5, 45, ... 337.5` rasterizadas apenas uma vez de `carDraw()`
para uma spritesheet 4×4 em memória. A partir dela, o carro é desenhado
com `drawImage()` durante o jogo. O carro continua dirigível e a câmera
continua podendo girar.

IMPORTANTE: o modo demo **não produz** realismo 3D; serve para validar
renderização raster em 16 direções, pivô, escala, câmera e fallback.
`?hybrid=off` desabilita qualquer tentativa de atlas. Sem parâmetro,
o motor lê o manifesto, mas permanece no renderer procedural enquanto
`enabled` estiver `false`.

## Adicionar uma spritesheet 3D autêntica

1. Criar ou obter um modelo 3D legítimo/licenciado do cupê, com a
   frente apontando para a direção +X de sua convenção de exportação.
2. Renderizar ortograficamente **16 poses diferentes** do mesmo modelo,
   câmera com distância/inclinação fixa. O atlas esperado é uma grade 4×4:
   0° à direita, aumentando no sentido horário sobre a tela. Elevação
   aproximada de 30° acima do chão (a projeção do jogo usa `TILT=0.5`
   e `HZ=0.86`). Calibrar o eixo da câmera em um render-teste.
3. PNG ou WebP com transparência total fora da carroceria. O objeto deve
   estar ancorado ao **centro do carro no chão** no pixel (192,192) do
   quadro de 384×384; todas as vistas usam o MESMO pivô. Não usar
   captura de tela com fundo, sombra desenhada na lataria ou texto.
4. Organizar as vistas por linha, esquerda → direita, na grade 4×4.
   Exportar `body.png` com **1536×1536 pixels**. Opcionalmente,
   exportar `shadow.png`, `headlights.png`, `brakes.png`,
   `left.png`, `right.png` com EXATAMENTE as mesmas dimensões
   e poses, fundo transparente.
5. Colocar as imagens nesta pasta e alterar `enabled` para `true`
   em `manifest.json`. O código carrega as camadas de forma assíncrona:
   se o corpo não carregar, mantém o carro 2D procedural automaticamente.
   Se uma camada opcional não carregar, usa a iluminação procedural.
6. Inspecionar visualmente os 16 quadros: consistência da frente/traseira,
   rodas, cores, escala, transparência, posição e sombra; conferir curvas
   e 4 orientações diferentes da câmera no jogo.

O jogo continua tendo 9 carros procedurais. **Apenas o Skyline/cupê
japonês 1992** possui o manifesto de piloto. Nenhum arquivo de arte
gerada por IA da antiga Diablo é ativado por este fluxo.

### Convenção e cálculos de renderização

- Coordenada angular do carro: `b.rot` em radianos; a frente é +X
  no plano da simulação.
- Ângulo relativo à tela: `b.rot + cam.ang + angleOffset`.
- Frame: `round(angle * directions / (2*pi)) mod directions`.
- Tamanho na tela: `frameWidth * (cam.zoom / referenceZoom)`.
- Centro no chão: `proj(b.x,b.y,0)`, alinhado com `pivot`.
- Sombra e efeitos dinâmicos respeitam a geometria procedural.

O `angleOffset` é útil para alinhar uma exportação do Blender que
comece em uma pose diferente de 0°. A troca dos sprites não altera a
rotação física, só a escolha de quadro na tela.

# City of God: 10 veículos de serviço e iluminação

Fonte: Generic civil service vehicles pack, autor Comrade1280.
https://sketchfab.com/3d-models/generic-civil-service-vehicles-pack-8ff2a13f30914932a70c7950cfa58465
Licença: Creative Commons Attribution 4.0 (CC BY 4.0); incluir crédito e link na distribuição.

O Sketchfab requer login para baixar. Os binários originais NÃO foram incluídos nesta alteração. Os 10 veículos só ficam no catálogo jogável após importar arquivos reais.

## Como instalar

1. Baixe o arquivo original usando sua conta Sketchfab e extraia os FBX/texturas.
2. No Blender, separe os carros por arquivo, mantendo materiais e UVs. Garanta frente +Z, cima +Y, carro em escala proporcional e rodas/pivôs corretos.
3. Exporte cada carro em GLB com suas texturas embutidas. Nomes obrigatórios:

- civil-ambulance.glb — ambulância (9404 triângulos anunciados)
- civil-city-bus.glb — ônibus urbano (9062)
- civil-fire-truck.glb — bombeiros (12110)
- civil-garbage-truck.glb — lixo (12747)
- civil-police-sedan.glb — viatura (8454)
- civil-postal-van.glb — correios (6031)
- civil-school-bus.glb — ônibus escolar (11472)
- civil-service-truck.glb — serviço (8216)
- civil-taxi.glb — táxi (7306)
- civil-tow-truck.glb — guincho (7955)

4. Execute: npm run import:civil -- "C:/CityOfGod/civil-glb"
5. O importador verifica cabeçalho, triângulos reais, draw calls, tamanho, hash SHA-256 e licença, copia os 10 modelos e ativa os 10 IDs no catálogo.
6. Execute: node --test tests/*.test.* ; npm run build:site ; npm run audit:vehicles. Faça QA manual em Chrome, nos quatro ângulos de câmera, antes de publicar.

Comprimento/altura, sentido das rodas, pivô e posições das lâmpadas são valores preliminares até inspeção dos GLBs reais. O autor descreve os interiores como falsos/simplificados; portas físicas não vêm necessariamente animadas.

## Controles dos carros existentes e novos

- L: farol baixo e lanterna traseira
- I: farol alto (também ativa farol baixo)
- J / K: seta esquerda / direita (pressionar novamente para cancelar)
- U: pisca-alerta sincronizado
- O: giroflex policial/ambulância/bombeiros ou sinalizador âmbar de serviço (apenas modelos compatíveis)
- S / espaço: freio; a luz branca de ré ativa quando o carro se move para trás
- H: buzina

Sem SpotLights para veículos estacionados ou NPCs; apenas pequenas lentes emissivas com piscada, quando necessário. O carro do jogador usa no máximo dois SpotLights dianteiros. Ajustar luminárias contra a malha de CADA carro após importar.

## Critérios de aceite

Cada veículo precisa passar conferência de frente/trás, rodas, largura/altura, colisão, decalques, câmera nas quatro posições, desempenho e todos os controles de luz. Não afirmar que os carros estão publicados antes do download e teste dos 10 GLBs reais.

## Rig de rodas 2026-10-29
Modelo original convertido em 58 pivôs de roda reais. A versão 2K WebP com roda articulada está em `civil-fleet-2k-webp-wheelrig.zip` (SHA-256 `298dcdf13a795df7eb68fb27bb663270f6fe427f691de1647db945f0155c43cd`). Frente física do novo pack corresponde ao **+Z** no GLB, ao contrário da frota anterior. As rodas giram conforme metros percorridos e raio real de pneu; direção dianteira aplicada no eixo vertical original Z, com eixo traseiro e duplas sem esterçamento. Arquivo original e atribuição CC BY 4.0 preservados.

# Veículo 3D ao vivo — City of God

**Modelo:** Nissan Silvia S13, 1992  
**Autor da malha original:** bagged_ls (Sketchfab: https://sketchfab.com/lstance)  
**Modelo original:** https://sketchfab.com/3d-models/none-6fa8f1948f954e3b980b5e96f203815a  
**Licença da malha:** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/  
**Fonte da versão GLB otimizada para web:** https://github.com/pedrosoandre/carros  
**Arquivo original da coleção:** `assets/nissan-silvia-s13.glb` (1.621.824 bytes, SHA Git `42a622041cdeff142ff7447852f3a146ca36ece8`).

Alterações desta implementação: normalização de escala/pivô, rotação e iluminação de apresentação. **A malha, materiais e texturas do arquivo GLB não são convertidos em sprites**. O arquivo é carregado diretamente pelo GLTFLoader e renderizado continuamente por Three.js/WebGL no navegador.

O jogo usa uma implementação própria de dirigibilidade inspirada no ritmo e na visão isométrica de Project Zomboid; não utiliza assets do jogo original nem código da The Indie Stone.

## Como testar
Abra o jogo após o build do workflow. Ao se aproximar do carro, aperte `F` para entrar.
- `W`: acelerar; `S`: frear e dar ré; `A / D`: virar
- `Espaço`: freio de mão; `X`: motor; `L`: faróis; `H`: buzina
- `F`: sair; `Q / E`: girar câmera; roda do mouse: zoom

O overlay `#vehicle3d` é um contexto WebGL real, transparente, posicionado entre o cenário e a HUD. Não há spritesheets nem capturas de câmera para veículos. Os edifícios usam máscaras de profundidade invisíveis para cobrir carros atrás de construções.

O primeiro modelo é um piloto, não há ainda estado persistente de combustível, reparo, multiplayer, danos visuais, passageiros adicionais nem sincronização em servidor. A separação de rodas e faróis depende de como cada arquivo GLB nomeia seus nós, e exigirá revisão por modelo.

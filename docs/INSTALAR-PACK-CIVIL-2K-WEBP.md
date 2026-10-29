# Upload de 1 arquivo para integrar os 10 veículos civis

O ZIP enviado ao ChatGPT foi validado: 10 GLBs originais separados, 15,8 MB de ZIP, licença CC BY 4.0. O arquivo exato foi conferido com o SHA-256 abaixo. Modelos de Comrade1280 — https://sketchfab.com/3d-models/generic-civil-service-vehicles-pack-8ff2a13f30914932a70c7950cfa58465

## Como instalar no repositório

Como a integração ChatGPT-GitHub para este projeto **não pode transmitir o ZIP binário diretamente**, faça UM upload pela interface do GitHub:

1. Baixe o arquivo de nome civil-fleet-2k-webp.zip fornecido pelo ChatGPT.
2. Abra https://github.com/joaopaulony/cityofgod/tree/main/assets/vehicles/incoming (se a pasta não existir, use Add file > Upload files no repositório e crie esta pasta).
3. No GitHub, use **Add file > Upload files** e selecione o ZIP sem extraí-lo. O caminho final precisa ser:
   assets/vehicles/incoming/civil-fleet-2k-webp.zip
4. Escolha **Commit changes** na branch main.
5. O workflow "Install provided Comrade1280 2K WebP civil fleet" validará o SHA-256, extrairá os 10 carros, os registrará no catálogo, rodará testes, fará o build e publicará os GLBs individuais automaticamente.
6. Aguarde o status verde antes de testar no jogo. Caso o workflow falhe, não haverá publicação parcial.

SHA-256 do ZIP: 244df2166618311b3d2a3afcf8ada7f9fb34aa9e1b30f7c6f43a837e8df5ebb2

## Importante: rodas e faróis
Os GLBs do pack têm a geometria das rodas agrupada com a carroceria, sem os pivôs wheel_fl/wheel_fr/wheel_rl/wheel_rr. O jogo conseguirá renderizar os carros, mas a animação individual das rodas exigirá remodelagem ou extração das rodas de cada GLB. A posição de faróis, ré, freio e giroflex ainda deve ser validada visualmente por veículo. Não tratar esse pacote como QA final aprovado antes de verificar as animações e os faróis em todas as orientações de câmera.

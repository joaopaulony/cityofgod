# Upload de 1 arquivo para integrar os 10 veículos civis

O ZIP enviado ao ChatGPT foi validado: 10 GLBs originais separados, aprox. 13 MB de ZIP, licença CC BY 4.0. O arquivo rigado exato foi conferido com o SHA-256 abaixo. Modelos de Comrade1280 — https://sketchfab.com/3d-models/generic-civil-service-vehicles-pack-8ff2a13f30914932a70c7950cfa58465

## Como instalar no repositório

Como a integração ChatGPT-GitHub para este projeto **não pode transmitir o ZIP binário diretamente**, faça UM upload pela interface do GitHub:

1. Baixe o arquivo de nome civil-fleet-2k-webp-wheelrig.zip fornecido pelo ChatGPT.
2. Abra https://github.com/joaopaulony/cityofgod/tree/main/assets/vehicles/incoming (se a pasta não existir, use Add file > Upload files no repositório e crie esta pasta).
3. No GitHub, use **Add file > Upload files** e selecione o ZIP sem extraí-lo. O caminho final precisa ser:
   assets/vehicles/incoming/civil-fleet-2k-webp-wheelrig.zip
4. Escolha **Commit changes** na branch main.
5. O workflow "Install provided Comrade1280 2K WebP civil fleet" validará o SHA-256, extrairá os 10 carros, os registrará no catálogo, rodará testes, fará o build e publicará os GLBs individuais automaticamente.
6. Aguarde o status verde antes de testar no jogo. Caso o workflow falhe, não haverá publicação parcial.

SHA-256 do ZIP: 298dcdf13a795df7eb68fb27bb663270f6fe427f691de1647db945f0155c43cd

## Importante: rodas e faróis
Os novos GLBs foram processados para separar **58 rodas reais** em pivôs independentes: 4 rodas nos sedãs/táxi/van, 6 nos veículos de eixos duplos e 10 no caminhão de lixo. O eixo dianteiro esterça e todos os eixos giram com distância percorrida, inclusive marcha ré. A malha, os materiais e os triângulos originais foram preservados.

O código `vehicle-wheels.mjs` entende as rodas extras `wheel_exNN` e o eixo vertical original glTF (`steeringAxis: z`). Antes da aprovação visual final, confira se as rodas não atravessam as caixas de roda nas quatro câmeras.

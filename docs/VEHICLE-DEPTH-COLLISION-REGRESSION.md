# Checklist de regressão — carros GLB, profundidade e colisões

**Origem:** sete capturas enviadas pelo usuário.  
**Veículos:** Silvia S13 + dez modelos Comrade1280.

## Visuais — repetir nos 11 carros
- [ ] Câmera a 0°, 90°, 180° e 270°: GLB atrás de casa, sem aparecer acima do telhado.
- [ ] Carro à frente da casa: carro inteiro, sem recorte antecipado de capô ou para-brisa.
- [ ] Poste em primeiro plano oculta parte correta do carro; poste atrás não o oculta.
- [ ] Jogador e NPCs aparecem à frente do GLB conforme a posição física relativa.
- [ ] Tronco, copa, arbusto e pedra: profundidade coerente, sem manchas no carro.
- [ ] Cerca de ripas: carro visível pelos vãos; madeira frontal pode ocultá-lo.
- [ ] Giro contínuo Q/E e zoom sem oclusão invertida ou recortes persistentes.
- [ ] Rodas dianteiras esterçam, quatro pneus e aros giram, ré inverte rotação.
- [ ] Troca de carro V atualiza comprimento, largura e posição do modelo.

## Colisões — repetir nos 11 carros
- [ ] Parede de casa: bloquear apenas em contato, sem margem invisível de 1,5m.
- [ ] Quintal livre: nenhuma barreira fantasma no limite do terreno.
- [ ] Cercas e muros: contato preciso nas ripas/linhas reais.
- [ ] Poste: colisão no poste, não metros antes.
- [ ] Tronco e pedra: colisão próxima da base, não no volume da copa.
- [ ] Arbustos e tufos decorativos: não paralisar o carro indevidamente.
- [ ] Caixas sólidas giradas: colisão precisa; toldos elevados não são obstáculos.
- [ ] Água/limite: verificar área sob o veículo e pontos de borda, não só cantos.
- [ ] Velocidade alta e curva: nenhuma atravessada de parede (trajeto em subpassos).

## Automação disponível
- tests/vehicle-depth-collision.test.mjs: geometrias, casas, cercas, objetos, água e subpassos.
- tests/comrade-vehicle.test.mjs: estrutura dos 11 GLB e animação das rodas.
- tests/comrade-vehicle-browser.cjs: Chrome WebGL com inspeção individual dos 11 modelos.
- tests/live-glb-browser.cjs: veículo real em movimento, alinhamento de câmera e direção.
- tests/vegetation-browser.cjs: qualidade do cenário e regressão visual geral.

Os testes de geometria são automáticos. As capturas ajudam a avaliar o visual, mas não substituem a revisão de todas as silhuetas pixel a pixel.

## Resultado do build
- Construcao de WebGL 3D em tempo real validada pelo workflow vehicle-depth-fix-build.
- As máscaras de oclusão são profundidade 3D, não capturas de sprites.
- Revisar as capturas dos 11 modelos após cada alteração na geometria de postes e copas.

## Três imagens adicionais — revisão de beirais e telhado (23/10/2026)
- [x] Corrigido o painter order que desenhava cobertura de varanda (porchroof/canopy) SOBRE o telhado principal, criando placas retangulares.
- [x] Máscaras WebGL separadas em parede e telhado: esconder apenas as águas inclinadas do telhado quando o veículo ocupa a área coberta pela projeção.
- [x] Cortina de visibilidade usa triângulos reais de telhado e profundidade da câmera ortográfica, inclusive em Q/E.
- [x] Casa continua com parede física/visual opaca; móveis internos não se tornam visíveis ao dirigir atrás da construção.
- [x] Restaurar telhado opaco assim que veículo sair de trás, sem deixar o recorte travado.
- [x] Teste matemático de quatro ângulos em tests/vehicle-roof-visibility.test.mjs.
- [ ] Evidência visual: tests/vehicle-roof-browser.cjs gera PNG por carro e por orientação no Chrome para confirmar ausência de buracos retangulares.

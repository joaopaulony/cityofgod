# City of God — Juiz exigente, Rodada 3

## Condições de aprovação
- Carro 3D atrás de um telhado real não aparece em cima da construção. Quando o usuário dirige, a condição de interior do ator não desliga todos os oclusores.
- A lente de visão segue o carro, não apenas o sprite do jogador, e informa o edifício que pode ser revelado ao WebGL.
- Palmeiras continuam ilustradas no Canvas, mas suas copas não são esferas oclusoras artificiais que fazem o carro desaparecer.
- Prédios comerciais e hotéis de telhado plano giram todas as fachadas, paredes/portas, cobertura e colisão conforme a tangente da rua. Telhados inclinados permanecem restritos a trechos próximos de um eixo.
- Quadras reservadas antes dos prédios: basquete, vôlei, tênis, futebol; alambrado, equipamento adequado e relatório de distribuição global.
- O planejamento global prioriza 14 quadras populares e 10 nobres quando os lotes livres comportarem. Pelo menos oito planejadas com as quatro modalidades diferentes são exigência automática.
- O juiz executa testes de geometria, contagem/distribuição, sincronização entre JS modular e bundle do navegador, marcações e colisão.

## Limites de validação
O juiz automatizado não é uma captura do jogo renderizado. É indispensável verificar visualmente:
1. carro andando atrás de telhados altos em 4 ângulos de câmera;
2. lentes sobre carro e jogador;
3. corpos e sombras de palmeiras;
4. fachadas comerciais em avenidas curvas;
5. quadras em setores descarregados/recarregados;
6. FPS, especialmente ao entrar em edifícios.

**Comando de testes:** `node --test tests/street-layout.test.cjs tests/urban-regression.test.cjs tests/urban-round3.test.cjs`.

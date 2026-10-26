# City Home — rodada de coreografia doméstica (2026-10-26)

## Escopo implementado
- Sockets orientados por tipo de móvel (frente do sofá/cadeira, lado da cama, bancada) com checagem de A*, portas e espaço livre;
- Caminho → aproximação exata → alinhamento angular → atividade → recuperação da postura em pé;
- Coreografias **procedurais com targets anatômicos** para sentar/levantar, repousar, deitar/acordar e cozinhar: pernas/mãos com IK de dois segmentos, contato aproximado com o assento/colchão e alcance dos braços limitado;
- Camada de ossos Mixamo em WebGL apenas durante atividades, deixando o AnimationMixer responsável pela locomoção de sempre;
- Atualização de alvos dos esqueletos via skeleton.js/J, sem custo adicional no percurso normal;
- Testes automáticos para socket, alinhamento, pagamento/recompensa somente no fim, cancelamento e finitude das juntas.

## Limitações não resolvidas
Isto não são novos clipes de mocap nem retarget completo; até inspeção visual em um navegador real, não se pode declarar qualidade profissional, ausência de todas as interpenetrações ou FPS específico.
O encaixe fino depende da forma exata de cada malha e requer calibração visual por item (sofá, cama, cadeira, fogão).
TV, computador, higiene e alimentação recebem gestos procedurais básicos, não manipulação física completa de botões, louça, água ou objetos com constraints e partículas.
Nenhum novo FBX/GLB CC3 foi instalado, e a ativação CC3 permanece opcional. Verificar licenças antes de distribuir corpos CC3.

## Validação
`node --test tests/city-home-performance.test.cjs`
`npm run judge:home`
`npm run build:site`

Notas do juiz são auditoria **técnica**, não certificação visual. Verificar manualmente com Mixamo David/Megan, vista lateral, aproximação, travamentos e pose na cama/sofá.

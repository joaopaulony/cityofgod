# City of God — Centro de Comando ADMIN (F10)

## Acesso
- F10 ou Ctrl+Shift+A durante a partida; Esc para fechar.
- Produção: senha autenticada no endpoint /api/admin-auth, via hash SHA-256 do servidor e cookie HMAC assinado com validade de três horas, HttpOnly, Secure e SameSite Strict.
- Variáveis exclusivas do servidor: CITY_ADMIN_PASSWORD_SHA256 e CITY_ADMIN_SESSION_SECRET.
- Sem configuração dessas variáveis o servidor responde 503 e o painel não autoriza ações.
- Em localhost/127.0.0.1, o modo desenvolvedor permite testar localmente sem servidor.
- Sessão administrativa é revalidada antes de toda operação e não é gravada em localStorage.

## Abas
1. Visão geral: resumo de saúde, energia, dinheiro, casas, veículos, modelos e coordenadas.
2. Jogador: restaurar vida/fome/sede/energia/necessidades e retornar ao spawn.
3. Economia: definir saldo exato, adicionar ou retirar fundos com confirmação e histórico.
4. Teleporte: coordenadas X/Y, delegacias, hospital, prefeitura, escola, aeroportos, POIs do GPS, verificando mundo aberto/colisões.
5. Casas: consultar propriedade, área, preço, ID, localizar entrada e conceder/revogar posse de teste.
6. Veículos: ver departamentos/GLBs instalados e entregar modelos em estacionamento seguro.
7. Mundo: diagnóstico do mapa, setores, dados básicos 3D e exportação de JSON.
8. Auditoria: histórico local e exportação de diagnóstico.

## Segurança e limites
O jogo ainda é SINGLE-PLAYER com progresso e dinheiro em localStorage. O login protege o painel publicado, mas não torna a economia ou os imóveis resistentes ao DevTools do próprio navegador. Todos os comandos deste painel alteram SOMENTE a partida local atual. No futuro multiplayer, o servidor do jogo terá que validar todas as mutações e permissões com contas de administrador; não reutilizar as chamadas locais como API administrativa remota. Sem outros jogadores conectados, não há ban/kick de usuários. Casas de setores não carregados não aparecem até teleportar próximo.

## Testes
- node --test tests/admin-panel.test.mjs
- node --test tests/*.test.*
- npm run build:site
- Validar visualmente no navegador: F10, login, saldo, pontos de interesse, imóveis, veículos, JSON, fechar com Esc, e bloqueio de controle WASD durante a edição.

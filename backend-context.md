# Backend Context - RiftPlay

## Visão Geral

O backend do RiftPlay é uma API REST construída com Node.js, Express e MongoDB (via Mongoose). Ele gerencia autenticação de usuários, criação e gestão de times, matchmaking com apostas, e ciclo de partidas. O sistema suporta times de 5 jogadores, apostas por cabeça ou por time, e usa JWT para autenticação.

## Rotas

### Auth Routes (`/rotas/authRoutes.js`)

- `POST /api/register`: Registra novo usuário (rate-limited).
- `POST /api/login`: Login, retorna JWT (rate-limited).
- `GET /api/me`: Retorna dados do usuário autenticado.

### Team Routes (`/rotas/teamroutes.js`)

- `POST /api/team/create`: Cria time (nome obrigatório, valorAposta opcional).
- `GET /api/team/me`: Retorna time do usuário.
- `GET /api/team/:id`: Retorna time por ID.
- `POST /api/team/join`: Entra em time existente.
- `POST /api/team/leave`: Sai do time.
- `POST /api/team/add-member`: Capitão adiciona membro.
- `DELETE /api/team/remove-member/:jogadorId`: Capitão remove membro.
- `POST /api/team/transfer-captain`: Transfere capitania.

### Matchmaking Routes (`/rotas/matchmakingRoutes.js`)

- `POST /api/matchmaking/queue`: Entra na fila com valorAposta.
- `POST /api/matchmaking/cancel`: Cancela fila.
- `GET /api/matchmaking/status`: Status (fila ou partida).
- `POST /api/matchmaking/accept`: Aceita partida.
- `POST /api/matchmaking/finish`: Finaliza partida com vencedor.

## Controllers

### Auth Controller (`/controllers/authController.js`)

- `register`: Valida entrada, hash senha, cria Jogador, retorna JWT.
- `login`: Verifica credenciais, retorna JWT.
- `me`: Retorna dados do usuário autenticado.

### Team Controller (`/controllers/teamController.js`)

- `createTeam`: Cria time, valida nome único, seta capitão.
- `myTeam`: Retorna time do usuário.
- `getTeam`: Retorna time por ID.
- `joinTeam`: Adiciona usuário ao time (se não estiver em outro).
- `leaveTeam`: Remove usuário, transfere capitania se necessário.
- `addMember`: Capitão adiciona membro.
- `removeMember`: Capitão remove membro (não capitão).
- `transferCaptain`: Transfere capitania.

### Matchmaking Controller (`/controllers/matchmakingController.js`)

- `enterQueue`: Valida time completo (5 membros), entra fila, busca oponente por faixa de aposta.
- `cancelQueue`: Remove da fila.
- `status`: Retorna status atual (fila ou partida).
- `accept`: Registra aceitação, inicia partida se ambos aceitaram (congela saldos).
- `finish`: Finaliza partida, distribui prêmios ao vencedor.

## Models

### Jogador (`/models/Jogador.js`)

- Campos: nome, nickname, email (único), senhaHash, cpf (único), saldo (default 200), timeId, isCapitao, ultimaRecarga.
- Índices: timeId.

### Time (`/models/Time.js`)

- Campos: nome (único), capitaoId, jogadores (array ObjectId), valorAposta (default 25), status (lobby/busca), maxMembros (default 5), saldo (default 10000), saldoCongelado, wins, losses.
- Índices: jogadores.

### Match (`/models/Match.js`)

- Campos: teams (array 2 ObjectId), valorAposta, status (pendente/em_andamento/finalizada/cancelada), perHead, teamAPlayers/teamBPlayers (snapshots), acceptedBy, acceptDeadline, startedAt/finishedAt, winnerTeamId, placar.
- Validação: Exatamente 2 times.
- Índices: status/createdAt, status/acceptDeadline, teams/createdAt, teams/status.

### Player (`/models/Player.js`)

- Campos: teamId, saldo, saldoCongelado, allowance (default 200), startOfWeek.
- Índices: teamId, saldo.

### Queue (`/models/Queue.js`)

- Campos: teamId (único), valorAposta, byUserId.
- Índices: teamId (único), valorAposta/createdAt, createdAt (TTL opcional).

## Middleware

### Auth (`/middleware/auth.js`)

- Valida JWT, injeta req.user com id, timeId, isCapitao, etc.

### Rate Limit (`/middleware/rateLimit.js`)

- `publicLimiter`: 120 req/min (window 60s).
- `authLimiter`: 20 req/15min.
- `makeLimiter`: Fábrica para custom.

### Error Handler (`/middleware/errorHandler.js`)

- `notFoundHandler`: 404 para rotas inexistentes.
- `errorHandler`: Trata erros, loga, retorna JSON padronizado.

## Config

### DB (`/config/db.js`)

- Conecta MongoDB com opções (maxPoolSize 10, etc.).

## Fluxo de Apostas e Filas

### Entrada na Fila

- Usuário (capitão) chama `/queue` com teamId e valorAposta.
- Valida time com 5 membros.
- Insere/atualiza Queue.
- Busca oponente na Queue com aposta compatível (faixa baseada em tempo na fila: 0.3% a 10%).
- Se encontra, cria Match (status "pendente"), remove ambos da Queue.

### Aceitação

- Ambos os times chamam `/accept`.
- Quando ambos aceitaram, inicia partida (status "em_andamento").
- Congela saldos: por cabeça (se Player) ou por time.
- Aplica top-up semanal aos jogadores.

### Finalização

- Capitão chama `/finish` com winnerTeamId.
- Descongela saldos, paga 2x aposta ao vencedor.
- Status "finalizada".

### Cancelamento/Timeout

- Se não aceitar em 60s, cancela, re-insere na Queue.

## Como o Backend Funciona (Passo a Passo)

1. **Startup**: server.js conecta MongoDB, inicia jobs (matchTimeoutSweep), sobe Express.
2. **Autenticação**: JWT via auth middleware.
3. **Times**: CRUD via teamController, validações (único nome, max 5 membros).
4. **Matchmaking**: Queue busca oponente, Match gerencia ciclo com transações MongoDB.
5. **Saldos**: Congelados na aceitação, descongelados na finalização.
6. **Rate Limit**: Protege endpoints públicos/auth.
7. **Erros**: Centralizados via errorHandler.

## O que Cada Arquivo Faz

- `server.js`: Ponto de entrada, configura Express, CORS, Helmet, rotas, error handlers.
- `rotas/`: Define endpoints, monta middlewares.
- `controllers/`: Lógica de negócio, validações, DB ops.
- `models/`: Schemas Mongoose, índices.
- `middleware/`: Auth, rate limit, error handling.
- `config/db.js`: Conexão MongoDB.
- `jobs/`: Varreduras periódicas (ex.: timeouts).
- `scripts/`: Utilitários (seed, etc.).

## Validações Existentes

- **Auth**: Email único, CPF único, senha hashada.
- **Times**: Nome único, max 5 membros, capitão obrigatório.
- **Matchmaking**: Time completo (5), aposta >=1, divisível por membros (per head).
- **Saldos**: Não negativos, congelado suficiente.
- **JWT**: Expirado/inválido.
- **Rate Limit**: Por endpoint.

## Dependências Críticas

- `express`: Framework web.
- `mongoose`: ODM MongoDB.
- `jsonwebtoken`: JWT.
- `bcrypt`: Hash senhas.
- `cors`: CORS.
- `helmet`: Segurança headers.
- `express-rate-limit`: Rate limiting.
- `express-mongo-sanitize`: Sanitização Mongo.

## Exemplos de Fluxos

### Criar Time

```
POST /api/team/create
{ "nome": "Team Alpha", "valorAposta": 50 }
-> 201: { "time": {...} }
```

### Entrar na Fila

```
POST /api/matchmaking/queue
{ "teamId": "64f...", "valorAposta": 50 }
-> 200: { "queued": true, "range": { "min": 45, "max": 55 } }
```

### Aceitar Partida

```
POST /api/matchmaking/accept
{ "matchId": "64f...", "teamId": "64f..." }
-> 200: { "startedAt": "2023-..." }
```

### Finalizar Partida

```
POST /api/matchmaking/finish
{ "matchId": "64f...", "winnerTeamId": "64f...", "placar": "13-9" }
-> 200: { "winnerTeamId": "64f..." }
```

## O que Falta para MVP Completo

- **Payout/Prêmios**: Implementado, mas sem histórico detalhado de transações.
- **Histórico de Partidas**: Match tem placar/winner, mas sem endpoint para listar histórico por time/jogador.
- **Ranking**: Time tem wins/losses, mas sem sistema de ranking global.
- **Notificações**: Sem push/email para eventos (aceitação, timeout).
- **Admin Panel**: Sem endpoints para moderar times/partidas.
- **Logs/Auditoria**: Sem logs detalhados de ações.
- **Frontend Integration**: Backend pronto, mas sem UI.
- **Testes**: Sem testes unitários/integração.
- **Deploy**: Scripts para produção (Docker, etc.).

## Dependências do Ambiente

- `NODE_ENV`: production/dev.
- `MONGO_URI`: Conexão DB.
- `JWT_SECRET`: Chave JWT.
- `PORT`: Porta servidor.
- `RATE_LIMIT_*`: Config rate limit.
- `AUTH_RATE_LIMIT_*`: Rate limit auth.
- `MATCH_ACCEPT_TIMEOUT_SECS`: Timeout aceitação (60s).
- `WEEKLY_TOPUP_PER_PLAYER`: Crédito semanal (200).
- `TIMEOUT_SWEEP_MS`: Sweep timeouts (5000ms).
- `QUEUE_TTL_SECS`: TTL fila (3600s).

# TODO - Bloco 1: Segurança

- [x] Editar server.js: Remover condição de produção para rate-limit em /api/matchmaking/status, aplicar sempre.
- [x] Editar server.js: Melhorar configuração do helmet com HSTS, CSP, noSniff, frameOptions.
- [x] Verificar endpoints: /health, registro/login/me (JWT), rate-limit em /api/matchmaking/status (429 com headers RateLimit-*).
- [x] Listar envs usadas.

## Lista de Envs Usadas

- MONGO_URI (config/db.js, .env)
- JWT_SECRET (controllers/authController.js, .env)
- PORT (server.js, .env)
- NODE_ENV (server.js, config/db.js)
- CORS_ORIGINS (server.js)
- JSON_LIMIT (server.js)
- RATE_LIMIT_WINDOW_MS (middleware/rateLimit.js)
- RATE_LIMIT_MAX (middleware/rateLimit.js)
- AUTH_RATE_LIMIT_WINDOW_MS (middleware/rateLimit.js, rotas/authRoutes.js)
- AUTH_RATE_LIMIT_MAX (middleware/rateLimit.js, rotas/authRoutes.js)
- TIMEOUT_SWEEP_MS (jobs/matchTimeoutSweep.js, .env)
- TIMEOUT_SWEEP_LOCK_MS (jobs/matchTimeoutSweep.js, .env)
- MATCH_ACCEPT_TIMEOUT_SECS (controllers/matchmakingController.js, .env)
- WEEKLY_TOPUP_PER_PLAYER (controllers/matchmakingController.js, .env)
- QUEUE_TTL_SECS (.env - não usado no código)
- API_URL (.env - não usado no código)
- HEALTH_URL (.env - não usado no código)
- WEEKLY_CAP_PER_PLAYER (.env - não usado no código)

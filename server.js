// server.js
require('dotenv').config();

// DEBUG JWT SECRET (REMOVER DEPOIS)
const crypto = require('crypto');
const S = process.env.JWT_SECRET || '';
const sha = crypto.createHash('sha256').update(S).digest('hex').slice(0, 12);
const masked = S ? (S.slice(0,6) + '…' + S.slice(-4)) : '(vazio)';
console.log('[AUTH] JWT_SECRET len=%d sha256=%s masked=%s', S.length, sha, masked);

const express = require('express');
const cors = require('cors');

// 🔒 Segurança leve
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');

// 🔌 Conexão com o MongoDB
const conectarMongo = require('./config/db');

// 🔔 Varredura de timeouts
const { scheduleMatchTimeoutSweep } = require('./jobs/matchTimeoutSweep');

// 🛣️ Rotas
const authRoutes = require('./rotas/authRoutes');
const teamRoutes = require('./rotas/teamroutes');
const matchmakingRoutes = require('./rotas/matchmakingRoutes');

// ⏱️ Rate limit público (usado só em produção)
const { publicLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ✅ Se estiver atrás de proxy (NGINX/Render/Heroku/Railway), confia nos headers do proxy
app.set('trust proxy', 1);

// ===== Segurança Mongoose (não muda comportamento do app) =====
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);
mongoose.set('sanitizeProjection', true);

// Middlewares base
app.use(cors());                 // se quiser, em prod, pode restringir origens via env
app.use(express.json());
app.use(mongoSanitize());        // remove operadores $ e campos com ponto do payload

// 🔎 Healthcheck
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// Rota raiz
app.get('/', (_req, res) => {
  res.send('Servidor do RiftPlay está rodando com sucesso!');
});

// 🚦 Rate-limit só em produção (evita travar teus testes locais)
if (NODE_ENV === 'production') {
  // exemplo: proteger a rota pública de status
  app.use('/api/matchmaking/status', publicLimiter);

  // se quiser, proteja outras rotas públicas também:
  // app.use('/api/healthcheck', publicLimiter);
}

// Rotas
app.use('/api', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

// 👉 Sobe o HTTP primeiro
const server = app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em: http://localhost:${PORT} (env=${NODE_ENV})`);
});

// 👉 Conecta no Mongo e, se ok, inicia o sweep de timeout
(async () => {
  try {
    await conectarMongo();
    console.log('✅ MongoDB conectado com sucesso!');
    scheduleMatchTimeoutSweep();
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB:', err?.message || err);
    // process.exit(1); // em prod você pode querer finalizar o processo
  }
})();

// (opcional) logs de erros não tratados
process.on('unhandledRejection', (reason) => console.error('⚠️ UnhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('⚠️ UncaughtException:', err));

module.exports = { app, server };

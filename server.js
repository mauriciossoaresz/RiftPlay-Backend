// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');

// Conexão com o MongoDB
const conectarMongo = require('./config/db');

// Varredura de timeouts
const { scheduleMatchTimeoutSweep } = require('./jobs/matchTimeoutSweep');

// Rotas
const authRoutes = require('./rotas/authRoutes');
const teamRoutes = require('./rotas/teamroutes');
const matchmakingRoutes = require('./rotas/matchmakingRoutes');

// Rate limit público (usado só em produção)
const { publicLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// confiar em proxy (Render/Heroku/etc.)
app.set('trust proxy', 1);

// ===== Segurança Mongoose (não muda comportamento do app) =====
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);
mongoose.set('sanitizeProjection', true);

// ===== Segurança Express =====
app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // evita bloquear assets de outros domínios
  })
);

// ===== CORS =====
// Em produção, defina CORS_ORIGINS="https://seu-front.com,https://outro.com"
// Em dev, libera tudo para facilitar testes.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions =
  NODE_ENV === 'production' && allowedOrigins.length
    ? {
        origin(origin, cb) {
          if (!origin) return cb(null, true); // curl/health etc.
          if (allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error('CORS not allowed by policy'), false);
        },
        credentials: true,
      }
    : { origin: true, credentials: true };

app.use(cors(corsOptions));

// ===== Body / Sanitização =====
app.use(express.json({ limit: process.env.JSON_LIMIT || '100kb' }));
app.use(mongoSanitize()); // remove operadores Mongo ($ e .) do payload

// Healthcheck
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// Rota raiz
app.get('/', (_req, res) => {
  res.send('Servidor do RiftPlay está rodando com sucesso!');
});

// Rate-limit só em produção (evita travar testes locais)
if (NODE_ENV === 'production') {
  app.use('/api/matchmaking/status', publicLimiter);
  // exemplo para outras rotas públicas:
  // app.use('/api/healthcheck', publicLimiter);
}

// Rotas da API
app.use('/api', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

// Sobe o HTTP primeiro
const server = app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em: http://localhost:${PORT} (env=${NODE_ENV})`);
});

// Conecta no Mongo e inicia o sweep de timeout
(async () => {
  try {
    await conectarMongo();
    console.log('✅ MongoDB conectado com sucesso!');
    scheduleMatchTimeoutSweep();
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB:', err?.message || err);
    // Em produção você pode querer encerrar o processo:
    // process.exit(1);
  }
})();

// (opcional) logs de erros não tratados
process.on('unhandledRejection', (reason) => console.error('⚠️ UnhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('⚠️ UncaughtException:', err));

module.exports = { app, server };

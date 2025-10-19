const rateLimit = require('express-rate-limit');

// valores padrão (ajuste no .env se quiser)
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000); // 1 min
const max = Number(process.env.RATE_LIMIT_MAX || 120);               // 120 req/min

const publicLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,   // retorna RateLimit-* headers
  legacyHeaders: false,
  message: { ok: false, error: 'too_many_requests' },
});

const makeLimiter = (opts = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'too_many_requests' },
    ...opts,
  });

module.exports = { publicLimiter, makeLimiter };

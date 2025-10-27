// backend/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

/** Lê inteiro do env com fallback seguro */
function readInt(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}

// ===== Limite público (genérico) =====
const WINDOW_MS = readInt('RATE_LIMIT_WINDOW_MS', 60_000); // 1 min
const MAX_REQS  = readInt('RATE_LIMIT_MAX',       120);    // 120 req/min

const publicLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQS,
  standardHeaders: true,   // retorna RateLimit-* headers
  legacyHeaders: false,
  message: { ok: false, error: 'too_many_requests' },
});

// ===== Limite específico p/ auth (login/registro) =====
const AUTH_WINDOW_MS = readInt('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60_000); // 15 min
const AUTH_MAX       = readInt('AUTH_RATE_LIMIT_MAX',              20);   // 20 tentativas

const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'too_many_attempts_try_later' },
});

// ===== Fábrica opcional p/ criar outros limiters por rota =====
const makeLimiter = (opts = {}) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max: MAX_REQS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'too_many_requests' },
    ...opts,
  });

module.exports = { publicLimiter, authLimiter, makeLimiter };

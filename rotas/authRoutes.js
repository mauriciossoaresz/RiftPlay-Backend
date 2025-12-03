const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");
const { makeLimiter } = require("../middleware/rateLimit");

// Limites específicos para auth (podem ser ajustados via env)
const AUTH_WINDOW_MS = Number(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60_000
); // 15min
const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20); // 20 req por janela

const authLimiter = makeLimiter({ windowMs: AUTH_WINDOW_MS, max: AUTH_MAX });

// Rotas públicas com limiter
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);

// Rota protegida para teste
router.get("/me", auth, authController.me);

module.exports = router;

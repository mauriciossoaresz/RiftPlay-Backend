const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
// ✅ limiter específico para rotas de auth (definido em middleware/rateLimit.js)
const { authLimiter } = require('../middleware/rateLimit');

// Rotas públicas (com proteção contra brute-force)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Rota protegida para teste de autenticação
router.get('/me', auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;

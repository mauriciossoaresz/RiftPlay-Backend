const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Rotas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Rota protegida para teste de autenticação
router.get('/me', auth, (req, res) => {
  // Retorna os dados do usuário autenticado
  res.json({ ok: true, user: req.user });
});

module.exports = router;
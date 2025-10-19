// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const Jogador = require('../models/Jogador');

/**
 * Middleware de autenticação JWT.
 * Valida o token, busca o usuário e injeta dados relevantes na req.
 */
async function auth(req, res, next) {
  try {
    // Aceita 'authorization' em qualquer capitalização e remove espaços extras
    const header =
      (req.headers && (req.headers.authorization || req.headers.Authorization)) ||
      req.get?.('authorization');

    if (!header || !/^Bearer\s+/i.test(header)) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ erro: 'Token ausente.' });
    }

    const secret = process.env.JWT_SECRET || 'segredo';
    const payload = jwt.verify(token, secret); // pode lançar (expirado/inválido)

    // Usamos sub (padrão JWT) e caímos pra id se necessário
    const userId = payload?.sub || payload?.id;
    if (!userId) {
      return res.status(401).json({ erro: 'Token inválido (sem subject).' });
    }

    // Busca o usuário no banco para garantir existência e pegar dados atuais
    const jogador = await Jogador.findById(userId)
      .select('_id timeId isCapitao nickname email')
      .lean();

    if (!jogador) {
      return res.status(401).json({ erro: 'Usuário não encontrado.' });
    }

    // Injeta dados mínimos na requisição (sem info sensível)
    req.user = {
      id: String(jogador._id),
      _id: String(jogador._id), // <- adicionado para compatibilidade com controllers que usam req.user._id
      timeId: jogador.timeId ? String(jogador.timeId) : null,
      isCapitao: !!jogador.isCapitao,
      nickname: jogador.nickname || null,
      email: jogador.email || null,
    };

    return next();
  } catch (err) {
    // Erros mais claros
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado.' });
    }
    if (err?.name === 'JsonWebTokenError') {
      return res.status(401).json({ erro: 'Token inválido.' });
    }
    return res.status(401).json({ erro: 'Não autenticado.' });
  }
}

module.exports = auth;

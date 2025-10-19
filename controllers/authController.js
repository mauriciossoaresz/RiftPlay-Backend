const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Jogador = require('../models/Jogador');

/**
 * Registra um novo jogador.
 */
const register = async (req, res) => {
  try {
    const { nome, nickname, email, senha, cpf } = req.body;

    // Validação básica dos campos obrigatórios
    if (![nome, nickname, email, senha, cpf].every(Boolean)) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
    }

    // Checa duplicidade de email ou CPF
    const existe = await Jogador.findOne({ $or: [{ email }, { cpf }] });
    if (existe) {
      return res.status(409).json({ erro: 'Email ou CPF já cadastrado.' });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Cria novo jogador
    const novo = new Jogador({ nome, nickname, email, cpf, senhaHash });
    await novo.save();

    return res.status(201).json({ mensagem: 'Jogador cadastrado com sucesso!' });
  } catch (err) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar jogador.' });
  }
};

/**
 * Realiza login do jogador.
 */
const login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Validação básica dos campos obrigatórios
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
    }

    // Busca usuário pelo email
    const user = await Jogador.findOne({ email });
    if (!user) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    // Compara senha fornecida com o hash salvo
    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    // Gera token JWT
    const token = jwt.sign(
      { sub: user._id, nickname: user.nickname },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        nome: user.nome,
        nickname: user.nickname,
        saldo: user.saldo
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro no login.' });
  }
};

module.exports = { register, login };

/*
Principais mudanças:
- Uso de .every(Boolean) para validação dos campos obrigatórios no registro.
- Comentários padronizados e claros.
- Garantia de status HTTP corretos e mensagens de erro consistentes.
- Nenhuma alteração de lógica, apenas melhorias de legibilidade e boas práticas.
*/
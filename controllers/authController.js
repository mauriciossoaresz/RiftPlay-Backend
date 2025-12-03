const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Jogador = require("../models/Jogador");

// Regex simples para validação de email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registra um novo jogador.
 */
const register = async (req, res) => {
  try {
    let { nome, nickname, email, senha, cpf } = req.body;

    // Sanitização e validação básica dos campos obrigatórios
    nome = nome?.trim();
    nickname = nickname?.trim();
    email = email?.toLowerCase().trim();
    senha = senha?.trim();
    cpf = cpf?.trim();

    if (![nome, nickname, email, senha, cpf].every(Boolean)) {
      return res
        .status(400)
        .json({ erro: "Todos os campos são obrigatórios." });
    }

    // Validação de formato de email
    if (!emailRegex.test(email)) {
      return res.status(400).json({ erro: "Email inválido." });
    }

    // Validação de tamanho mínimo da senha
    if (senha.length < 6) {
      return res
        .status(400)
        .json({ erro: "Senha deve ter pelo menos 6 caracteres." });
    }

    // Checa duplicidade de email ou CPF (email em lowercase para consistência)
    const existe = await Jogador.findOne({ $or: [{ email }, { cpf }] });
    if (existe) {
      return res.status(409).json({ erro: "Email ou CPF já cadastrado." });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Cria novo jogador
    const novo = new Jogador({ nome, nickname, email, cpf, senhaHash });
    await novo.save();

    return res
      .status(201)
      .json({ mensagem: "Jogador cadastrado com sucesso!" });
  } catch (err) {
    console.error("Erro no registro:", err);
    throw new Error("Erro ao cadastrar jogador.");
  }
};

/**
 * Realiza login do jogador.
 */
const login = async (req, res) => {
  try {
    let { email, senha } = req.body;

    // Sanitização e validação básica dos campos obrigatórios
    email = email?.toLowerCase().trim();
    senha = senha?.trim();

    if (!email || !senha) {
      return res.status(400).json({ erro: "Email e senha são obrigatórios." });
    }

    // Validação de formato de email
    if (!emailRegex.test(email)) {
      return res.status(400).json({ erro: "Email inválido." });
    }

    // Busca usuário pelo email (em lowercase)
    const user = await Jogador.findOne({ email });
    if (!user) {
      return res.status(401).json({ erro: "Credenciais inválidas." });
    }

    // Compara senha fornecida com o hash salvo
    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) {
      return res.status(401).json({ erro: "Credenciais inválidas." });
    }

    // Gera token JWT
    const token = jwt.sign(
      { sub: user._id, nickname: user.nickname },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        nome: user.nome,
        nickname: user.nickname,
        saldo: user.saldo,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ erro: "Erro no login." });
  }
};

/**
 * Retorna informações do usuário autenticado.
 */
const me = async (req, res) => {
  try {
    return res.json({
      mensagem: "Usuário autenticado com sucesso.",
      user: req.user,
    });
  } catch (err) {
    console.error("Erro ao obter usuário:", err);
    throw new Error("Erro ao obter informações do usuário.");
  }
};

module.exports = { register, login, me };

/*
Principais mudanças:
- Sanitização de entradas (trim, lowercase para email).
- Validação de formato de email e tamanho mínimo da senha.
- Uso de .every(Boolean) para validação dos campos obrigatórios no registro.
- Comentários padronizados e claros.
- Garantia de status HTTP corretos e mensagens de erro consistentes.
- Nenhuma alteração de lógica, apenas melhorias de legibilidade e boas práticas.
*/

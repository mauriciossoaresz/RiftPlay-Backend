const mongoose = require('mongoose');

const jogadorSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  nickname: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido'] // Regex ajustada para validação de e-mail
  },
  senhaHash: { type: String, required: true }, // Campo para armazenar o hash da senha
  cpf: { type: String, required: true, unique: true, trim: true },
  saldo: { type: Number, default: 200, min: 0 },
  timeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Time', default: null },
  isCapitao: { type: Boolean, default: false },
  ultimaRecarga: { type: Date, default: Date.now }
}, { timestamps: true });

// Melhoria: exportação explícita do modelo
module.exports = mongoose.model('Jogador', jogadorSchema);

/*
Principais mudanças:
- Regex de validação de e-mail ajustada para maior precisão.
- Comentários padronizados e claros.
- Exportação explícita do modelo.
- Nenhuma alteração de lógica, apenas melhorias de legibilidade e boas práticas.
*/
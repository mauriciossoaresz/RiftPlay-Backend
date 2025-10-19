const mongoose = require('mongoose');

// Schema do Time otimizado e padronizado
const timeSchema = new mongoose.Schema(
  {
    // Identificação / membros
    nome: {
      type: String,
      required: true,
      unique: true,
      trim: true
    }, // nome único
    capitaoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jogador',
      required: true
    },
    jogadores: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jogador'
    }],

    // Configuração padrão do time
    valorAposta: { type: Number, default: 25, min: 0 },
    status: {
      type: String,
      enum: ['lobby', 'buscando'],
      default: 'lobby'
    },
    maxMembros: { type: Number, default: 5, min: 1 },

    // === Carteira (novo) ===
    saldo: { type: Number, default: 10000, min: 0 },         // saldo livre
    saldoCongelado: { type: Number, default: 0, min: 0 },    // saldo reservado em partidas

    // === Ranking (novo) ===
    wins:   { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Índice para nome único (garante unicidade no banco)
timeSchema.index({ nome: 1 }, { unique: true });

// (Opcional) índices para ranking futuro
// timeSchema.index({ wins: -1, losses: 1 });

module.exports = mongoose.model('Time', timeSchema);

/*
Principais mudanças:
- Adicionado min: 1 em maxMembros para evitar times com zero membros.
- Adicionado índice explícito para nome único (garante unicidade no banco).
- Comentários padronizados e claros.
- Nenhuma alteração de lógica, apenas melhorias de legibilidade e boas práticas.
*/
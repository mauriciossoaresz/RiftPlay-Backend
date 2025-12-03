const mongoose = require('mongoose');

// Schema do Time
const timeSchema = new mongoose.Schema(
  {
    // Identificação / membros
    nome: {
      type: String,
      required: true,
      unique: true,   // << já garante índice único
      trim: true,
    },
    capitaoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jogador',
      required: true,
    },
    jogadores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Jogador',
      },
    ],

    // Configuração padrão do time
    valorAposta: { type: Number, default: 25, min: 0 },
    status: {
      type: String,
      enum: ['lobby', 'buscando'],
      default: 'lobby',
    },
    maxMembros: { type: Number, default: 5, min: 1 },

    // Carteira
    saldo: { type: Number, default: 10000, min: 0 },
    saldoCongelado: { type: Number, default: 0, min: 0 },

    // Ranking
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Índices para acelerar buscas comuns
timeSchema.index({ jogadores: 1 });

module.exports = mongoose.model('Time', timeSchema);

// backend/models/Match.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const matchSchema = new Schema(
  {
    // Sempre 2 IDs de times
    teams: [
      { type: Types.ObjectId, ref: 'Time', required: true }
    ],

    // Aposta usada no pareamento
    valorAposta: { type: Number, required: true, min: 1 },

    // Ciclo da partida
    status: {
      type: String,
      enum: ['pendente', 'em_andamento', 'finalizada', 'cancelada', 'em_analise'],
      default: 'pendente',
      index: true,
    },

    // Valor por jogador (snapshot quando vira em_andamento)
    perHead: { type: Number, default: 0 },

    // Snapshot de jogadores por time (quando em_andamento)
    teamAPlayers: [{ type: Types.ObjectId, ref: 'Player' }],
    teamBPlayers: [{ type: Types.ObjectId, ref: 'Player' }],

    // /accept: quem já aceitou
    acceptedBy: [{ type: Types.ObjectId, ref: 'Time', default: [] }],

    // (Opcional) quem teve saldo reservado/congelado
    reservedBy: [{ type: Types.ObjectId, ref: 'Time', default: [] }],

    // Aceite + cancelamento
    acceptDeadline: { type: Date, default: null },
    cancelReason:   { type: String, default: null },

    // Timestamps do ciclo
    startedAt:  { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    // Resultado
    winnerTeamId: { type: Types.ObjectId, ref: 'Time', default: null },

    // Placar flexível: string ("13-9") ou objeto ({ a:13, b:9 })
    placar: { type: Schema.Types.Mixed, default: null },

    // Votos dos capitaos (por teamId => "win" | "loss")
    resultsByTeam: {
      type: Map,
      of: {
        type: String,
        enum: ['win', 'loss'],
      },
      default: {},
    },

    // Prazo para reportar resultado
    resultDeadline: { type: Date, default: null },

    // Marcacao de disputa / analise manual
    disputeReason: { type: String, default: null },
    disputeCreatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Validação: exatamente 2 times
matchSchema.path('teams').validate(
  (arr) => Array.isArray(arr) && arr.length === 2,
  'A partida deve conter exatamente 2 times.'
);

// Índices úteis de consulta (depois do schema!)
matchSchema.index({ status: 1, createdAt: -1 });  // listar pendentes/andamento mais recentes
matchSchema.index({ status: 1, acceptDeadline: 1 }); // checar timeouts rápido
matchSchema.index({ teams: 1, createdAt: -1 });  // buscar última partida por time
matchSchema.index({ teams: 1, status: 1 });      // status atual de um time

module.exports = mongoose.model('Match', matchSchema);

// backend/models/Queue.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Fila de matchmaking por time e valor de aposta.
 * Uma entrada por time (unique), usada para buscar adversário compatível.
 */
const queueSchema = new Schema(
  {
    teamId: {
      type: Types.ObjectId,
      ref: 'Time',
      required: true,
      // a unicidade é garantida no índice abaixo
    },

    valorAposta: {
      type: Number,
      required: true,
      min: 1,
    },

    // (opcional) quem colocou na fila (ex.: capitão)
    byUserId: { type: Types.ObjectId, ref: 'Jogador', default: null },
  },
  {
    timestamps: true,  // cria createdAt/updatedAt
    versionKey: false,
  }
);

/* ===================== Índices ===================== */

// 1) Um time só pode ter 1 entrada na fila
queueSchema.index({ teamId: 1 }, { unique: true, name: 'queue_teamId_unique' });

// 2) Busca por faixa de aposta + antiguidade (ajuda o “matcher”)
queueSchema.index({ valorAposta: 1, createdAt: 1 }, { name: 'queue_aposta_createdAt_1' });

// 3) TTL opcional para manter a fila limpa automaticamente
//    Defina QUEUE_TTL_SECS=3600 no .env (ou deixe unset para não expirar).
const ttl = Number(process.env.QUEUE_TTL_SECS || 0);
if (ttl > 0) {
  queueSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: ttl, name: 'queue_createdAt_ttl' }
  );
} else {
  // Sem TTL: ainda criamos um índice simples em createdAt para ordenações rápidas
  queueSchema.index({ createdAt: 1 }, { name: 'queue_createdAt_1' });
}

module.exports = mongoose.model('Queue', queueSchema);

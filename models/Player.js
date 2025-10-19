// models/Player.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const playerSchema = new Schema(
  {
    // RELAÇÃO COM TIME
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Time',
      index: true,     // cria index em teamId
      required: false, // não obrigatório
    },

    // SALDOS
    saldo: { type: Number, default: 0, min: 0 },
    saldoCongelado: { type: Number, default: 0, min: 0 },

    // CRÉDITO SEMANAL
    allowance: { type: Number, default: 200, min: 0 },
    startOfWeek: { type: Date, default: null },
  },
  { timestamps: true }
);

// índices auxiliares (opcional)
playerSchema.index({ saldo: 1 }); // consultar/ordenar por saldo

module.exports = mongoose.model('Player', playerSchema);

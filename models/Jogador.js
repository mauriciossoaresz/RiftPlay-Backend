const mongoose = require("mongoose");

const jogadorSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    nickname: { type: String, required: true, trim: true }, // TODO: validar que o nickname do jogador é o mesmo do Wild Rift (integração futura com IA / antifraude)
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"],
    },
    senhaHash: { type: String, required: true },
    cpf: { type: String, required: true, unique: true, trim: true },
    saldo: { type: Number, default: 200, min: 0 },
    timeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Time",
      default: null,
    },
    isCapitao: { type: Boolean, default: false },
    ultimaRecarga: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Índices para performance
jogadorSchema.index({ timeId: 1 });

// Melhoria: exportação explícita do modelo
module.exports = mongoose.model("Jogador", jogadorSchema);

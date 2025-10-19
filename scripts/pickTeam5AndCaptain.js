// scripts/pickTeam5AndCaptain.js
require('dotenv').config();
const mongoose = require('mongoose');

const Time = require('../models/Time');
let Jogador; // pode não existir no seu projeto, tentamos carregar

(async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) {
      console.error(JSON.stringify({ ok:false, error: 'MONGO_URI ausente no .env' }));
      process.exit(1);
    }
    await mongoose.connect(uri, {});

    try { Jogador = require('../models/Jogador'); } catch {}

    // opcional: excluir um time específico passado por arg (por ex. o TEAM_A)
    const excludeId = process.argv[2];

    // acha um time com exatamente 5 jogadores (players ou membros)
    const t = await Time.findOne({
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      $or: [
        { $expr: { $eq: [ { $size: { $ifNull: ['$players', []] } }, 5 ] } },
        { $expr: { $eq: [ { $size: { $ifNull: ['$membros', []] } }, 5 ] } },
      ],
    }).lean();

    if (!t) {
      console.log(JSON.stringify({ ok:false, error:'nenhum_time_com_5' }));
      process.exit(0);
    }

    // tenta achar capitão (Jogador com isCapitao/isCaptain)
    let capId = null;
    if (Jogador) {
      const cap = await Jogador.findOne({
        timeId: t._id,
        $or: [{ isCapitao: true }, { isCaptain: true }],
      }).select('_id').lean();
      if (cap) capId = String(cap._id);
    }

    // se não achar capitão marcado, pega o 1º membro/jogador da lista
    if (!capId) {
      const arr = Array.isArray(t.players) && t.players.length ? t.players
                : Array.isArray(t.membros) ? t.membros.map(m => m.playerId || m._id) : [];
      if (arr.length) capId = String(arr[0]);
    }

    if (!capId) {
      console.log(JSON.stringify({ ok:false, error:'capitao_nao_encontrado', teamB: String(t._id) }));
      process.exit(0);
    }

    console.log(JSON.stringify({ ok:true, teamB: String(t._id), capB: capId }));
    process.exit(0);
  } catch (e) {
    console.error(JSON.stringify({ ok:false, error: e.message || String(e) }));
    process.exit(1);
  }
})();

// backend/scripts/backfillPlayersFromJogador.js
require('dotenv').config();
const mongoose = require('mongoose');
const Time   = require('../models/Time');
let Jogador  = null;
try { Jogador = require('../models/Jogador'); } catch {}
const Player = require('../models/Player');

const mondayUTC = (d = new Date()) => {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCHours(0,0,0,0);
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
};

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) throw new Error('Defina MONGODB_URI/MONGO_URI/DATABASE_URL no .env');

  await mongoose.connect(uri, {});
  const times = await Time.find({}).select('_id nome membros players').lean();

  let created = 0, skipped = 0;
  for (const t of times) {
    const memberIds = (Array.isArray(t.membros) && t.membros.length ? t.membros :
                      Array.isArray(t.players) && t.players.length ? t.players : [])
                      .map(String);
    if (!memberIds.length) continue;

    const nameById = new Map();
    if (Jogador) {
      const jogs = await Jogador.find({ _id: { $in: memberIds } }).select('_id nome apelido nick username').lean();
      for (const j of jogs) nameById.set(String(j._id), j.nome || j.apelido || j.nick || j.username || '');
    }

    for (const id of memberIds) {
      const exists = await Player.exists({ _id: id });
      if (exists) { skipped++; continue; }
      await Player.create({
        _id: id,
        timeId: t._id,
        nome: nameById.get(id) || undefined,
        saldo: 500,              // >>> saldo inicial para permitir aceitar partidas
        saldoCongelado: 0,
        lastTopUpAt: new Date(0) // >>> força top-up semanal acumulado na próxima partida
      });
      created++;
    }
  }

  console.log(`Backfill concluído. Criados: ${created}, já existiam: ${skipped}.`);
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch {}; process.exit(1); });

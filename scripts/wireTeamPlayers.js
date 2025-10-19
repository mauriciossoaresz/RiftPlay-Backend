// backend/scripts/wireTeamPlayers.js
require('dotenv').config();
const mongoose = require('mongoose');

const Time    = require('../models/Time');
const Jogador = require('../models/Jogador');
const Player  = require('../models/Player');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {});
    const teamIds = process.argv.slice(2).filter(Boolean);
    if (!teamIds.length) {
      console.log('uso: node scripts/wireTeamPlayers.js <TEAM_ID> [<TEAM_ID_2> ...]');
      process.exit(1);
    }

    for (const tid of teamIds) {
      const js = await Jogador.find({ timeId: tid }).select('_id').limit(5).lean();
      const ids = js.map(j => j._id);
      if (ids.length !== 5) {
        console.log('⚠️  Time sem 5 jogadores; pulando:', String(tid), 'got', ids.length);
        continue;
      }

      // garante Player docs com mesmo _id
      for (const _id of ids) {
        await Player.updateOne(
          { _id },
          { $setOnInsert: { saldo: 0, saldoCongelado: 0 } },
          { upsert: true }
        );
      }

      // grava snapshot que o matchmaking usa p/ “modo por jogador”
      await Time.updateOne({ _id: tid }, { $set: { players: ids } });

      console.log('✅ Wire concluído para time', String(tid), 'players=', ids.map(String));
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();


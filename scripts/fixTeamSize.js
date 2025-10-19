// backend/scripts/fixTeamSize.js
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const [teamId] = process.argv.slice(2);
  if (!teamId) {
    console.log('Uso: node scripts/fixTeamSize.js <teamId>');
    process.exit(1);
  }

  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DB_URI ||
    process.env.DATABASE_URL;

  if (!uri) {
    console.error('ERRO: nenhuma URI de Mongo encontrada na .env (MONGODB_URI/MONGO_URI/DB_URI/DATABASE_URL).');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);

    const teamsCol = mongoose.connection.collection('teams');
    const { ObjectId } = mongoose.Types;

    const team = await teamsCol.findOne({ _id: new ObjectId(teamId) });
    if (!team) {
      console.log('Time não encontrado:', teamId);
      process.exit(1);
    }

    const field = Array.isArray(team.players) ? 'players'
                 : Array.isArray(team.jogadores) ? 'jogadores'
                 : null;

    if (!field) {
      console.log('Nenhuma lista de jogadores encontrada neste time (players/jogadores).');
      process.exit(1);
    }

    const arr = team[field] || [];
    const seen = new Set();
    const uniq = [];
    for (const p of arr) {
      const id = (p?.playerId || p?._id || p).toString();
      if (!seen.has(id)) { seen.add(id); uniq.push(p); }
    }

    const keep = uniq.slice(0, 5);
    await teamsCol.updateOne({ _id: team._id }, { $set: { [field]: keep } });

    const after = await teamsCol.findOne({ _id: team._id });
    console.log(`OK: ${teamId} agora tem ${(after[field]||[]).length} jogadores (campo "${field}").`);
  } catch (e) {
    console.error('Erro ao ajustar time:', e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();

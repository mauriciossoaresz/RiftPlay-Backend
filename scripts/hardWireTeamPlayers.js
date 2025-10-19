// backend/scripts/hardWireTeamPlayers.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const [teamId, ...playerIds] = process.argv.slice(2);
  if (!teamId || playerIds.length !== 5) {
    console.log('Uso: node scripts/hardWireTeamPlayers.js <teamId> <p1> <p2> <p3> <p4> <p5>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ Sem MONGODB_URI/MONGO_URI no .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const Team = require('../models/Time'); // ajuste se o model tiver outro nome/caminho

  const ids = playerIds.map((id) => new mongoose.Types.ObjectId(id));
  const t = await Team.findById(teamId);
  if (!t) {
    console.log('Time não encontrado:', teamId);
    process.exit(1);
  }

  // escreve nos dois campos, se existirem
  if (Array.isArray(t.players) || t.players === undefined) t.players = ids;
  if (Array.isArray(t.jogadores) || t.jogadores === undefined) t.jogadores = ids;

  await t.save();

  console.log('✅ Elenco definido para o time', String(teamId));
  console.table(playerIds);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

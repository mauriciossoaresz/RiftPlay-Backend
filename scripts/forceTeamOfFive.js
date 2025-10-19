// backend/scripts/forceTeamOfFive.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const [teamId] = process.argv.slice(2);
  if (!teamId) {
    console.log('Uso: node scripts/forceTeamOfFive.js <teamId>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ Sem MONGODB_URI/MONGO_URI no .env');
    process.exit(1);
  }
  await mongoose.connect(uri);

  // Carrega o model direto do caminho padrão
  const Team = require('../models/Time'); // ajuste se o model tiver outro nome/caminho

  // Busca o time
  const t = await Team.findById(teamId);
  if (!t) {
    console.log('Time não encontrado:', teamId);
    process.exit(1);
  }

  // Detecta campos possíveis
  const arrA = Array.isArray(t.players) ? t.players.map(String) : [];
  const arrB = Array.isArray(t.jogadores) ? t.jogadores.map(String) : [];

  // Preferimos o que tiver dados; se ambos tiverem, juntamos e uniquificamos
  let ids = [...new Set([...(arrA || []), ...(arrB || [])])];

  if (ids.length === 0) {
    console.log('⚠️  Time sem elenco. Campo players/jogadores vazio.');
    process.exit(1);
  }

  // Garante exatamente 5
  if (ids.length < 5) {
    console.log(`⚠️  Time com ${ids.length} jogadores. Precisa ter 5 para o matchmaking.`);
    process.exit(1);
  }
  ids = ids.slice(0, 5);

  // Garante que o capitão (se existir) está entre os 5
  const capKeys = ['capitao', 'capitan', 'captain', 'capitaoId', 'owner', 'lider', 'leader'];
  let cap = null;
  for (const k of capKeys) {
    if (t[k]) { cap = String(t[k]); break; }
  }
  if (cap && !ids.includes(cap)) {
    // coloca o capitão no lugar do primeiro
    ids[0] = cap;
  }

  // Converte de volta para ObjectId
  const objIds = ids.map(id => new mongoose.Types.ObjectId(id));

  // Escreve nos dois campos, se existirem
  if (Array.isArray(t.players))   t.players   = objIds;
  if (Array.isArray(t.jogadores)) t.jogadores = objIds;

  await t.save();

  console.log('✅ Ajustado para 5 jogadores.');
  console.table(ids);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

// backend/scripts/purgeJogadores.js
require('dotenv').config();
const mongoose = require('mongoose');
const conectarMongo = require('../config/db');

async function fixOne(col, id) {
  const _id = new mongoose.Types.ObjectId(id);
  const doc = await col.findOne({ _id });
  if (!doc) {
    console.log('❌ Time não encontrado:', id);
    return;
  }

  const players = (doc.players || []).map(String);
  const jogadores = (doc.jogadores || []).map(String);
  const merged = [...players, ...jogadores];

  // únicos e no máximo 5
  const uniq = [...new Set(merged)].slice(0, 5);

  await col.updateOne(
    { _id },
    { $set: { players: uniq }, $unset: { jogadores: "" } }
  );

  const after = await col.findOne({ _id });
  console.log('✅ Normalizado:', id, {
    players: (after.players || []).map(String),
    temJogadores: !!after.jogadores
  });
}

(async () => {
  try {
    const ids = process.argv.slice(2);
    if (ids.length === 0) {
      console.log('Uso: node scripts/purgeJogadores.js <teamId> [<teamId>...]');
      process.exit(1);
    }

    await conectarMongo();
    const col = mongoose.connection.db.collection('times'); // coleção do modelo Time

    for (const id of ids) {
      // valida id
      if (!/^[a-f0-9]{24}$/i.test(id)) {
        console.log('Ignorando id inválido:', id);
        continue;
      }
      await fixOne(col, id);
    }
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro:', e?.message || e);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();

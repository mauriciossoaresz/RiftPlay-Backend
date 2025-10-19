// scripts/fix-player-index.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const conectarMongo = require('../config/db');
const mongoose = require('mongoose');

(async () => {
  try {
    await conectarMongo();
    const Player = require('../models/Player');

    const idx = await Player.collection.indexes();
    const names = idx.map(i => i.name);
    const legacyNames = ['player_timeId_1', 'timeId_1']; // possíveis nomes

    const toDrop = legacyNames.filter(n => names.includes(n));

    if (toDrop.length === 0) {
      console.log('✅ Nenhum índice legado encontrado. Índices atuais:', names);
    } else {
      for (const n of toDrop) {
        try {
          await Player.collection.dropIndex(n);
          console.log('🗑️  Removido índice legado:', n);
        } catch (e) {
          console.log('(info) Não consegui remover', n, '-', e?.message || e);
        }
      }
      console.log('\nÍndices de Player agora:', await Player.collection.indexes());
    }
  } catch (e) {
    console.error('Erro:', e);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();

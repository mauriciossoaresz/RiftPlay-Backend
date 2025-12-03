// backend/scripts/print-indexes.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const conectarMongo = require('../config/db');
const mongoose = require('mongoose');
const Jogador = require('../models/Jogador');
const Time = require('../models/Time');
const Match = require('../models/Match');
const Queue = require('../models/Queue');
const Player = require('../models/Player');

(async () => {
  try {
    console.log('> print-indexes: conectando ao MongoDB…');
    await conectarMongo();

    const jogadorIndexes = await Jogador.collection.indexes();
    const timeIndexes = await Time.collection.indexes();
    const matchIndexes = await Match.collection.indexes();
    const queueIndexes = await Queue.collection.indexes();
    const playerIndexes = await Player.collection.indexes();

    console.log('\nÍndices de Jogador:\n', jogadorIndexes);
    console.log('\nÍndices de Time:\n', timeIndexes);
    console.log('\nÍndices de Match:\n', matchIndexes);
    console.log('\nÍndices de Queue:\n', queueIndexes);
    console.log('\nÍndices de Player:\n', playerIndexes);

    console.log('\n> print-indexes: concluído.');
  } catch (e) {
    console.error('Erro em print-indexes:', e);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();

// scripts/build-indexes.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const conectarMongo = require('../config/db');
const mongoose = require('mongoose');

(async () => {
  console.log('> build-indexes: iniciando…');
  const t0 = Date.now();
  try {
    await conectarMongo();

    // Importa modelos DEPOIS da conexão
    const Jogador = require('../models/Jogador');
    const Time = require('../models/Time');
    const Match = require('../models/Match');
    const Queue = require('../models/Queue');
    const Player = require('../models/Player');

    // Helper: cria índice e ignora conflito de nome/opções (code 85/48)
    async function ensureIndex(collection, spec, options = {}) {
      try {
        await collection.createIndex(spec, options);
        console.log('✓ Index OK:', { spec, options });
      } catch (e) {
        // 85 = IndexOptionsConflict, 48 = IndexAlreadyExists
        if (e?.code === 85 || e?.code === 48) {
          console.log('• Index já existia (nome/opção diferente):', { spec, options });
        } else {
          throw e;
        }
      }
    }

    // ========= Jogador =========
    await ensureIndex(Jogador.collection, { timeId: 1 }, { name: 'jogador_timeId_1' });
    await ensureIndex(Jogador.collection, { email: 1 }, { unique: true, name: 'jogador_email_unique' });
    await ensureIndex(Jogador.collection, { cpf: 1 }, { unique: true, name: 'jogador_cpf_unique' });

    // ========= Time =========
    await ensureIndex(Time.collection, { nome: 1 }, { unique: true, name: 'time_nome_unique' });
    await ensureIndex(Time.collection, { jogadores: 1 }, { name: 'time_jogadores_1' });

    // ========= Match =========
    await ensureIndex(Match.collection, { status: 1, createdAt: -1 }, { name: 'match_status_createdAt_-1' });
    await ensureIndex(Match.collection, { status: 1, acceptDeadline: 1 }, { name: 'match_status_acceptDeadline_1' });
    await ensureIndex(Match.collection, { teams: 1, createdAt: -1 }, { name: 'match_teams_createdAt_-1' });
    await ensureIndex(Match.collection, { teams: 1, status: 1 }, { name: 'match_teams_status_1' });

    // ========= Queue =========
    await ensureIndex(Queue.collection, { teamId: 1 }, { unique: true, name: 'queue_teamId_unique' });
    await ensureIndex(Queue.collection, { valorAposta: 1, createdAt: 1 }, { name: 'queue_aposta_createdAt_1' });
    // TTL é criado dinamicamente no schema, não aqui

    // ========= Player =========
    await ensureIndex(Player.collection, { teamId: 1 }, { name: 'player_teamId_1' });
    await ensureIndex(Player.collection, { saldo: 1 }, { name: 'player_saldo_1' });

    // ---- dump final de índices ----
    console.log('\nÍndices de Queue:',  await Queue.collection.indexes());
    console.log('\nÍndices de Match:',  await Match.collection.indexes());
    console.log('\nÍndices de Player:', await Player.collection.indexes());

    console.log(`\n> build-indexes: concluído em ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  } catch (e) {
    console.error('✗ Erro ao criar índices:', e);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();

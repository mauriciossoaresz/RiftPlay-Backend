// backend/jobs/matchTimeoutSweep.js
// Varredura contínua de timeouts com proteções (match ativa, lock distribuído, índices)

const mongoose = require('mongoose');
const Match = require('../models/Match');
const Queue = require('../models/Queue');

const SWEEP_EVERY_MS = Number(process.env.TIMEOUT_SWEEP_MS) || 5000; // frequência de varredura
const LOCK_ID = 'match-timeout-sweeper'; // id do lock distribuído
const LOCK_LEASE_MS = Number(process.env.TIMEOUT_SWEEP_LOCK_MS) || SWEEP_EVERY_MS * 3; // duração do lock

let _timer = null;

// --- [3] Índices para performance/consistência ---
async function ensureIndexes() {
  try {
    await Match.collection.createIndex(
      { status: 1, acceptDeadline: 1 },
      { name: 'status_acceptDeadline_1' }
    );
  } catch (_) {}

  try {
    await Queue.collection.createIndex(
      { teamId: 1 },
      { unique: true, name: 'teamId_unique' }
    );
  } catch (_) {}

  try {
    const locks = mongoose.connection.db.collection('locks');
    await locks.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'expiresAt_ttl' }
    );
  } catch (_) {}
}

// --- [2] Lock distribuído via Mongo (renova OU cria, null-safe) ---
async function withDistributedLock(fn) {
  const locks = mongoose.connection.db.collection('locks');
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LOCK_LEASE_MS);

  let acquired = false;

  // 1) tenta RENOVAR lock vencido (sem upsert)
  try {
    const res = await locks.findOneAndUpdate(
      { _id: LOCK_ID, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { expiresAt: leaseUntil } },
      { returnDocument: 'after' }
    );
    if (res && res.value) acquired = true;
  } catch (_) {}

  // 2) se não renovou, tenta CRIAR (sem upsert)
  if (!acquired) {
    try {
      await locks.insertOne({ _id: LOCK_ID, expiresAt: leaseUntil });
      acquired = true;
    } catch (_) {
      acquired = false;
    }
  }

  if (!acquired) return;

  try {
    await fn();
  } finally {
    // opcional: liberar antes do lease expirar
    // await locks.updateOne({ _id: LOCK_ID }, { $set: { expiresAt: new Date() } });
  }
}

// --- Lógica principal da varredura ---
async function sweepPendingMatches() {
  await ensureIndexes(); // idempotente

  await withDistributedLock(async () => {
    const now = new Date();

    // usa aggregation para evitar CastError em datas
    const pendentesVencidos = await Match.aggregate([
      { $match: { status: 'pendente' } },
      { $match: { acceptDeadline: { $ne: null } } },
      { $match: { $expr: { $lte: ['$acceptDeadline', now] } } },
      { $project: { _id: 1, teams: 1, valorAposta: 1 } },
    ]);

    if (!pendentesVencidos.length) return;

    for (const m of pendentesVencidos) {
      try {
        // cancelamento atômico (evita race de aceite tardio)
        const updated = await Match.findOneAndUpdate(
          { _id: m._id, status: 'pendente' },
          { $set: { status: 'cancelada', cancelReason: 'timeout', finishedAt: new Date() } },
          { new: true }
        );

        if (!updated) continue; // já mudou em outra corrida

        // re-enfileira cada time somente se não estiver em outra partida ativa
        for (const teamId of updated.teams) {
          const temAtivo = await Match.exists({
  teams: teamId,
  $or: [{ status: 'pendente' }, { status: 'em_andamento' }],
});

          if (temAtivo) continue;

          await Queue.findOneAndUpdate(
            { teamId },
            {
              $set: { valorAposta: updated.valorAposta },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }

        console.log(`[timeout] Match ${updated._id} cancelada por timeout; times re-enfileirados quando elegíveis.`);
      } catch (e) {
        console.error('[timeout] erro ao cancelar/re-enfileirar:', e);
      }
    }
  });
}

// Exporta o agendador contínuo
function scheduleMatchTimeoutSweep() {
  if (_timer) return;
  _timer = setInterval(() => {
    sweepPendingMatches().catch(err => console.error('[timeout] sweep error:', err));
  }, SWEEP_EVERY_MS);
  console.log(`[timeout] varredura de timeouts a cada ${SWEEP_EVERY_MS} ms (com lock distribuído)`);
}

module.exports = { scheduleMatchTimeoutSweep };

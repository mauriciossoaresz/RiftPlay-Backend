#!/usr/bin/env node

// Mostra saldos (saldo / saldoCongelado) dos jogadores de 1..N times.
// Uso: node scripts/printBalances.js <teamId1> <teamId2> ...

require('dotenv').config();
const mongoose = require('mongoose');

const Time   = require('../models/Time');
const Player = require('../models/Player');

let Jogador = null;
try { Jogador = require('../models/Jogador'); } catch { /* opcional */ }

// ----------------- helpers -----------------
const isValidObjectId = (id) => !!id && mongoose.Types.ObjectId.isValid(id);
const oid = (id) => new mongoose.Types.ObjectId(id);

async function getTeamPlayerIds(teamId) {
  // 1) tenta pelos campos do Time (membros | players)
  const t = await Time.findById(teamId).select('membros players').lean();
  let ids = [];
  if (t) {
    if (Array.isArray(t.membros) && t.membros.length) ids = t.membros;
    else if (Array.isArray(t.players) && t.players.length) ids = t.players;
  }
  // 2) se não veio nada, tenta por Player.timeId
  if (!ids.length) {
    const ps = await Player.find({ timeId: teamId }).select('_id').lean();
    ids = ps.map(p => p._id);
  }
  // 3) fallback via Jogador.timeId (se existir o modelo)
  if (!ids.length && Jogador) {
    const js = await Jogador.find({ timeId: teamId }).select('_id').lean();
    ids = js.map(j => j._id);
  }
  return ids.map(String);
}

function pickName(p) {
  return (
    p?.nome ||
    p?.name ||
    p?.nick ||
    p?.username ||
    p?._id?.toString() ||
    'sem-nome'
  );
}

// ----------------- main -----------------
(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('❌ MONGODB_URI/MONGO_URI/DATABASE_URL não definido no .env');
    process.exit(1);
  }

  const teamIds = process.argv.slice(2).filter(isValidObjectId);
  if (!teamIds.length) {
    console.error('Uso: node scripts/printBalances.js <teamId1> <teamId2> ...');
    process.exit(1);
  }

  await mongoose.connect(uri, {});

  for (const tid of teamIds) {
    const team = await Time.findById(tid).lean().catch(() => null);
    const teamName = team?.nome || team?.name || tid;

    const memberIds = await getTeamPlayerIds(tid);
    if (!memberIds.length) {
      console.log(`\n=== TIME ${teamName} (${tid}) ===`);
      console.log('Nenhum jogador encontrado para o time.');
      continue;
    }

    // Busca em Player; se não existir em Player, tenta Jogador só pra nome
    const players = await Player.find({ _id: { $in: memberIds.map(oid) } })
      .select('_id saldo saldoCongelado nome name nick username lastTopUpAt')
      .lean();

    // Mapa pra nomes via Jogador (opcional)
    let jogMap = new Map();
    if (Jogador) {
      const jogs = await Jogador.find({ _id: { $in: memberIds.map(oid) } })
        .select('_id nome apelido nick username')
        .lean();
      jogMap = new Map(jogs.map(j => [String(j._id), j]));
    }

    const rows = [];
    for (const idStr of memberIds) {
      const p = players.find(x => String(x._id) === idStr);
      const j = jogMap.get(idStr) || {};
      const nome = p ? pickName(p) : (j.nome || j.apelido || j.nick || j.username || idStr);

      const saldo = Number(p?.saldo || 0);
      const congelado = Number(p?.saldoCongelado || 0);
      rows.push({
        jogador: nome,
        playerId: idStr,
        saldo,
        congelado,
        total: saldo + congelado,
        lastTopUpAt: p?.lastTopUpAt || null,
      });
    }

    // ordena por nome
    rows.sort((a, b) => a.jogador.localeCompare(b.jogador, 'pt-BR'));

    const sum = (k) => rows.reduce((acc, r) => acc + Number(r[k] || 0), 0);

    console.log(`\n=== TIME ${teamName} (${tid}) ===`);
    console.table(rows, ['jogador', 'playerId', 'saldo', 'congelado', 'total']);
    console.log('Totais do time:', {
      jogadores: rows.length,
      saldo: sum('saldo'),
      congelado: sum('congelado'),
      total: sum('total'),
    });
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error('Erro:', e?.message || e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

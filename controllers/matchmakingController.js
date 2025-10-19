// backend/controllers/matchmakingController.js
const Queue    = require('../models/Queue');
const Match    = require('../models/Match');
const Time     = require('../models/Time');
const Player   = require('../models/Player');
const mongoose = require('mongoose');

// ===== Config =====
const ACCEPT_TIMEOUT_SECS     = Number(process.env.MATCH_ACCEPT_TIMEOUT_SECS) || 60;
const WEEKLY_TOPUP_PER_PLAYER = Number(process.env.WEEKLY_TOPUP_PER_PLAYER)  || 200;

// ===== Helpers =====
const isValidObjectId = (id) => !!id && mongoose.Types.ObjectId.isValid(String(id));
const toNumber        = (v) => (Number.isFinite(+v) ? +v : NaN);
const idEq            = (a, b) => String(a) === String(b);

// toOid robusto (não recria ObjectId se já for)
const toOid = (x) => {
  if (x instanceof mongoose.Types.ObjectId) return x;
  return new mongoose.Types.ObjectId(String(x));
};

// $in seguro via AGGREGATE (evita “Cast to ObjectId failed for value { $in: … }”)
async function aggFindPlayersByIds(ids, session, projection = ['_id', 'saldo']) {
  const arr = [...new Set((ids || []).map(toOid))];
  if (!arr.length) return [];
  const pipe = [
    { $match: { _id: { $in: arr } } },
    { $project: projection.reduce((acc, k) => (acc[k] = 1, acc), {}) }
  ];
  const agg = Player.aggregate(pipe);
  if (session) agg.session(session);
  return agg.exec();
}

// --- Aposta por cabeça (MVP exige inteiro e distribuição exata) ---
function calcPerHead(valorAposta, membersCount) {
  if (!Number.isFinite(valorAposta) || valorAposta < 1) return NaN;
  if (!Number.isInteger(valorAposta)) return NaN;
  if (membersCount < 5) return NaN;
  if (valorAposta % membersCount !== 0) return NaN;
  return valorAposta / membersCount;
}

// ===== Tolerância / faixa =====
function getTolerancePercent(minutes) {
  if (minutes <= 2) return 0.3;
  if (minutes <= 4) return 1.0;
  if (minutes <= 6) return 3.0;
  return 10.0;
}
function rangeByTolerance(valorAposta, tol) {
  const delta = Math.floor(valorAposta * tol);
  const min = Math.max(1, valorAposta - delta);
  const max = valorAposta + delta;
  return { min, max };
}

// ===== Top-up semanal cumulativo (por jogador) =====
function mondayUTC(d = new Date()) {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCHours(0,0,0,0);
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}
function weeksBetween(fromMon, toMon) {
  const ms = toMon.getTime() - fromMon.getTime();
  const w  = Math.floor(ms / (7*24*60*60*1000));
  return w > 0 ? w : 0;
}
async function applyWeeklyTopUpToPlayers(playerIds, session) {
  const arr = [...new Set((playerIds || []).map(toOid))];
  if (!arr.length) return;

  // via aggregate para evitar cast no _id
  const pipe = [
    { $match: { _id: { $in: arr } } },
    { $project: { _id: 1, saldo: 1, lastTopUpAt: 1, createdAt: 1 } }
  ];
  const agg = Player.aggregate(pipe);
  if (session) agg.session(session);
  const players = await agg.exec();
  if (!players.length) return;

  const nowMonday = mondayUTC(new Date());
  const incOps = [];
  const setOps = [];

  for (const p of players) {
    const last = p.lastTopUpAt ? mondayUTC(new Date(p.lastTopUpAt))
      : p.createdAt           ? mondayUTC(new Date(p.createdAt))
      : nowMonday;
    const w = weeksBetween(last, nowMonday);
    if (w > 0) {
      const credit = w * WEEKLY_TOPUP_PER_PLAYER;
      incOps.push({ updateOne: { filter: { _id: p._id }, update: { $inc: { saldo: credit } } } });
      setOps.push({ updateOne: { filter: { _id: p._id }, update: { $set: { lastTopUpAt: nowMonday } } } });
    } else {
      setOps.push({ updateOne: { filter: { _id: p._id }, update: { $set: { lastTopUpAt: p.lastTopUpAt || nowMonday } } } });
    }
  }

  if (incOps.length) await Player.bulkWrite(incOps, { session });
  if (setOps.length) await Player.bulkWrite(setOps, { session });
}

/** ids de jogadores do Time (players|jogadores|membros) com DISTINCT => ObjectId[] */
async function getTeamPlayerIds(teamId, session) {
  const t = await Time.findById(teamId).session(session || null).select('players jogadores membros').lean();
  if (!t) return [];
  const toId = (x) => String(x?.playerId ?? x?._id ?? x);
  const merged = [
    ...(Array.isArray(t.players)   ? t.players   : []),
    ...(Array.isArray(t.jogadores) ? t.jogadores : []),
    ...(Array.isArray(t.membros)   ? t.membros   : []),
  ].map(toId).filter(Boolean);
  const distinct = [...new Set(merged)];
  return distinct.map(toOid);
}

// ======== Endpoints ========

// POST /api/matchmaking/queue
exports.enterQueue = async (req, res) => {
  try {
    const mm = (global.__mm ||= {
      counters: { queued: 0, matched: 0 },
      log(ev, data = {}) { console.log(`[mm] ${new Date().toISOString()} ${ev}`, data, 'counters=', { ...this.counters }); },
    });

    const { teamId } = req.body;
    let { valorAposta } = req.body;

    if (!isValidObjectId(teamId)) return res.status(400).json({ ok:false, error:'teamId inválido' });
    valorAposta = toNumber(valorAposta);
    if (!Number.isFinite(valorAposta) || valorAposta < 1) return res.status(400).json({ ok:false, error:'valorAposta inválido (>= 1)' });

    const oid = toOid(teamId);
    const team = await Time.findById(oid).lean();
    if (!team) return res.status(404).json({ ok:false, error:'Time não encontrado' });

    const emMatch = await Match.exists({ teams: oid, $or:[{status:'pendente'},{status:'em_andamento'}] });
    if (emMatch) return res.status(400).json({ ok:false, error:'Time já está em uma partida' });

    const mine = await Queue.findOneAndUpdate(
      { teamId: oid },
      { $set: { valorAposta, byUserId: req.user?._id }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const createdAt = mine.createdAt || new Date();
    const minutes   = (Date.now() - new Date(createdAt).getTime()) / 60000;
    const tol       = getTolerancePercent(minutes);
    const { min, max } = rangeByTolerance(mine.valorAposta, tol);

    const candidates = await Queue.find({}).sort({ createdAt: 1 }).limit(100).lean();
    const opponent = candidates.find(c =>
      String(c.teamId) !== String(oid) &&
      Number.isFinite(+c.valorAposta) &&
      c.valorAposta >= min && c.valorAposta <= max
    );

    if (!opponent) {
      mm.counters.queued += 1;
      mm.log('queue', { teamId: oid.toHexString(), valorAposta: mine.valorAposta, range: { min, max } });
      return res.status(200).json({ ok:true, queued:true, teamId: oid.toHexString(), valorAposta: mine.valorAposta, tolerance: tol, range:{min,max} });
    }

    const oppOid = toOid(opponent.teamId);
    const menorAposta = Math.min(mine.valorAposta, opponent.valorAposta);
    const match = await Match.create({
      teams: [oid, oppOid],
      valorAposta: menorAposta,
      status: 'pendente',
      createdAt: new Date(),
      acceptDeadline: new Date(Date.now() + ACCEPT_TIMEOUT_SECS * 1000),
    });

    await Promise.all([ Queue.deleteOne({ teamId: oid }), Queue.deleteOne({ teamId: oppOid }) ]);

    mm.counters.matched += 1;
    mm.log('matched', { matchId: String(match._id), teams: match.teams.map(String), valorAposta: match.valorAposta });

    return res.status(201).json({ ok:true, matched:true, matchId: match._id, teams: match.teams, valorAposta: match.valorAposta, status: match.status });
  } catch (err) {
    console.error('enterQueue error:', err);
    return res.status(500).json({ ok:false, error:'Erro interno' });
  }
};

// POST /api/matchmaking/cancel
exports.cancelQueue = async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!isValidObjectId(teamId)) return res.status(400).json({ ok:false, error:'teamId inválido' });
    const del = await Queue.deleteOne({ teamId: toOid(teamId) });
    return res.status(200).json({ ok:true, deleted: del.deletedCount });
  } catch (err) {
    console.error('cancelQueue error:', err);
    return res.status(500).json({ ok:false, error:'Erro interno' });
  }
};

// GET /api/matchmaking/status
exports.status = async (req, res) => {
  try {
    let { teamId } = req.query;
    teamId = String(teamId || '').trim();
    if (!isValidObjectId(teamId)) return res.status(400).json({ ok:false, error:'teamId inválido' });

    const oid = toOid(teamId);
    const match = await Match.findOne({ teams: oid, $or:[{status:'pendente'},{status:'em_andamento'}]}).sort({ createdAt: -1 }).lean();

    if (match) {
      return res.status(200).json({
        ok:true, matched:true, matchId:String(match._id), status:match.status,
        teams:(match.teams||[]).map(String), valorAposta:match.valorAposta, perHead:match.perHead??null,
        startedAt:match.startedAt??null, finishedAt:match.finishedAt??null,
        acceptedBy:(match.acceptedBy||[]).map(String), winnerTeamId: match.winnerTeamId?String(match.winnerTeamId):null,
        acceptDeadline: match.acceptDeadline ?? null, cancelReason: match.cancelReason ?? null,
      });
    }

    const q = await Queue.findOne({ teamId: oid }).lean();
    if (q) {
      const createdAt = q.createdAt instanceof Date ? q.createdAt : new Date(q.createdAt || Date.now());
      const minutes = (Date.now() - createdAt.getTime()) / 60000;
      const tol = getTolerancePercent(minutes);
      const { min, max } = rangeByTolerance(q.valorAposta, tol);
      return res.status(200).json({ ok:true, queued:true, teamId: oid.toHexString(), valorAposta:q.valorAposta, tolerance:tol, range:{min,max} });
    }

    return res.status(200).json({ ok:true, queued:false, matched:false });
  } catch (err) {
    console.error('status error:', err);
    return res.status(500).json({ ok:false, error:'Erro interno' });
  }
};

// ===================== Ciclo da partida =====================

// POST /api/matchmaking/accept
exports.accept = async (req, res) => {
  try {
    const { matchId, teamId } = req.body;
    if (!isValidObjectId(matchId) || !isValidObjectId(teamId)) {
      return res.status(400).json({ ok:false, error:'matchId e teamId válidos são obrigatórios' });
    }

    const match = await Match.findOne({ _id: matchId, teams: teamId, $or:[{status:'pendente'},{status:'em_andamento'}] });
    if (!match) return res.status(404).json({ ok:false, error:'Partida não encontrada ou inválida para aceitar' });

    // timeout
    if (match.status === 'pendente' && match.acceptDeadline && Date.now() > new Date(match.acceptDeadline).getTime()) {
      match.status = 'cancelada'; match.cancelReason = 'timeout'; match.finishedAt = new Date();
      await match.save();
      await Promise.all(match.teams.map((tid) =>
        Queue.findOneAndUpdate({ teamId: tid }, { $set:{ valorAposta: match.valorAposta }, $setOnInsert:{ createdAt:new Date() } }, { upsert:true, setDefaultsOnInsert:true })
      ));
      return res.status(409).json({ ok:false, canceled:true, error:'match timeout', matchId: match._id, cancelReason: match.cancelReason });
    }

    if (!Array.isArray(match.acceptedBy)) match.acceptedBy = [];
    if (!match.acceptedBy.some(t => idEq(t, teamId))) match.acceptedBy.push(teamId);

    const ambosAceitaram = match.teams.every(t => match.acceptedBy.some(a => idEq(a, t)));

    if (ambosAceitaram && match.status === 'pendente') {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const aposta = match.valorAposta;
          const [tA, tB] = match.teams.map(toOid);

          const [pAIds, pBIds] = await Promise.all([ getTeamPlayerIds(tA, session), getTeamPlayerIds(tB, session) ]);
          const bothHavePlayers = pAIds.length > 0 && pBIds.length > 0;

          if (bothHavePlayers) {
            await applyWeeklyTopUpToPlayers([...pAIds, ...pBIds], session);

            const shareA = aposta / pAIds.length;
            const shareB = aposta / pBIds.length;
            if (!Number.isFinite(shareA) || !Number.isFinite(shareB)) { const e=new Error('aposta_incompativel'); e.code='BAD_PER_HEAD'; throw e; }
            if (Math.abs(shareA - shareB) > 0) { const e=new Error('times_com_tamanhos_diferentes'); e.code='BAD_SIZE'; throw e; }

            const [playersA, playersB] = await Promise.all([
              aggFindPlayersByIds(pAIds, session, ['_id','saldo']),
              aggFindPlayersByIds(pBIds, session, ['_id','saldo']),
            ]);
            const insufA = playersA.find(p => (p.saldo ?? 0) < shareA);
            const insufB = playersB.find(p => (p.saldo ?? 0) < shareB);
            if (insufA || insufB) { const e=new Error('saldo_insuficiente_jogador'); e.code='SALDO_PLAYER'; e.data={ who:insufA?'timeA':'timeB', id:String((insufA||insufB)._id) }; throw e; }

            const ops = [];
            for (const id of pAIds) ops.push({ updateOne:{ filter:{ _id:id }, update:{ $inc:{ saldo:-shareA, saldoCongelado:+shareA } } } });
            for (const id of pBIds) ops.push({ updateOne:{ filter:{ _id:id }, update:{ $inc:{ saldo:-shareB, saldoCongelado:+shareB } } } });
            if (ops.length) await Player.bulkWrite(ops, { session });

            match.$session(session);
            match.status = 'em_andamento';
            match.startedAt = new Date();
            match.acceptDeadline = null;
            match.perHead = shareA;
            match.teamAPlayers = pAIds.map(toOid);
            match.teamBPlayers = pBIds.map(toOid);
            await match.save({ session });
          } else {
            const aposta = match.valorAposta;
            const teamsDocs = await Time.find({ _id: { $in: [tA, tB] } }).session(session).select('_id saldo saldoCongelado').lean();
            if (teamsDocs.length !== 2) { const err=new Error('times_nao_encontrados'); err.code='NOT_FOUND'; throw err; }
            const insuf = teamsDocs.find(t => (t.saldo ?? 0) < aposta);
            if (insuf) { const err=new Error('saldo_insuficiente'); err.code='SALDO'; throw err; }

            await Promise.all([ tA, tB ].map(_id => Time.updateOne({ _id }, { $inc:{ saldo:-aposta, saldoCongelado:+aposta } }, { session })));

            match.$session(session);
            match.status = 'em_andamento';
            match.startedAt = new Date();
            match.acceptDeadline = null;
            await match.save({ session });
          }
        });
      } catch (e) {
        if (session) await session.endSession().catch(()=>{});
        if (e?.code === 'SALDO_PLAYER') return res.status(400).json({ ok:false, error:'saldo_insuficiente_jogador', details:e.data, matchId:match._id });
        if (e?.code === 'BAD_PER_HEAD')  return res.status(400).json({ ok:false, error:'valorAposta_incompativel_com_tamanho_do_time', matchId:match._id });
        if (e?.code === 'BAD_SIZE')      return res.status(400).json({ ok:false, error:'times_com_tamanhos_diferentes', matchId:match._id });
        if (e?.code === 'SALDO')         return res.status(400).json({ ok:false, error:'saldo_insuficiente', matchId:match._id });
        if (e?.code === 'NOT_FOUND')     return res.status(404).json({ ok:false, error:'times_nao_encontrados', matchId:match._id });
        console.error('accept tx unexpected error:', e);
        return res.status(500).json({ ok:false, error:'accept_unexpected', message:String(e?.message||e), where:'withTransaction' });
      } finally {
        if (session) await session.endSession().catch(()=>{});
      }

      return res.status(200).json({ ok:true, matchId:match._id, status:match.status, acceptedBy:match.acceptedBy, teams:match.teams, startedAt:match.startedAt??null });
    }

    await match.save();
    return res.status(200).json({ ok:true, matchId:match._id, status:match.status, acceptedBy:match.acceptedBy, teams:match.teams, startedAt:match.startedAt??null });
  } catch (err) {
    console.error('accept error:', err);
    return res.status(500).json({ ok:false, error:'Erro interno' });
  }
};

// POST /api/matchmaking/finish
exports.finish = async (req, res) => {
  try {
    const { matchId, winnerTeamId, placar } = req.body;
    if (!isValidObjectId(matchId) || !isValidObjectId(winnerTeamId)) {
      return res.status(400).json({ ok:false, error:'matchId e winnerTeamId válidos são obrigatórios' });
    }

    let match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ ok:false, error:'Partida não encontrada' });
    if (!match.teams.some(t => idEq(t, winnerTeamId))) {
      return res.status(400).json({ ok:false, error:'winnerTeamId não pertence à partida' });
    }
    if (match.status === 'finalizada' || match.status === 'finalizado') {
      return res.status(200).json({ ok:true, alreadyFinished:true, matchId:match._id, status:match.status, winnerTeamId:match.winnerTeamId??null, placar:match.placar??null, finishedAt:match.finishedAt??match.endedAt??null });
    }
    if (match.status === 'pendente')  return res.status(409).json({ ok:false, error:'Partida ainda não começou (pendente)' });
    if (match.status === 'cancelada') return res.status(409).json({ ok:false, error:'Partida cancelada' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        match = await Match.findById(matchId).session(session);
        if (!match) throw new Error('match_nao_encontrada_tx');
        if (match.status === 'finalizada' || match.status === 'finalizado') return;

        const perHead = Number(match.perHead || 0);

        if (perHead > 0 && Array.isArray(match.teamAPlayers) && Array.isArray(match.teamBPlayers) &&
            match.teamAPlayers.length && match.teamBPlayers.length) {

          const A = match.teamAPlayers.map(toOid);
          const B = match.teamBPlayers.map(toOid);
          const all = [...A, ...B];

          // aggregate para checar congelado
          const pipe = [
            { $match: { _id: { $in: all } } },
            { $project: { _id:1, saldoCongelado:1 } }
          ];
          const agg = Player.aggregate(pipe).session(session);
          const players = await agg.exec();
          const byId = new Map(players.map(p => [String(p._id), p]));
          const bad = all.find(id => ((byId.get(String(id))?.saldoCongelado ?? 0) < perHead));
          if (bad) { const err=new Error('congelado_insuficiente_player'); err.code='SALDO_CONGELADO_PLAYER'; throw err; }

          const ops = all.map(id => ({ updateOne: { filter:{ _id:id }, update:{ $inc:{ saldoCongelado:-perHead } } } }));
          const winnerIsA = String(winnerTeamId) === String(match.teams[0]);
          const winners = winnerIsA ? A : B;
          for (const id of winners) ops.push({ updateOne:{ filter:{ _id:id }, update:{ $inc:{ saldo:2*perHead } } } });
          if (ops.length) await Player.bulkWrite(ops, { session });

        } else {
          const aposta = match.valorAposta;
          const [tA, tB] = match.teams.map(toOid);
          const winnerOid = toOid(winnerTeamId);
          const teamsDocs = await Time.find({ _id: { $in: [tA, tB] } }).session(session).select('_id saldoCongelado').lean();
          if (teamsDocs.length !== 2) { const err=new Error('times_nao_encontrados'); err.code='NOT_FOUND'; throw err; }
          const insufCong = teamsDocs.find(t => (t.saldoCongelado ?? 0) < aposta);
          if (insufCong) { const err=new Error('congelado_insuficiente'); err.code='SALDO_CONGELADO'; throw err; }

          await Promise.all([
            Time.updateOne({ _id:tA }, { $inc:{ saldoCongelado:-aposta } }, { session }),
            Time.updateOne({ _id:tB }, { $inc:{ saldoCongelado:-aposta } }, { session }),
            Time.updateOne({ _id:winnerOid }, { $inc:{ saldo:2*aposta } }, { session }),
          ]);
        }

        match.$session(session);
        match.status = 'finalizada';
        match.winnerTeamId = winnerTeamId;
        if (placar) match.placar = placar;
        match.finishedAt = new Date();
        await match.save({ session });
      });
    } catch (e) {
      if (session) await session.endSession().catch(()=>{});
      if (e?.code === 'SALDO_CONGELADO_PLAYER') return res.status(400).json({ ok:false, error:'saldo_congelado_insuficiente_player', matchId });
      if (e?.code === 'SALDO_CONGELADO')        return res.status(400).json({ ok:false, error:'saldo_congelado_insuficiente', matchId });
      if (e?.code === 'NOT_FOUND')              return res.status(404).json({ ok:false, error:'times_nao_encontrados', matchId });
      console.error('finish tx error:', e);
      return res.status(500).json({ ok:false, error:'Erro ao finalizar partida' });
    } finally {
      if (session) await session.endSession().catch(()=>{});
    }

    return res.status(200).json({ ok:true, matchId:match._id, status:match.status, winnerTeamId:match.winnerTeamId, placar:match.placar??null, finishedAt:match.finishedAt??null });
  } catch (err) {
    console.error('finish error:', err);
    return res.status(500).json({ ok:false, error:'Erro interno' });
  }
};

// --- Gate 5x5 (robusto) ---
async function rpEnsureRosterFiveByTeam(teamId, session) {
  try {
    const t = await Time.findById(teamId).session(session || null).select('players jogadores membros maxMembros').lean();
    if (t) {
      const toId = (x) => String(x?.playerId ?? x?._id ?? x);
      const merged = [
        ...(Array.isArray(t.players)   ? t.players   : []),
        ...(Array.isArray(t.jogadores) ? t.jogadores : []),
        ...(Array.isArray(t.membros)   ? t.membros   : []),
      ].map(toId).filter(Boolean);
      const distinct = [...new Set(merged)];
      const have = distinct.length;
      const need = Number.isFinite(+t.maxMembros) && +t.maxMembros > 0 ? +t.maxMembros : 5;
      return have === need ? { ok:true } : { ok:false, code:400, error:'team_incomplete', detail:{ have, need } };
    }
  } catch {}
  try {
    const [nP, nJ] = await Promise.all([
      Player.countDocuments({ timeId: teamId }).catch(() => 0),
      (async () => { try { const Jog = require('../models/Jogador'); return await Jog.countDocuments({ timeId: teamId }); } catch { return 0; } })(),
    ]);
    const have = Math.max(nP, nJ);
    const need = 5;
    return have === need ? { ok:true } : { ok:false, code:400, error:'team_incomplete', detail:{ have, need } };
  } catch {
    return { ok:false, code:500, error:'gate_failed' };
  }
}

if (!module.exports.__rpEnterQueueWrapped) {
  const __origEnterQueue = module.exports.enterQueue || exports.enterQueue;
  module.exports.enterQueue = exports.enterQueue = async (req, res, next) => {
    try {
      const teamId = req.body?.teamId || req.user?.teamId;
      if (!teamId) return res.status(400).json({ error:'team_required' });
      const gate = await rpEnsureRosterFiveByTeam(teamId, null);
      if (!gate.ok) return res.status(gate.code).json({ error: gate.error, detail: gate.detail });
      return __origEnterQueue(req, res, next);
    } catch (err) {
      return res.status(500).json({ error:'internal_error', message: err.message });
    }
  };
  module.exports.__rpEnterQueueWrapped = true;
}

// --- Validação de capitão (queue/accept/finish) ---
const Jogador = require('../models/Jogador');

async function rpEnsureCaptain(teamId, userId) {
  if (!teamId || !userId) return { ok:false, code:401, error:'nao_autenticado' };
  const cap = await Jogador.exists({ _id:userId, timeId:teamId, $or:[{isCapitao:true},{isCaptain:true}] });
  return cap ? { ok:true } : { ok:false, code:403, error:'not_captain' };
}
function wrapCaptain(name){
  const orig = module.exports[name] || exports[name];
  if (!orig || module.exports[`__rpCap_${name}`]) return;
  module.exports[name] = exports[name] = async (req,res,next)=>{
    const teamId = req.body?.teamId || req.user?.teamId;
    const userId = req.user?.sub || req.user?._id;
    const r = await rpEnsureCaptain(teamId, userId);
    if (!r.ok) return res.status(r.code).json({ error:r.error });
    return orig(req,res,next);
  };
  module.exports[`__rpCap_${name}`] = true;
}
['enterQueue','accept','finish'].forEach(wrapCaptain);

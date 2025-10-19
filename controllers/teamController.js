const mongoose = require('mongoose');
const Time = require('../models/Time');
const Jogador = require('../models/Jogador');

// Utilitário para validação de ObjectId
const isValidId = (id) => !!id && mongoose.Types.ObjectId.isValid(id);

// Valor padrão para máximo de membros
const MAX_MEMBROS = 5;

/** POST /api/team/create  { nome, valorAposta? } */
exports.createTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { nome, valorAposta } = req.body || {};

    if (!userId) return res.status(401).json({ erro: 'não autenticado' });
    if (!nome || typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ erro: 'nome é obrigatório' });

    // Não deixar criar se já participa de algum time
    const jaTem = await Time.findOne({ jogadores: userId });
    if (jaTem) return res.status(400).json({ erro: 'você já está em um time' });

    // Evita nomes duplicados (case-insensitive)
    const nomeEsc = nome.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nomeEmUso = await Time.findOne({ nome: new RegExp(`^${nomeEsc}$`, 'i') });
    if (nomeEmUso) return res.status(409).json({ erro: 'Já existe um time com esse nome.' });

    const time = await Time.create({
      nome: nome.trim(),
      capitaoId: userId,
      jogadores: [userId],
      valorAposta: valorAposta ?? 25,
    });

    const populated = await Time.findById(time._id)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(201).json({ mensagem: 'Time criado com sucesso!', time: populated });
  } catch (e) {
    console.error('createTeam error:', e);
    return res.status(500).json({ erro: 'erro interno ao criar time' });
  }
};

/** GET /api/team/me */
exports.myTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'não autenticado' });

    const time = await Time.findOne({ jogadores: userId })
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(200).json({ time: time || null });
  } catch (e) {
    console.error('myTeam error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/** GET /api/team/:id */
exports.getTeam = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ erro: 'ID inválido.' });

    const time = await Time.findById(id)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    if (!time) return res.status(404).json({ erro: 'Time não encontrado.' });
    return res.status(200).json({ time });
  } catch (e) {
    console.error('getTeam error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/** POST /api/team/join { teamId } */
exports.joinTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.body || {};

    if (!userId) return res.status(401).json({ erro: 'não autenticado' });
    if (!isValidId(teamId)) return res.status(400).json({ erro: 'teamId inválido' });

    // Usuário já está em time?
    const jaTem = await Time.findOne({ jogadores: userId });
    if (jaTem) return res.status(400).json({ erro: 'você já está em um time' });

    const time = await Time.findById(teamId);
    if (!time) return res.status(404).json({ erro: 'Time não encontrado' });

    if (time.jogadores.length >= (time.maxMembros ?? MAX_MEMBROS)) {
      return res.status(400).json({ erro: 'time cheio' });
    }

    if (time.jogadores.map(String).includes(String(userId))) {
      return res.status(400).json({ erro: 'Você já está neste time.' });
    }

    await Time.updateOne(
      { _id: teamId },
      { $addToSet: { jogadores: userId } }
    );

    const populated = await Time.findById(teamId)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(200).json({ mensagem: 'Você entrou no time.', time: populated });
  } catch (e) {
    console.error('joinTeam error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/** POST /api/team/leave */
exports.leaveTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'não autenticado' });

    const time = await Time.findOne({ jogadores: userId });
    if (!time) return res.status(400).json({ erro: 'você não está em um time' });

    // Capitão saindo?
    const isCaptain = String(time.capitaoId) === String(userId);

    // Remove jogador
    time.jogadores = time.jogadores.filter(j => String(j) !== String(userId));

    if (isCaptain) {
      if (time.jogadores.length > 0) {
        time.capitaoId = time.jogadores[0]; // transfere para o primeiro da lista
      } else {
        await Time.deleteOne({ _id: time._id });
        return res.status(200).json({ mensagem: 'Você saiu e o time foi removido (último membro).' });
      }
    }

    await time.save();
    const populated = await Time.findById(time._id)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(200).json({ mensagem: 'Você saiu do time.', time: populated });
  } catch (e) {
    console.error('leaveTeam error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/** POST /api/team/add-member { jogadorId }  — precisa ser capitão */
exports.addMember = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { jogadorId } = req.body || {};
    if (!userId) return res.status(401).json({ erro: 'não autenticado' });
    if (!isValidId(jogadorId)) return res.status(400).json({ erro: 'jogadorId inválido' });

    const time = await Time.findOne({ capitaoId: userId });
    if (!time) return res.status(403).json({ erro: 'apenas o capitão pode adicionar membros' });

    // Jogador já está em algum time?
    const jaTem = await Time.findOne({ jogadores: jogadorId });
    if (jaTem) return res.status(400).json({ erro: 'jogador já está em um time' });

    if (time.jogadores.length >= (time.maxMembros ?? MAX_MEMBROS)) {
      return res.status(400).json({ erro: 'time cheio' });
    }

    if (time.jogadores.map(String).includes(String(jogadorId))) {
      return res.status(400).json({ erro: 'Jogador já está neste time.' });
    }

    await Time.updateOne(
      { _id: time._id },
      { $addToSet: { jogadores: jogadorId } }
    );

    const populated = await Time.findById(time._id)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(200).json({ mensagem: 'Membro adicionado.', time: populated });
  } catch (e) {
    console.error('addMember error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/** DELETE /api/team/remove-member/:jogadorId — capitão remove */
exports.removeMember = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { jogadorId } = req.params || {};
    if (!userId) return res.status(401).json({ erro: 'não autenticado' });
    if (!isValidId(jogadorId)) return res.status(400).json({ erro: 'jogadorId inválido' });

    const time = await Time.findOne({ capitaoId: userId });
    if (!time) return res.status(403).json({ erro: 'apenas o capitão pode remover membros' });

    if (String(jogadorId) === String(time.capitaoId)) {
      return res.status(400).json({ erro: 'não é possível remover o capitão. transfira a liderança antes.' });
    }

    if (!time.jogadores.map(String).includes(String(jogadorId))) {
      return res.status(404).json({ erro: 'Jogador não está no time.' });
    }

    await Time.updateOne(
      { _id: time._id },
      { $pull: { jogadores: jogadorId } }
    );

    const populated = await Time.findById(time._id)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(200).json({ mensagem: 'Membro removido.', time: populated });
  } catch (e) {
    console.error('removeMember error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/** POST /api/team/transfer-captain { jogadorId } */
exports.transferCaptain = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { jogadorId } = req.body || {};
    if (!userId) return res.status(401).json({ erro: 'não autenticado' });
    if (!isValidId(jogadorId)) return res.status(400).json({ erro: 'jogadorId inválido' });

    const time = await Time.findOne({ capitaoId: userId });
    if (!time) return res.status(403).json({ erro: 'apenas o capitão pode transferir liderança' });

    if (!time.jogadores.map(String).includes(String(jogadorId))) {
      return res.status(400).json({ erro: 'jogador não pertence ao time' });
    }

    if (String(time.capitaoId) === String(jogadorId)) {
      return res.status(200).json({ mensagem: 'Este jogador já é o capitão.', time });
    }

    time.capitaoId = jogadorId;
    await time.save();

    const populated = await Time.findById(time._id)
      .populate('jogadores', 'nome nickname')
      .populate('capitaoId', 'nome nickname');

    return res.status(200).json({ mensagem: 'Capitania transferida.', time: populated });
  } catch (e) {
    console.error('transferCaptain error:', e);
    return res.status(500).json({ erro: 'erro interno' });
  }
};

/*
Principais mudanças:
- Troca de req.user?._id -> req.user?.id para alinhar com o middleware auth.
- Restante mantido exatamente como estava.
*/

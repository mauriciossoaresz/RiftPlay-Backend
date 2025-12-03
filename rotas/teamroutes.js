// backend/rotas/teamroutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');              // exige Bearer token
const team = require('../controllers/teamController');  // handlers

// ⚠️ Este router é montado em /api/team (server.js)

// cria time do usuário autenticado
router.post('/create', auth, team.createTeam);

// retorna times/dados do próprio usuário (ajuste o nome do handler se necessário)
router.get('/me', auth, team.myTeam);

// pega um time por id (se quiser público, remova o 'auth' aqui)
router.get('/:id', auth, team.getTeam);

// ações de participação / gestão
router.post('/join',           auth, team.joinTeam);
router.post('/leave',          auth, team.leaveTeam);
router.post('/add-member',     auth, team.addMember);
router.delete('/remove-member/:jogadorId', auth, team.removeMember);
router.post('/transfer-captain',           auth, team.transferCaptain);

module.exports = router;

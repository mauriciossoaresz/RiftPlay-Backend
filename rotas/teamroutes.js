// backend/rotas/teamroutes.js
const express = require('express');
const router = express.Router();

// Middleware de autenticação
const auth = require('../middleware/auth');

// Controller de times
const team = require('../controllers/teamController');

// ⚠️ Estas rotas já estão montadas em /api/team no server.js
router.post('/create', auth, team.createTeam);
router.get('/me', auth, team.myTeam);

// ► Se no controller o nome for getTeam, troque getById -> getTeam abaixo.
router.get('/:id', auth, team.getTeam);


router.post('/join', auth, team.joinTeam);
router.post('/leave', auth, team.leaveTeam);
router.post('/add-member', auth, team.addMember);
router.delete('/remove-member/:jogadorId', auth, team.removeMember);
router.post('/transfer-captain', auth, team.transferCaptain);

module.exports = router;

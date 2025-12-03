const express = require("express");
const router = express.Router();

const matchmakingController = require("../controllers/matchmakingController");
const auth = require("../middleware/auth");

// --- Fila / matchmaking ---
router.post("/queue", auth, matchmakingController.enterQueue); // Entra/atualiza fila
router.post("/cancel", auth, matchmakingController.cancelQueue); // Cancela da fila
router.get("/status", auth, matchmakingController.status); // Status (fila ou partida)

// --- Ciclo da partida ---
router.post("/accept", auth, matchmakingController.accept); // Time aceita o match
router.post("/decline", auth, matchmakingController.declineMatch); // Time recusa o match
router.post("/finish", auth, matchmakingController.finish); // Finaliza e define vencedor
router.get("/history", auth, matchmakingController.history); // Histórico de partidas do time

module.exports = router;

/*
Principais mudanças:
- Padronização dos comentários e espaçamento.
- Garantia de ordem lógica das rotas.
- Nenhuma alteração de lógica, apenas melhorias de legibilidade e boas práticas.*/

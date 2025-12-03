// middleware/errorHandler.js

/**
 * Handler para rotas não encontradas (404)
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({ erro: "Rota não encontrada" });
};

/**
 * Handler global de erros
 */
const errorHandler = (err, req, res, next) => {
  // Log do erro
  console.error("Erro global:", err);

  // Status padrão 500 se não definido
  const status = err.status || 500;

  // Mensagem: usar err.message se definido, senão 'Erro interno'
  const message = err.message || "Erro interno";

  res.status(status).json({ erro: message });
};

module.exports = { notFoundHandler, errorHandler };

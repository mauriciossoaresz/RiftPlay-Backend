// Carrega o .env (este script roda separado do server.js)
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

// Verificação das variáveis obrigatórias
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET", "PORT"];
const missingVars = REQUIRED_ENV_VARS.filter((key) => {
  const v = process.env[key];
  return !v || String(v).trim() === "";
});

if (missingVars.length > 0) {
  console.error(`Faltando variáveis no .env: ${missingVars.join(", ")}`);
  process.exit(1);
}

console.log("ENV ok");

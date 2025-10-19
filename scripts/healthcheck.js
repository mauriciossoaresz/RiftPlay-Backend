// Melhoria: Uso de const para variáveis imutáveis e nomes mais claros
const http = require("http");
const HEALTH_URL = process.env.HEALTH_URL || "http://localhost:3000/health";

// Melhoria: Adição de tratamento para resposta incompleta e uso de arrow functions
http.get(HEALTH_URL, (res) => {
  // Melhoria: Consome a resposta para evitar vazamento de memória
  res.resume();

  if (res.statusCode === 200) {
    console.log("HEALTH ok");
    process.exit(0);
  } else {
    console.error(`HEALTH falhou: ${res.statusCode}`);
    process.exit(2);
  }
}).on("error", (err) => {
  console.error(`HEALTH erro: ${err.message}`);
  process.exit(3);
});

// Principais mudanças:
// - Renomeação de variáveis para maior clareza (HEALTH_URL)
// - Uso de template strings para mensagens
// - Consumo da resposta com res.resume() para evitar vazamento de memória
// - Padronização do código para boas práticas
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const conectarMongo = require('../config/db');
const Time = require('../models/Time');

(async () => {
  try {
    await conectarMongo();

    // Melhoria: select apenas campos necessários, limit para evitar sobrecarga
    const teams = await Time.find().select('_id nome name').limit(20);

    console.log('Times encontrados:');
    teams.forEach((t) => {
      // Melhoria: nome padronizado, fallback seguro
      const nome = t.nome || t.name || '(sem nome)';
      console.log(`- id=${t._id}   nome=${nome}`);
    });

    process.exit(0);
  } catch (e) {
    // Melhoria: log detalhado do erro
    console.error('Erro listando times:', e);
    process.exit(1);
  }
})();

// Principais mudanças:
// - Padronização do nome da variável 'nome' para evitar repetição de lógica.
// - Uso de select e limit para performance.
// - Log de erro mais detalhado.
// - Uso de arrow function no
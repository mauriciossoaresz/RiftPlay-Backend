const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const conectarMongo = require('../config/db');
const Time = require('../models/Time');

// Melhoria: Função utilitária para gerar ObjectId
function objectId() {
  return new mongoose.Types.ObjectId();
}

// Melhoria: Gera valor padrão para arrays conforme tipo do campo
function defaultForArray(caster, key) {
  if (caster?.instance === 'ObjectID' || caster?.options?.ref || /Ids?$/i.test(key)) {
    return [objectId()];
  }
  if (caster?.instance === 'String') return ['item'];
  if (caster?.instance === 'Number') return [1];
  if (caster?.instance === 'Boolean') return [false];
  if (caster?.instance === 'Date') return [new Date()];
  return [];
}

// Melhoria: Gera valor padrão para cada campo do schema
function defaultForPath(p, key, displayName) {
  if (
    p?.options?.ref ||
    p?.options?.type === mongoose.Schema.Types.ObjectId ||
    /Id$/i.test(key) ||
    /(capitao|owner|lider|criador).*id$/i.test(key)
  ) {
    return objectId();
  }

  if (p.instance === 'Array') return defaultForArray(p.caster, key);

  switch (p.instance) {
    case 'ObjectID':   return objectId();
    case 'String':     return (key === 'nome' || key === 'name') ? displayName : 'placeholder';
    case 'Number':     return 1;
    case 'Boolean':    return false;
    case 'Date':       return new Date();
    case 'Decimal128': return mongoose.Types.Decimal128.fromString('0');
    case 'Mixed':
    default:           return {};
  }
}

// Melhoria: Função para verificar se campo é obrigatório
function isRequired(p) {
  const opt = p?.options?.required;
  if (!opt) return false;
  if (opt === true) return true;
  if (Array.isArray(opt)) return !!opt[0];
  if (typeof opt === 'function') return true;
  return false;
}

// Melhoria: Gera documento com campos obrigatórios e nome legível
async function buildDoc(displayName) {
  const doc = {};
  const paths = Time.schema.paths;

  for (const [key, p] of Object.entries(paths)) {
    if (key === '_id' || key === '__v') continue;
    if (key.includes('.')) continue;
    if (!isRequired(p)) continue;

    doc[key] = defaultForPath(p, key, displayName);
  }

  // Garante nome legível mesmo se não for required
  if (paths['nome'] && !doc['nome']) doc['nome'] = displayName;
  if (paths['name'] && !doc['name']) doc['name'] = displayName;

  return doc;
}

(async () => {
  try {
    await conectarMongo();

    // Melhoria: Evita duplicidade de times de teste
    await Time.deleteMany({
      $or: [
        { nome: 'Time Teste A' }, { nome: 'Time Teste B' },
        { name: 'Time Teste A' }, { name: 'Time Teste B' }
      ]
    });

    const docA = await buildDoc('Time Teste A');
    const docB = await buildDoc('Time Teste B');

    const a = await Time.create(docA);
    const b = await Time.create(docB);

    console.log('✅ Times criados:');
    console.log('- A:', a._id.toString());
    console.log('- B:', b._id.toString());
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed falhou.');
    if (err.name === 'ValidationError') {
      for (const [k, v] of Object.entries(err.errors)) {
        console.error(`   • ${k}: ${v.message}`);
      }
    } else {
      console.error(err);
    }
    process.exit(1);
  }
})();

// Principais mudanças:
// - Funções utilitárias para gerar valores padrão de campos obrigatórios, inclusive arrays e ObjectId.
// - Padronização e clareza na geração dos documentos de teste.
// - Garantia de nomes legíveis para times criados.
// - Remoção de duplicidade antes de inserir.
// - Log detalhado para erros de validação.
// - Comentários explicativos e boas práticas de código.
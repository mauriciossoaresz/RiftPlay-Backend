// imprime 1 jogador do time que NÃO é capitão
const path = require('path'); require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const connect = require('../config/db'); const Jogador = require('../models/Jogador');

(async () => {
  await connect();
  const teamId = process.argv[2];
  // pega alguém cujo flag NÃO é true (pega undefined também)
  const u = await Jogador.findOne({ timeId: teamId, $or: [{ isCapitao: { $ne: true } }, { isCaptain: { $ne: true } }] })
    .select('_id').lean();
  console.log(u?._id?.toString() || '');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

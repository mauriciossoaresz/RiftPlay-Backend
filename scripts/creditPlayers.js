// backend/scripts/creditPlayers.js
require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');

(async () => {
  const [,, amountStr, ...teamIds] = process.argv;
  const amount = Number(amountStr || 0);
  if (!amount || !teamIds.length) {
    console.log('Uso: node scripts/creditPlayers.js <valor> <teamId> [<teamId> ...]');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  await mongoose.connect(uri, {});
  const res = await Player.updateMany({ timeId: { $in: teamIds } }, { $inc: { saldo: amount } });
  console.log(`Players afetados: ${res.modifiedCount} (+${amount})`);
  await mongoose.disconnect();
})();

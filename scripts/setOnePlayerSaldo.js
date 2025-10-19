require("dotenv").config();
const mongoose = require("mongoose");
const Time = require("../models/Time");
const Player = require("../models/Player");
(async()=>{
  try{
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    const [teamId, rawAmount] = process.argv.slice(2);
    const amount = Number(rawAmount||0);
    const t = await Time.findById(teamId).select("players jogadores membros").lean();
    const toId = (x)=> String(x?.playerId ?? x?._id ?? x);
    const merged = [...(t.players||[]), ...(t.jogadores||[]), ...(t.membros||[])].map(toId).filter(Boolean);
    const distinct = [...new Set(merged)];
    if (!distinct.length){ console.log("Time sem jogadores."); process.exit(0); }
    const first = distinct[0];
    await Player.updateOne({_id:first},{ $set:{ saldo: amount }});
    const p = await Player.findById(first).select("_id saldo saldoCongelado").lean();
    console.log("Player ajustado:", p);
  }catch(e){ console.error(e); } finally { await mongoose.disconnect().catch(()=>{}); process.exit(0); }
})();

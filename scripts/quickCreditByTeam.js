require("dotenv").config();
const mongoose = require("mongoose");
const Time  = require("../models/Time");
const Player = require("../models/Player");
function toId(x){ return String(x?.playerId ?? x?._id ?? x); }
(async()=>{
  try{
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    const [teamId, rawAmount] = process.argv.slice(2);
    const amount = Number(rawAmount||0);
    const t = await Time.findById(teamId).select("players jogadores membros").lean();
    const merged = [...(t.players||[]), ...(t.jogadores||[]), ...(t.membros||[])].map(toId).filter(Boolean);
    const distinct = [...new Set(merged)];
    if(!distinct.length){ console.log("Time sem jogadores vinculados."); process.exit(0); }
    const ops = distinct.map(id=>({ updateOne:{ filter:{ _id:new mongoose.Types.ObjectId(id) }, update:{ $inc:{ saldo:amount } }}}));
    const r = await Player.bulkWrite(ops); console.log("Players distintos:",distinct.length,"| bulk:",JSON.stringify(r));
  }finally{ await mongoose.disconnect().catch(()=>{}); process.exit(0); }
})();

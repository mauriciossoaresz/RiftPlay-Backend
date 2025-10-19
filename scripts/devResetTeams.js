require("dotenv").config();
const mongoose = require("mongoose");
const Match  = require("../models/Match");
const Queue  = require("../models/Queue");
const Time   = require("../models/Time");
const Player = require("../models/Player");

(async ()=>{
  const [teamA, teamB] = process.argv.slice(2);
  try{
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const ids = [teamA, teamB].filter(Boolean).map(x=>new mongoose.Types.ObjectId(x));
    if(ids.length===0){ console.log("uso: node scripts/devResetTeams.js <teamIdA> <teamIdB>"); process.exit(1); }

    // 1) Cancela matches pendentes/em_andamento desses times
    const ms = await Match.find({ teams: { $in: ids }, $or:[{status:"pendente"},{status:"em_andamento"}] });
    for(const m of ms){
      // desfaz congelamentos
      const perHead = Number(m.perHead||0);
      if(perHead>0 && Array.isArray(m.teamAPlayers) && Array.isArray(m.teamBPlayers)){
        const all = [...m.teamAPlayers, ...m.teamBPlayers].map(x=>new mongoose.Types.ObjectId(x));
        if(all.length) await Player.updateMany({ _id:{ $in: all } }, { $inc:{ saldoCongelado: -perHead } });
      }else if(Number.isFinite(+m.valorAposta)){
        await Time.updateMany({ _id:{ $in: m.teams } }, { $inc:{ saldoCongelado: -Number(m.valorAposta) } });
      }
      m.status = "cancelada";
      m.cancelReason = "dev_reset";
      m.finishedAt = new Date();
      m.acceptDeadline = null;
      await m.save();
    }

    // 2) Limpa filas
    const dq = await Queue.deleteMany({ teamId: { $in: ids } });

    console.log("Reset OK | matchesCancel:", ms.length, "| queuesDel:", dq.deletedCount);
  }catch(e){
    console.error(e);
  }finally{
    await mongoose.disconnect().catch(()=>{});
    process.exit(0);
  }
})();

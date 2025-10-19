// scripts/printBalancesAscii.js
require("dotenv").config();
const mongoose = require("mongoose");
const Time = require("../models/Time");
const Player = require("../models/Player");

function toId(x){ return String(x?.playerId ?? x?._id ?? x); }

function pad(str, len){ str = String(str); return (str + " ".repeat(Math.max(0, len - str.length))).slice(0, len); }

async function getTeamPlayers(teamId){
  const t = await Time.findById(teamId).select("players jogadores membros").lean();
  const merged = [...(t?.players||[]), ...(t?.jogadores||[]), ...(t?.membros||[])].map(toId).filter(Boolean);
  const distinct = [...new Set(merged)];
  if (!distinct.length) return { list: [], total: { jogadores:0, saldo:0, congelado:0, total:0 } };

  const players = await Player.find({_id:{ $in:distinct }}).select("_id nome saldo saldoCongelado").lean();

  let saldo = 0, cong = 0;
  for(const p of players){ saldo += (p.saldo||0); cong += (p.saldoCongelado||0); }

  return {
    list: players,
    total: { jogadores: players.length, saldo, congelado: cong, total: saldo + cong }
  };
}

(async()=>{
  try{
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const [teamA, teamB] = process.argv.slice(2);
    const rows = [];

    for(const teamId of [teamA, teamB]){
      const t = await Time.findById(teamId).lean();
      const r = await getTeamPlayers(teamId);

      console.log("");
      console.log(`=== TIME ${t?.nome||"(sem nome)"} (${teamId}) ===`);
      console.log(pad("idx",4) + " | " + pad("playerId",24) + " | " + pad("nome",22) + " | " + pad("saldo",8) + " | " + pad("congelado",10) + " | " + pad("total",8));
      console.log("-".repeat(4)+"-+-"+ "-".repeat(24) + "-+-" + "-".repeat(22) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(10) + "-+-" + "-".repeat(8));

      r.list.forEach((p, i)=>{
        const s = p.saldo||0, c = p.saldoCongelado||0;
        console.log(
          pad(i,4) + " | " +
          pad(p._id,24) + " | " +
          pad(p.nome||"",22) + " | " +
          pad(s,8) + " | " +
          pad(c,10) + " | " +
          pad(s+c,8)
        );
      });

      console.log("-".repeat(80));
      console.log(`Totais do time: jogadores=${r.total.jogadores}, saldo=${r.total.saldo}, congelado=${r.total.congelado}, total=${r.total.total}`);
      console.log("");
    }
  }catch(err){
    console.error(err);
  }finally{
    await mongoose.disconnect().catch(()=>{});
    process.exit(0);
  }
})();

require("dotenv").config();
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const Team = require("../models/Time");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const ids = process.argv.slice(2).map(s => new ObjectId(s));
  for (const id of ids) {
    console.log("\n================ TEAM", String(id), "================");

    const raw = await mongoose.connection.collection("times").findOne({_id:id});
    console.log("\n-- RAW (times.findOne) --");
    console.log(JSON.stringify(raw, null, 2));

    const doc = await Team.findById(id).lean({ virtuals:false, getters:false });
    console.log("\n-- VIA MONGOOSE (lean) --");
    console.log(JSON.stringify(doc, null, 2));

    const playersLen   = Array.isArray(doc?.players)   ? doc.players.length   : 0;
    const jogadoresLen = Array.isArray(doc?.jogadores) ? doc.jogadores.length : 0;
    console.log("\n-- COUNTS --");
    console.log({ playersLen, jogadoresLen });
  }
  process.exit(0);
})();

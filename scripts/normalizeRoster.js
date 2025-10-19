require("dotenv").config();
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    const teamIds = process.argv.slice(2).map(id => new ObjectId(id));
    const col = mongoose.connection.collection("times"); // nome real da collection

    for (const _id of teamIds) {
      const raw = await col.findOne({ _id });
      if (!raw) { console.log("Time não encontrado:", String(_id)); continue; }

      const jogadores = Array.isArray(raw.jogadores) ? raw.jogadores : [];
      const players   = Array.isArray(raw.players)   ? raw.players   : [];

      // Se players está vazio e há 'jogadores', migra
      if (players.length === 0 && jogadores.length > 0) {
        // normaliza para ObjectId
        const asObjId = jogadores.map(x => (x instanceof ObjectId ? x : new ObjectId(String(x))));
        const res = await col.updateOne(
          { _id },
          { $set: { players: asObjId }, $unset: { jogadores: "" } }
        );
        console.log("Migrado:", String(_id), "-> players:", asObjId.length, "| unset jogadores");
      } else {
        console.log("Nada a migrar:", String(_id), "| players:", players.length, "| jogadores:", jogadores.length);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();

const mongoose = require("mongoose");

const conectarMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB conectado com sucesso!");
  } catch (error) {
    console.error("❌ Erro na conexão com o MongoDB:", error);
    process.exit(1);
  }
};

module.exports = conectarMongo;

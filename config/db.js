const mongoose = require('mongoose');

const conectarMongo = async () => {
  try {
    const isProd = process.env.NODE_ENV === 'production';

    await mongoose.connect(process.env.MONGO_URI, {
      // opções compatíveis com Mongoose 8
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !isProd, // evita recriar índices em produção
    });

    console.log('✅ MongoDB conectado com sucesso!');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Erro na conexão com o MongoDB:', error);
    process.exit(1);
  }
};

module.exports = conectarMongo;

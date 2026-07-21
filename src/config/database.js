const mongoose = require('mongoose');
const config = require('./index');
const logger = require('./logger');

async function connectDB() {
  if (!config.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to connect flora-engarde to its database');
  }
  await mongoose.connect(config.MONGODB_URI);
  logger.info(`MongoDB connected: ${mongoose.connection.host}`);

  mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
}

module.exports = connectDB;

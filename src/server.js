const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./config/logger');
const connectDB = require('./config/database');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.ALLOWED_ORIGINS }));
// Keep the raw body for webhook HMAC verification (US-3.1.5).
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

app.use('/', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handlers are registered after all routes/middleware are mounted,
// per FLORA_DEVELOPMENT_RULES.md.
app.use((err, req, res, next) => {
  logger.error(`Server error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' });
});

async function start() {
  try {
    await connectDB();
    app.listen(config.PORT, () => {
      logger.info(`flora-engarde listening on port ${config.PORT} (${config.NODE_ENV})`);
    });
  } catch (err) {
    logger.error(`Failed to start flora-engarde: ${err.message}`);
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

module.exports = app;

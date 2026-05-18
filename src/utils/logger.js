const config = require('../config');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const logger = {
  info: (msg, data = '') => {
    if (levels[config.logs.level] >= levels.info) {
      console.log(`[INFO] ${new Date().toISOString()}: ${msg}`, data);
    }
  },
  error: (msg, error = '') => {
    if (levels[config.logs.level] >= levels.error) {
      console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`, error);
    }
  },
  warn: (msg, data = '') => {
    if (levels[config.logs.level] >= levels.warn) {
      console.warn(`[WARN] ${new Date().toISOString()}: ${msg}`, data);
    }
  },
  debug: (msg, data = '') => {
    if (levels[config.logs.level] >= levels.debug) {
      console.debug(`[DEBUG] ${new Date().toISOString()}: ${msg}`, data);
    }
  }
};

module.exports = logger;

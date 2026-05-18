const logger = require('../../utils/logger');
const config = require('../../config');

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';
  
  logger.error(`${req.method} ${req.url} - ${status}`, {
    message,
    stack: config.env === 'development' ? err.stack : undefined
  });

  res.status(status).json({
    error: {
      message,
      status,
      ...(config.env === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;

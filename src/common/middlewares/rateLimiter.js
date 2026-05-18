const rateLimit = require('express-rate-limit');

// Limitador para intentos de login
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Limitar cada IP a 5 intentos de login por ventana
  message: {
    message: 'Demasiados intentos de inicio de sesión. Por favor, intente de nuevo en 15 minutos.'
  },
  standardHeaders: true, // Retorna info del límite en las cabeceras `RateLimit-*`
  legacyHeaders: false, // Deshabilita las cabeceras `X-RateLimit-*`
});

// Limitador general para la API
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // Limitar cada IP a 100 peticiones por minuto
  message: {
    message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.'
  },
});

module.exports = {
  loginRateLimiter,
  apiRateLimiter
};

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // Intentar obtener el token de la cabecera o de la cookie segura
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies.token;

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ message: 'Token inválido o expirado' });
      }

      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ message: 'No autenticado: Token faltante' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }

    next();
  };
};

module.exports = {
  authenticateJWT,
  authorizeRoles
};

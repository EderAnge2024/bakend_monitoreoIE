const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    // Get user and their primary role
    const result = await db.query(
      `SELECT u.*, r.nombre as role 
       FROM usuarios u
       JOIN usuario_roles ur ON u.id = ur.usuario_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.username = $1 AND u.activo = TRUE`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials or inactive account' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        institucion_id: user.institucion_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Configuración de la cookie de seguridad
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });

    res.json({
      token, // Mantener por compatibilidad temporal
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  const { username, password, email, nombres, apellidos, dni, institucion_id, role_id } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const userRes = await client.query(
        'INSERT INTO usuarios (username, password, email, nombres, apellidos, dni, institucion_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [username, hashedPassword, email, nombres, apellidos, dni, institucion_id]
      );
      
      const userId = userRes.rows[0].id;
      
      await client.query(
        'INSERT INTO usuario_roles (usuario_id, role_id) VALUES ($1, $2)',
        [userId, role_id || 4] // Default to 'docente' if not provided
      );
      
      await client.query('COMMIT');
      
      res.status(201).json({ message: 'User registered successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    // req.user viene del middleware authenticateJWT
    const result = await db.query(
      `SELECT id, username, email, nombres, apellidos, institucion_id 
       FROM usuarios WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ user: { ...user, role: req.user.role } });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada correctamente' });
};

module.exports = {
  login,
  register,
  getMe,
  logout
};

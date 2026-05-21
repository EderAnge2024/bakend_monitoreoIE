const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const emailService = require('../../services/emailService');

const login = async (req, res, next) => {
  const { dni, password } = req.body; // Using DNI for login as requested by schema

  try {
    const result = await db.query(
      `SELECT u.*, r.nombre as role, i.nombre as institucion_nombre
       FROM usuarios u
       JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
       JOIN roles r ON ur.id_rol = r.id_rol
       LEFT JOIN instituciones i ON u.id_institucion = i.id_institucion
       WHERE u.dni = $1 AND u.estado = TRUE`,
      [dni]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado o inactivo' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Update last login
    await db.query('UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id_usuario = $1', [user.id_usuario]);

    const token = jwt.sign(
      { 
        id: user.id_usuario, 
        dni: user.dni, 
        role: user.role,
        id_institucion: user.id_institucion 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info(`Usuario logueado: ${user.dni} (${user.role})`);

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
        id: user.id_usuario,
        dni: user.dni,
        nombres: user.nombres,
        apellidos: user.apellidos,
        correo: user.correo,
        role: user.role,
        id_institucion: user.id_institucion,
        institucion_nombre: user.institucion_nombre,
        foto_perfil: user.foto_perfil
      }
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  const { dni, nombres, apellidos, correo, password, id_institucion, id_rol } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const userRes = await client.query(
        'INSERT INTO usuarios (dni, nombres, apellidos, correo, password, id_institucion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario',
        [dni, nombres, apellidos, correo, hashedPassword, id_institucion]
      );
      
      const idUsuario = userRes.rows[0].id_usuario;
      
      await client.query(
        'INSERT INTO usuario_roles (id_usuario, id_rol) VALUES ($1, $2)',
        [idUsuario, id_rol]
      );
      
      await client.query('COMMIT');
      res.status(201).json({ message: 'Usuario registrado correctamente', id_usuario: idUsuario });
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

const forgotPassword = async (req, res, next) => {
  // Accept both 'correo' and 'email' fields for compatibility (only 'correo' exists in DB)
  const email = (req.body.correo || req.body.email || '').trim();
  if (!email) {
    return res.status(400).json({ message: 'Se requiere el correo del usuario' });
  }
  try {
    // 1️⃣ Buscar en usuarios
    const result = await db.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado con ese correo' });
    }
    const user = result.rows[0];

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 30 * 60000); // 30 minutos

    // Insert token for usuario only
    await db.query(
      `INSERT INTO password_resets (id_usuario, id_docente, token, expiracion) VALUES ($1, NULL, $2, $3)`,
      [user.id_usuario, resetToken, resetTokenExpires]
    );

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    await emailService.enviarRecuperacionPassword(email, resetLink).catch(e => console.error('Error enviando email', e));
    res.json({ message: 'Enlace de recuperación enviado al correo (revisa la consola si estás en modo simulado)' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const { token, newPassword } = req.body;
  try {
    const result = await db.query(
      `SELECT * FROM password_resets WHERE token = $1 AND usado = FALSE AND expiracion > CURRENT_TIMESTAMP`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Token inválido, expirado o ya utilizado' });
    }
    const resetRecord = result.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      if (resetRecord.id_usuario) {
        // actualizar usuarios
        await client.query('UPDATE usuarios SET password = $1 WHERE id_usuario = $2', [hashedPassword, resetRecord.id_usuario]);
      } else if (resetRecord.id_docente) {
        // actualizar docentes (se agregó columna password en la tabla docentes)
        await client.query('UPDATE docentes SET password = $1 WHERE id = $2', [hashedPassword, resetRecord.id_docente]);
      }
      await client.query('UPDATE password_resets SET usado = TRUE WHERE id = $1', [resetRecord.id]);
      await client.query('COMMIT');
      res.json({ message: 'Contraseña actualizada correctamente' });
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

const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; 

  try {
    const result = await db.query('SELECT password FROM usuarios WHERE id_usuario = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE usuarios SET password = $1 WHERE id_usuario = $2', [hashedPassword, userId]);

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id_usuario as id, u.dni, u.nombres, u.apellidos, u.correo, u.id_institucion, u.foto_perfil, r.nombre as role, i.nombre as institucion_nombre
       FROM usuarios u
       JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
       JOIN roles r ON ur.id_rol = r.id_rol
       LEFT JOIN instituciones i ON u.id_institucion = i.id_institucion
       WHERE u.id_usuario = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ user });
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
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  logout
};

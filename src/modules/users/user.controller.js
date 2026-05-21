const db = require('../../config/database');
const bcrypt = require('bcryptjs');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT u.id_usuario, u.dni, u.nombres, u.apellidos, u.correo, u.telefono, u.estado, u.created_at, u.id_institucion,
             i.nombre as institucion_nombre,
             r.nombre as role, r.id_rol
      FROM usuarios u
      LEFT JOIN instituciones i ON u.id_institucion = i.id_institucion
      LEFT JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN roles r ON ur.id_rol = r.id_rol
      WHERE r.nombre <> 'docente'
      ORDER BY u.id_usuario DESC
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT u.*, i.nombre as institucion_nombre, r.nombre as role, r.id_rol
      FROM usuarios u
      LEFT JOIN instituciones i ON u.id_institucion = i.id_institucion
      LEFT JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN roles r ON ur.id_rol = r.id_rol
      WHERE u.id_usuario = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  const { dni, nombres, apellidos, correo, password, telefono, id_institucion, id_rol } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await db.pool.connect();
    const instId = id_institucion === "" ? null : id_institucion;
    const rolId = parseInt(id_rol);

    try {
      await client.query('BEGIN');
      
      const userRes = await client.query(
        `INSERT INTO usuarios (dni, nombres, apellidos, correo, password, telefono, id_institucion) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_usuario`,
        [dni, nombres, apellidos, correo, hashedPassword, telefono, instId]
      );
      
      const idUsuario = userRes.rows[0].id_usuario;
      
      await client.query(
        'INSERT INTO usuario_roles (id_usuario, id_rol) VALUES ($1, $2)',
        [idUsuario, rolId]
      );

      await client.query('COMMIT');
      res.status(201).json({ message: 'Usuario creado correctamente', id_usuario: idUsuario });
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

const update = async (req, res, next) => {
  const { id } = req.params;
  const { dni, nombres, apellidos, correo, telefono, id_institucion, id_rol, estado } = req.body;

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const instId = id_institucion === "" ? null : id_institucion;
      await client.query(
        `UPDATE usuarios 
         SET dni = $1, nombres = $2, apellidos = $3, correo = $4, telefono = $5, id_institucion = $6, estado = $7
         WHERE id_usuario = $8`,
        [dni, nombres, apellidos, correo, telefono, instId, estado, id]
      );

      if (id_rol) {
        const rolId = parseInt(id_rol);
        await client.query('DELETE FROM usuario_roles WHERE id_usuario = $1', [id]);
        await client.query('INSERT INTO usuario_roles (id_usuario, id_rol) VALUES ($1, $2)', [id, rolId]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Usuario actualizado correctamente' });
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

const remove = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  try {
    // Si el solicitante es director, verificar que el usuario objetivo sea docente y pertenezca a la misma institución
    if (req.user.role === 'director') {
      const targetUserRes = await db.query(`
        SELECT u.id_institucion, r.nombre as role 
        FROM usuarios u
        JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
        JOIN roles r ON ur.id_rol = r.id_rol
        WHERE u.id_usuario = $1
      `, [id]);

      if (targetUserRes.rows.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      const { id_institucion: targetInstId, role: targetUserRole } = targetUserRes.rows[0];

      if (targetUserRole !== 'docente') {
        return res.status(403).json({ message: 'El Director solo tiene permisos para restablecer contraseñas de Docentes.' });
      }

      if (req.user.id_institucion !== targetInstId) {
        return res.status(403).json({ message: 'No tiene permiso para restablecer la contraseña de un docente de otra institución.' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE usuarios SET password = $1 WHERE id_usuario = $2', [hashedPassword, id]);
    res.json({ message: 'Contraseña restablecida correctamente.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  resetPassword
};

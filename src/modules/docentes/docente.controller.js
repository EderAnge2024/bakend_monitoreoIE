const db = require('../../config/database');
const bcrypt = require('bcryptjs');

const getAll = async (req, res, next) => {
  try {
    const { id_institucion } = req.user; 
    let query = `
      SELECT d.*, i.nombre as institucion_nombre, u.correo as usuario_correo
      FROM docentes d
      LEFT JOIN instituciones i ON d.id_institucion = i.id_institucion
      LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
    `;
    let params = [];

    if (req.user.role === 'director') {
      query += ` WHERE d.id_institucion = $1`;
      params.push(id_institucion);
    }

    query += ` ORDER BY d.id_docente DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT d.*, u.correo as correo 
      FROM docentes d 
      LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario 
      WHERE d.id_docente = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  const { dni, nombres, apellidos, nivel, grado, seccion, area, cargo, condicion_laboral, id_institucion, tutor, grado_tutoria, correo } = req.body;
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if user already exists
    const userExist = await client.query('SELECT id_usuario FROM usuarios WHERE dni = $1 OR correo = $2', [dni, correo]);
    let idUsuario;

    if (userExist.rows.length > 0) {
      idUsuario = userExist.rows[0].id_usuario;
    } else {
      // 2. Create User account (Password is DNI by default)
      const hashedPassword = await bcrypt.hash(dni, 10);
      const userRes = await client.query(
        'INSERT INTO usuarios (dni, nombres, apellidos, correo, password, id_institucion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario',
        [dni, nombres, apellidos, correo, hashedPassword, id_institucion]
      );
      idUsuario = userRes.rows[0].id_usuario;

      // 3. Assign 'docente' role
      const roleRes = await client.query('SELECT id_rol FROM roles WHERE LOWER(nombre) = $1', ['docente']);
      if (roleRes.rows.length > 0) {
        await client.query(
          'INSERT INTO usuario_roles (id_usuario, id_rol) VALUES ($1, $2)',
          [idUsuario, roleRes.rows[0].id_rol]
        );
      }
    }

    // 4. Create Docente record
    const result = await client.query(
      `INSERT INTO docentes (id_usuario, id_institucion, dni, nombres, apellidos, nivel, grado, seccion, area, cargo, condicion_laboral, tutor, grado_tutoria, correo) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [idUsuario, id_institucion, dni, nombres, apellidos, nivel, grado, seccion, area, cargo, condicion_laboral, tutor || false, grado_tutoria || null, correo]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const update = async (req, res, next) => {
  const { id } = req.params;
  const { dni, nombres, apellidos, nivel, grado, seccion, area, cargo, condicion_laboral, id_institucion, estado, tutor, grado_tutoria, correo } = req.body;
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get current teacher to find linked user
    const currentDocRes = await client.query('SELECT id_usuario FROM docentes WHERE id_docente = $1', [id]);
    if (currentDocRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Docente no encontrado' });
    }
    const idUsuario = currentDocRes.rows[0].id_usuario;

    // 2. Update linked user account if exists
    if (idUsuario) {
      await client.query(
        'UPDATE usuarios SET dni = $1, nombres = $2, apellidos = $3, correo = $4 WHERE id_usuario = $5',
        [dni, nombres, apellidos, correo, idUsuario]
      );
    }

    // 3. Update Docente record
    const result = await client.query(
      `UPDATE docentes 
       SET dni = $1, nombres = $2, apellidos = $3, nivel = $4, grado = $5, seccion = $6, area = $7, cargo = $8, condicion_laboral = $9, id_institucion = $10, estado = $11, tutor = $12, grado_tutoria = $13, correo = $14
       WHERE id_docente = $15 RETURNING *`,
      [dni, nombres, apellidos, nivel, grado, seccion, area, cargo, condicion_laboral, id_institucion, estado, tutor || false, grado_tutoria || null, correo, id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const remove = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM docentes WHERE id_docente = $1', [id]);
    res.json({ message: 'Docente eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};

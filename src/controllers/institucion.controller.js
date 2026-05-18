const db = require('../config/db');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM instituciones ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM instituciones WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Institución no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  const { nombre, codigo_modular, direccion, telefono, email } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO instituciones (nombre, codigo_modular, direccion, telefono, email) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, codigo_modular, direccion, telefono, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, codigo_modular, direccion, telefono, email } = req.body;
  try {
    const result = await db.query(
      'UPDATE instituciones SET nombre = $1, codigo_modular = $2, direccion = $3, telefono = $4, email = $5 WHERE id = $6 RETURNING *',
      [nombre, codigo_modular, direccion, telefono, email, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Institución no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM instituciones WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Institución no encontrada' });
    }
    res.json({ message: 'Institución eliminada correctamente' });
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

const db = require('../../config/database');
const crud = require('../../utils/crud');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM instituciones ORDER BY id_institucion DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM instituciones WHERE id_institucion = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Institución no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { nombre, codigo_modular, direccion, telefono, correo, director, ugel, dre } = req.body;
    const result = await db.query(
      `INSERT INTO instituciones (nombre, codigo_modular, direccion, telefono, correo, director, ugel, dre) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nombre, codigo_modular, direccion, telefono, correo, director, ugel, dre]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, codigo_modular, direccion, telefono, correo, director, ugel, dre, estado } = req.body;
  try {
    const result = await db.query(
      `UPDATE instituciones 
       SET nombre = $1, codigo_modular = $2, direccion = $3, telefono = $4, correo = $5, director = $6, ugel = $7, dre = $8, estado = $9 
       WHERE id_institucion = $10 RETURNING *`,
      [nombre, codigo_modular, direccion, telefono, correo, director, ugel, dre, estado, id]
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
    const result = await db.query('DELETE FROM instituciones WHERE id_institucion = $1 RETURNING *', [id]);
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

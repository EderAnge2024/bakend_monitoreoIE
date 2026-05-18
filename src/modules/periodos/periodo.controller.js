const db = require('../../config/database');

const getAllPeriodos = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM periodos ORDER BY fecha_inicio DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM periodos WHERE id_periodo = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Periodo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const createPeriodo = async (req, res, next) => {
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO periodos (nombre, fecha_inicio, fecha_fin, estado) VALUES ($1, $2, $3, true) RETURNING *',
      [nombre, fecha_inicio, fecha_fin]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updatePeriodo = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, fecha_inicio, fecha_fin, estado } = req.body;
  try {
    const result = await db.query(
      'UPDATE periodos SET nombre = $1, fecha_inicio = $2, fecha_fin = $3, estado = $4 WHERE id_periodo = $5 RETURNING *',
      [nombre, fecha_inicio, fecha_fin, estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Periodo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const removePeriodo = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM periodos WHERE id_periodo = $1', [id]);
    res.json({ message: 'Periodo eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPeriodos,
  getById,
  createPeriodo,
  updatePeriodo,
  removePeriodo
};

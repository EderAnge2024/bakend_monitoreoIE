const db = require('../../config/database');

// GET all niveles
const getNiveles = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM niveles_desempeno ORDER BY puntaje_minimo ASC'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// GET single nivel
const getNivelById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM niveles_desempeno WHERE id_nivel = $1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Nivel no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// POST create nivel
const createNivel = async (req, res, next) => {
  const { nombre, puntaje_minimo, puntaje_maximo, descripcion, color } = req.body;

  if (!nombre || puntaje_minimo == null || puntaje_maximo == null) {
    return res.status(400).json({ message: 'Nombre, puntaje mínimo y máximo son obligatorios.' });
  }
  if (Number(puntaje_minimo) >= Number(puntaje_maximo)) {
    return res.status(400).json({ message: 'El puntaje mínimo debe ser menor que el máximo.' });
  }

  try {
    // Check if 'color' column exists in the table
    const colCheck = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'niveles_desempeno' AND column_name = 'color'
    `);
    const hasColor = colCheck.rows.length > 0;

    let result;
    if (hasColor) {
      result = await db.query(
        `INSERT INTO niveles_desempeno (nombre, puntaje_minimo, puntaje_maximo, descripcion, color)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nombre, puntaje_minimo, puntaje_maximo, descripcion || null, color || '#6366f1']
      );
    } else {
      result = await db.query(
        `INSERT INTO niveles_desempeno (nombre, puntaje_minimo, puntaje_maximo, descripcion)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [nombre, puntaje_minimo, puntaje_maximo, descripcion || null]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// PUT update nivel
const updateNivel = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, puntaje_minimo, puntaje_maximo, descripcion, color } = req.body;

  if (Number(puntaje_minimo) >= Number(puntaje_maximo)) {
    return res.status(400).json({ message: 'El puntaje mínimo debe ser menor que el máximo.' });
  }

  try {
    const colCheck = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'niveles_desempeno' AND column_name = 'color'
    `);
    const hasColor = colCheck.rows.length > 0;

    let result;
    if (hasColor) {
      result = await db.query(
        `UPDATE niveles_desempeno
         SET nombre=$1, puntaje_minimo=$2, puntaje_maximo=$3, descripcion=$4, color=$5
         WHERE id_nivel=$6 RETURNING *`,
        [nombre, puntaje_minimo, puntaje_maximo, descripcion || null, color || '#6366f1', id]
      );
    } else {
      result = await db.query(
        `UPDATE niveles_desempeno
         SET nombre=$1, puntaje_minimo=$2, puntaje_maximo=$3, descripcion=$4
         WHERE id_nivel=$5 RETURNING *`,
        [nombre, puntaje_minimo, puntaje_maximo, descripcion || null, id]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ message: 'Nivel no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// DELETE nivel
const deleteNivel = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM niveles_desempeno WHERE id_nivel = $1', [id]);
    res.json({ message: 'Nivel eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNiveles, getNivelById, createNivel, updateNivel, deleteNivel };

const db = require('../../config/database');

// --- Fichas ---
const getAllFichas = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM fichas ORDER BY id_ficha DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createFicha = async (req, res, next) => {
  const { nombre, descripcion, es_tutoria } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO fichas (nombre, descripcion, es_tutoria) VALUES ($1, $2, $3) RETURNING *',
      [nombre, descripcion, es_tutoria || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateFicha = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, estado, es_tutoria } = req.body;
  try {
    const result = await db.query(
      'UPDATE fichas SET nombre = $1, descripcion = $2, estado = $3, es_tutoria = $4 WHERE id_ficha = $5 RETURNING *',
      [nombre, descripcion, estado, es_tutoria, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const deleteFicha = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM fichas WHERE id_ficha = $1', [id]);
    res.json({ message: 'Ficha eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

// --- Categorias ---
const getCategoriasByFicha = async (req, res, next) => {
  const { fichaId } = req.params;
  try {
    const result = await db.query('SELECT * FROM categorias WHERE id_ficha = $1 ORDER BY orden ASC', [fichaId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createCategoria = async (req, res, next) => {
  const { id_ficha, nombre, descripcion, orden } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO categorias (id_ficha, nombre, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [id_ficha, nombre, descripcion, orden]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateCategoria = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, orden } = req.body;
  try {
    const result = await db.query(
      'UPDATE categorias SET nombre = $1, descripcion = $2, orden = $3 WHERE id_categoria = $4 RETURNING *',
      [nombre, descripcion, orden, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const deleteCategoria = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM categorias WHERE id_categoria = $1', [id]);
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

// --- Preguntas ---
const getPreguntasByCategoria = async (req, res, next) => {
  const { categoriaId } = req.params;
  try {
    const result = await db.query('SELECT * FROM preguntas WHERE id_categoria = $1 ORDER BY orden ASC', [categoriaId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createPregunta = async (req, res, next) => {
  const { id_categoria, pregunta, tipo_respuesta, puntaje_maximo, peso, obligatorio, orden } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO preguntas (id_categoria, pregunta, tipo_respuesta, puntaje_maximo, peso, obligatorio, orden) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id_categoria, pregunta, tipo_respuesta, puntaje_maximo, peso, obligatorio, orden]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updatePregunta = async (req, res, next) => {
  const { id } = req.params;
  const { pregunta, tipo_respuesta, puntaje_maximo, peso, obligatorio, orden } = req.body;
  try {
    const result = await db.query(
      `UPDATE preguntas SET pregunta = $1, tipo_respuesta = $2, puntaje_maximo = $3, peso = $4, obligatorio = $5, orden = $6
       WHERE id_pregunta = $7 RETURNING *`,
      [pregunta, tipo_respuesta, puntaje_maximo, peso, obligatorio, orden, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const deletePregunta = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM preguntas WHERE id_pregunta = $1', [id]);
    res.json({ message: 'Pregunta eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

// --- Opciones ---
const getOpcionesByPregunta = async (req, res, next) => {
  const { preguntaId } = req.params;
  try {
    const result = await db.query('SELECT * FROM opciones_respuesta WHERE id_pregunta = $1 ORDER BY orden ASC', [preguntaId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createOpcion = async (req, res, next) => {
  const { id_pregunta, nombre_opcion, valor, orden } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO opciones_respuesta (id_pregunta, nombre_opcion, valor, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [id_pregunta, nombre_opcion, valor, orden]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateOpcion = async (req, res, next) => {
  const { id } = req.params;
  const { nombre_opcion, valor, orden } = req.body;
  try {
    const result = await db.query(
      'UPDATE opciones_respuesta SET nombre_opcion = $1, valor = $2, orden = $3 WHERE id_opcion = $4 RETURNING *',
      [nombre_opcion, valor, orden, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const deleteOpcion = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM opciones_respuesta WHERE id_opcion = $1', [id]);
    res.json({ message: 'Opción eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

const getFichaFull = async (req, res, next) => {
  const { id } = req.params;
  try {
    // 1. Get Ficha
    const fichaRes = await db.query('SELECT * FROM fichas WHERE id_ficha = $1', [id]);
    if (fichaRes.rows.length === 0) return res.status(404).json({ message: 'Ficha no encontrada' });
    const ficha = fichaRes.rows[0];

    // 2. Get Categories
    const catRes = await db.query('SELECT * FROM categorias WHERE id_ficha = $1 ORDER BY orden ASC', [id]);
    const categories = catRes.rows;

    // 3. For each category, get questions and for each question get options
    for (const cat of categories) {
      const qRes = await db.query('SELECT * FROM preguntas WHERE id_categoria = $1 ORDER BY orden ASC', [cat.id_categoria]);
      cat.preguntas = qRes.rows;

      for (const q of cat.preguntas) {
        const optRes = await db.query('SELECT * FROM opciones_respuesta WHERE id_pregunta = $1 ORDER BY orden ASC', [q.id_pregunta]);
        q.opciones = optRes.rows;
      }
    }

    ficha.categorias = categories;
    res.json(ficha);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllFichas,
  createFicha,
  updateFicha,
  deleteFicha,
  getCategoriasByFicha,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getPreguntasByCategoria,
  createPregunta,
  updatePregunta,
  deletePregunta,
  getOpcionesByPregunta,
  createOpcion,
  updateOpcion,
  deleteOpcion,
  getFichaFull
};

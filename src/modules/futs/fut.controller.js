const db = require('../../config/database');
const path = require('path');
const fs = require('fs');
const googleDriveService = require('../../services/googleDriveService');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM futs ORDER BY id_fut DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getActives = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM futs WHERE estado = true ORDER BY id_fut DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  const archivo = req.file;

  if (!archivo) {
    return res.status(400).json({ message: 'El archivo FUT es obligatorio' });
  }

  let archivo_url = `/uploads/futs/${archivo.filename}`;

  try {
    if (process.env.USE_GOOGLE_DRIVE === 'true') {
      const filePath = path.join(__dirname, '../../../', archivo_url);
      const fileId = await googleDriveService.uploadFile(filePath, archivo.originalname, archivo.mimetype, process.env.GOOGLE_DRIVE_FOLDER_FUTS);
      archivo_url = await googleDriveService.generatePublicUrl(fileId);
      // Opcional: Eliminar archivo local después de subir
      // fs.unlinkSync(filePath);
    }

    const result = await db.query(
      `INSERT INTO futs (nombre, descripcion, archivo_url) 
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre, descripcion, archivo_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, estado } = req.body;
  
  try {
    let result;
    if (req.file) {
      let archivo_url = `/uploads/futs/${req.file.filename}`;
      
      if (process.env.USE_GOOGLE_DRIVE === 'true') {
        const filePath = path.join(__dirname, '../../../', archivo_url);
        const fileId = await googleDriveService.uploadFile(filePath, req.file.originalname, req.file.mimetype, process.env.GOOGLE_DRIVE_FOLDER_FUTS);
        archivo_url = await googleDriveService.generatePublicUrl(fileId);
      }

      result = await db.query(
        `UPDATE futs 
         SET nombre = $1, descripcion = $2, estado = $3, archivo_url = $4
         WHERE id_fut = $5 RETURNING *`,
        [nombre, descripcion, estado, archivo_url, id]
      );
    } else {
      result = await db.query(
        `UPDATE futs 
         SET nombre = $1, descripcion = $2, estado = $3
         WHERE id_fut = $4 RETURNING *`,
        [nombre, descripcion, estado, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'FUT no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  const { id } = req.params;
  try {
    const fut = await db.query('SELECT archivo_url FROM futs WHERE id_fut = $1', [id]);
    if (fut.rows.length > 0) {
      const filePath = path.join(__dirname, '../../../', fut.rows[0].archivo_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.query('DELETE FROM futs WHERE id_fut = $1', [id]);
    res.json({ message: 'FUT eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getActives,
  create,
  update,
  remove
};

const db = require('../../config/database');
const path = require('path');
const fs = require('fs');
const googleDriveService = require('../../services/googleDriveService');
const emailService = require('../../services/emailService');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT s.*, d.nombres, d.apellidos, d.dni, f.nombre as fut_nombre 
      FROM solicitudes s
      JOIN docentes d ON s.id_docente = d.id_docente
      LEFT JOIN futs f ON s.id_fut = f.id_fut
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getByDocente = async (req, res, next) => {
  const { id_docente } = req.params;
  try {
    const result = await db.query(`
      SELECT s.*, f.nombre as fut_nombre 
      FROM solicitudes s
      LEFT JOIN futs f ON s.id_fut = f.id_fut
      WHERE s.id_docente = $1 
      ORDER BY s.created_at DESC
    `, [id_docente]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  const { id_docente, id_fut, tipo_solicitud, asunto, descripcion, fecha_inicio, fecha_fin } = req.body;
  const archivo = req.file;

  let archivo_adjunto = archivo ? `/uploads/solicitudes/${archivo.filename}` : null;

  try {
    if (archivo && process.env.USE_GOOGLE_DRIVE === 'true') {
      const filePath = path.join(__dirname, '../../../', archivo_adjunto);
      const fileId = await googleDriveService.uploadFile(filePath, archivo.originalname, archivo.mimetype, process.env.GOOGLE_DRIVE_FOLDER_SOLICITUDES);
      archivo_adjunto = await googleDriveService.generatePublicUrl(fileId);
    }

    const result = await db.query(
      `INSERT INTO solicitudes (id_docente, id_fut, tipo_solicitud, asunto, descripcion, fecha_inicio, fecha_fin, archivo_adjunto) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id_docente, id_fut || null, tipo_solicitud, asunto, descripcion, fecha_inicio || null, fecha_fin || null, archivo_adjunto]
    );

    // Enviar notificación a admin
    const adminRes = await db.query("SELECT correo FROM usuarios u JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario JOIN roles r ON ur.id_rol = r.id_rol WHERE r.nombre IN ('administrador', 'director') AND u.correo IS NOT NULL LIMIT 1");
    const docenteRes = await db.query('SELECT nombres, apellidos FROM docentes WHERE id_docente = $1', [id_docente]);
    if (adminRes.rows.length > 0 && docenteRes.rows.length > 0) {
      const adminEmail = adminRes.rows[0].correo;
      const docenteNombre = `${docenteRes.rows[0].nombres} ${docenteRes.rows[0].apellidos}`;
      await emailService.enviarNotificacionSolicitud(adminEmail, asunto, docenteNombre).catch(e => console.error('Error enviando email admin', e));
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  const { id } = req.params;
  const { estado, observacion } = req.body;

  try {
    const result = await db.query(
      `UPDATE solicitudes 
       SET estado = $1, observacion = $2
       WHERE id_solicitud = $3 RETURNING *`,
      [estado, observacion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    // Enviar estado al docente
    const solicitud = result.rows[0];
    const docenteRes = await db.query('SELECT u.correo FROM docentes d JOIN usuarios u ON d.id_usuario = u.id_usuario WHERE d.id_docente = $1', [solicitud.id_docente]);
    if (docenteRes.rows.length > 0 && docenteRes.rows[0].correo) {
      await emailService.enviarEstadoSolicitud(docenteRes.rows[0].correo, solicitud.asunto, estado, observacion).catch(e => console.error('Error enviando email docente', e));
    }

    res.json(solicitud);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getByDocente,
  create,
  updateStatus
};

const db = require('../../config/database');
const path = require('path');
const fs = require('fs');
const googleDriveService = require('../../services/googleDriveService');
const googleOAuthService = require('../../services/googleOAuthService');
const emailService = require('../../services/emailService');

// 1. Crear nueva categoría y carpetas correspondientes en Google Drive
const createCategory = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  const plantillaFile = req.file;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
  }

  try {
    // Verificar si la categoría ya existe en la base de datos
    const checkCat = await db.query('SELECT * FROM categorias_documentos WHERE nombre = $1', [nombre]);
    if (checkCat.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe una categoría con ese nombre.' });
    }

    let driveFolderTemplatesId = null;
    let driveFolderUsersId = null;

    if (process.env.USE_GOOGLE_DRIVE === 'true') {
      // 1. Buscar o crear carpeta raíz "Plantillas" dentro de la carpeta padre configurada (si existe)
      const parentFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
      const rootFolderId = await googleDriveService.getOrCreateFolder('Plantillas', parentFolderId);
      
      // 2. Crear carpeta principal de la categoría dentro de "Plantillas"
      driveFolderTemplatesId = await googleDriveService.createFolder(nombre, rootFolderId);
      
      // 3. Crear carpeta secundaria "-Usuarios" dentro de "Plantillas"
      driveFolderUsersId = await googleDriveService.createFolder(`${nombre}-Usuarios`, rootFolderId);
    } else {
      // Simulación local si Drive está desactivado
      driveFolderTemplatesId = `simulated_folder_templates_${Date.now()}`;
      driveFolderUsersId = `simulated_folder_users_${Date.now()}`;
    }

    // Insertar la categoría en la BD
    const categoryRes = await db.query(
      `INSERT INTO categorias_documentos (nombre, descripcion, drive_folder_id_templates, drive_folder_id_users)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, descripcion || null, driveFolderTemplatesId, driveFolderUsersId]
    );

    const newCategory = categoryRes.rows[0];

    // Subir la plantilla oficial si se proporcionó una
    let newPlantilla = null;
    if (plantillaFile) {
      let fileUrl = `/uploads/${plantillaFile.filename}`;
      let fileId = `simulated_file_${Date.now()}`;

      if (process.env.USE_GOOGLE_DRIVE === 'true') {
        const filePath = path.join(__dirname, '../../../uploads', plantillaFile.filename);
        fileId = await googleDriveService.uploadFile(
          filePath,
          plantillaFile.originalname,
          plantillaFile.mimetype,
          driveFolderTemplatesId
        );
        fileUrl = await googleDriveService.generatePublicUrl(fileId);
        
        // Opcional: Eliminar archivo local para ahorrar espacio
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Insertar en la tabla de plantillas
      const templateRes = await db.query(
        `INSERT INTO plantillas (categoria_id, nombre, drive_file_id, drive_file_url)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [newCategory.id, plantillaFile.originalname, fileId, fileUrl]
      );
      newPlantilla = templateRes.rows[0];
    }

    res.status(201).json({
      message: 'Categoría y carpetas de Google Drive creadas correctamente.',
      categoria: newCategory,
      plantilla: newPlantilla
    });
  } catch (error) {
    console.error('Error en createCategory:', error);
    next(error);
  }
};

// 2. Obtener todas las categorías con sus plantillas oficiales
const getCategories = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        cd.id, cd.nombre, cd.descripcion, cd.drive_folder_id_templates, cd.drive_folder_id_users, cd.created_at,
        p.id as plantilla_id, p.nombre as plantilla_nombre, p.drive_file_id as plantilla_file_id, p.drive_file_url as plantilla_file_url
      FROM categorias_documentos cd
      LEFT JOIN plantillas p ON cd.id = p.categoria_id
      ORDER BY cd.nombre ASC
    `);

    // Agrupamos el resultado de las plantillas por categoría
    const categoriesMap = {};
    result.rows.forEach(row => {
      if (!categoriesMap[row.id]) {
        categoriesMap[row.id] = {
          id: row.id,
          nombre: row.nombre,
          descripcion: row.descripcion,
          drive_folder_id_templates: row.drive_folder_id_templates,
          drive_folder_id_users: row.drive_folder_id_users,
          created_at: row.created_at,
          plantillas: []
        };
      }
      if (row.plantilla_id) {
        categoriesMap[row.id].plantillas.push({
          id: row.plantilla_id,
          nombre: row.plantilla_nombre,
          drive_file_id: row.plantilla_file_id,
          drive_file_url: row.plantilla_file_url
        });
      }
    });

    res.json(Object.values(categoriesMap));
  } catch (error) {
    next(error);
  }
};

// 3. Subir un documento editado (Flujo del Docente)
const uploadDocenteDocument = async (req, res, next) => {
  const { categoria_id } = req.body;
  const userFile = req.file;
  const usuario_id = req.user.id; // Proveniente del middleware de JWT (req.user.id)

  if (!categoria_id) {
    return res.status(400).json({ message: 'El ID de la categoría es obligatorio.' });
  }
  if (!userFile) {
    return res.status(400).json({ message: 'El archivo a subir es obligatorio.' });
  }

  try {
    // Validar que la categoría exista
    const catRes = await db.query('SELECT * FROM categorias_documentos WHERE id = $1', [categoria_id]);
    if (catRes.rows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    const categoria = catRes.rows[0];

    let fileUrl = `/uploads/${userFile.filename}`;
    let fileId = `simulated_user_file_${Date.now()}`;

    if (process.env.USE_GOOGLE_DRIVE === 'true') {
      const filePath = path.join(__dirname, '../../../uploads', userFile.filename);
      fileId = await googleDriveService.uploadFile(
        filePath,
        userFile.originalname,
        userFile.mimetype,
        categoria.drive_folder_id_users
      );
      fileUrl = await googleDriveService.generatePublicUrl(fileId);

      // Eliminar archivo local una vez subido
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Registrar el documento subido en la BD
    const docRes = await db.query(
      `INSERT INTO documentos_subidos (categoria_id, usuario_id, nombre, drive_file_id, drive_file_url, estado)
       VALUES ($1, $2, $3, $4, $5, 'En espera') RETURNING *`,
      [categoria_id, usuario_id, userFile.originalname, fileId, fileUrl]
    );

    res.status(201).json({
      message: 'Documento subido correctamente a Google Drive.',
      documento: docRes.rows[0]
    });
  } catch (error) {
    console.error('Error en uploadDocenteDocument:', error);
    next(error);
  }
};

// 4. Obtener documentos del Docente autenticado
const getDocenteDocuments = async (req, res, next) => {
  const usuario_id = req.user.id;

  try {
    const result = await db.query(
      `SELECT ds.*, cd.nombre as categoria_nombre
       FROM documentos_subidos ds
       LEFT JOIN categorias_documentos cd ON ds.categoria_id = cd.id
       WHERE ds.usuario_id = $1
       ORDER BY ds.created_at DESC`,
      [usuario_id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// 5. Obtener todos los documentos enviados (Admin/Director) con filtros
const getAllDocuments = async (req, res, next) => {
  const { categoria_id } = req.query;

  try {
    let query = `
      SELECT 
        ds.*, cd.nombre as categoria_nombre,
        u.nombres as usuario_nombres, u.apellidos as usuario_apellidos, u.dni as usuario_dni, u.correo as usuario_correo
      FROM documentos_subidos ds
      LEFT JOIN categorias_documentos cd ON ds.categoria_id = cd.id
      LEFT JOIN usuarios u ON ds.usuario_id = u.id_usuario
    `;
    const params = [];

    if (categoria_id) {
      query += ` WHERE ds.categoria_id = $1`;
      params.push(parseInt(categoria_id));
    }

    query += ` ORDER BY ds.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// 6. Cambiar estado de un documento subido y notificar por correo
const updateDocumentStatus = async (req, res, next) => {
  const { id } = req.params;
  const { estado, observacion } = req.body;

  const validStates = ['En espera', 'Recibido', 'Observado', 'Aprobado', 'Rechazado'];
  if (!validStates.includes(estado)) {
    return res.status(400).json({ message: `Estado no válido. Debe ser uno de: ${validStates.join(', ')}` });
  }

  try {
    // Actualizar en la BD
    const result = await db.query(
      `UPDATE documentos_subidos
       SET estado = $1, observacion = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [estado, observacion || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Documento no encontrado.' });
    }

    const updatedDoc = result.rows[0];

    // Obtener los datos del usuario y la categoría para el correo
    const detailRes = await db.query(`
      SELECT 
        u.correo, u.nombres, u.apellidos,
        cd.nombre as categoria_nombre
      FROM usuarios u
      JOIN documentos_subidos ds ON ds.usuario_id = u.id_usuario
      LEFT JOIN categorias_documentos cd ON ds.categoria_id = cd.id
      WHERE ds.id = $1
    `, [id]);

    if (detailRes.rows.length > 0 && detailRes.rows[0].correo) {
      const { correo, nombres, apellidos, categoria_nombre } = detailRes.rows[0];
      const subject = `Actualización de Estado de tu Documento: ${estado}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">Gestión Documental - Monitoreo IE</h2>
          <p>Hola <strong>${nombres} ${apellidos}</strong>,</p>
          <p>Se ha actualizado el estado de tu documento enviado para la categoría <strong>"${categoria_nombre}"</strong>.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Documento:</strong> ${updatedDoc.nombre}</p>
            <p style="margin: 5px 0;"><strong>Nuevo Estado:</strong> <span style="color: #2563eb; font-weight: bold;">${estado}</span></p>
            <p style="margin: 5px 0;"><strong>Observación:</strong> ${observacion || 'Ninguna'}</p>
          </div>
          <p>Por favor, ingresa al portal institucional para ver más detalles.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 30px;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">Este es un correo automático del Sistema de Monitoreo IE.</p>
        </div>
      `;

      const textContent = `Hola ${nombres}, tu documento "${updatedDoc.nombre}" de la categoría "${categoria_nombre}" cambió a estado: ${estado}. Observación: ${observacion || 'Ninguna'}.`;

      // Enviar correo de forma asíncrona para no retrasar la respuesta API
      emailService.sendEmail(correo, subject, textContent, htmlContent)
        .then(() => console.log(`Notificación por correo enviada exitosamente a ${correo}`))
        .catch(err => console.error('Error al enviar correo de notificación de documento:', err));
    }

    res.json({
      message: 'Estado del documento actualizado correctamente.',
      documento: updatedDoc
    });
  } catch (error) {
    console.error('Error en updateDocumentStatus:', error);
    next(error);
  }
};

// 7. Actualizar nombre/descripción de una categoría (Admin/Director)
const updateCategory = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;

  if (!nombre) return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });

  try {
    const result = await db.query(
      `UPDATE categorias_documentos SET nombre = $1, descripcion = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [nombre, descripcion || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Categoría no encontrada.' });
    res.json({ message: 'Categoría actualizada correctamente.', categoria: result.rows[0] });
  } catch (error) {
    console.error('Error en updateCategory:', error);
    next(error);
  }
};

// 8. Eliminar una categoría (Admin/Director) — también elimina sus plantillas asociadas en BD
const deleteCategory = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Obtener datos de la categoría para limpiar Drive si aplica
    const catRes = await db.query('SELECT * FROM categorias_documentos WHERE id = $1', [id]);
    if (catRes.rows.length === 0) return res.status(404).json({ message: 'Categoría no encontrada.' });

    const categoria = catRes.rows[0];

    // Intentar eliminar carpetas en Drive (no crítico — nunca bloqueamos la BD por errores de Drive)
    if (process.env.USE_GOOGLE_DRIVE === 'true') {
      const tryDeleteFromDrive = async (fileId, label) => {
        try {
          await googleDriveService.deleteFile(fileId);
        } catch (e) {
          // 403 ocurre cuando la carpeta fue creada por otro usuario (ej. Service Account antiguo)
          // Lo ignoramos silenciosamente — la BD se limpia igual
          console.warn(`[Drive] No se pudo eliminar ${label} (ID: ${fileId}): ${e.message}`);
        }
      };
      if (categoria.drive_folder_id_templates) {
        await tryDeleteFromDrive(categoria.drive_folder_id_templates, 'carpeta de plantillas');
      }
      if (categoria.drive_folder_id_users) {
        await tryDeleteFromDrive(categoria.drive_folder_id_users, 'carpeta de usuarios');
      }
    }

    // --- Limpieza en Base de Datos (siempre se ejecuta, independiente de Drive) ---
    // Eliminar plantillas asociadas (tabla real: "plantillas")
    await db.query('DELETE FROM plantillas WHERE categoria_id = $1', [id]);
    // Eliminar documentos subidos asociados
    await db.query('DELETE FROM documentos_subidos WHERE categoria_id = $1', [id]);
    // Eliminar la categoría
    await db.query('DELETE FROM categorias_documentos WHERE id = $1', [id]);

    res.json({ message: `Categoría "${categoria.nombre}" eliminada correctamente junto con sus plantillas y documentos asociados.` });
  } catch (error) {
    console.error('Error en deleteCategory:', error);
    next(error);
  }
};


// 9. Eliminar un documento subido por un docente (Admin/Director)
const deleteDocument = async (req, res, next) => {
  const { id } = req.params;

  try {
    const docRes = await db.query('SELECT * FROM documentos_subidos WHERE id = $1', [id]);
    if (docRes.rows.length === 0) return res.status(404).json({ message: 'Documento no encontrado.' });

    const doc = docRes.rows[0];

    // Eliminar archivo en Drive si existe
    if (process.env.USE_GOOGLE_DRIVE === 'true' && doc.drive_file_id) {
      await googleDriveService.deleteFile(doc.drive_file_id).catch(e => console.warn('No se pudo eliminar archivo en Drive:', e.message));
    }

    await db.query('DELETE FROM documentos_subidos WHERE id = $1', [id]);

    res.json({ message: `Documento "${doc.nombre}" eliminado correctamente.` });
  } catch (error) {
    console.error('Error en deleteDocument:', error);
    next(error);
  }
};

// --- Controladores de Autenticación de Google Drive OAuth2 ---

const getGoogleAuthUrl = async (req, res, next) => {
  try {
    const url = googleOAuthService.getAuthUrl();
    if (!url) {
      return res.status(500).json({ message: 'Error al generar la URL de autenticación. Verifica las variables de entorno en el backend.' });
    }
    res.json({ url });
  } catch (error) {
    next(error);
  }
};

const googleAuthCallback = async (req, res, next) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Código de autorización faltante de Google.');
  }
  try {
    await googleOAuthService.handleCallback(code);
    
    // Redireccionar al frontend a la página de Gestión Documental
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/gestion-documental?oauth=success`);
  } catch (error) {
    console.error('Error en el callback de OAuth2:', error);
    res.status(500).send(`Error de autenticación con Google Drive: ${error.message}`);
  }
};

const getGoogleAuthStatus = async (req, res, next) => {
  try {
    const connected = await googleOAuthService.isConnected();
    let email = null;
    if (connected) {
      const token = await googleOAuthService.getStoredToken();
      email = token.scope ? 'Cuenta Autorizada de Drive' : 'Conectado';
    }
    res.json({ connected, email });
  } catch (error) {
    next(error);
  }
};

const googleDisconnect = async (req, res, next) => {
  try {
    await googleOAuthService.disconnect();
    res.json({ message: 'Google Drive desconectado con éxito.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  uploadDocenteDocument,
  getDocenteDocuments,
  getAllDocuments,
  updateDocumentStatus,
  deleteDocument,
  getGoogleAuthUrl,
  googleAuthCallback,
  getGoogleAuthStatus,
  googleDisconnect
};

const db = require('../../config/database');

// Obtener configuración de asistencia de la institución
const getConfiguracion = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    
    const result = await db.query(
      'SELECT * FROM configuracion_asistencia WHERE id_institucion = $1',
      [id_institucion]
    );

    if (result.rows.length === 0) {
      // Si no existe configuración, devolver valores por defecto
      return res.json({
        exists: false,
        default_config: {
          latitud_ie: -12.0464,
          longitud_ie: -77.0428,
          radio_permitido_metros: 100,
          wifi_nombre: '',
          wifi_bssid: '',
          validar_gps: true,
          validar_wifi: false,
          hora_ingreso: '08:00:00',
          hora_salida: '13:00:00',
          tolerancia_minutos: 15,
          activo: true
        }
      });
    }

    res.json({
      exists: true,
      config: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Crear o actualizar configuración de asistencia
const saveConfiguracion = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    const {
      latitud_ie,
      longitud_ie,
      radio_permitido_metros,
      wifi_nombre,
      wifi_bssid,
      validar_gps,
      validar_wifi,
      hora_ingreso,
      hora_salida,
      tolerancia_minutos,
      activo
    } = req.body;

    // Validar datos requeridos
    if (!latitud_ie || !longitud_ie) {
      return res.status(400).json({ 
        message: 'Las coordenadas GPS de la institución son requeridas' 
      });
    }

    // Verificar si ya existe configuración
    const existeConfig = await db.query(
      'SELECT id_config FROM configuracion_asistencia WHERE id_institucion = $1',
      [id_institucion]
    );

    let result;

    if (existeConfig.rows.length > 0) {
      // Actualizar configuración existente
      result = await db.query(
        `UPDATE configuracion_asistencia 
         SET latitud_ie = $1, longitud_ie = $2, radio_permitido_metros = $3,
             wifi_nombre = $4, wifi_bssid = $5, validar_gps = $6, validar_wifi = $7,
             hora_ingreso = $8, hora_salida = $9, tolerancia_minutos = $10, 
             activo = $11, updated_at = CURRENT_TIMESTAMP
         WHERE id_institucion = $12
         RETURNING *`,
        [
          latitud_ie, longitud_ie, radio_permitido_metros,
          wifi_nombre || null, wifi_bssid || null, validar_gps, validar_wifi,
          hora_ingreso, hora_salida, tolerancia_minutos, activo,
          id_institucion
        ]
      );
    } else {
      // Crear nueva configuración
      result = await db.query(
        `INSERT INTO configuracion_asistencia 
         (id_institucion, latitud_ie, longitud_ie, radio_permitido_metros,
          wifi_nombre, wifi_bssid, validar_gps, validar_wifi,
          hora_ingreso, hora_salida, tolerancia_minutos, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          id_institucion, latitud_ie, longitud_ie, radio_permitido_metros,
          wifi_nombre || null, wifi_bssid || null, validar_gps, validar_wifi,
          hora_ingreso, hora_salida, tolerancia_minutos, activo
        ]
      );
    }

    res.json({
      success: true,
      message: 'Configuración de asistencia guardada exitosamente',
      config: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Obtener estadísticas de asistencia
const getEstadisticasAsistencia = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    const { fecha_inicio, fecha_fin } = req.query;

    let whereClause = 'd.id_institucion = $1';
    let params = [id_institucion];

    if (fecha_inicio && fecha_fin) {
      whereClause += ' AND a.fecha BETWEEN $2 AND $3';
      params.push(fecha_inicio, fecha_fin);
    } else {
      // Por defecto, últimos 30 días
      whereClause += ' AND a.fecha >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    // Estadísticas generales
    const statsResult = await db.query(`
      SELECT 
        COUNT(DISTINCT a.id_docente) as docentes_registrados,
        COUNT(a.id_asistencia) as total_registros,
        COUNT(CASE WHEN a.estado_ingreso = 'PUNTUAL' THEN 1 END) as puntuales,
        COUNT(CASE WHEN a.estado_ingreso = 'TARDANZA' THEN 1 END) as tardanzas,
        COUNT(CASE WHEN a.nivel_seguridad = 'ALTA' THEN 1 END) as seguridad_alta,
        COUNT(CASE WHEN a.nivel_seguridad = 'MEDIA' THEN 1 END) as seguridad_media,
        COUNT(CASE WHEN a.nivel_seguridad = 'BAJA' THEN 1 END) as seguridad_baja
      FROM asistencias_docentes a
      JOIN docentes d ON a.id_docente = d.id_docente
      WHERE ${whereClause}
    `, params);

    // Total de docentes en la institución
    const totalDocentesResult = await db.query(
      'SELECT COUNT(*) as total FROM docentes WHERE id_institucion = $1',
      [id_institucion]
    );

    // Asistencias por día (últimos 7 días)
    const asistenciasPorDiaResult = await db.query(`
      SELECT 
        a.fecha,
        COUNT(a.id_asistencia) as total_asistencias,
        COUNT(CASE WHEN a.estado_ingreso = 'PUNTUAL' THEN 1 END) as puntuales,
        COUNT(CASE WHEN a.estado_ingreso = 'TARDANZA' THEN 1 END) as tardanzas
      FROM asistencias_docentes a
      JOIN docentes d ON a.id_docente = d.id_docente
      WHERE d.id_institucion = $1 AND a.fecha >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY a.fecha
      ORDER BY a.fecha DESC
    `, [id_institucion]);

    const stats = statsResult.rows[0];
    const totalDocentes = parseInt(totalDocentesResult.rows[0].total);

    res.json({
      estadisticas_generales: {
        total_docentes: totalDocentes,
        docentes_registrados: parseInt(stats.docentes_registrados),
        total_registros: parseInt(stats.total_registros),
        porcentaje_puntualidad: stats.total_registros > 0 
          ? Math.round((stats.puntuales / stats.total_registros) * 100) 
          : 0,
        puntuales: parseInt(stats.puntuales),
        tardanzas: parseInt(stats.tardanzas),
        seguridad: {
          alta: parseInt(stats.seguridad_alta),
          media: parseInt(stats.seguridad_media),
          baja: parseInt(stats.seguridad_baja)
        }
      },
      asistencias_por_dia: asistenciasPorDiaResult.rows
    });
  } catch (error) {
    next(error);
  }
};

// Obtener reporte detallado de asistencias
const getReporteAsistencias = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    const { fecha_inicio, fecha_fin, id_docente } = req.query;

    let whereClause = 'd.id_institucion = $1';
    let params = [id_institucion];
    let paramIndex = 2;

    if (fecha_inicio && fecha_fin) {
      whereClause += ` AND a.fecha BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(fecha_inicio, fecha_fin);
      paramIndex += 2;
    }

    if (id_docente) {
      whereClause += ` AND a.id_docente = $${paramIndex}`;
      params.push(id_docente);
    }

    const result = await db.query(`
      SELECT 
        a.*,
        d.nombres,
        d.apellidos,
        d.dni,
        d.area,
        d.grado,
        d.seccion
      FROM asistencias_docentes a
      JOIN docentes d ON a.id_docente = d.id_docente
      WHERE ${whereClause}
      ORDER BY a.fecha DESC, a.hora_ingreso DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Eliminar registro de asistencia
const deleteAsistencia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_institucion } = req.user;

    // Verificar que la asistencia pertenece a la institución (por medio del docente)
    const asistenciaExiste = await db.query(
      `SELECT a.id_asistencia 
       FROM asistencias_docentes a
       JOIN docentes d ON a.id_docente = d.id_docente
       WHERE a.id_asistencia = $1 AND d.id_institucion = $2`,
      [id, id_institucion]
    );

    if (asistenciaExiste.rows.length === 0) {
      return res.status(404).json({ message: 'Registro de asistencia no encontrado o no autorizado' });
    }

    await db.query('DELETE FROM asistencias_docentes WHERE id_asistencia = $1', [id]);

    res.json({
      success: true,
      message: 'Registro de asistencia eliminado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConfiguracion,
  saveConfiguracion,
  getEstadisticasAsistencia,
  getReporteAsistencias,
  deleteAsistencia
};
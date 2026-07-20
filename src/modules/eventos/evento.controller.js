const db = require('../../config/database');

// Función para calcular distancia entre dos puntos GPS (en metros)
const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c); // Distancia en metros
};

// Función para determinar el nivel de seguridad
const determinarNivelSeguridad = (validacionGPS, validacionWiFi, distancia, radioPermitido) => {
  if (validacionGPS && validacionWiFi && distancia <= radioPermitido/2) return 'ALTA';
  if (validacionGPS && distancia <= radioPermitido) return 'MEDIA';
  return 'BAJA';
};

// ============================================================================
// FUNCIONES PARA DIRECTORES (Gestión de Eventos)
// ============================================================================

// Obtener todos los eventos de la institución
const getAllEventos = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    
    const result = await db.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM asistencia_eventos ae WHERE ae.id_evento = e.id_evento) as total_asistentes
      FROM eventos e
      WHERE e.id_institucion = $1
      ORDER BY e.fecha DESC, e.hora_inicio DESC
    `, [id_institucion]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Crear nuevo evento
const createEvento = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    const { nombre_evento, fecha, hora_inicio, hora_fin, descripcion } = req.body;

    // Validar datos requeridos
    if (!nombre_evento || !fecha || !hora_inicio) {
      return res.status(400).json({ 
        message: 'Nombre del evento, fecha y hora de inicio son requeridos' 
      });
    }

    const result = await db.query(`
      INSERT INTO eventos (id_institucion, nombre_evento, fecha, hora_inicio, hora_fin, descripcion, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE')
      RETURNING *
    `, [id_institucion, nombre_evento, fecha, hora_inicio, hora_fin || null, descripcion || null]);

    res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente',
      evento: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Obtener evento por ID
const getEventoById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_institucion } = req.user;

    const result = await db.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM asistencia_eventos ae WHERE ae.id_evento = e.id_evento) as total_asistentes
      FROM eventos e
      WHERE e.id_evento = $1 AND e.id_institucion = $2
    `, [id, id_institucion]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Actualizar evento
const updateEvento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_institucion } = req.user;
    const { nombre_evento, fecha, hora_inicio, hora_fin, descripcion, estado } = req.body;

    // Verificar que el evento pertenece a la institución
    const eventoExiste = await db.query(
      'SELECT id_evento FROM eventos WHERE id_evento = $1 AND id_institucion = $2',
      [id, id_institucion]
    );

    if (eventoExiste.rows.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const result = await db.query(`
      UPDATE eventos 
      SET nombre_evento = $1, fecha = $2, hora_inicio = $3, hora_fin = $4, 
          descripcion = $5, estado = $6
      WHERE id_evento = $7 AND id_institucion = $8
      RETURNING *
    `, [nombre_evento, fecha, hora_inicio, hora_fin, descripcion, estado, id, id_institucion]);

    res.json({
      success: true,
      message: 'Evento actualizado exitosamente',
      evento: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Cambiar estado del evento
const cambiarEstadoEvento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_institucion } = req.user;
    const { estado } = req.body;

    // Validar estado permitido
    const estadosPermitidos = ['PENDIENTE', 'EN_REGISTRO', 'CERRADO', 'ANULADO'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ 
        message: 'Estado no válido. Estados permitidos: ' + estadosPermitidos.join(', ') 
      });
    }

    const result = await db.query(`
      UPDATE eventos 
      SET estado = $1
      WHERE id_evento = $2 AND id_institucion = $3
      RETURNING *
    `, [estado, id, id_institucion]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    res.json({
      success: true,
      message: `Estado del evento cambiado a ${estado}`,
      evento: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Ver asistentes del evento
const getAsistentesEvento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_institucion } = req.user;

    // Verificar que el evento pertenece a la institución
    const eventoExiste = await db.query(
      'SELECT id_evento FROM eventos WHERE id_evento = $1 AND id_institucion = $2',
      [id, id_institucion]
    );

    if (eventoExiste.rows.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const result = await db.query(`
      SELECT 
        ae.*,
        d.nombres,
        d.apellidos,
        d.dni,
        d.area,
        d.grado,
        d.seccion
      FROM asistencia_eventos ae
      JOIN docentes d ON ae.id_docente = d.id_docente
      WHERE ae.id_evento = $1
      ORDER BY ae.hora_registro ASC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// FUNCIONES PARA DOCENTES (Registro de Asistencia a Eventos)
// ============================================================================

// Obtener eventos disponibles para el docente
const getEventosDisponibles = async (req, res, next) => {
  try {
    const { id, id_institucion } = req.user;

    // Obtener el docente asociado al usuario
    const docenteResult = await db.query(
      'SELECT id_docente FROM docentes WHERE id_usuario = $1',
      [id]
    );

    if (docenteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    const id_docente = docenteResult.rows[0].id_docente;

    // Obtener eventos EN_REGISTRO de la institución
    const result = await db.query(`
      SELECT 
        e.*,
        CASE 
          WHEN ae.id_asistencia_evento IS NOT NULL THEN true 
          ELSE false 
        END as ya_registrado,
        ae.hora_registro,
        ae.nivel_seguridad
      FROM eventos e
      LEFT JOIN asistencia_eventos ae ON (e.id_evento = ae.id_evento AND ae.id_docente = $1)
      WHERE e.id_institucion = $2 AND e.estado = 'EN_REGISTRO'
      ORDER BY e.fecha ASC, e.hora_inicio ASC
    `, [id_docente, id_institucion]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar asistencia a evento
const registrarAsistenciaEvento = async (req, res, next) => {
  try {
    const { id } = req.params; // id_evento
    const { id: id_usuario, id_institucion } = req.user;
    const { latitud, longitud, wifi_ssid, wifi_bssid } = req.body;

    // Validar datos requeridos
    if (!latitud || !longitud) {
      return res.status(400).json({ 
        message: 'Ubicación GPS requerida para registrar asistencia' 
      });
    }

    // Obtener el docente asociado al usuario
    const docenteResult = await db.query(
      'SELECT id_docente FROM docentes WHERE id_usuario = $1',
      [id_usuario]
    );

    if (docenteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    const id_docente = docenteResult.rows[0].id_docente;

    // Verificar que el evento existe y está EN_REGISTRO
    const eventoResult = await db.query(`
      SELECT * FROM eventos 
      WHERE id_evento = $1 AND id_institucion = $2 AND estado = 'EN_REGISTRO'
    `, [id, id_institucion]);

    if (eventoResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'Evento no encontrado o no está disponible para registro' 
      });
    }

    // Verificar si ya se registró para este evento
    const yaRegistrado = await db.query(
      'SELECT id_asistencia_evento FROM asistencia_eventos WHERE id_evento = $1 AND id_docente = $2',
      [id, id_docente]
    );

    if (yaRegistrado.rows.length > 0) {
      return res.status(400).json({ 
        message: 'Ya se encuentra registrado para este evento' 
      });
    }

    // Obtener configuración de la institución
    const configResult = await db.query(
      'SELECT * FROM configuracion_asistencia WHERE id_institucion = $1 AND activo = TRUE',
      [id_institucion]
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'No existe configuración de asistencia para esta institución' 
      });
    }

    const config = configResult.rows[0];

    // Validar ubicación GPS
    const distancia = calcularDistancia(
      parseFloat(latitud),
      parseFloat(longitud),
      parseFloat(config.latitud_ie),
      parseFloat(config.longitud_ie)
    );

    // Validación obligatoria de perímetro
    if (config.validar_gps && distancia > config.radio_permitido_metros) {
      return res.status(400).json({
        message: 'Usted se encuentra fuera de la Institución Educativa. No puede registrar asistencia al evento.',
        distancia: distancia,
        radio_permitido: config.radio_permitido_metros
      });
    }

    // Validar WiFi si está configurado
    let validacionWiFi = true;
    if (config.validar_wifi && config.wifi_nombre) {
      validacionWiFi = (wifi_ssid === config.wifi_nombre) || 
                       (wifi_bssid === config.wifi_bssid);
      
      if (!validacionWiFi) {
        console.log(`Advertencia WiFi evento: Esperado ${config.wifi_nombre}, Recibido: ${wifi_ssid}`);
      }
    }

    // Determinar nivel de seguridad
    const nivelSeguridad = determinarNivelSeguridad(
      config.validar_gps, 
      validacionWiFi, 
      distancia, 
      config.radio_permitido_metros
    );

    // Registrar la asistencia al evento
    const result = await db.query(
      `INSERT INTO asistencia_eventos 
       (id_evento, id_docente, latitud, longitud, distancia_metros, 
        wifi_detectado, wifi_bssid, nivel_seguridad, estado, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PRESENTE', $9)
       RETURNING *`,
      [
        id,
        id_docente,
        latitud,
        longitud,
        distancia,
        wifi_ssid || null,
        wifi_bssid || null,
        nivelSeguridad,
        validacionWiFi ? null : 'WiFi institucional no detectado'
      ]
    );

    res.json({
      success: true,
      message: 'Asistencia al evento registrada correctamente',
      asistencia: result.rows[0],
      validaciones: {
        gps: config.validar_gps ? (distancia <= config.radio_permitido_metros) : true,
        wifi: validacionWiFi,
        distancia: distancia
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Funciones para directores
  getAllEventos,
  createEvento,
  getEventoById,
  updateEvento,
  cambiarEstadoEvento,
  getAsistentesEvento,
  
  // Funciones para docentes
  getEventosDisponibles,
  registrarAsistenciaEvento
};
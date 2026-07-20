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

// Obtener configuración de asistencia de la institución
const getConfiguracion = async (req, res, next) => {
  try {
    const { id_institucion } = req.user;
    
    const result = await db.query(
      'SELECT * FROM configuracion_asistencia WHERE id_institucion = $1 AND activo = TRUE',
      [id_institucion]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: 'No existe configuración de asistencia para esta institución' 
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Consultar asistencia del día actual
const getAsistenciaHoy = async (req, res, next) => {
  try {
    const { id } = req.user; // id_usuario
    
    // Obtener el docente asociado al usuario
    const docenteResult = await db.query(
      'SELECT id_docente FROM docentes WHERE id_usuario = $1',
      [id]
    );

    if (docenteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    const id_docente = docenteResult.rows[0].id_docente;
    const fechaHoy = new Date().toISOString().split('T')[0];

    const result = await db.query(
      'SELECT * FROM asistencias_docentes WHERE id_docente = $1 AND fecha = $2',
      [id_docente, fechaHoy]
    );

    if (result.rows.length === 0) {
      return res.json({ registrado: false });
    }

    res.json({ 
      registrado: true, 
      asistencia: result.rows[0] 
    });
  } catch (error) {
    next(error);
  }
};

// Registrar ingreso
const registrarIngreso = async (req, res, next) => {
  try {
    const { id, id_institucion } = req.user;
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
      [id]
    );

    if (docenteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    const id_docente = docenteResult.rows[0].id_docente;
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Verificar si ya existe registro del día
    const existeRegistro = await db.query(
      'SELECT id_asistencia FROM asistencias_docentes WHERE id_docente = $1 AND fecha = $2',
      [id_docente, fechaHoy]
    );

    if (existeRegistro.rows.length > 0) {
      return res.status(400).json({ 
        message: 'Ya existe un registro de asistencia para el día de hoy' 
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
        message: 'Usted se encuentra fuera de la Institución Educativa. No puede registrar asistencia.',
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
        // Registrar incidencia pero permitir el registro con nivel de seguridad bajo
        console.log(`Advertencia WiFi: Esperado ${config.wifi_nombre}, Recibido: ${wifi_ssid}`);
      }
    }

    // Determinar estado de puntualidad
    const horaActual = new Date();
    const horaIngreso = new Date();
    const [horas, minutos] = config.hora_ingreso.split(':');
    horaIngreso.setHours(parseInt(horas), parseInt(minutos), 0, 0);
    
    const horaLimite = new Date(horaIngreso);
    horaLimite.setMinutes(horaLimite.getMinutes() + config.tolerancia_minutos);

    const estadoIngreso = horaActual <= horaLimite ? 'PUNTUAL' : 'TARDANZA';

    // Determinar nivel de seguridad
    const nivelSeguridad = determinarNivelSeguridad(
      config.validar_gps, 
      validacionWiFi, 
      distancia, 
      config.radio_permitido_metros
    );

    // Registrar la asistencia
    const result = await db.query(
      `INSERT INTO asistencias_docentes 
       (id_docente, fecha, hora_ingreso, latitud_ingreso, longitud_ingreso, 
        distancia_ingreso_metros, wifi_ingreso, wifi_ingreso_bssid, 
        estado_ingreso, nivel_seguridad, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id_docente,
        fechaHoy,
        horaActual.toTimeString().split(' ')[0], // HH:MM:SS
        latitud,
        longitud,
        distancia,
        wifi_ssid || null,
        wifi_bssid || null,
        estadoIngreso,
        nivelSeguridad,
        validacionWiFi ? null : 'WiFi institucional no detectado'
      ]
    );

    res.json({
      success: true,
      message: 'Ingreso registrado correctamente',
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

// Registrar salida
const registrarSalida = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { latitud, longitud, wifi_ssid, wifi_bssid } = req.body;

    // Obtener el docente asociado al usuario
    const docenteResult = await db.query(
      'SELECT id_docente FROM docentes WHERE id_usuario = $1',
      [id]
    );

    if (docenteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Docente no encontrado' });
    }

    const id_docente = docenteResult.rows[0].id_docente;
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Verificar que existe ingreso del día
    const ingresoResult = await db.query(
      'SELECT * FROM asistencias_docentes WHERE id_docente = $1 AND fecha = $2',
      [id_docente, fechaHoy]
    );

    if (ingresoResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'No se puede registrar salida sin un ingreso previo' 
      });
    }

    const registroIngreso = ingresoResult.rows[0];

    // Verificar que no se haya registrado salida
    if (registroIngreso.hora_salida) {
      return res.status(400).json({ 
        message: 'Ya se ha registrado la salida para el día de hoy' 
      });
    }

    // Calcular distancia de salida si se proporcionó ubicación
    let distanciaSalida = null;
    if (latitud && longitud) {
      // Obtener configuración para calcular distancia
      const configResult = await db.query(
        'SELECT latitud_ie, longitud_ie FROM configuracion_asistencia WHERE id_institucion = $1',
        [req.user.id_institucion]
      );

      if (configResult.rows.length > 0) {
        const config = configResult.rows[0];
        distanciaSalida = calcularDistancia(
          parseFloat(latitud),
          parseFloat(longitud),
          parseFloat(config.latitud_ie),
          parseFloat(config.longitud_ie)
        );
      }
    }

    // Actualizar registro con datos de salida
    const horaActual = new Date();
    const result = await db.query(
      `UPDATE asistencias_docentes 
       SET hora_salida = $1, latitud_salida = $2, longitud_salida = $3,
           distancia_salida_metros = $4, wifi_salida = $5, wifi_salida_bssid = $6,
           estado_salida = 'NORMAL'
       WHERE id_docente = $7 AND fecha = $8
       RETURNING *`,
      [
        horaActual.toTimeString().split(' ')[0],
        latitud || null,
        longitud || null,
        distanciaSalida,
        wifi_ssid || null,
        wifi_bssid || null,
        id_docente,
        fechaHoy
      ]
    );

    res.json({
      success: true,
      message: 'Salida registrada correctamente',
      asistencia: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConfiguracion,
  getAsistenciaHoy,
  registrarIngreso,
  registrarSalida
};
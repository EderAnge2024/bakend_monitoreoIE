const db = require('../../config/database');

const createMonitoreo = async (req, res, next) => {
  const { 
    id_ficha, id_docente, id_periodo, numero_visita, fecha, area, 
    competencia, desempeno, sesion, interpretacion_desempeno, 
    desempeno_priorizado, compromiso_docente, observaciones_generales, 
    recomendaciones, tipo_monitoreo
  } = req.body;
  
  const id_evaluador = req.user.id; // From JWT

  try {
    const result = await db.query(
      `INSERT INTO monitoreos (
        id_ficha, id_docente, id_periodo, id_evaluador, numero_visita, fecha, area, 
        competencia, desempeno, sesion, interpretacion_desempeno, 
        desempeno_priorizado, compromiso_docente, observaciones_generales, recomendaciones, tipo_monitoreo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        id_ficha, id_docente, id_periodo, id_evaluador, numero_visita, fecha, area, 
        competencia, desempeno, sesion, interpretacion_desempeno, 
        desempeno_priorizado, compromiso_docente, observaciones_generales, recomendaciones, tipo_monitoreo || 'Docente'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const getMonitoreosByEvaluador = async (req, res, next) => {
  const id_evaluador = req.user.id;
  try {
    const result = await db.query(`
      SELECT m.*, d.nombres as docente_nombres, d.apellidos as docente_apellidos, f.nombre as ficha_nombre,
             nd.color as nivel_color, COALESCE(nd.nombre, m.nivel_final) as nivel_final
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      JOIN fichas f ON m.id_ficha = f.id_ficha
      LEFT JOIN LATERAL (
        SELECT nombre, color 
        FROM niveles_desempeno
        WHERE m.puntaje_total BETWEEN rango_min AND rango_max
        LIMIT 1
      ) nd ON true
      WHERE m.id_evaluador = $1
      ORDER BY m.fecha DESC
    `, [id_evaluador]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getMonitoreosByDocente = async (req, res, next) => {
  const { id_docente } = req.params;
  try {
    const result = await db.query(`
      SELECT m.*, u.nombres as evaluador_nombres, u.apellidos as evaluador_apellidos, f.nombre as ficha_nombre,
             nd.color as nivel_color, COALESCE(nd.nombre, m.nivel_final) as nivel_final
      FROM monitoreos m
      JOIN usuarios u ON m.id_evaluador = u.id_usuario
      JOIN fichas f ON m.id_ficha = f.id_ficha
      LEFT JOIN LATERAL (
        SELECT nombre, color FROM niveles_desempeno
        WHERE m.puntaje_total BETWEEN rango_min AND rango_max
        LIMIT 1
      ) nd ON true
      WHERE m.id_docente = $1
      ORDER BY m.fecha DESC
    `, [id_docente]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const scoreService = require('../../services/scoreService');

const saveAnswers = async (req, res, next) => {
  const { id_monitoreo, respuestas } = req.body;
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of respuestas) {
        await client.query(
          `INSERT INTO respuestas (id_monitoreo, id_pregunta, id_opcion, respuesta_texto, valor_respuesta, puntaje, comentario) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id_monitoreo, 
            r.id_pregunta, 
            r.id_opcion || null, 
            r.respuesta_texto || null, 
            r.valor_respuesta || r.puntaje || 0, 
            r.puntaje || 0, 
            r.comentario || null
          ]
        );
      }
      await client.query('COMMIT');
      
      // Calculate final score
      const result = await scoreService.calculateTotalScore(id_monitoreo);
      
      res.json({ message: 'Respuestas guardadas y monitoreo finalizado', ...result });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  const { id_institucion, id_periodo, id_ficha, id_docente } = req.query;
  
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let pIdx = 1;

    // Enforce role-based filtering
    const userRole = req.user.role;
    const userIdInstitucion = req.user.id_institucion;

    if (userRole === 'director' || userRole === 'especialista' || userRole === 'docente') {
      // If they have an institution assigned, they can only see that one
      if (userIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (id_institucion) {
      // Admins can filter by any institution
      whereClause += ` AND d.id_institucion = $${pIdx++}`;
      params.push(id_institucion);
    }

    if (id_periodo) {
      whereClause += ` AND m.id_periodo = $${pIdx++}`;
      params.push(id_periodo);
    }
    if (id_ficha) {
      whereClause += ` AND m.id_ficha = $${pIdx++}`;
      params.push(id_ficha);
    }
    if (id_docente) {
      whereClause += ` AND m.id_docente = $${pIdx++}`;
      params.push(id_docente);
    }

    const stats = {};

    // 0. Load niveles_desempeno (check if table/column exists gracefully)
    let niveles = [];
    try {
      const nivelesRes = await db.query(
        'SELECT * FROM niveles_desempeno ORDER BY rango_min ASC'
      );
      niveles = nivelesRes.rows;
    } catch (_) { niveles = []; }
    stats.niveles = niveles;

    // Determine lowest-performing threshold dynamically
    // The "bajo desempeño" is the first nivel's max (lowest tier)
    const umbralBajo = niveles.length > 0 ? niveles[0].puntaje_maximo : 49;

    // Helper: find nivel color by name
    const nivelColor = (nombre) => {
      if (!nombre) return '#94a3b8';
      const found = niveles.find(n => n.nombre === nombre);
      return found?.color || '#6366f1';
    };

    // 1. KPIs
    const kpiRes = await db.query(`
      SELECT 
        COUNT(DISTINCT m.id_docente) as total_docentes,
        ROUND(AVG(m.puntaje_total)::numeric, 2) as promedio_general,
        COUNT(m.id_monitoreo) as total_monitoreos,
        COUNT(CASE WHEN m.puntaje_total <= ${umbralBajo} THEN 1 END) as alertas_bajo_desempeno
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      ${whereClause} AND m.estado = 'completado'
    `, params);
    stats.kpis = kpiRes.rows[0];

    // 2. Distribución por nivel — JOIN con niveles_desempeno por rango de puntaje
    // 2. Distribución de Niveles (Pedagógicos + Tutoría juntos para el general)
    let distRows = [];
    if (niveles.length > 0) {
      const distRes = await db.query(`
        WITH monitoreo_niveles AS (
          SELECT 
            m.id_monitoreo,
            COALESCE(
              (SELECT nombre FROM niveles_desempeno WHERE m.puntaje_total BETWEEN puntaje_minimo AND puntaje_maximo LIMIT 1),
              CASE 
                WHEN m.puntaje_total > (SELECT MAX(puntaje_maximo) FROM niveles_desempeno) 
                THEN (SELECT nombre FROM niveles_desempeno ORDER BY puntaje_maximo DESC LIMIT 1)
                ELSE 'Sin Nivel' 
              END
            ) AS nivel_nombre
          FROM monitoreos m
          JOIN docentes d ON m.id_docente = d.id_docente
          ${whereClause} AND m.estado = 'completado'
        )
        SELECT 
          nivel_nombre AS nivel_final,
          COUNT(*)::int AS cantidad
        FROM monitoreo_niveles
        GROUP BY nivel_nombre
      `, params);
      distRows = distRes.rows.map(row => ({
        ...row,
        color: nivelColor(row.nivel_final)
      }));
    }
    stats.distribucionNiveles = distRows;

    // 2.5 Distribución específica para Tutoría
    let tutorDistRows = [];
    if (niveles.length > 0) {
      const tutorDistRes = await db.query(`
        WITH tutor_niveles AS (
          SELECT 
            m.id_monitoreo,
            COALESCE(
              (SELECT nombre FROM niveles_desempeno WHERE m.puntaje_total BETWEEN puntaje_minimo AND puntaje_maximo LIMIT 1),
              CASE 
                WHEN m.puntaje_total > (SELECT MAX(puntaje_maximo) FROM niveles_desempeno) 
                THEN (SELECT nombre FROM niveles_desempeno ORDER BY puntaje_maximo DESC LIMIT 1)
                ELSE 'Sin Nivel' 
              END
            ) AS nivel_nombre
          FROM monitoreos m
          JOIN docentes d ON m.id_docente = d.id_docente
          JOIN fichas f ON m.id_ficha = f.id_ficha
          ${whereClause} AND m.estado = 'completado' AND f.es_tutoria = true
        )
        SELECT 
          nivel_nombre AS nivel_final,
          COUNT(*)::int AS cantidad
        FROM tutor_niveles
        GROUP BY nivel_nombre
      `, params);
      tutorDistRows = tutorDistRes.rows.map(row => ({
        ...row,
        color: nivelColor(row.nivel_final)
      }));
    }
    stats.distribucionTutores = tutorDistRows;

    // 3. Ranking de Docentes — nivel calculado dinámicamente desde el promedio
    // n.color NO se incluye en SQL para evitar error si la columna no existe
    const rankingRes = await db.query(`
      WITH docente_avg AS (
        SELECT 
          d.id_docente,
          d.nombres || ' ' || d.apellidos        AS nombre_docente,
          i.nombre                                AS institucion,
          ROUND(AVG(m.puntaje_total)::numeric, 2) AS promedio,
          COUNT(m.id_monitoreo)::int             AS visitas_realizadas
        FROM monitoreos m
        JOIN docentes d      ON m.id_docente     = d.id_docente
        JOIN instituciones i ON d.id_institucion = i.id_institucion
        ${whereClause} AND m.estado = 'completado'
        GROUP BY d.id_docente, d.nombres, d.apellidos, i.nombre
      )
      SELECT 
        da.nombre_docente,
        da.institucion,
        da.promedio,
        da.visitas_realizadas,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno WHERE da.promedio BETWEEN puntaje_minimo AND puntaje_maximo LIMIT 1),
          CASE 
            WHEN da.promedio > (SELECT MAX(puntaje_maximo) FROM niveles_desempeno) 
            THEN (SELECT nombre FROM niveles_desempeno ORDER BY puntaje_maximo DESC LIMIT 1)
            ELSE 'Sin Nivel' 
          END
        ) AS nivel_final
      FROM docente_avg da
      ORDER BY da.promedio DESC
      LIMIT 10
    `, params);
    // Resolver color en JS (independiente de si columna color existe en BD)
    stats.rankingDocentes = rankingRes.rows.map(row => ({
      ...row,
      nivel_color: nivelColor(row.nivel_final)
    }));

    // 3.2 Ranking de Tutores — específico para fichas de tutoría
    const rankingTutoresRes = await db.query(`
      WITH tutor_avg AS (
        SELECT 
          d.id_docente,
          d.nombres || ' ' || d.apellidos        AS nombre_docente,
          i.nombre                                AS institucion,
          ROUND(AVG(m.puntaje_total)::numeric, 2) AS promedio,
          COUNT(m.id_monitoreo)::int             AS visitas_realizadas
        FROM monitoreos m
        JOIN docentes d      ON m.id_docente     = d.id_docente
        JOIN instituciones i ON d.id_institucion = i.id_institucion
        JOIN fichas f        ON m.id_ficha       = f.id_ficha
        ${whereClause} AND m.estado = 'completado' AND f.es_tutoria = true
        GROUP BY d.id_docente, d.nombres, d.apellidos, i.nombre
      )
      SELECT 
        ta.nombre_docente,
        ta.institucion,
        ta.promedio,
        ta.visitas_realizadas,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno WHERE ta.promedio BETWEEN puntaje_minimo AND puntaje_maximo LIMIT 1),
          CASE 
            WHEN ta.promedio > (SELECT MAX(puntaje_maximo) FROM niveles_desempeno) 
            THEN (SELECT nombre FROM niveles_desempeno ORDER BY puntaje_maximo DESC LIMIT 1)
            ELSE 'Sin Nivel' 
          END
        ) AS nivel_final
      FROM tutor_avg ta
      ORDER BY ta.promedio DESC
      LIMIT 10
    `, params);

    stats.rankingTutores = rankingTutoresRes.rows.map(row => ({
      ...row,
      nivel_color: nivelColor(row.nivel_final)
    }));

    // 3.5 Ranking por Puntaje Acumulado (Suma Total)
    const acumuladoRes = await db.query(`
      SELECT 
        d.nombres || ' ' || d.apellidos        AS nombre_docente,
        i.nombre                                AS institucion,
        SUM(m.puntaje_total)                    AS puntaje_total,
        COUNT(m.id_monitoreo)::int             AS visitas
      FROM monitoreos m
      JOIN docentes d      ON m.id_docente     = d.id_docente
      JOIN instituciones i ON d.id_institucion = i.id_institucion
      ${whereClause} AND m.estado = 'completado'
      GROUP BY d.id_docente, d.nombres, d.apellidos, i.nombre
      ORDER BY SUM(m.puntaje_total) DESC
      LIMIT 10
    `, params);
    stats.rankingAcumulado = acumuladoRes.rows;

    // 4. Evolución Temporal
    const evolutionRes = await db.query(`
      SELECT 
        m.fecha, 
        ROUND(AVG(m.puntaje_total)::numeric, 2) as promedio
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      ${whereClause} AND m.estado = 'completado'
      GROUP BY m.fecha
      ORDER BY m.fecha ASC
    `, params);
    stats.evolucion = evolutionRes.rows;

    // 5. Estadísticas por Institución
    const instRes = await db.query(`
      SELECT 
        i.nombre, 
        ROUND(AVG(m.puntaje_total)::numeric, 2) as promedio,
        COUNT(m.id_monitoreo) as cantidad
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      JOIN instituciones i ON d.id_institucion = i.id_institucion
      ${whereClause} AND m.estado = 'completado'
      GROUP BY i.id_institucion, i.nombre
    `, params);
    stats.porInstitucion = instRes.rows;

    // 6. Historial Detallado si se selecciona un docente
    if (id_docente) {
      const historyRes = await db.query(`
        SELECT 
          m.*,
          u.nombres || ' ' || u.apellidos                 AS monitor,
          COALESCE(n.nombre, m.nivel_final, 'Sin Nivel')  AS nivel_resuelto
        FROM monitoreos m
        JOIN usuarios u ON m.id_evaluador = u.id_usuario
        LEFT JOIN niveles_desempeno n
          ON m.puntaje_total BETWEEN n.puntaje_minimo AND n.puntaje_maximo
        WHERE m.id_docente = $1
        ORDER BY m.fecha DESC, m.numero_visita DESC
      `, [id_docente]);
      // Color resuelto en JS (evita error si columna color no existe en BD)
      stats.historialDocente = historyRes.rows.map(row => ({
        ...row,
        nivel_final: row.nivel_resuelto,
        nivel_color: nivelColor(row.nivel_resuelto)
      }));
    }

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const getEvaluadosByPeriodo = async (req, res, next) => {
  const { id_periodo } = req.params;
  const { id_ficha } = req.query;
  try {
    let query = "SELECT DISTINCT id_docente FROM monitoreos WHERE id_periodo = $1 AND estado = 'completado'";
    const params = [id_periodo];
    
    if (id_ficha) {
      query += " AND id_ficha = $2";
      params.push(id_ficha);
    }

    const result = await db.query(query, params);
    res.json(result.rows.map(r => r.id_docente));
  } catch (error) {
    next(error);
  }
};

const getMonitoreoDetalle = async (req, res, next) => {
  const { id_monitoreo } = req.params;
  try {
    // 1. Get header
    const headerRes = await db.query(`
      SELECT m.*, nd.color as nivel_color, COALESCE(nd.nombre, m.nivel_final) as nivel_final,
             d.nombres as docente_nombres, d.apellidos as docente_apellidos,
             f.nombre as ficha_nombre, u.nombres as evaluador_nombres, u.apellidos as evaluador_apellidos
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      JOIN fichas f ON m.id_ficha = f.id_ficha
      JOIN usuarios u ON m.id_evaluador = u.id_usuario
      LEFT JOIN LATERAL (
        SELECT nombre, color FROM niveles_desempeno
        WHERE m.puntaje_total BETWEEN rango_min AND rango_max
        LIMIT 1
      ) nd ON true
      WHERE m.id_monitoreo = $1
    `, [id_monitoreo]);

    if (headerRes.rows.length === 0) return res.status(404).json({ message: 'Monitoreo no encontrado' });

    // 2. Get answers grouped by category
    const answersRes = await db.query(`
      SELECT 
        r.*, 
        p.pregunta, 
        c.nombre as categoria_nombre,
        o.nombre_opcion as opcion_nombre,
        o.valor as opcion_valor
      FROM respuestas r
      JOIN preguntas p ON r.id_pregunta = p.id_pregunta
      JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN opciones_respuesta o ON r.id_opcion = o.id_opcion
      WHERE r.id_monitoreo = $1
      ORDER BY c.orden, p.orden
    `, [id_monitoreo]);

    res.json({
      ...headerRes.rows[0],
      respuestas: answersRes.rows
    });
  } catch (error) {
    next(error);
  }
};

// Obtener TODOS los monitoreos con filtros y control de acceso por rol
const getAllMonitoreos = async (req, res, next) => {
  const { search, id_periodo, estado, tipo_monitoreo } = req.query;
  const { role, id_institucion, id: id_usuario } = req.user;

  try {
    const params = [];
    let pIdx = 1;
    let whereClause = 'WHERE 1=1';

    // --- Control de acceso por rol ---
    if (role === 'docente') {
      // Docente: solo ve sus propios monitoreos (busca su id_docente via la tabla docentes)
      const docenteRes = await db.query(
        'SELECT id_docente FROM docentes WHERE id_usuario = $1 LIMIT 1', [id_usuario]
      );
      if (docenteRes.rows.length === 0) {
        return res.json([]); // Docente sin registro, sin monitoreos
      }
      whereClause += ` AND m.id_docente = $${pIdx++}`;
      params.push(docenteRes.rows[0].id_docente);
    } else if (role === 'director') {
      // Director: solo ve los monitoreos de docentes de su IE
      if (id_institucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(id_institucion);
      }
    }
    // Administrador: ve todo, sin filtro adicional

    // --- Filtros opcionales de query ---
    if (id_periodo) {
      whereClause += ` AND m.id_periodo = $${pIdx++}`;
      params.push(id_periodo);
    }
    if (estado) {
      whereClause += ` AND m.estado = $${pIdx++}`;
      params.push(estado);
    }
    if (tipo_monitoreo) {
      whereClause += ` AND m.tipo_monitoreo = $${pIdx++}`;
      params.push(tipo_monitoreo);
    }
    if (search) {
      whereClause += ` AND (
        LOWER(d.nombres || ' ' || d.apellidos) LIKE $${pIdx} OR
        LOWER(f.nombre) LIKE $${pIdx} OR
        LOWER(i.nombre) LIKE $${pIdx}
      )`;
      params.push(`%${search.toLowerCase()}%`);
      pIdx++;
    }

    const result = await db.query(`
      SELECT 
        m.id_monitoreo, m.fecha, m.numero_visita, m.tipo_monitoreo,
        m.puntaje_total, m.estado, m.area, m.sesion,
        COALESCE(nd.nombre, m.nivel_final) as nivel_final, nd.color as nivel_color,
        d.nombres AS docente_nombres, d.apellidos AS docente_apellidos,
        f.nombre AS ficha_nombre,
        i.nombre AS institucion_nombre,
        u.nombres AS evaluador_nombres, u.apellidos AS evaluador_apellidos
      FROM monitoreos m
      JOIN docentes d      ON m.id_docente     = d.id_docente
      JOIN fichas f        ON m.id_ficha       = f.id_ficha
      JOIN instituciones i ON d.id_institucion = i.id_institucion
      JOIN usuarios u      ON m.id_evaluador   = u.id_usuario
      LEFT JOIN LATERAL (
        SELECT nombre, color FROM niveles_desempeno
        WHERE m.puntaje_total BETWEEN rango_min AND rango_max
        LIMIT 1
      ) nd ON true
      ${whereClause}
      ORDER BY m.fecha DESC, m.id_monitoreo DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const deleteMonitoreo = async (req, res, next) => {
  const { id_monitoreo } = req.params;
  
  // Extra security check just in case the middleware is bypassed or we want a controller-level check
  if (req.user.role !== 'administrador') {
    return res.status(403).json({ message: 'Prohibido: Solo los administradores pueden eliminar monitoreos.' });
  }

  try {
    const result = await db.query('DELETE FROM monitoreos WHERE id_monitoreo = $1 RETURNING *', [id_monitoreo]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Monitoreo no encontrado' });
    }
    
    res.json({ message: 'Monitoreo eliminado correctamente', deleted: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMonitoreo,
  getMonitoreosByEvaluador,
  getMonitoreosByDocente,
  getAllMonitoreos,
  saveAnswers,
  getStats,
  getEvaluadosByPeriodo,
  getMonitoreoDetalle,
  deleteMonitoreo
};


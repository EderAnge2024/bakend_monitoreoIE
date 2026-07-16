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
        ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
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
        ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
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

    if (userRole === 'director' || userRole === 'docente') {
      // If they have an institution assigned, they can only see that one
      if (userIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (userRole === 'especialista') {
      // Specialist: can filter by any institution via query param
      if (id_institucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(id_institucion);
      } else if (userIdInstitucion) {
        // Default to their own institution if no filter is provided
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
        'SELECT * FROM niveles_desempeno ORDER BY puntaje_minimo ASC'
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
            (SELECT nombre FROM niveles_desempeno
             ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
             LIMIT 1) AS nivel_nombre
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
            (SELECT nombre FROM niveles_desempeno
             ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
             LIMIT 1) AS nivel_nombre
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
          (SELECT nombre FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(da.promedio::numeric) - puntaje_minimo), ABS(FLOOR(da.promedio::numeric) - puntaje_maximo))
           LIMIT 1),
          'Sin Nivel'
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

    // Helper reutilizable para rankings por nivel educativo y tipo de ficha
    const buildRankingByNivel = async (nivelEducativo, esTutoria) => {
      const tutoriaFilter = esTutoria
        ? 'AND f.es_tutoria = true'
        : 'AND (f.es_tutoria = false OR f.es_tutoria IS NULL)';
      const nivelFilter = nivelEducativo
        ? `AND LOWER(COALESCE(d.nivel,'')) LIKE '%${nivelEducativo.toLowerCase()}%'`
        : '';
      const res = await db.query(`
        WITH avg_data AS (
          SELECT 
            d.id_docente,
            d.nombres || ' ' || d.apellidos        AS nombre_docente,
            i.nombre                                AS institucion,
            d.nivel                                 AS nivel_educativo,
            ROUND(AVG(m.puntaje_total)::numeric, 2) AS promedio,
            COUNT(m.id_monitoreo)::int              AS visitas_realizadas
          FROM monitoreos m
          JOIN docentes d      ON m.id_docente     = d.id_docente
          JOIN instituciones i ON d.id_institucion = i.id_institucion
          JOIN fichas f        ON m.id_ficha       = f.id_ficha
          ${whereClause} AND m.estado = 'completado' ${tutoriaFilter} ${nivelFilter}
          GROUP BY d.id_docente, d.nombres, d.apellidos, i.nombre, d.nivel
        )
        SELECT 
          ad.nombre_docente, ad.institucion, ad.nivel_educativo,
          ad.promedio, ad.visitas_realizadas,
          COALESCE(
            (SELECT nombre FROM niveles_desempeno
             ORDER BY LEAST(ABS(FLOOR(ad.promedio::numeric) - puntaje_minimo), ABS(FLOOR(ad.promedio::numeric) - puntaje_maximo))
             LIMIT 1),
            'Sin Nivel'
          ) AS nivel_final
        FROM avg_data ad
        ORDER BY ad.promedio DESC
        LIMIT 10
      `, params);
      return res.rows.map(row => ({ ...row, nivel_color: nivelColor(row.nivel_final) }));
    };

    // 3.2 Ranking de Tutores general + separados por nivel educativo
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
        ta.nombre_docente, ta.institucion, ta.promedio, ta.visitas_realizadas,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(ta.promedio::numeric) - puntaje_minimo), ABS(FLOOR(ta.promedio::numeric) - puntaje_maximo))
           LIMIT 1),
          'Sin Nivel'
        ) AS nivel_final
      FROM tutor_avg ta
      ORDER BY ta.promedio DESC
      LIMIT 10
    `, params);

    stats.rankingTutores = rankingTutoresRes.rows.map(row => ({
      ...row,
      nivel_color: nivelColor(row.nivel_final)
    }));

    // Rankings separados por nivel educativo (primaria / secundaria)
    const [rdPrimaria, rdSecundaria, rtPrimaria, rtSecundaria] = await Promise.all([
      buildRankingByNivel('primaria', false),
      buildRankingByNivel('secundaria', false),
      buildRankingByNivel('primaria', true),
      buildRankingByNivel('secundaria', true),
    ]);
    stats.rankingDocentesPrimaria   = rdPrimaria;
    stats.rankingDocentesSecundaria = rdSecundaria;
    stats.rankingTutoresPrimaria    = rtPrimaria;
    stats.rankingTutoresSecundaria  = rtSecundaria;

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
          u.nombres || ' ' || u.apellidos AS monitor,
          nd.nombre                        AS nivel_resuelto
        FROM monitoreos m
        JOIN usuarios u ON m.id_evaluador = u.id_usuario
        LEFT JOIN LATERAL (
          SELECT nombre FROM niveles_desempeno
          ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
          LIMIT 1
        ) nd ON true
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
    let query = "SELECT id_docente, COUNT(*) as conteo FROM monitoreos WHERE id_periodo = $1 AND estado = 'completado'";
    const params = [id_periodo];
    
    if (id_ficha) {
      query += " AND id_ficha = $2";
      params.push(id_ficha);
    }

    query += " GROUP BY id_docente";

    const result = await db.query(query, params);
    res.json(result.rows);
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
        ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
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
  const { search, id_periodo, estado, tipo_monitoreo, id_institucion: queryIdInstitucion } = req.query;
  const { role, id_institucion: userInstitucion, id: id_usuario } = req.user;

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
      if (userInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userInstitucion);
      }
    } else if (role === 'especialista') {
      if (queryIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(queryIdInstitucion);
      } else if (userInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userInstitucion);
      }
    } else if (queryIdInstitucion) {
      whereClause += ` AND d.id_institucion = $${pIdx++}`;
      params.push(queryIdInstitucion);
    }

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
        ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
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

// Importar la función avanzada de exportación
const ExcelJS = require('exceljs');

const XLSX = require('xlsx');

const getSeguimiento = async (req, res, next) => {
  const { id_institucion, id_periodo, id_ficha } = req.query;
  const { role, id_institucion: userIdInstitucion } = req.user;

  try {
    let whereClause = 'WHERE m.estado = $1';
    const params = ['completado'];
    let pIdx = 2;

    // Control de acceso por rol
    if (role === 'docente') {
      const docenteRes = await db.query(
        'SELECT id_docente FROM docentes WHERE id_usuario = $1 LIMIT 1', [req.user.id]
      );
      if (docenteRes.rows.length === 0) return res.json([]);
      whereClause += ` AND d.id_docente = $${pIdx++}`;
      params.push(docenteRes.rows[0].id_docente);
    } else if (role === 'director') {
      if (userIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (role === 'especialista') {
      if (id_institucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(id_institucion);
      } else if (userIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (id_institucion) {
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

    // Obtener monitoreos agrupados por docente
    const result = await db.query(`
      SELECT 
        d.id_docente,
        d.nombres || ' ' || d.apellidos AS nombre_docente,
        d.nivel AS nivel_educativo,
        i.nombre AS institucion,
        ROUND(AVG(m.puntaje_total)::numeric, 2) AS promedio,
        json_agg(
          json_build_object(
            'id_monitoreo', m.id_monitoreo,
            'numero', m.numero_visita,
            'fecha', TO_CHAR(m.fecha, 'DD/MM/YYYY'),
            'puntaje', ROUND(m.puntaje_total::numeric, 2),
            'instrumento', f.nombre,
            'nivel', COALESCE(
              (SELECT nombre FROM niveles_desempeno
               ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), 
                             ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
               LIMIT 1),
              'Sin nivel'
            ),
            'nivel_color', COALESCE(
              (SELECT color FROM niveles_desempeno
               ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), 
                             ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
               LIMIT 1),
              '#6366f1'
            )
          ) ORDER BY m.fecha ASC, m.numero_visita ASC
        ) AS visitas,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(AVG(m.puntaje_total)::numeric) - puntaje_minimo), 
                         ABS(FLOOR(AVG(m.puntaje_total)::numeric) - puntaje_maximo))
           LIMIT 1),
          'Sin nivel'
        ) AS nivel_final,
        COALESCE(
          (SELECT color FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(AVG(m.puntaje_total)::numeric) - puntaje_minimo), 
                         ABS(FLOOR(AVG(m.puntaje_total)::numeric) - puntaje_maximo))
           LIMIT 1),
          '#6366f1'
        ) AS nivel_color
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      JOIN instituciones i ON d.id_institucion = i.id_institucion
      JOIN fichas f ON m.id_ficha = f.id_ficha
      ${whereClause}
      GROUP BY d.id_docente, d.nombres, d.apellidos, d.nivel, i.nombre
      ORDER BY promedio DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const exportToExcel = async (req, res, next) => {
  const { id_institucion, id_periodo, id_ficha, id_docente } = req.query;
  const { role, id_institucion: userIdInstitucion } = req.user;

  try {
    let whereClause = 'WHERE m.estado = $1';
    const params = ['completado'];
    let pIdx = 2;

    // Control de acceso por rol
    if (role === 'docente') {
      const docenteRes = await db.query(
        'SELECT id_docente FROM docentes WHERE id_usuario = $1 LIMIT 1', [req.user.id]
      );
      if (docenteRes.rows.length === 0) return res.json([]);
      whereClause += ` AND d.id_docente = $${pIdx++}`;
      params.push(docenteRes.rows[0].id_docente);
    } else if (role === 'director') {
      // Director: limit to their own institution
      if (userIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (role === 'especialista') {
      // Specialist: can filter by any institution via query param
      if (id_institucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(id_institucion);
      } else if (userIdInstitucion) {
        // If no specific institution provided, default to their own
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (id_institucion) {
      // Administrador or other roles: allow any institution filter
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

    // Obtener datos agrupados por docente
    const result = await db.query(`
      SELECT 
        d.id_docente,
        d.nombres || ' ' || d.apellidos AS docente,
        d.dni,
        d.area,
        d.nivel AS nivel_educativo,
        i.nombre AS institucion,
        p.nombre AS periodo,
        COUNT(m.id_monitoreo) AS total_monitoreos,
        ROUND(AVG(m.puntaje_total)::numeric, 2) AS promedio_puntaje,
        MAX(m.puntaje_total) AS puntaje_maximo,
        MIN(m.puntaje_total) AS puntaje_minimo,
        STRING_AGG(DISTINCT f.nombre, ', ' ORDER BY f.nombre) AS instrumentos_usados,
        MIN(m.fecha) AS primera_visita,
        MAX(m.fecha) AS ultima_visita,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(AVG(m.puntaje_total)::numeric) - puntaje_minimo), 
                         ABS(FLOOR(AVG(m.puntaje_total)::numeric) - puntaje_maximo))
           LIMIT 1),
          'Sin nivel'
        ) AS nivel_desempeno
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      JOIN instituciones i ON d.id_institucion = i.id_institucion
      JOIN fichas f ON m.id_ficha = f.id_ficha
      LEFT JOIN periodos p ON m.id_periodo = p.id_periodo
      ${whereClause}
      GROUP BY d.id_docente, d.nombres, d.apellidos, d.dni, d.area, d.nivel, i.nombre, p.nombre
      ORDER BY promedio_puntaje DESC
    `, params);

    // Obtener detalle de monitoreos por docente
    const detalleResult = await db.query(`
      SELECT 
        m.id_monitoreo,
        d.id_docente,
        d.nombres || ' ' || d.apellidos AS docente,
        m.fecha,
        m.numero_visita,
        f.nombre AS instrumento,
        m.area,
        m.sesion,
        m.puntaje_total,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), 
                         ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
           LIMIT 1),
          'Sin nivel'
        ) AS nivel,
        u.nombres || ' ' || u.apellidos AS evaluador,
        m.compromiso_docente,
        m.observaciones_generales,
        m.recomendaciones
      FROM monitoreos m
      JOIN docentes d ON m.id_docente = d.id_docente
      JOIN fichas f ON m.id_ficha = f.id_ficha
      JOIN usuarios u ON m.id_evaluador = u.id_usuario
      ${whereClause}
      ORDER BY d.id_docente, m.fecha DESC, m.numero_visita DESC
    `, params);

    // Crear workbook con ExcelJS
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema de Monitoreo IE';
    wb.created = new Date();

    // Estilos reutilizables
    const headerStyle = {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D47A1' } }, // Azul oscuro
      alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };

    const rowStyle = {
      font: { name: 'Arial', size: 10, color: { argb: 'FF000000' } },
      alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
      }
    };
    
    // Función para obtener color según nivel (Verde, Amarillo, Marrón, Negro)
    const getNivelStyle = (nivel) => {
      const lowerNivel = (nivel || '').toLowerCase();
      let color = 'FFFFFFFF';
      let fontColor = 'FF000000';
      if (lowerNivel.includes('destacado') || lowerNivel.includes('satisfactorio')) {
        color = 'FF4CAF50'; // Verde
        fontColor = 'FFFFFFFF';
      } else if (lowerNivel.includes('proceso')) {
        color = 'FFFFEB3B'; // Amarillo
      } else if (lowerNivel.includes('inicio') || lowerNivel.includes('bajo')) {
        color = 'FF795548'; // Marrón
        fontColor = 'FFFFFFFF';
      } else if (lowerNivel.includes('insatisfactorio')) {
        color = 'FF212121'; // Negro
        fontColor = 'FFFFFFFF';
      }
      return {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
        font: { name: 'Arial', size: 10, bold: true, color: { argb: fontColor } },
        alignment: { vertical: 'middle', horizontal: 'center' }
      };
    };

    const configSheet = (sheet, columns) => {
      sheet.columns = columns;
      sheet.getRow(1).height = 30;
      sheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
        cell.border = headerStyle.border;
      });
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length }
      };
    };

    // --- Hoja 1: Resumen por Docente ---
    const wsResumen = wb.addWorksheet('Resumen por Docente');
    configSheet(wsResumen, [
      { header: 'DNI', key: 'dni', width: 12 },
      { header: 'Docente', key: 'docente', width: 35 },
      { header: 'Institución', key: 'institucion', width: 40 },
      { header: 'Periodo', key: 'periodo', width: 18 },
      { header: 'Nivel Educativo', key: 'nivel_educativo', width: 18 },
      { header: 'Área', key: 'area', width: 25 },
      { header: 'Total Monitoreos', key: 'total_monitoreos', width: 15 },
      { header: 'Promedio', key: 'promedio', width: 12 },
      { header: 'Puntaje Máximo', key: 'puntaje_maximo', width: 15 },
      { header: 'Puntaje Mínimo', key: 'puntaje_minimo', width: 15 },
      { header: 'Nivel de Desempeño', key: 'nivel_desempeno', width: 20 },
      { header: 'Instrumentos Usados', key: 'instrumentos_usados', width: 40 },
      { header: 'Primera Visita', key: 'primera_visita', width: 15 },
      { header: 'Última Visita', key: 'ultima_visita', width: 15 }
    ]);

    result.rows.forEach(row => {
      const dbRow = wsResumen.addRow({
        dni: row.dni || '',
        docente: row.docente,
        institucion: row.institucion,
        periodo: row.periodo || 'Varios',
        nivel_educativo: row.nivel_educativo || '',
        area: row.area || '',
        total_monitoreos: row.total_monitoreos,
        promedio: row.promedio_puntaje ? Number(row.promedio_puntaje) : 0,
        puntaje_maximo: row.puntaje_maximo ? Number(row.puntaje_maximo) : 0,
        puntaje_minimo: row.puntaje_minimo ? Number(row.puntaje_minimo) : 0,
        nivel_desempeno: row.nivel_desempeno,
        instrumentos_usados: row.instrumentos_usados,
        primera_visita: row.primera_visita ? new Date(row.primera_visita) : '',
        ultima_visita: row.ultima_visita ? new Date(row.ultima_visita) : ''
      });
      
      dbRow.eachCell(cell => { cell.style = { ...cell.style, ...rowStyle }; });
      
      const nivelCell = dbRow.getCell('nivel_desempeno');
      const nivelStyle = getNivelStyle(row.nivel_desempeno);
      nivelCell.fill = nivelStyle.fill;
      nivelCell.font = nivelStyle.font;
      nivelCell.alignment = nivelStyle.alignment;
      
      dbRow.getCell('promedio').numFmt = '0.00';
      if (row.primera_visita) dbRow.getCell('primera_visita').numFmt = 'dd/mm/yyyy';
      if (row.ultima_visita) dbRow.getCell('ultima_visita').numFmt = 'dd/mm/yyyy';
    });

    // --- Hoja 2: Detalle de Monitoreos ---
    const wsDetalle = wb.addWorksheet('Detalle de Monitoreos');
    configSheet(wsDetalle, [
      { header: 'ID Monitoreo', key: 'id_monitoreo', width: 12 },
      { header: 'Docente', key: 'docente', width: 35 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Visita Nº', key: 'numero_visita', width: 10 },
      { header: 'Instrumento', key: 'instrumento', width: 30 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Sesión', key: 'sesion', width: 30 },
      { header: 'Puntaje', key: 'puntaje', width: 10 },
      { header: 'Nivel', key: 'nivel', width: 20 },
      { header: 'Evaluador', key: 'evaluador', width: 30 },
      { header: 'Compromiso', key: 'compromiso', width: 45 },
      { header: 'Observaciones', key: 'observaciones', width: 45 },
      { header: 'Recomendaciones', key: 'recomendaciones', width: 45 }
    ]);

    detalleResult.rows.forEach(row => {
      const dbRow = wsDetalle.addRow({
        id_monitoreo: row.id_monitoreo,
        docente: row.docente,
        fecha: row.fecha ? new Date(row.fecha) : '',
        numero_visita: row.numero_visita,
        instrumento: row.instrumento,
        area: row.area || '',
        sesion: row.sesion || '',
        puntaje: row.puntaje_total ? Number(row.puntaje_total) : 0,
        nivel: row.nivel,
        evaluador: row.evaluador,
        compromiso: row.compromiso_docente || '',
        observaciones: row.observaciones_generales || '',
        recomendaciones: row.recomendaciones || ''
      });
      
      dbRow.eachCell(cell => { cell.style = { ...cell.style, ...rowStyle }; });
      
      const nivelCell = dbRow.getCell('nivel');
      const nivelStyle = getNivelStyle(row.nivel);
      nivelCell.fill = nivelStyle.fill;
      nivelCell.font = nivelStyle.font;
      nivelCell.alignment = nivelStyle.alignment;
      
      if (row.fecha) dbRow.getCell('fecha').numFmt = 'dd/mm/yyyy';
      dbRow.getCell('puntaje').numFmt = '0.00';
    });

    // --- Hoja 3: Evolución por Docente (si hay un docente específico) ---
    if (id_docente) {
      const wsEvolucion = wb.addWorksheet('Evolución Docente');
      configSheet(wsEvolucion, [
        { header: 'Orden', key: 'orden', width: 8 },
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Visita Nº', key: 'numero_visita', width: 10 },
        { header: 'Instrumento', key: 'instrumento', width: 30 },
        { header: 'Puntaje', key: 'puntaje', width: 10 },
        { header: 'Nivel', key: 'nivel', width: 20 }
      ]);

      const evolucionResult = await db.query(`
        SELECT 
          m.fecha,
          m.numero_visita,
          m.puntaje_total,
          f.nombre AS instrumento,
          COALESCE(
            (SELECT nombre FROM niveles_desempeno
             ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo), 
                           ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
             LIMIT 1),
            'Sin nivel'
          ) AS nivel
        FROM monitoreos m
        JOIN fichas f ON m.id_ficha = f.id_ficha
        WHERE m.id_docente = $1 AND m.estado = 'completado'
        ORDER BY m.fecha ASC, m.numero_visita ASC
      `, [id_docente]);

      evolucionResult.rows.forEach((row, idx) => {
        const dbRow = wsEvolucion.addRow({
          orden: idx + 1,
          fecha: row.fecha ? new Date(row.fecha) : '',
          numero_visita: row.numero_visita,
          instrumento: row.instrumento,
          puntaje: row.puntaje_total ? Number(row.puntaje_total) : 0,
          nivel: row.nivel
        });
        
        dbRow.eachCell(cell => { cell.style = { ...cell.style, ...rowStyle }; });
        
        const nivelCell = dbRow.getCell('nivel');
        const nivelStyle = getNivelStyle(row.nivel);
        nivelCell.fill = nivelStyle.fill;
        nivelCell.font = nivelStyle.font;
        nivelCell.alignment = nivelStyle.alignment;
        
        if (row.fecha) dbRow.getCell('fecha').numFmt = 'dd/mm/yyyy';
        dbRow.getCell('puntaje').numFmt = '0.00';
      });
    }

    // Generar buffer asíncrono con ExcelJS
    const buffer = await wb.xlsx.writeBuffer();

    // Establecer headers de respuesta
    const filename = `Reporte_Monitoreos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const getSeguimientoAnalisis = async (req, res, next) => {
  const { id_institucion, id_periodo, id_ficha, id_docente } = req.query;
  const { role, id_institucion: userIdInstitucion } = req.user;

  if (!id_ficha) {
    return res.status(400).json({ message: 'Se requiere id_ficha para el análisis por criterios' });
  }

  try {
    let whereClause = "WHERE m.estado = 'completado' AND m.id_ficha = $1";
    const params = [id_ficha];
    let pIdx = 2;

    // Control de acceso por rol
    if (role === 'docente') {
      const docenteRes = await db.query(
        'SELECT id_docente FROM docentes WHERE id_usuario = $1 LIMIT 1', [req.user.id]
      );
      if (docenteRes.rows.length === 0) return res.json({ tipo: 'general', datos: [] });
      whereClause += ` AND d.id_docente = $${pIdx++}`;
      params.push(docenteRes.rows[0].id_docente);
    } else if (role === 'director' && userIdInstitucion) {
      whereClause += ` AND d.id_institucion = $${pIdx++}`;
      params.push(userIdInstitucion);
    } else if (role === 'especialista') {
      if (id_institucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(id_institucion);
      } else if (userIdInstitucion) {
        whereClause += ` AND d.id_institucion = $${pIdx++}`;
        params.push(userIdInstitucion);
      }
    } else if (id_institucion) {
      whereClause += ` AND d.id_institucion = $${pIdx++}`;
      params.push(id_institucion);
    }

    if (id_periodo) {
      whereClause += ` AND m.id_periodo = $${pIdx++}`;
      params.push(id_periodo);
    }

    if (id_docente) {
      whereClause += ` AND m.id_docente = $${pIdx++}`;
      params.push(id_docente);
      
      const result = await db.query(`
        SELECT 
          m.numero_visita,
          m.fecha,
          COALESCE(per.nombre, 'Sin período') AS periodo_nombre,
          c.nombre AS categoria,
          p.id_pregunta,
          p.pregunta,
          ROUND(AVG(r.puntaje)::numeric, 2) AS promedio_puntaje
        FROM respuestas r
        JOIN preguntas p ON r.id_pregunta = p.id_pregunta
        JOIN categorias c ON p.id_categoria = c.id_categoria
        JOIN monitoreos m ON r.id_monitoreo = m.id_monitoreo
        JOIN docentes d ON m.id_docente = d.id_docente
        LEFT JOIN periodos per ON m.id_periodo = per.id_periodo
        ${whereClause}
        GROUP BY m.numero_visita, m.fecha, per.nombre, c.nombre, p.id_pregunta, p.pregunta, c.orden, p.orden
        ORDER BY c.orden, p.orden, m.fecha ASC, m.numero_visita
      `, params);
      
      return res.json({ tipo: 'individual', datos: result.rows });
    } else {
      const result = await db.query(`
        SELECT 
          m.numero_visita,
          m.fecha,
          COALESCE(per.nombre, 'Sin período') AS periodo_nombre,
          c.nombre AS categoria,
          p.id_pregunta,
          p.pregunta,
          ROUND(AVG(r.puntaje)::numeric, 2) AS promedio_puntaje
        FROM respuestas r
        JOIN preguntas p ON r.id_pregunta = p.id_pregunta
        JOIN categorias c ON p.id_categoria = c.id_categoria
        JOIN monitoreos m ON r.id_monitoreo = m.id_monitoreo
        JOIN docentes d ON m.id_docente = d.id_docente
        LEFT JOIN periodos per ON m.id_periodo = per.id_periodo
        ${whereClause}
        GROUP BY m.numero_visita, m.fecha, per.nombre, c.nombre, p.id_pregunta, p.pregunta, c.orden, p.orden
        ORDER BY c.orden, p.orden, m.fecha ASC, m.numero_visita
      `, params);
      
      return res.json({ tipo: 'general', datos: result.rows });
    }
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
  deleteMonitoreo,
  getSeguimiento,
  exportToExcel,
  getSeguimientoAnalisis
};

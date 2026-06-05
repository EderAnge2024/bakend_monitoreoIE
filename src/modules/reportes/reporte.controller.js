const db = require('../../config/database');
const XLSX = require('xlsx');

/**
 * Genera un Excel de seguimiento de progreso por docente.
 * Columnas: Docente, IE, Visita 1..N (puntaje), Tendencia, Nivel Final
 */
const exportSeguimientoExcel = async (req, res, next) => {
  const { id_institucion, id_periodo, id_ficha } = req.query;
  const { role, id_institucion: userInstitucion } = req.user;

  try {
    let whereClause = "WHERE m.estado = 'completado'";
    const params = [];
    let pIdx = 1;

    // Restricción por rol
    if (role === 'director' && userInstitucion) {
      whereClause += ` AND d.id_institucion = $${pIdx++}`;
      params.push(userInstitucion);
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

    // Obtener todos los monitoreos ordenados por docente y visita
    const result = await db.query(`
      SELECT
        d.id_docente,
        d.nombres || ' ' || d.apellidos   AS docente,
        d.nivel                            AS nivel_educativo,
        i.nombre                           AS institucion,
        f.nombre                           AS instrumento,
        m.numero_visita,
        m.fecha,
        m.puntaje_total,
        COALESCE(
          (SELECT nombre FROM niveles_desempeno
           ORDER BY LEAST(ABS(FLOOR(m.puntaje_total::numeric) - puntaje_minimo),
                          ABS(FLOOR(m.puntaje_total::numeric) - puntaje_maximo))
           LIMIT 1),
          'Sin Nivel'
        ) AS nivel_final
      FROM monitoreos m
      JOIN docentes d      ON m.id_docente     = d.id_docente
      JOIN instituciones i ON d.id_institucion = i.id_institucion
      JOIN fichas f        ON m.id_ficha       = f.id_ficha
      ${whereClause}
      ORDER BY d.id_docente ASC, m.numero_visita ASC
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No hay datos para exportar con los filtros seleccionados.' });
    }

    // Agrupar por docente
    const byDocente = {};
    result.rows.forEach(row => {
      const key = row.id_docente;
      if (!byDocente[key]) {
        byDocente[key] = {
          docente: row.docente,
          nivel_educativo: row.nivel_educativo || '—',
          institucion: row.institucion,
          instrumento: row.instrumento,
          visitas: []
        };
      }
      byDocente[key].visitas.push({
        numero: row.numero_visita,
        fecha: row.fecha ? new Date(row.fecha).toLocaleDateString('es-PE') : '—',
        puntaje: parseFloat(row.puntaje_total) || 0,
        nivel: row.nivel_final
      });
    });

    // Calcular max visitas para las columnas dinámicas
    const maxVisitas = Math.max(...Object.values(byDocente).map(d => d.visitas.length));

    // Construir filas del Excel
    const headers = [
      'N°', 'Docente', 'Nivel Educativo', 'Institución', 'Instrumento'
    ];
    for (let v = 1; v <= maxVisitas; v++) {
      headers.push(`Visita ${v} - Fecha`);
      headers.push(`Visita ${v} - Puntaje`);
      headers.push(`Visita ${v} - Nivel`);
    }
    headers.push('Tendencia', 'Promedio', 'Nivel Final');

    const rows = [headers];
    let rowNum = 1;

    Object.values(byDocente).forEach(doc => {
      const row = [
        rowNum++,
        doc.docente,
        doc.nivel_educativo,
        doc.institucion,
        doc.instrumento
      ];

      // Rellenar visitas
      for (let v = 1; v <= maxVisitas; v++) {
        const visita = doc.visitas.find(vi => vi.numero === v);
        if (visita) {
          row.push(visita.fecha, visita.puntaje, visita.nivel);
        } else {
          row.push('—', '—', '—');
        }
      }

      // Calcular tendencia
      const puntajes = doc.visitas.map(v => v.puntaje).filter(p => p > 0);
      let tendencia = '—';
      if (puntajes.length >= 2) {
        const diff = puntajes[puntajes.length - 1] - puntajes[0];
        if (diff > 0) tendencia = '↑ Mejora';
        else if (diff < 0) tendencia = '↓ Baja';
        else tendencia = '→ Estable';
      }

      const promedio = puntajes.length > 0
        ? (puntajes.reduce((a, b) => a + b, 0) / puntajes.length).toFixed(2)
        : '—';

      const nivelFinal = doc.visitas.length > 0
        ? doc.visitas[doc.visitas.length - 1].nivel
        : '—';

      row.push(tendencia, promedio, nivelFinal);
      rows.push(row);
    });

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 4 }, { wch: 30 }, { wch: 14 }, { wch: 28 }, { wch: 28 },
      ...Array(maxVisitas * 3).fill({ wch: 16 }),
      { wch: 14 }, { wch: 10 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento Docentes');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Seguimiento_Docentes_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    next(error);
  }
};

module.exports = { exportSeguimientoExcel };

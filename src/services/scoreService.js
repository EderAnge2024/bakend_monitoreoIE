const db = require('../config/database');

/**
 * Calcula el puntaje total de un monitoreo:
 * suma todos los puntajes de las respuestas y divide entre la cantidad de preguntas respondidas.
 * Luego ubica al docente en el nivel de desempeño correspondiente.
 */
const calculateTotalScore = async (id_monitoreo) => {
  try {
    // 1. Sumar puntajes y contar preguntas respondidas
    const result = await db.query(`
      SELECT 
        SUM(puntaje)::numeric      AS sum_total,
        COUNT(id_pregunta)::numeric AS count_preguntas
      FROM respuestas
      WHERE id_monitoreo = $1
    `, [id_monitoreo]);

    const sumTotal       = parseFloat(result.rows[0].sum_total       || 0);
    const countPreguntas = parseInt(result.rows[0].count_preguntas   || 1, 10);

    // 2. Promedio = suma / cantidad de preguntas
    const totalScore = parseFloat(
      (sumTotal / (countPreguntas > 0 ? countPreguntas : 1)).toFixed(2)
    );

    // 3. Ubicar en nivel: primer nivel cuyo puntaje_minimo <= totalScore,
    //    ordenado de mayor a menor para obtener el nivel más alto alcanzado
    const levelRes = await db.query(`
      SELECT nombre
      FROM niveles_desempeno
      WHERE puntaje_minimo <= $1
      ORDER BY puntaje_minimo DESC
      LIMIT 1
    `, [totalScore]);

    const nivelFinal = levelRes.rows[0]?.nombre || 'Sin Nivel';

    // 4. Actualizar el monitoreo con el puntaje y nivel calculados
    await db.query(`
      UPDATE monitoreos
      SET puntaje_total = $1, nivel_final = $2, estado = 'completado'
      WHERE id_monitoreo = $3
    `, [totalScore, nivelFinal, id_monitoreo]);

    return { totalScore, levelName: nivelFinal };
  } catch (error) {
    console.error('Error calculating score:', error);
    throw error;
  }
};

module.exports = { calculateTotalScore };

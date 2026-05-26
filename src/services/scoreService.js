const db = require('../config/database');

/**
 * Calculates and updates the total score for a monitoring session.
 * @param {number} id_monitoreo 
 */
const calculateTotalScore = async (id_monitoreo) => {
  try {
    // 1. Get all answers for this monitoring
    const result = await db.query(`
      SELECT SUM(puntaje)::numeric as sum_total, COUNT(id_pregunta)::numeric as count_preguntas 
      FROM respuestas 
      WHERE id_monitoreo = $1
    `, [id_monitoreo]);

    const sumTotal = parseFloat(result.rows[0].sum_total || 0);
    const countPreguntas = parseInt(result.rows[0].count_preguntas || 1, 10);
    const totalScore = parseFloat((sumTotal / (countPreguntas > 0 ? countPreguntas : 1)).toFixed(2));

    // 2. Determinar nivel de desempeño:
    //    Busca el nivel cuyo puntaje_minimo sea <= al puntaje obtenido,
    //    ordenado de mayor a menor → el nivel más alto alcanzado.
    //    Esto evita huecos entre rangos sin importar los decimales.
    let levelRes = await db.query(`
      SELECT nombre 
      FROM niveles_desempeno 
      WHERE puntaje_minimo <= $1
      ORDER BY puntaje_minimo DESC
      LIMIT 1
    `, [totalScore]);

    let nivelFinal = levelRes.rows[0]?.nombre || 'Sin Nivel';

    // 3. Update monitoring record
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

module.exports = {
  calculateTotalScore
};

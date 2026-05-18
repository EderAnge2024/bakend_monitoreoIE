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

    // 2. Determine performance level based on score
    let levelRes = await db.query(`
      SELECT nombre 
      FROM niveles_desempeno 
      WHERE $1 >= puntaje_minimo AND $1 <= puntaje_maximo
      LIMIT 1
    `, [totalScore]);

    let nivelFinal = levelRes.rows[0]?.nombre || 'Sin Nivel';

    // Fallback: If score exceeds max level, assign the highest one
    if (!levelRes.rows.length) {
      const maxLevelRes = await db.query('SELECT nombre FROM niveles_desempeno ORDER BY puntaje_maximo DESC LIMIT 1');
      if (maxLevelRes.rows.length && totalScore > 0) {
        nivelFinal = maxLevelRes.rows[0].nombre;
      }
    }

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

const db = require('../../config/database');

const getAlerts = async (req, res, next) => {
  const { id, role, id_institucion } = req.user;
  
  try {
    const alerts = [];
    
    // 1. Nuevas Solicitudes (para Admin y Director)
    if (role === 'administrador' || role === 'director') {
      let solQuery = `
        SELECT COUNT(*) 
        FROM solicitudes s
        JOIN docentes d ON s.id_docente = d.id_docente
        WHERE s.estado = 'Pendiente'
      `;
      let solParams = [];
      
      if (role === 'director') {
        solQuery += " AND d.id_institucion = $1";
        solParams.push(id_institucion);
      }
      
      const solRes = await db.query(solQuery, solParams);
      const count = parseInt(solRes.rows[0].count);
      if (count > 0) {
        alerts.push({
          type: 'solicitud',
          title: 'Nuevas Solicitudes',
          message: `Tienes ${count} trámites pendientes de revisión.`,
          count,
          link: '/solicitudes'
        });
      }
    }

    // 2. Fichas sin responder (Monitoreos en proceso o pendientes que el usuario inició)
    if (role !== 'docente') {
      const monRes = await db.query(`
        SELECT COUNT(*) 
        FROM monitoreos 
        WHERE id_evaluador = $1 AND estado IN ('pendiente', 'en_proceso')
      `, [id]);
      const count = parseInt(monRes.rows[0].count);
      if (count > 0) {
        alerts.push({
          type: 'monitoreo',
          title: 'Monitoreos Incompletos',
          message: `Tienes ${count} fichas de monitoreo sin finalizar.`,
          count,
          link: '/dashboard' // O a una página de mis monitoreos realizados
        });
      }
    }

    // 3. Notificaciones para Docentes (Cambios de estado en sus solicitudes)
    if (role === 'docente') {
      // Buscar el id_docente vinculado al usuario
      const docRes = await db.query("SELECT id_docente FROM docentes WHERE id_usuario = $1", [id]);
      if (docRes.rows.length > 0) {
        const id_docente = docRes.rows[0].id_docente;
        const solDocRes = await db.query(`
          SELECT COUNT(*) FROM solicitudes 
          WHERE id_docente = $1 AND estado != 'Pendiente' 
          AND created_at > (SELECT COALESCE(ultimo_login, '1970-01-01') FROM usuarios WHERE id_usuario = $2)
        `, [id_docente, id]);
        
        const count = parseInt(solDocRes.rows[0].count);
        if (count > 0) {
          alerts.push({
            type: 'solicitud_update',
            title: 'Actualización de Trámites',
            message: `Tus solicitudes han tenido ${count} actualizaciones desde tu última visita.`,
            count,
            link: '/solicitudes'
          });
        }
      }
    }

    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts
};

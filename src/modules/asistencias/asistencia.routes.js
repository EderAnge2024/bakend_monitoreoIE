const express = require('express');
const router = express.Router();
const asistenciaController = require('./asistencia.controller');
const configuracionController = require('./configuracion.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

// Rutas para docentes (registrar su propia asistencia)
router.get('/configuracion', authenticateJWT, authorizeRoles('docente'), asistenciaController.getConfiguracion);
router.get('/hoy', authenticateJWT, authorizeRoles('docente'), asistenciaController.getAsistenciaHoy);
router.post('/ingreso', authenticateJWT, authorizeRoles('docente'), asistenciaController.registrarIngreso);
router.post('/salida', authenticateJWT, authorizeRoles('docente'), asistenciaController.registrarSalida);

// Rutas para directores (configuración y estadísticas)
router.get('/admin/configuracion', authenticateJWT, authorizeRoles('administrador', 'director'), configuracionController.getConfiguracion);
router.post('/admin/configuracion', authenticateJWT, authorizeRoles('administrador', 'director'), configuracionController.saveConfiguracion);
router.get('/admin/estadisticas', authenticateJWT, authorizeRoles('administrador', 'director'), configuracionController.getEstadisticasAsistencia);
router.get('/admin/reporte', authenticateJWT, authorizeRoles('administrador', 'director'), configuracionController.getReporteAsistencias);
router.delete('/:id', authenticateJWT, authorizeRoles('director'), configuracionController.deleteAsistencia);

module.exports = router;
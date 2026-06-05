const express = require('express');
const router = express.Router();
const monitoreoController = require('./monitoreo.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

router.post('/', authenticateJWT, authorizeRoles('administrador', 'director', 'especialista'), monitoreoController.createMonitoreo);
router.post('/respuestas', authenticateJWT, authorizeRoles('administrador', 'director', 'especialista'), monitoreoController.saveAnswers);
router.get('/stats', authenticateJWT, authorizeRoles('administrador', 'director', 'especialista'), monitoreoController.getStats);
router.get('/seguimiento', authenticateJWT, authorizeRoles('administrador', 'director', 'especialista'), monitoreoController.getSeguimiento);
router.get('/export/excel', authenticateJWT, authorizeRoles('administrador', 'director', 'especialista'), monitoreoController.exportToExcel);
router.get('/historial', authenticateJWT, monitoreoController.getAllMonitoreos);
router.get('/mis-evaluaciones', authenticateJWT, monitoreoController.getMonitoreosByEvaluador);
router.get('/docente/:id_docente', authenticateJWT, monitoreoController.getMonitoreosByDocente);
router.get('/evaluados/:id_periodo', authenticateJWT, monitoreoController.getEvaluadosByPeriodo);
router.get('/:id_monitoreo', authenticateJWT, monitoreoController.getMonitoreoDetalle);

// Eliminar monitoreo: Solo accesible para administradores
router.delete('/:id_monitoreo', authenticateJWT, authorizeRoles('administrador'), monitoreoController.deleteMonitoreo);

module.exports = router;

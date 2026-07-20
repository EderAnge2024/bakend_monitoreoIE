const express = require('express');
const router = express.Router();
const asistenciaController = require('./asistencia.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

// Rutas para docentes (registrar su propia asistencia)
router.get('/configuracion', authenticateJWT, authorizeRoles('docente'), asistenciaController.getConfiguracion);
router.get('/hoy', authenticateJWT, authorizeRoles('docente'), asistenciaController.getAsistenciaHoy);
router.post('/ingreso', authenticateJWT, authorizeRoles('docente'), asistenciaController.registrarIngreso);
router.post('/salida', authenticateJWT, authorizeRoles('docente'), asistenciaController.registrarSalida);

module.exports = router;
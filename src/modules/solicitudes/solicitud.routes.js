const express = require('express');
const router = express.Router();
const solicitudController = require('./solicitud.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');
const upload = require('../../common/middlewares/upload');

// Admin / Director pueden ver todas las solicitudes
router.get('/', authenticateJWT, authorizeRoles('administrador', 'director'), solicitudController.getAll);

// Docentes pueden ver sus propias solicitudes
router.get('/docente/:id_docente', authenticateJWT, solicitudController.getByDocente);

// Crear solicitud (con o sin archivo adjunto)
router.post('/', authenticateJWT, upload.single('archivo'), solicitudController.create);

// Actualizar estado (Admin/Director)
router.put('/:id/estado', authenticateJWT, authorizeRoles('administrador', 'director'), solicitudController.updateStatus);

module.exports = router;

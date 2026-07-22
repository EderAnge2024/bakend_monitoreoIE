const express = require('express');
const router = express.Router();
const eventoController = require('./evento.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

// ============================================================================
// RUTAS PARA DIRECTORES Y ADMINISTRADORES (Gestión de Eventos)
// ============================================================================

// Gestión de eventos (solo directores y administradores)
router.get('/', authenticateJWT, authorizeRoles('administrador', 'director'), eventoController.getAllEventos);
router.post('/', authenticateJWT, authorizeRoles('administrador', 'director'), eventoController.createEvento);
router.get('/:id', authenticateJWT, authorizeRoles('administrador', 'director'), eventoController.getEventoById);
router.put('/:id', authenticateJWT, authorizeRoles('administrador', 'director'), eventoController.updateEvento);
router.patch('/:id/estado', authenticateJWT, authorizeRoles('administrador', 'director'), eventoController.cambiarEstadoEvento);
router.get('/:id/asistentes', authenticateJWT, authorizeRoles('administrador', 'director'), eventoController.getAsistentesEvento);
router.delete('/:id', authenticateJWT, authorizeRoles('director'), eventoController.deleteEvento);

// ============================================================================
// RUTAS PARA DOCENTES (Registro de Asistencia a Eventos)
// ============================================================================

// Eventos disponibles para docentes
router.get('/disponibles/mis-eventos', authenticateJWT, authorizeRoles('docente'), eventoController.getEventosDisponibles);

// Registrar asistencia a evento
router.post('/:id/asistencia', authenticateJWT, authorizeRoles('docente'), eventoController.registrarAsistenciaEvento);

module.exports = router;
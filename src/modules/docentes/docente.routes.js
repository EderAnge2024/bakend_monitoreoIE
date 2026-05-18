const express = require('express');
const router = express.Router();
const docenteController = require('./docente.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

router.get('/', authenticateJWT, docenteController.getAll);
router.get('/:id', authenticateJWT, docenteController.getById);
router.post('/', authenticateJWT, authorizeRoles('administrador', 'director'), docenteController.create);
router.put('/:id', authenticateJWT, authorizeRoles('administrador', 'director'), docenteController.update);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador', 'director'), docenteController.remove);

module.exports = router;

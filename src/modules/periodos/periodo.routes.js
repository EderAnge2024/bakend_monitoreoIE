const express = require('express');
const router = express.Router();
const periodoController = require('./periodo.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

router.get('/', authenticateJWT, periodoController.getAllPeriodos);
router.get('/:id', authenticateJWT, periodoController.getById);
router.post('/', authenticateJWT, authorizeRoles('administrador'), periodoController.createPeriodo);
router.put('/:id', authenticateJWT, authorizeRoles('administrador'), periodoController.updatePeriodo);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador'), periodoController.removePeriodo);

module.exports = router;

const express = require('express');
const router = express.Router();
const instController = require('../controllers/institucion.controller');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth.middleware');

// Only admins can manage institutions
router.get('/', authenticateJWT, instController.getAll);
router.get('/:id', authenticateJWT, instController.getById);
router.post('/', authenticateJWT, authorizeRoles('administrador'), instController.create);
router.put('/:id', authenticateJWT, authorizeRoles('administrador'), instController.update);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador'), instController.remove);

module.exports = router;

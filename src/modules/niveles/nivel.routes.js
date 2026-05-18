const express = require('express');
const router = express.Router();
const { getNiveles, getNivelById, createNivel, updateNivel, deleteNivel } = require('./nivel.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

// Public to authenticated users (needed for scoreService lookup)
router.get('/', authenticateJWT, getNiveles);
router.get('/:id', authenticateJWT, getNivelById);

// Admin only for mutations
router.post('/', authenticateJWT, authorizeRoles('administrador'), createNivel);
router.put('/:id', authenticateJWT, authorizeRoles('administrador'), updateNivel);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador'), deleteNivel);

module.exports = router;

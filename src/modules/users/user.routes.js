const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

router.get('/', authenticateJWT, authorizeRoles('administrador'), userController.getAll);
router.get('/:id', authenticateJWT, authorizeRoles('administrador'), userController.getById);
router.post('/', authenticateJWT, authorizeRoles('administrador'), userController.create);
router.put('/:id', authenticateJWT, authorizeRoles('administrador'), userController.update);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador'), userController.remove);
router.put('/:id/reset-password', authenticateJWT, authorizeRoles('administrador', 'director'), userController.resetPassword);

module.exports = router;

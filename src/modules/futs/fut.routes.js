const express = require('express');
const router = express.Router();
const futController = require('./fut.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');
const upload = require('../../common/middlewares/upload');

// Public or logged-in users can view active FUTs
router.get('/actives', authenticateJWT, futController.getActives);
router.get('/', authenticateJWT, futController.getAll);

// Admin / Director only
router.post('/', authenticateJWT, authorizeRoles('administrador', 'director'), upload.single('archivo'), futController.create);
router.put('/:id', authenticateJWT, authorizeRoles('administrador', 'director'), upload.single('archivo'), futController.update);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador', 'director'), futController.remove);

module.exports = router;

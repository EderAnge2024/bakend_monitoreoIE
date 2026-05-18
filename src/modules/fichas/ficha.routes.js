const express = require('express');
const router = express.Router();
const fichaController = require('./ficha.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

// --- Rutas Estáticas (Categorías, Preguntas, Opciones) ---

// Categorias
router.get('/:fichaId/categorias', authenticateJWT, fichaController.getCategoriasByFicha);
router.post('/categorias', authenticateJWT, authorizeRoles('administrador'), fichaController.createCategoria);
router.put('/categorias/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.updateCategoria);
router.delete('/categorias/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.deleteCategoria);

// Preguntas
router.get('/categorias/:categoriaId/preguntas', authenticateJWT, fichaController.getPreguntasByCategoria);
router.post('/preguntas', authenticateJWT, authorizeRoles('administrador'), fichaController.createPregunta);
router.put('/preguntas/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.updatePregunta);
router.delete('/preguntas/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.deletePregunta);

// Opciones
router.get('/preguntas/:preguntaId/opciones', authenticateJWT, fichaController.getOpcionesByPregunta);
router.post('/opciones', authenticateJWT, authorizeRoles('administrador'), fichaController.createOpcion);
router.put('/opciones/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.updateOpcion);
router.delete('/opciones/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.deleteOpcion);

// --- Rutas de Fichas (ID al final para evitar conflictos) ---
router.get('/', authenticateJWT, fichaController.getAllFichas);
router.post('/', authenticateJWT, authorizeRoles('administrador'), fichaController.createFicha);
router.get('/:id', authenticateJWT, fichaController.getFichaFull);
router.put('/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.updateFicha);
router.delete('/:id', authenticateJWT, authorizeRoles('administrador'), fichaController.deleteFicha);

module.exports = router;

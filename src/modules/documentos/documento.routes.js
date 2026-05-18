const express = require('express');
const router = express.Router();
const documentoController = require('./documento.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');
const upload = require('../../common/middlewares/upload');

// --- Rutas de Autenticación de Google Drive OAuth2 ---
router.get('/auth/url', authenticateJWT, authorizeRoles('administrador', 'director'), documentoController.getGoogleAuthUrl);
router.get('/auth/callback', documentoController.googleAuthCallback);
router.get('/auth/status', authenticateJWT, authorizeRoles('administrador', 'director'), documentoController.getGoogleAuthStatus);
router.post('/auth/disconnect', authenticateJWT, authorizeRoles('administrador', 'director'), documentoController.googleDisconnect);

// --- Rutas de Categorías ---

// Crear una categoría y sus respectivas carpetas en Drive (Solo Admins/Directores)
router.post(
  '/categorias',
  authenticateJWT,
  authorizeRoles('administrador', 'director'),
  upload.single('plantilla'),
  documentoController.createCategory
);

// Obtener todas las categorías con sus plantillas (Disponible para todos los autenticados)
router.get(
  '/categorias',
  authenticateJWT,
  documentoController.getCategories
);

// Actualizar nombre/descripción de una categoría (Solo Admins/Directores)
router.put(
  '/categorias/:id',
  authenticateJWT,
  authorizeRoles('administrador', 'director'),
  documentoController.updateCategory
);

// Eliminar una categoría y todo su contenido (Solo Admins/Directores)
router.delete(
  '/categorias/:id',
  authenticateJWT,
  authorizeRoles('administrador', 'director'),
  documentoController.deleteCategory
);

// --- Rutas de Documentos de Docentes ---

// Subir un documento editado basado en una plantilla (Docentes/Usuarios)
router.post(
  '/subir',
  authenticateJWT,
  upload.single('documento'),
  documentoController.uploadDocenteDocument
);

// Consultar el historial de envíos propios (Docente autenticado)
router.get(
  '/mis-documentos',
  authenticateJWT,
  documentoController.getDocenteDocuments
);

// --- Rutas Administrativas ---

// Ver todos los documentos enviados por docentes (Solo Admins/Directores)
router.get(
  '/admin/listado',
  authenticateJWT,
  authorizeRoles('administrador', 'director'),
  documentoController.getAllDocuments
);

// Cambiar el estado y enviar correo de notificación (Solo Admins/Directores)
router.put(
  '/admin/estado/:id',
  authenticateJWT,
  authorizeRoles('administrador', 'director'),
  documentoController.updateDocumentStatus
);

// Eliminar un documento subido por un docente (Solo Admins/Directores)
router.delete(
  '/admin/documento/:id',
  authenticateJWT,
  authorizeRoles('administrador', 'director'),
  documentoController.deleteDocument
);

module.exports = router;

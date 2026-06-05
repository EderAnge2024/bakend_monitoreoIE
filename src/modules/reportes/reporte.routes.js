const express = require('express');
const router = express.Router();
const { exportSeguimientoExcel } = require('./reporte.controller');
const { authenticateJWT, authorizeRoles } = require('../../common/middlewares/auth.middleware');

router.get(
  '/seguimiento-excel',
  authenticateJWT,
  authorizeRoles('administrador', 'director', 'especialista'),
  exportSeguimientoExcel
);

module.exports = router;

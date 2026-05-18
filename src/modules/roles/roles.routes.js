const express = require('express');
const router = express.Router();
const rolesController = require('./roles.controller');
const { authenticateJWT } = require('../../common/middlewares/auth.middleware');

router.get('/', authenticateJWT, rolesController.getAll);

module.exports = router;

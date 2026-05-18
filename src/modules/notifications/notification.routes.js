const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authenticateJWT } = require('../../common/middlewares/auth.middleware');

router.get('/alerts', authenticateJWT, notificationController.getAlerts);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticateJWT } = require('../../common/middlewares/auth.middleware');
const { loginRateLimiter } = require('../../common/middlewares/rateLimiter');

router.post('/login', loginRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticateJWT, authController.getMe);
router.post('/forgot-password', loginRateLimiter, authController.forgotPassword);
router.post('/reset-password', loginRateLimiter, authController.resetPassword);
router.put('/change-password', authenticateJWT, authController.changePassword);

module.exports = router;

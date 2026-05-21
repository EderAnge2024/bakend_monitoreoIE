const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const loginValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidation = [
  body('username').notEmpty().trim().isLength({ min: 4 }),
  body('password').isLength({ min: 6 }),
  body('email').isEmail(),
  body('nombres').notEmpty(),
  body('apellidos').notEmpty(),
  body('dni').isLength({ min: 8, max: 8 }),
];

// Validation for forgot password (email field)
const forgotPasswordValidation = [
  body('correo').optional().isEmail().withMessage('Correo must be a valid email'),
  body('email').optional().isEmail().withMessage('Email must be a valid email'),
];

// Validation for reset password (token and newPassword)
const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

router.post('/login', loginValidation, validate, authController.login);
router.post('/register', registerValidation, validate, authController.register);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, authController.resetPassword);

module.exports = router;

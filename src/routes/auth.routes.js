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

router.post('/login', loginValidation, validate, authController.login);
router.post('/register', registerValidation, validate, authController.register);

module.exports = router;

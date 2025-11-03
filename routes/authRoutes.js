const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Rota para login
router.post('/login', AuthController.login);

// Rota para cadastro
router.post('/signup', AuthController.signup);

// Rota para recuperação de senha
router.post('/forgot-password', AuthController.forgotPassword);

// Rota para redefinição de senha
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;
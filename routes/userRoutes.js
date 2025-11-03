const express = require('express');
const UserController = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Rota para buscar dados do usuário (protegida)
router.get('/usuarios', authenticate, UserController.getUser);

// Rota para atualizar perfil (protegida)
router.put('/profile', authenticate, UserController.updateProfile);

module.exports = router;
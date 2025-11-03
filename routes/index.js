const express = require('express');
const router = express.Router();

// Importar todas as rotas
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const transactionRoutes = require('./transactionRoutes');
const strategyRoutes = require('./strategyRoutes');
const portfolioRoutes = require('./portfolioRoutes');
const newsRoutes = require('./newsRoutes');

// Log de rotas acessadas
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Rotas sem autenticação
router.use('/auth', authRoutes);

// Rota de login alternativa para compatibilidade
router.post('/login', (req, res, next) => {
  const authController = require('../controllers/authController');
  return authController.login(req, res, next);
});

// Rotas com autenticação
const { authenticate } = require('../middlewares/auth');

// Rotas de usuário
router.get('/usuarios', authenticate, (req, res, next) => {
  // Rota para buscar dados do usuário atual
  const userController = require('../controllers/userController');
  return userController.getUser(req, res, next);
});

// Rotas de carteira
router.get('/carteira', authenticate, (req, res, next) => {
  const portfolioController = require('../controllers/portfolioController');
  return portfolioController.getPortfolio(req, res, next);
});

// Rotas de transações
router.get('/transacoes', authenticate, (req, res, next) => {
  const transactionController = require('../controllers/transactionController');
  return transactionController.getTransactions(req, res, next);
});

// Rota de estratégias (alternativa para /api/estrategias)
router.get('/estrategias', authenticate, (req, res, next) => {
  const strategyController = require('../controllers/strategyController');
  return strategyController.getStrategies(req, res, next);
});

// Rotas adicionais (mantendo as existentes)
router.use('/users', authenticate, userRoutes);
router.use('/transactions', authenticate, transactionRoutes);
router.use('/strategies', authenticate, strategyRoutes);
router.use('', newsRoutes); // Rotas de notícias (raiz do /api)

// Rota de status (para verificar se a API está online)
router.get('/status', (req, res) => {
  res.json({ 
    status: 'API está funcionando', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Rota de teste de autenticação (protegida)
router.get('/test-auth', authenticate, (req, res) => {
  res.json({ 
    message: 'Autenticação bem-sucedida!',
    user: req.user
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();

// Importar todas as rotas
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const transactionRoutes = require('./transactionRoutes');
const strategyRoutes = require('./strategyRoutes');
const portfolioRoutes = require('./portfolioRoutes');
const newsRoutes = require('./newsRoutes');

// Configurar rotas
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/usuarios', userRoutes); // Rota alternativa em português
router.use('/transactions', transactionRoutes);
router.use('/transacoes', transactionRoutes); // Rota alternativa em português
router.use('/strategies', strategyRoutes);
router.use('/carteira', portfolioRoutes);
router.use('', newsRoutes); // Rotas de notícias (raiz do /api)

// Rota de teste
router.get('/status', (req, res) => {
  res.json({ status: 'API está funcionando', timestamp: new Date() });
});

module.exports = router;

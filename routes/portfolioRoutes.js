const express = require('express');
const PortfolioController = require('../controllers/portfolioController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Rota para buscar carteira (protegida)
router.get('/carteira', authenticate, PortfolioController.getPortfolio);

// Rota para registrar compra (protegida)
router.post('/carteira', authenticate, PortfolioController.buyAsset);

// Rota para registrar venda (protegida)
router.post('/vender', authenticate, PortfolioController.sellAsset);

// Rota para obter total investido (protegida)
router.get('/total-investido', authenticate, PortfolioController.getTotalInvested);

// Rota para verificar estrutura da tabela (opcional, para debug)
router.get('/check-table-structure', PortfolioController.checkTableStructure);

module.exports = router;
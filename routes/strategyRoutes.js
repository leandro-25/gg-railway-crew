const express = require('express');
const StrategyController = require('../controllers/strategyController');

const router = express.Router();

// Rota para buscar estratégias
router.get('/estrategias', StrategyController.getStrategies);

// Rota para buscar ativos de uma estratégia
router.get('/estrategias/:id/ativos', StrategyController.getStrategyAssets);

module.exports = router;
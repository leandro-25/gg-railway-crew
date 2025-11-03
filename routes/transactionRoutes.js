const express = require('express');
const TransactionController = require('../controllers/transactionController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Rota para buscar transações (protegida)
router.get('/transacoes', authenticate, TransactionController.getTransactions);

// Rota para registrar transação (protegida)
router.post('/transacoes', authenticate, TransactionController.createTransaction);

module.exports = router;
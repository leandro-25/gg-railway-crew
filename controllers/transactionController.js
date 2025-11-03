const TransactionModel = require('../models/TransactionModel');

class TransactionController {
  static async getTransactions(req, res) {
    try {
      const user = req.user;
      const transacoes = await TransactionModel.getTransactionsByUser(user.id);
      res.json(transacoes);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  }

  static async createTransaction(req, res) {
    try {
      const user = req.user;
      const { valor, tipo, descricao } = req.body;
      const transacao = await TransactionModel.executeTransaction(user.id, valor, tipo, descricao);
      res.json(transacao);
    } catch (error) {
      console.error('Erro na transação:', error);
      res.status(500).json({ error: 'Erro ao processar transação' });
    }
  }
}

module.exports = TransactionController;
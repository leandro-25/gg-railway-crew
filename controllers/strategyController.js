const StrategyModel = require('../models/StrategyModel');

class StrategyController {
  static async getStrategies(req, res) {
    try {
      const estrategias = await StrategyModel.getStrategies();
      res.json(estrategias);
    } catch (error) {
      console.error('Erro ao buscar estratégias:', error);
      res.status(500).json({ error: 'Erro ao carregar estratégias' });
    }
  }

  static async getStrategyAssets(req, res) {
    try {
      const { id } = req.params;
      const assets = await StrategyModel.getStrategyAssets(id);
      res.json(assets);
    } catch (error) {
      console.error('Erro ao buscar ativos da estratégia:', error);
      res.status(500).json({ error: 'Erro ao carregar ativos da estratégia' });
    }
  }
}

module.exports = StrategyController;
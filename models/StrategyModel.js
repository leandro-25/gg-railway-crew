const supabase = require('../config/database');

class StrategyModel {
  static async getStrategies() {
    const { data, error } = await supabase
      .from('estrategias')
      .select(`
        *,
        ativos:ranking_ativos (
          id,
          codigo_ativo,
          posicao,
          rentabilidade
        )
      `)
      .order('nome', { ascending: false });
    
    if (error) throw error;
    return data.map(estrategia => ({
      ...estrategia,
      total_ativos: estrategia.ativos?.length || 0
    }));
  }

  static async getStrategyAssets(strategyId) {
    const { data, error } = await supabase
      .from('ranking_ativos')
      .select(`
        *,
        ativo:codigo_ativo (
          nome,
          tipo,
          preco_atual
        )
      `)
      .eq('estrategia_id', strategyId)
      .order('posicao', { ascending: true });
    
    if (error) throw error;
    return data;
  }
}

module.exports = StrategyModel;
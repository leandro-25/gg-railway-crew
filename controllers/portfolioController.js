const PortfolioModel = require('../models/PortfolioModel');

class PortfolioController {
  static async getPortfolio(req, res) {
    try {
      const user = req.user;
      const carteira = await PortfolioModel.getPortfolio(user.id);
      
      // Lógica de agrupamento por estratégia (mantida intacta)
      const carteiraPorEstrategia = {};
      carteira.forEach(item => {
        const estrategiaId = item.estrategias.id;
        const estrategiaNome = item.estrategias.nome;
        if (!carteiraPorEstrategia[estrategiaId]) {
          carteiraPorEstrategia[estrategiaId] = {
            id: estrategiaId,
            nome: estrategiaNome,
            total_investido: 0,
            ativos: []
          };
        }
        const quantidade = parseFloat(item.quantidade);
        const valorMedio = parseFloat(item.valor_compra);
        const precoAtual = item.ativos?.preco_atual || null;
        const valorTotal = quantidade * valorMedio;
        carteiraPorEstrategia[estrategiaId].ativos.push({
          codigo: item.codigo_ativo,
          quantidade,
          valor_medio: valorMedio,
          preco_atual: precoAtual,
          valor_total: valorTotal
        });
        carteiraPorEstrategia[estrategiaId].total_investido += valorTotal;
      });
      
      const totalGeral = Object.values(carteiraPorEstrategia).reduce((total, estrategia) => total + estrategia.total_investido, 0);
      const resultado = Object.values(carteiraPorEstrategia).map(estrategia => ({
        ...estrategia,
        porcentagem: totalGeral > 0 ? parseFloat(((estrategia.total_investido / totalGeral) * 100).toFixed(2)) : 0
      }));
      
      res.json(resultado);
    } catch (error) {
      console.error('Erro ao carregar carteira:', error);
      res.status(500).json({ error: 'Erro ao carregar carteira' });
    }
  }

  static async buyAsset(req, res) {
    try {
      const user = req.user;
      const { codigo_ativo, quantidade, valor_compra, estrategia_id } = req.body;
      
      if (!codigo_ativo || !quantidade || typeof estrategia_id === 'undefined') {
        return res.status(400).json({ error: 'Dados inválidos' });
      }
      if (isNaN(quantidade) || quantidade <= 0 || isNaN(valor_compra) || valor_compra <= 0) {
        return res.status(400).json({ error: 'Quantidade ou valor inválido' });
      }
      
      const result = await PortfolioModel.buyAsset(user.id, { codigo_ativo, quantidade, valor_compra, estrategia_id });
      res.json({ message: 'Compra registrada com sucesso', data: result });
    } catch (error) {
      console.error('Erro na compra:', error);
      res.status(500).json({ error: error.message || 'Erro ao processar compra' });
    }
  }

  static async sellAsset(req, res) {
    try {
      const user = req.user;
      const { codigo_ativo, quantidade, estrategia_id, preco_venda } = req.body;
      
      if (!codigo_ativo || !quantidade || typeof estrategia_id === 'undefined') {
        return res.status(400).json({ error: 'Dados inválidos' });
      }
      
      const result = await PortfolioModel.sellAsset(user.id, { codigo_ativo, quantidade, estrategia_id, preco_venda });
      res.json({ message: 'Venda realizada com sucesso', data: result });
    } catch (error) {
      console.error('Erro na venda:', error);
      res.status(500).json({ error: error.message || 'Erro ao processar venda' });
    }
  }

  static async getTotalInvested(req, res) {
    try {
      const user = req.user;
      const total = await PortfolioModel.getTotalInvested(user.id);
      res.json({ total_investido: total });
    } catch (error) {
      console.error('Erro ao calcular total investido:', error);
      res.status(500).json({ error: 'Erro ao calcular total investido' });
    }
  }

  static async checkTableStructure(req, res) {
    // Lógica de debug (mantida intacta do original)
    try {
      const supabase = require('../config/database');
      const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'transacoes');
      
      if (error) throw error;
      
      const testData = {
        usuario_id: 1,
        tipo: 'teste',
        valor: 100,
        descricao: 'Teste de estrutura',
        data: new Date().toISOString(),
        codigo_ativo: 'TEST11',
        quantidade: 10,
        valor_unitario: 10,
        valor_total: 100
      };
      
      const { data, error: insertError } = await supabase
        .from('transacoes')
        .insert([testData])
        .select();
      
      if (insertError) throw insertError;
      
      if (data && data[0]?.id) {
        await supabase.from('transacoes').delete().eq('id', data[0].id);
      }
      
      res.json({ success: true, message: 'Estrutura da tabela está correta', tableStructure: columns });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao verificar estrutura da tabela' });
    }
  }
}

module.exports = PortfolioController;
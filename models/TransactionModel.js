const supabase = require('../config/database');

class TransactionModel {
  static async getTransactionsByUser(userId) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id')
      .eq('user_id', userId)
      .single();

    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('data', { ascending: false });
    if (error) throw error;
    return data;
  }

  static async createTransaction(transactionData) {
    const { data, error } = await supabase
      .from('transacoes')
      .insert([transactionData])
      .select();
    if (error) throw error;
    return data;
  }

  static async executeTransaction(userId, valor, tipo, descricao) {
    const { data, error } = await supabase.rpc('executar_transacao', {
      user_id: userId,
      valor_transacao: valor,
      tipo_transacao: tipo,
      descricao_transacao: descricao || 'Operação financeira'
    });
    if (error) throw error;
    return data;
  }
}

module.exports = TransactionModel;
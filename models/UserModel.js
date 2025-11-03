const supabase = require('../config/database');

class UserModel {
  static async getUserById(userId) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, saldo')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  static async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('user_id', userId)
      .select();
    if (error) throw error;
    return data;
  }

  static async createUser(userData) {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([userData])
      .select();
    if (error) throw error;
    return data;
  }
}

module.exports = UserModel;
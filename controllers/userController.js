const UserModel = require('../models/UserModel');
const supabase = require('../config/database');

class UserController {
  static async getUser(req, res) {
    try {
      const user = req.user;
      const usuario = await UserModel.getUserById(user.id);
      res.json(usuario);
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  }

  static async updateProfile(req, res) {
    try {
      const user = req.user;
      const { nome, novaSenha } = req.body;

      if (!nome || nome.trim() === '') {
        return res.status(400).json({ success: false, error: 'Nome obrigatório', code: 'INVALID_NAME' });
      }

      await UserModel.updateUser(user.id, { nome: nome.trim() });

      if (novaSenha) {
        await supabase.auth.updateUser({ password: novaSenha.trim() });
      }

      res.json({ success: true, message: 'Perfil atualizado!', user: { id: user.id, nome, email: user.email } });
    } catch (error) {
      console.error('Erro na atualização:', error);
      res.status(500).json({ success: false, error: 'Erro ao atualizar perfil' });
    }
  }
}

module.exports = UserController;
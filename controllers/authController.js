const supabase = require('../config/database');
const UserModel = require('../models/UserModel');

class AuthController {
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          code: 'MISSING_CREDENTIALS',
          message: 'Por favor, preencha todos os campos.'
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        return res.status(400).json({
          code: error.code || 'AUTH_ERROR',
          message: 'E-mail ou senha incorretos'
        });
      }

      res.json({ user: data.user, session: data.session });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'Ocorreu um erro inesperado.' });
    }
  }

  static async signup(req, res) {
    try {
      const { nome, email, password } = req.body;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: { data: { nome: nome.trim() } }
      });

      if (authError) throw authError;

      const userData = await UserModel.createUser({
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        user_id: authData.user.id
      });

      res.json({ user: { ...authData.user, profile: userData[0] } });
    } catch (error) {
      console.error('Erro no cadastro:', error);
      res.status(400).json({ code: error.code || 'DATABASE_ERROR', message: error.message });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          code: 'MISSING_EMAIL',
          message: 'Por favor, informe o e-mail para recuperação de senha.'
        });
      }

      // Envia um e-mail de redefinição de senha
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:8100/reset-password' // URL da sua tela de redefinição de senha no frontend
      });

      if (error) {
        console.error('Erro ao enviar e-mail de recuperação:', error);
        return res.status(400).json({
          code: error.code || 'PASSWORD_RESET_ERROR',
          message: 'Não foi possível enviar o e-mail de recuperação. Verifique se o e-mail está correto.'
        });
      }

      res.json({
        success: true,
        message: 'E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.'
      });
    } catch (error) {
      console.error('Erro na recuperação de senha:', error);
      res.status(500).json({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocorreu um erro ao processar sua solicitação de recuperação de senha.'
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, password, confirmPassword } = req.body;

      if (!token) {
        return res.status(400).json({
          code: 'MISSING_TOKEN',
          message: 'Token de redefinição não fornecido.'
        });
      }

      if (!password || !confirmPassword) {
        return res.status(400).json({
          code: 'MISSING_FIELDS',
          message: 'Por favor, preencha todos os campos.'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          code: 'PASSWORDS_DONT_MATCH',
          message: 'As senhas não coincidem.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          code: 'PASSWORD_TOO_SHORT',
          message: 'A senha deve ter no mínimo 6 caracteres.'
        });
      }

      // O Supabase lida com a redefinição de senha usando o token
      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Erro ao redefinir senha:', error);
        return res.status(400).json({
          code: error.code || 'PASSWORD_RESET_ERROR',
          message: 'Não foi possível redefinir a senha. O link pode ter expirado ou ser inválido.'
        });
      }

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      res.status(500).json({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocorreu um erro ao processar sua solicitação de redefinição de senha.'
      });
    }
  }
}

module.exports = AuthController;
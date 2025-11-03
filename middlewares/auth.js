const supabase = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!user || error) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
};

module.exports = { authenticate };
function errorHandler(err, req, res, next) {
  console.error('Erro na API:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🔒' : err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Tratar erros específicos
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Erro de validação',
      details: err.message
    });
  }

  // Erro 404
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      error: 'Recurso não encontrado',
      path: req.path
    });
  }

  // Erro genérico
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ocorreu um erro inesperado'
  });
}

// Middleware para rotas não encontradas (404)
function notFoundHandler(req, res, next) {
  const error = new Error(`Rota não encontrada: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler
};

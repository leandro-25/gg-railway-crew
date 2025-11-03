const express = require('express');
const router = express.Router();
const axios = require('axios');

// Rota para buscar notícias sobre um ativo
router.post('/noticias', async (req, res) => {
  try {
    const { ticker } = req.body;
    
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker do ativo não fornecido' });
    }

    // Aqui você pode implementar a lógica para buscar notícias
    // Por enquanto, vamos retornar um mock
    const mockNews = {
      resumo: `Notícias sobre ${ticker} - Aqui você pode integrar com uma API de notícias financeiras como NewsAPI, Alpha Vantage, etc.`,
      impacto: 'neutro',
      noticias: [
        {
          titulo: `Análise: ${ticker} apresenta desempenho estável`,
          fonte: 'Sistema',
          data: new Date().toISOString(),
          resumo: 'Este é um exemplo de notícia. Integre com uma API de notícias real para obter dados em tempo real.'
        }
      ]
    };

    res.json(mockNews);
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    res.status(500).json({ 
      error: 'Erro ao processar a requisição de notícias',
      details: error.message 
    });
  }
});

module.exports = router;

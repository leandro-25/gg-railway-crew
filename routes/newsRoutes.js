const express = require('express');
const router = express.Router();
const axios = require('axios');

// URL do serviço CrewAI (ajuste conforme necessário)
const CREWAI_SERVICE_URL = process.env.CREWAI_SERVICE_URL || 'http://localhost:5000';

// Rota para buscar notícias sobre um ativo
router.post('/noticias', async (req, res) => {
  try {
    const { ticker } = req.body;
    
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker do ativo não fornecido' });
    }

    // Chamar o serviço CrewAI para obter notícias
    const response = await axios.post(`${CREWAI_SERVICE_URL}/noticias`, { 
      ticker 
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Retornar a resposta do serviço CrewAI
    res.json({
      resumo: response.data.resumo || `Notícias sobre ${ticker}`,
      impacto: response.data.impacto || 'neutro',
      noticias: response.data.noticias || []
    });
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    res.status(500).json({ 
      error: 'Erro ao processar a requisição de notícias',
      details: error.message 
    });
  }
});

module.exports = router;

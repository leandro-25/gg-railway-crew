require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Importar configurações e rotas
const supabase = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const strategyRoutes = require('./routes/strategyRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
const allowedOrigins = [
  'http://localhost:8100',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
  'ionic://localhost',
  'http://localhost:4200',
  'chrome-extension://*',
  'devtools://devtools',
  'ws://localhost:*',
  'http://localhost:*',
  'https://gg-railway-production.up.railway.app',
  'https://seu-frontend.railway.app'  // Substitua pelo domínio real do seu frontend
];

// Configuração do CORS
app.use(cors({
  origin: function(origin, callback) {
    // Em desenvolvimento, permita todas as origens
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Em produção, verifique as origens permitidas
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma', 'Expires', 'DevTools-Request-Id'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Configuração de CSP para desenvolvimento
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires, DevTools-Request-Id');
    
    // Configuração de CSP para permitir o DevTools
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: gap: https://ssl.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "media-src *",
      "img-src 'self' data: content:",
      "connect-src 'self' ws: wss: http: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' data:"
    ].join('; ');
    
    res.header('Content-Security-Policy', csp);
  }
  next();
});

app.use(express.json());

// Usar as rotas
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', transactionRoutes);
app.use('/api', strategyRoutes);
app.use('/api', portfolioRoutes);

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
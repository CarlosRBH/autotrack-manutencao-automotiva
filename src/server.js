const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/database');

const clienteRoutes = require('./routes/clienteRoutes');
const veiculoRoutes = require('./routes/veiculoRoutes');
const manutencaoRoutes = require('./routes/manutencaoRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend estático da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas da API REST
app.use('/api/clientes', clienteRoutes);
app.use('/api/veiculos', veiculoRoutes);
app.use('/api/manutencoes', manutencaoRoutes);
app.use('/api/relatorios', relatorioRoutes);

// Health check da API e diagnóstico de banco
app.get('/api/health', async (req, res) => {
  const isDbConnected = await testConnection();
  return res.json({
    status: 'ok',
    sistema: 'AutoTrack - Sistema de Gestão de Manutenção Automotiva',
    versao: '1.0.0',
    bancoDeDados: {
      sgbd: 'MySQL 8.x',
      database: process.env.DB_NAME || 'autotrack_db',
      conectado: isDbConnected
    },
    timestamp: new Date().toISOString()
  });
});

// Tratamento de rota não encontrada
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota '${req.originalUrl}' não encontrada na API do AutoTrack.`
  });
});

// Redireciona qualquer outra rota para a SPA no index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Middleware global de erro
app.use((err, req, res, next) => {
  console.error('[AutoTrack Server Error]', err.stack);
  res.status(500).json({
    success: false,
    message: 'Ocorreu um erro interno no servidor AutoTrack.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Inicia o servidor HTTP
app.listen(PORT, async () => {
  console.log(`=============================================================`);
  console.log(`  AutoTrack — Gestão de Manutenção Automotiva rodando!`);
  console.log(`  URL Local: http://localhost:${PORT}`);
  console.log(`  API Health: http://localhost:${PORT}/api/health`);
  console.log(`=============================================================`);
  await testConnection();
});

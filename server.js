require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { initDB }          = require('./src/database');
const webhookRouter       = require('./src/routes/webhook');
const dashboardRouter     = require('./src/routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// Log every request
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Init banco de dados ───────────────────────────────────────
initDB();

// ── Rotas ─────────────────────────────────────────────────────
app.use('/webhook',   webhookRouter);
app.use('/dashboard', dashboardRouter);

app.get('/', (_req, res) => {
  res.json({
    service : 'ApostaDez Gamificação',
    version : '1.0.0',
    status  : 'online',
    endpoints: {
      webhook  : 'POST /webhook/login',
      users    : 'GET  /dashboard/users',
      user     : 'GET  /dashboard/users/:userId',
      events   : 'GET  /dashboard/events',
      stats    : 'GET  /dashboard/stats',
    }
  });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor ApostaDez Gamificação rodando na porta ${PORT}`);
  console.log(`   Webhook endpoint: POST http://localhost:${PORT}/webhook/login`);
  console.log(`   Dashboard:        GET  http://localhost:${PORT}/dashboard/stats\n`);
});

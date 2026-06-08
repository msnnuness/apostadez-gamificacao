require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { initDB }          = require('./src/database');
const webhookRouter       = require('./src/routes/webhook');
const dashboardRouter     = require('./src/routes/dashboard');
const adminRouter         = require('./src/routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

initDB();

app.use('/webhook',   webhookRouter);
app.use('/dashboard', dashboardRouter);
app.use('/admin',     adminRouter);

app.get('/', (_req, res) => {
  res.json({
    service  : 'ApostaDez Gamificação',
    version  : '1.0.0',
    status   : 'online',
    endpoints: {
      webhook   : 'POST /webhook/login',
      admin     : 'GET  /admin/panel',
      users     : 'GET  /dashboard/users',
      events    : 'GET  /dashboard/events',
      stats     : 'GET  /dashboard/stats',
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor ApostaDez Gamificação — porta ${PORT}`);
  console.log(`   Webhook: POST http://localhost:${PORT}/webhook/login`);
  console.log(`   Admin:   GET  http://localhost:${PORT}/admin/panel\n`);
});

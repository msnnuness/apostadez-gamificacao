require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { initDB }      = require('./src/database');
const webhookRouter   = require('./src/routes/webhook');
const dashboardRouter = require('./src/routes/dashboard');
const adminRouter     = require('./src/routes/admin');
const promosRouter    = require('./src/routes/promos');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

initDB();

app.use('/webhook',   webhookRouter);
app.use('/dashboard', dashboardRouter);
app.use('/admin',     adminRouter);
app.use('/promos',    promosRouter);

app.get('/', (_req, res) => res.json({ service: 'ApostaDez Gamificação', version: '2.0.0', status: 'online' }));
app.listen(PORT, () => console.log(`\n🚀 Servidor rodando na porta ${PORT}\n`));

const path = require('path');
const { LowSync }      = require('lowdb');
const { JSONFileSync } = require('lowdb/node');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

// Garante que o diretório existe
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const adapter = new JSONFileSync(DB_FILE);
const db = new LowSync(adapter, {
  users  : {},   // userId → { points, freeSpins, loginBonuses: [] }
  events : [],   // log de todos os webhooks recebidos
});

function initDB() {
  db.read();
  // Garante estrutura inicial se o arquivo estava vazio
  db.data.users  ??= {};
  db.data.events ??= [];
  db.write();
  console.log(`[DB] Banco carregado: ${DB_FILE}`);
}

// ── Usuários ──────────────────────────────────────────────────

function getUser(userId) {
  db.read();
  return db.data.users[userId] || null;
}

function ensureUser(userId, { email, fullName } = {}) {
  db.read();
  if (!db.data.users[userId]) {
    db.data.users[userId] = {
      userId,
      email    : email    || null,
      fullName : fullName || null,
      points   : 0,
      freeSpins: 0,
      loginBonuses: [],   // datas (YYYY-MM-DD) em que recebeu bônus
      createdAt: new Date().toISOString(),
    };
    db.write();
  }
  return db.data.users[userId];
}

function addPoints(userId, points, context = {}) {
  db.read();
  const user = db.data.users[userId];
  if (!user) return null;
  user.points    += points;
  user.freeSpins += points; // 1 ponto = 1 free spin
  user.lastBonus  = new Date().toISOString();
  if (context.bonusDate) user.loginBonuses.push(context.bonusDate);
  db.write();
  return user;
}

function getAllUsers() {
  db.read();
  return Object.values(db.data.users).sort((a, b) => b.points - a.points);
}

// ── Eventos ───────────────────────────────────────────────────

function logEvent(entry) {
  db.read();
  db.data.events.unshift({ ...entry, loggedAt: new Date().toISOString() });
  // Manter apenas os últimos 500 eventos
  if (db.data.events.length > 500) db.data.events = db.data.events.slice(0, 500);
  db.write();
}

function getEvents(limit = 50) {
  db.read();
  return db.data.events.slice(0, limit);
}

function getStats() {
  db.read();
  const users     = Object.values(db.data.users);
  const events    = db.data.events;
  const bonused   = events.filter(e => e.result === 'bonus');
  const totalPts  = users.reduce((s, u) => s + u.points, 0);

  return {
    totalUsers       : users.length,
    totalPointsGiven : totalPts,
    totalFreeSpins   : totalPts,
    totalWebhooks    : events.length,
    totalBonused     : bonused.length,
    totalSkipped     : events.filter(e => e.result === 'skip').length,
  };
}

module.exports = { initDB, getUser, ensureUser, addPoints, getAllUsers, logEvent, getEvents, getStats };

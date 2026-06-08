const path = require('path');
const { LowSync }      = require('lowdb');
const { JSONFileSync } = require('lowdb/node');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const DEFAULT_CONFIG = {
  active      : true,
  windowStart : '18:00',
  windowEnd   : '19:00',
  points      : 100,
  spinCost    : 1,
  spinValue   : 0.20,
  frequency   : 'daily',
  expiryDays  : 30,
  defaultTz   : 'America/Sao_Paulo',
  useUserTz   : true,
  updatedAt   : null,
};

const adapter = new JSONFileSync(DB_FILE);
const db = new LowSync(adapter, {
  users  : {},
  events : [],
  config : null,
});

function initDB() {
  db.read();
  db.data.users  ??= {};
  db.data.events ??= [];
  db.data.config ??= { ...DEFAULT_CONFIG };
  db.write();
  console.log(`[DB] Banco carregado: ${DB_FILE}`);
}

// ── Config ────────────────────────────────────────────────────

function getConfig() {
  db.read();
  return { ...DEFAULT_CONFIG, ...(db.data.config || {}) };
}

function saveConfig(updates) {
  db.read();
  db.data.config = { ...DEFAULT_CONFIG, ...(db.data.config || {}), ...updates, updatedAt: new Date().toISOString() };
  db.write();
  return db.data.config;
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
      loginBonuses: [],
      createdAt: new Date().toISOString(),
    };
    db.write();
  }
  return db.data.users[userId];
}

function addPoints(userId, points, context = {}) {
  db.read();
  const cfg   = getConfig();
  const spins = Math.floor(points / cfg.spinCost);
  const user  = db.data.users[userId];
  if (!user) return null;
  user.points    += points;
  user.freeSpins += spins;
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
  if (db.data.events.length > 500) db.data.events = db.data.events.slice(0, 500);
  db.write();
}

function getEvents(limit = 50) {
  db.read();
  return db.data.events.slice(0, limit);
}

function getStats() {
  db.read();
  const users    = Object.values(db.data.users);
  const events   = db.data.events;
  const totalPts = users.reduce((s, u) => s + u.points, 0);
  return {
    totalUsers       : users.length,
    totalPointsGiven : totalPts,
    totalFreeSpins   : totalPts,
    totalWebhooks    : events.length,
    totalBonused     : events.filter(e => e.result === 'bonus').length,
    totalSkipped     : events.filter(e => e.result === 'skip').length,
  };
}

module.exports = { initDB, getConfig, saveConfig, getUser, ensureUser, addPoints, getAllUsers, logEvent, getEvents, getStats };

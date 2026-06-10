const path = require('path');
const { LowSync }      = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const fs = require('fs');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const DEFAULT_CONFIG = {
  active: true, windowStart: '18:00', windowEnd: '19:00',
  points: 100, spinCost: 1, spinValue: 0.20, frequency: 'daily',
  expiryDays: 30, defaultTz: 'America/Sao_Paulo', useUserTz: true, updatedAt: null,
};

const adapter = new JSONFileSync(DB_FILE);
const db = new LowSync(adapter, { users: {}, events: [], config: null, promos: [] });

function initDB() {
  db.read();
  db.data.users  ??= {};
  db.data.events ??= [];
  db.data.config ??= { ...DEFAULT_CONFIG };
  db.data.promos ??= [];
  db.write();
  console.log('[DB] Banco carregado:', DB_FILE);
}

// ── Config ────────────────────────────────────────────────────
function getConfig() { db.read(); return { ...DEFAULT_CONFIG, ...(db.data.config || {}) }; }
function saveConfig(u) {
  db.read();
  db.data.config = { ...DEFAULT_CONFIG, ...(db.data.config||{}), ...u, updatedAt: new Date().toISOString() };
  db.write(); return db.data.config;
}

// ── Promos ────────────────────────────────────────────────────
function getPromos() { db.read(); return db.data.promos || []; }

function savePromo(promo) {
  db.read();
  const idx = db.data.promos.findIndex(p => p.id === promo.id);
  if (idx >= 0) db.data.promos[idx] = promo;
  else db.data.promos.push(promo);
  db.write(); return promo;
}

function deletePromo(id) {
  db.read();
  db.data.promos = db.data.promos.filter(p => p.id !== id);
  db.write();
}

function getActivePromos() {
  db.read();
  const now = new Date();
  return db.data.promos.filter(p => {
    if (!p.active) return false;
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate   && new Date(p.endDate)   < now) return false;
    return true;
  });
}

// ── Usuários ──────────────────────────────────────────────────
function getUser(userId) { db.read(); return db.data.users[userId] || null; }

function ensureUser(userId, { email, fullName } = {}) {
  db.read();
  if (!db.data.users[userId]) {
    db.data.users[userId] = {
      userId, email: email||null, fullName: fullName||null,
      points: 0, freeSpins: 0, loginBonuses: [],
      loginDates: [], consecutiveLogins: 0, lastLoginDate: null,
      promoProgress: {}, // promoId → { count, lastDate, rewarded: [] }
      createdAt: new Date().toISOString(),
    };
    db.write();
  } else if ((email || fullName) && (!db.data.users[userId].email || !db.data.users[userId].fullName)) {
    if (email)    db.data.users[userId].email    = email;
    if (fullName) db.data.users[userId].fullName = fullName;
    db.write();
  }
  return db.data.users[userId];
}

function recordLogin(userId, dateStr) {
  db.read();
  const user = db.data.users[userId];
  if (!user) return;
  if (!user.loginDates) user.loginDates = [];
  if (!user.loginDates.includes(dateStr)) {
    user.loginDates.push(dateStr);
    // calcular consecutivos
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
    if (user.lastLoginDate === yStr) user.consecutiveLogins = (user.consecutiveLogins || 0) + 1;
    else user.consecutiveLogins = 1;
    user.lastLoginDate = dateStr;
  }
  db.write();
  return user;
}

function addFreeSpins(userId, spins, promoId, rewardKey) {
  db.read();
  const user = db.data.users[userId];
  if (!user) return null;
  user.freeSpins = (user.freeSpins || 0) + spins;
  user.points    = (user.points    || 0) + spins;
  if (promoId) {
    if (!user.promoProgress[promoId]) user.promoProgress[promoId] = { count: 0, rewarded: [] };
    if (rewardKey && !user.promoProgress[promoId].rewarded.includes(rewardKey))
      user.promoProgress[promoId].rewarded.push(rewardKey);
  }
  user.lastBonus = new Date().toISOString();
  db.write();
  return user;
}

function getUserPromoProgress(userId, promoId) {
  db.read();
  const user = db.data.users[userId];
  if (!user) return null;
  return user.promoProgress?.[promoId] || { count: 0, rewarded: [] };
}

function incrementPromoCount(userId, promoId) {
  db.read();
  const user = db.data.users[userId];
  if (!user) return 0;
  if (!user.promoProgress[promoId]) user.promoProgress[promoId] = { count: 0, rewarded: [] };
  user.promoProgress[promoId].count += 1;
  db.write();
  return user.promoProgress[promoId].count;
}

function getAllUsers() { db.read(); return Object.values(db.data.users).sort((a,b) => b.freeSpins - a.freeSpins); }

// ── Eventos ───────────────────────────────────────────────────
function logEvent(entry) {
  db.read();
  db.data.events.unshift({ ...entry, loggedAt: new Date().toISOString() });
  if (db.data.events.length > 500) db.data.events = db.data.events.slice(0, 500);
  db.write();
}

function getEvents(limit = 50) { db.read(); return db.data.events.slice(0, limit); }

function getStats() {
  db.read();
  const users  = Object.values(db.data.users);
  const events = db.data.events;
  const totalFS = users.reduce((s,u) => s + (u.freeSpins||0), 0);
  return {
    totalUsers: users.length,
    totalFreeSpins: totalFS,
    totalPointsGiven: totalFS,
    totalWebhooks: events.length,
    totalBonused: events.filter(e => e.result === 'bonus').length,
    totalSkipped: events.filter(e => e.result === 'skip').length,
    totalPromos: db.data.promos.length,
    activePromos: getActivePromos().length,
  };
}

module.exports = {
  initDB, getConfig, saveConfig,
  getPromos, savePromo, deletePromo, getActivePromos,
  getUser, ensureUser, recordLogin, addFreeSpins, getUserPromoProgress, incrementPromoCount, getAllUsers,
  logEvent, getEvents, getStats,
};

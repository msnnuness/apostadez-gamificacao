const { getActivePromos, getUserPromoProgress, addFreeSpins, recordLogin, getUser } = require('../database');

function getLocalHour(ts, tz) {
  try { return parseInt(new Date(ts).toLocaleString('pt-BR', { timeZone: tz, hour: '2-digit', hour12: false }), 10); }
  catch { return (new Date(ts).getUTCHours() - 3 + 24) % 24; }
}
function getLocalMinute(ts, tz) {
  try { return parseInt(new Date(ts).toLocaleString('pt-BR', { timeZone: tz, minute: '2-digit', hour12: false }), 10); }
  catch { return new Date(ts).getUTCMinutes(); }
}
function getLocalDateStr(ts, tz) {
  try { return new Date(ts).toLocaleDateString('pt-BR', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return new Date(ts).toISOString().split('T')[0]; }
}
function getWeekKey(dateStr) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const date  = new Date(y, m - 1, d);
  const start = new Date(y, 0, 1);
  const week  = Math.ceil(((date - start) / 86400000 + start.getDay() + 1) / 7);
  return 'W' + week + '-' + y;
}
function getMonthKey(dateStr) {
  const parts = dateStr.split('/');
  return parts[1] + '/' + parts[2];
}
function inWindow(timeMin, startMin, endMin) {
  if (startMin <= endMin) return timeMin >= startMin && timeMin < endMin;
  return timeMin >= startMin || timeMin < endMin;
}

// ── LOGIN ─────────────────────────────────────────────────────
function processLoginEvent(payload, user) {
  const promos = getActivePromos('login');
  const results = [];
  const tz = payload.data?.tracking?.deviceInfo?.timezone || payload.data?.metadata?.timezone || 'America/Sao_Paulo';
  const ts = payload.timestamp;
  const hour    = getLocalHour(ts, tz);
  const minute  = getLocalMinute(ts, tz);
  const dateStr = getLocalDateStr(ts, tz);
  const timeMin = hour * 60 + minute;

  recordLogin(user.userId, dateStr);
  const updatedUser = getUser(user.userId);

  for (const promo of promos) {
    const progress = getUserPromoProgress(user.userId, promo.id);
    const result   = evaluateLoginPromo(promo, updatedUser, progress, { hour, minute, timeMin, dateStr, tz });
    if (result.eligible) {
      addFreeSpins(user.userId, promo.rewardSpins, promo.id, result.rewardKey);
      results.push({ promoId: promo.id, promoName: promo.name, spins: promo.rewardSpins, reason: result.reason, rewardKey: result.rewardKey });
    }
  }
  return results;
}

function evaluateLoginPromo(promo, user, progress, ctx) {
  const { hour, timeMin, dateStr } = ctx;

  if (promo.conditionType === 'time_window') {
    const [sh, sm] = (promo.timeStart || '18:00').split(':').map(Number);
    const [eh, em] = (promo.timeEnd   || '19:00').split(':').map(Number);
    if (!inWindow(timeMin, sh*60+sm, eh*60+em))
      return { eligible: false, reason: `hora ${String(hour).padStart(2,'0')}h fora de ${promo.timeStart}-${promo.timeEnd}` };
    const rewardKey = dateStr;
    if (progress.rewarded.includes(rewardKey)) return { eligible: false, reason: 'ja bonificado hoje' };
    return { eligible: true, reason: `login ${promo.timeStart}-${promo.timeEnd}`, rewardKey };
  }

  if (promo.conditionType === 'login_count') {
    const period   = promo.period || 'week';
    const required = parseInt(promo.loginRequired) || 3;
    const periodKey = period === 'day' ? dateStr : period === 'week' ? getWeekKey(dateStr) : getMonthKey(dateStr);
    if (progress.rewarded.includes(periodKey)) return { eligible: false, reason: 'recompensa ja concedida neste periodo' };
    const loginDates = user.loginDates || [];
    let count = 0;
    for (const d of loginDates) {
      const dk = period === 'day' ? d : period === 'week' ? getWeekKey(d) : getMonthKey(d);
      if (dk === periodKey) count++;
    }
    if (!loginDates.includes(dateStr)) count++;
    if (count < required) return { eligible: false, reason: `${count}/${required} logins` };
    return { eligible: true, reason: `${count} logins no periodo`, rewardKey: periodKey };
  }

  if (promo.conditionType === 'consecutive') {
    const required    = parseInt(promo.loginRequired) || 7;
    const consecutive = user.consecutiveLogins || 1;
    const rewardKey   = 'consec-' + dateStr;
    if (progress.rewarded.includes(rewardKey)) return { eligible: false, reason: 'ja bonificado hoje' };
    if (consecutive < required) return { eligible: false, reason: `${consecutive}/${required} dias consecutivos` };
    return { eligible: true, reason: `${consecutive} dias consecutivos`, rewardKey };
  }

  return { eligible: false, reason: 'tipo de condicao desconhecido' };
}

// ── DEPÓSITO ──────────────────────────────────────────────────
function processDepositEvent(payload, user) {
  const promos = getActivePromos('deposit');
  const results = [];

  const amount        = payload.data?.amount        || 0;
  const transactionId = payload.data?.transactionId || null;
  const depositCount  = user.depositCount || 0; // já incrementado antes de chamar esta função

  for (const promo of promos) {
    const progress = getUserPromoProgress(user.userId, promo.id);
    const result   = evaluateDepositPromo(promo, user, progress, { amount, transactionId, depositCount });
    if (result.eligible) {
      addFreeSpins(user.userId, promo.rewardSpins, promo.id, result.rewardKey);
      results.push({ promoId: promo.id, promoName: promo.name, spins: promo.rewardSpins, reason: result.reason, rewardKey: result.rewardKey });
    }
  }
  return results;
}

function evaluateDepositPromo(promo, user, progress, { amount, transactionId, depositCount }) {
  // Verifica valor mínimo
  const minAmount = parseFloat(promo.minDepositAmount) || 0;
  if (minAmount > 0 && amount < minAmount)
    return { eligible: false, reason: `valor R$${amount} abaixo do minimo R$${minAmount}` };

  // Verifica se é primeiro depósito
  if (promo.depositType === 'first' && depositCount > 1)
    return { eligible: false, reason: 'nao e o primeiro deposito' };

  // Frequência
  const freq = promo.depositFrequency || 'once_per_deposit';
  const now  = new Date();

  let rewardKey;
  if (freq === 'once_per_deposit') {
    rewardKey = transactionId || ('dep-' + Date.now());
  } else if (freq === 'daily') {
    rewardKey = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } else if (freq === 'weekly') {
    const d = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
    rewardKey = getWeekKey(d);
  } else if (freq === 'first_ever') {
    rewardKey = 'first-deposit-ever';
  }

  if (progress.rewarded.includes(rewardKey))
    return { eligible: false, reason: 'recompensa ja concedida para este periodo/deposito' };

  return { eligible: true, reason: `deposito R$${amount} elegivel`, rewardKey };
}

module.exports = { processLoginEvent, processDepositEvent };

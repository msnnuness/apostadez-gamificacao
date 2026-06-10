const { getActivePromos, getUserPromoProgress, incrementPromoCount, addFreeSpins, recordLogin } = require('../database');

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
function getWeekNumber(dateStr) {
  // Semana do ano a partir da data pt-BR (dd/mm/yyyy)
  const [d, m, y] = dateStr.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  const start = new Date(y, 0, 1);
  return Math.ceil(((date - start) / 86400000 + start.getDay() + 1) / 7);
}
function inWindow(timeMin, startMin, endMin) {
  if (startMin <= endMin) return timeMin >= startMin && timeMin < endMin;
  return timeMin >= startMin || timeMin < endMin;
}

/**
 * Processa todas as promos ativas para um evento de login
 * Retorna lista de recompensas concedidas
 */
function processLoginEvent(payload, user) {
  const promos = getActivePromos();
  const results = [];

  const tz = payload.data?.tracking?.deviceInfo?.timezone
          || payload.data?.metadata?.timezone
          || 'America/Sao_Paulo';
  const ts = payload.timestamp;
  const hour   = getLocalHour(ts, tz);
  const minute = getLocalMinute(ts, tz);
  const dateStr = getLocalDateStr(ts, tz);
  const timeMin = hour * 60 + minute;

  // Registra o login
  recordLogin(user.userId, dateStr);
  // Atualiza user após recordLogin
  const { getUser } = require('../database');
  const updatedUser = getUser(user.userId);

  for (const promo of promos) {
    if (promo.trigger !== 'login') continue;

    const progress = getUserPromoProgress(user.userId, promo.id);
    const result = evaluatePromo(promo, updatedUser, progress, { hour, minute, timeMin, dateStr, tz });

    if (result.eligible) {
      addFreeSpins(user.userId, promo.rewardSpins, promo.id, result.rewardKey);
      results.push({
        promoId   : promo.id,
        promoName : promo.name,
        spins     : promo.rewardSpins,
        reason    : result.reason,
        rewardKey : result.rewardKey,
      });
    }
  }

  return results;
}

function evaluatePromo(promo, user, progress, ctx) {
  const { hour, timeMin, dateStr, tz } = ctx;

  // ── Condição: horário específico ──────────────────────────
  if (promo.conditionType === 'time_window') {
    const [sh, sm] = (promo.timeStart || '18:00').split(':').map(Number);
    const [eh, em] = (promo.timeEnd   || '19:00').split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;

    if (!inWindow(timeMin, startMin, endMin)) {
      return { eligible: false, reason: `hora ${String(hour).padStart(2,'0')}h fora da janela ${promo.timeStart}–${promo.timeEnd}` };
    }

    // 1x por dia por padrão
    const rewardKey = `${dateStr}`;
    if (progress.rewarded.includes(rewardKey)) {
      return { eligible: false, reason: `já bonificado hoje` };
    }
    return { eligible: true, reason: `login no horário ${promo.timeStart}–${promo.timeEnd}`, rewardKey };
  }

  // ── Condição: quantidade de logins no período ─────────────
  if (promo.conditionType === 'login_count') {
    const period   = promo.period || 'week'; // day | week | month
    const required = promo.loginRequired || 3;

    // Chave do período atual
    let periodKey;
    if (period === 'day')   periodKey = dateStr;
    if (period === 'week')  periodKey = `W${getWeekNumber(dateStr)}-${dateStr.split('/')[2]}`;
    if (period === 'month') periodKey = `${dateStr.split('/')[1]}/${dateStr.split('/')[2]}`;

    const rewardKey = `${periodKey}`;
    if (progress.rewarded.includes(rewardKey)) {
      return { eligible: false, reason: `recompensa já concedida neste período` };
    }

    // Conta logins no período
    const loginDates = user.loginDates || [];
    let count = 0;
    for (const d of loginDates) {
      let dk;
      if (period === 'day')   dk = d;
      if (period === 'week')  dk = `W${getWeekNumber(d)}-${d.split('/')[2]}`;
      if (period === 'month') dk = `${d.split('/')[1]}/${d.split('/')[2]}`;
      if (dk === periodKey) count++;
    }
    // Inclui o login atual
    if (!loginDates.includes(dateStr)) count++;

    if (count < required) {
      return { eligible: false, reason: `${count}/${required} logins neste período` };
    }
    return { eligible: true, reason: `${count} logins em ${period === 'week' ? 'semana' : period === 'month' ? 'mês' : 'dia'}`, rewardKey };
  }

  // ── Condição: logins consecutivos ────────────────────────
  if (promo.conditionType === 'consecutive') {
    const required = promo.loginRequired || 7;
    const consecutive = user.consecutiveLogins || 1;
    const rewardKey = `consec-${dateStr}`;

    if (progress.rewarded.includes(rewardKey)) {
      return { eligible: false, reason: `já bonificado hoje` };
    }
    if (consecutive < required) {
      return { eligible: false, reason: `${consecutive}/${required} dias consecutivos` };
    }
    return { eligible: true, reason: `${consecutive} dias consecutivos`, rewardKey };
  }

  return { eligible: false, reason: 'tipo de condição desconhecido' };
}

module.exports = { processLoginEvent };

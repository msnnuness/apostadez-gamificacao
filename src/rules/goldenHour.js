const { getConfig } = require('../database');

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

// Suporta janelas que cruzam meia-noite (ex: 23:00–00:00)
function inWindow(timeMin, startMin, endMin) {
  if (startMin <= endMin) return timeMin >= startMin && timeMin < endMin;
  return timeMin >= startMin || timeMin < endMin;
}

const goldenHourRule = {
  name : 'Login horário dourado',
  event: 'user.login',

  check(payload, user) {
    const cfg = getConfig();
    if (!cfg.active) return { eligible: false, reason: 'regra desativada' };

    const tz = (cfg.useUserTz && (payload.data?.tracking?.deviceInfo?.timezone || payload.data?.metadata?.timezone)) || cfg.defaultTz;
    const h  = getLocalHour(payload.timestamp, tz);
    const m  = getLocalMinute(payload.timestamp, tz);

    const [sh, sm] = cfg.windowStart.split(':').map(Number);
    const [eh, em] = cfg.windowEnd.split(':').map(Number);

    const timeMin  = h * 60 + m;
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;

    if (!inWindow(timeMin, startMin, endMin)) {
      return { eligible: false, reason: `hora local ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} — fora da janela ${cfg.windowStart}–${cfg.windowEnd}` };
    }

    const bonusDate = getLocalDateStr(payload.timestamp, tz);
    if (cfg.frequency === 'daily' && user?.loginBonuses?.includes(bonusDate)) {
      return { eligible: false, reason: `bônus já concedido hoje (${bonusDate})` };
    }

    return { eligible: true, bonusDate, hour: h, timezone: tz };
  },

  get points() { return getConfig().points; },
};

module.exports = { goldenHourRule };

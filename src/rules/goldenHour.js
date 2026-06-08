/**
 * Regras de gamificação da ApostaDez
 * Adicione novas regras aqui — cada regra exporta um objeto com:
 *   name, event, check(payload, user), points, reason
 */

// ── Regra 1: Login no horário dourado (18h–19h) ───────────────
const GOLDEN_HOUR_START = 18;
const GOLDEN_HOUR_END   = 19;
const GOLDEN_HOUR_PTS   = 100;

function getLocalHour(isoTimestamp, timezone) {
  try {
    const date = new Date(isoTimestamp);
    const str  = date.toLocaleString('pt-BR', {
      timeZone : timezone || 'America/Sao_Paulo',
      hour     : '2-digit',
      hour12   : false,
    });
    return parseInt(str, 10);
  } catch {
    // Fallback: UTC-3
    const date = new Date(isoTimestamp);
    return (date.getUTCHours() - 3 + 24) % 24;
  }
}

function getLocalDateStr(isoTimestamp, timezone) {
  try {
    const date = new Date(isoTimestamp);
    return date.toLocaleDateString('pt-BR', {
      timeZone : timezone || 'America/Sao_Paulo',
      year     : 'numeric',
      month    : '2-digit',
      day      : '2-digit',
    });
  } catch {
    return new Date(isoTimestamp).toISOString().split('T')[0];
  }
}

const goldenHourRule = {
  name  : 'Login horário dourado',
  event : 'user.login',

  /**
   * @param {object} payload  — payload completo do webhook
   * @param {object|null} user — registro do usuário no banco (pode ser null)
   * @returns {{ eligible: boolean, reason: string, bonusDate?: string }}
   */
  check(payload, user) {
    const timestamp = payload.timestamp;
    const timezone  = payload.data?.tracking?.deviceInfo?.timezone
                   || payload.data?.metadata?.timezone
                   || 'America/Sao_Paulo';

    const hour      = getLocalHour(timestamp, timezone);
    const bonusDate = getLocalDateStr(timestamp, timezone);

    // Fora da janela?
    if (hour < GOLDEN_HOUR_START || hour >= GOLDEN_HOUR_END) {
      return {
        eligible : false,
        reason   : `hora local ${hour}h — fora da janela ${GOLDEN_HOUR_START}h–${GOLDEN_HOUR_END}h`,
      };
    }

    // Já recebeu bônus hoje?
    if (user?.loginBonuses?.includes(bonusDate)) {
      return {
        eligible : false,
        reason   : `bônus já concedido hoje (${bonusDate})`,
      };
    }

    return { eligible: true, bonusDate, hour, timezone };
  },

  points: GOLDEN_HOUR_PTS,
};

// ── Exporta todas as regras ───────────────────────────────────
module.exports = { goldenHourRule };

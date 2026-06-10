const express = require('express');
const router  = express.Router();
const { ensureUser, getUser, logEvent } = require('../database');
const { processLoginEvent } = require('../rules/promoEngine');

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'payload inválido';
  if (!payload.event)     return 'campo "event" ausente';
  if (!payload.timestamp) return 'campo "timestamp" ausente';
  if (!payload.data)      return 'campo "data" ausente';
  return null;
}

router.post('/login', (req, res) => {
  const payload = req.body;
  const err = validatePayload(payload);
  if (err) return res.status(400).json({ ok: false, error: err });
  if (payload.event !== 'user.login') return res.json({ ok: true, processed: false, reason: `evento "${payload.event}" sem regra ativa` });

  const userId   = payload.data?.userId || payload.data?.user_id || payload.data?.id;
  const email    = payload.data?.email    || null;
  const fullName = payload.data?.fullName || null;
  const env      = payload.metadata?.environment || 'unknown';

  if (!userId) {
    console.warn('[WEBHOOK] userId ausente — campos em data:', Object.keys(payload.data || {}));
    return res.status(400).json({ ok: false, error: 'data.userId ausente', camposRecebidos: Object.keys(payload.data || {}) });
  }

  console.log(`[WEBHOOK] user.login | userId: ${userId} | env: ${env}`);
  ensureUser(userId, { email, fullName });
  const user = getUser(userId);

  // Processa todas as promos ativas
  const rewards = processLoginEvent(payload, user);

  const tz = payload.data?.tracking?.deviceInfo?.timezone || payload.data?.metadata?.timezone || 'America/Sao_Paulo';
  const localHour = parseInt(new Date(payload.timestamp).toLocaleString('pt-BR', { timeZone: tz, hour: '2-digit', hour12: false }), 10);

  if (rewards.length > 0) {
    const totalSpins = rewards.reduce((s, r) => s + r.spins, 0);
    console.log(`[PROMO] ${rewards.length} promo(s) concedida(s) → ${totalSpins} free spins para ${userId}`);
    rewards.forEach(r => {
      logEvent({ event: 'user.login', userId, email, fullName, timestamp: payload.timestamp, result: 'bonus', promoId: r.promoId, promoName: r.promoName, points: r.spins, freeSpins: r.spins, localHour, timezone: tz, environment: env });
    });
    return res.json({ ok: true, processed: true, bonus: true, userId, email, fullName, rewards, totalSpins });
  } else {
    const reason = rewards.length === 0 ? 'nenhuma promo ativa aplicável' : 'condições não atendidas';
    console.log(`[PROMO] Sem recompensa para ${userId}`);
    logEvent({ event: 'user.login', userId, email, fullName, timestamp: payload.timestamp, result: 'skip', localHour, timezone: tz, environment: env, reason });
    return res.json({ ok: true, processed: true, bonus: false, userId, reason });
  }
});

router.post('/', (req, res) => {
  if (req.body?.event === 'user.login') return router.handle({ ...req, url: '/login' }, res, () => {});
  res.json({ ok: true, processed: false, reason: 'sem regra para este evento' });
});

module.exports = router;

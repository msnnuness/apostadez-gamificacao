const express = require('express');
const router  = express.Router();
const { ensureUser, getUser, logEvent, recordDeposit } = require('../database');
const { processLoginEvent, processDepositEvent } = require('../rules/promoEngine');

function validate(payload) {
  if (!payload || typeof payload !== 'object') return 'payload invalido';
  if (!payload.event)     return 'campo event ausente';
  if (!payload.timestamp) return 'campo timestamp ausente';
  if (!payload.data)      return 'campo data ausente';
  return null;
}

function getTz(payload) {
  return payload.data?.tracking?.deviceInfo?.timezone
      || payload.data?.metadata?.timezone
      || 'America/Sao_Paulo';
}

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const payload = req.body;
  const err = validate(payload);
  if (err) return res.status(400).json({ ok: false, error: err });
  if (payload.event !== 'user.login')
    return res.json({ ok: true, processed: false, reason: `evento "${payload.event}" sem regra` });

  const userId   = payload.data?.userId || payload.data?.user_id || payload.data?.id;
  const email    = payload.data?.email    || null;
  const fullName = payload.data?.fullName || null;
  const env      = payload.metadata?.environment || 'unknown';

  if (!userId) {
    console.warn('[WEBHOOK] userId ausente. Campos:', Object.keys(payload.data || {}));
    return res.status(400).json({ ok: false, error: 'data.userId ausente', campos: Object.keys(payload.data || {}) });
  }

  console.log(`[WEBHOOK] user.login | ${userId} | env:${env}`);
  ensureUser(userId, { email, fullName });
  const user    = getUser(userId);
  const rewards = processLoginEvent(payload, user);
  const tz      = getTz(payload);
  const localHour = parseInt(new Date(payload.timestamp).toLocaleString('pt-BR', { timeZone: tz, hour: '2-digit', hour12: false }), 10);

  if (rewards.length > 0) {
    const totalSpins = rewards.reduce((s,r) => s + r.spins, 0);
    rewards.forEach(r => logEvent({ event: 'user.login', userId, email, fullName, timestamp: payload.timestamp, result: 'bonus', promoId: r.promoId, promoName: r.promoName, points: r.spins, freeSpins: r.spins, localHour, timezone: tz, environment: env }));
    return res.json({ ok: true, processed: true, bonus: true, userId, rewards, totalSpins });
  }
  logEvent({ event: 'user.login', userId, email, fullName, timestamp: payload.timestamp, result: 'skip', localHour, timezone: tz, environment: env, reason: 'nenhuma promo aplicavel' });
  return res.json({ ok: true, processed: true, bonus: false, userId, reason: 'nenhuma promo aplicavel' });
});

// ── DEPÓSITO ──────────────────────────────────────────────────
router.post('/deposit', (req, res) => {
  const payload = req.body;
  const err = validate(payload);
  if (err) return res.status(400).json({ ok: false, error: err });
  if (payload.event !== 'payment.deposit.completed')
    return res.json({ ok: true, processed: false, reason: `evento "${payload.event}" sem regra` });

  const userId        = payload.data?.userId || payload.data?.user_id;
  const email         = payload.data?.email    || null;
  const fullName      = payload.data?.fullName || null;
  const amount        = parseFloat(payload.data?.amount) || 0;
  const transactionId = payload.data?.transactionId || null;
  const env           = payload.metadata?.environment || 'unknown';

  if (!userId) return res.status(400).json({ ok: false, error: 'data.userId ausente' });
  if (payload.data?.status !== 'completed') return res.json({ ok: true, processed: false, reason: `status ${payload.data?.status} ignorado` });

  console.log(`[WEBHOOK] deposit | ${userId} | R$${amount} | txId:${transactionId}`);
  ensureUser(userId, { email, fullName });

  // Registra depósito (com deduplicação)
  const { duplicate, user } = recordDeposit(userId, amount, transactionId);
  if (duplicate) {
    console.log(`[WEBHOOK] deposito duplicado ignorado: ${transactionId}`);
    return res.json({ ok: true, processed: false, reason: 'transacao duplicada' });
  }

  const rewards = processDepositEvent(payload, user);

  if (rewards.length > 0) {
    const totalSpins = rewards.reduce((s,r) => s + r.spins, 0);
    rewards.forEach(r => logEvent({ event: 'payment.deposit.completed', userId, email, fullName, amount, transactionId, timestamp: payload.timestamp, result: 'bonus', promoId: r.promoId, promoName: r.promoName, points: r.spins, freeSpins: r.spins, environment: env }));
    return res.json({ ok: true, processed: true, bonus: true, userId, rewards, totalSpins });
  }
  logEvent({ event: 'payment.deposit.completed', userId, email, fullName, amount, transactionId, timestamp: payload.timestamp, result: 'skip', environment: env, reason: 'nenhuma promo aplicavel' });
  return res.json({ ok: true, processed: true, bonus: false, userId, reason: 'nenhuma promo aplicavel' });
});

// Rota genérica
router.post('/', (req, res) => {
  const event = req.body?.event;
  if (event === 'user.login') { req.url = '/login'; return router.handle(req, res, () => {}); }
  if (event === 'payment.deposit.completed') { req.url = '/deposit'; return router.handle(req, res, () => {}); }
  res.json({ ok: true, processed: false, reason: `evento "${event}" sem regra` });
});

module.exports = router;

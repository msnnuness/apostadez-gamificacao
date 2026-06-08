const express = require('express');
const router  = express.Router();
const { ensureUser, addPoints, getUser, logEvent } = require('../database');
const { goldenHourRule } = require('../rules/goldenHour');

// ── Validação básica do payload ───────────────────────────────
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'payload inválido';
  if (!payload.event)     return 'campo "event" ausente';
  if (!payload.timestamp) return 'campo "timestamp" ausente';
  if (!payload.data)      return 'campo "data" ausente';
  return null; // ok
}

// ── POST /webhook/login ───────────────────────────────────────
router.post('/login', (req, res) => {
  const payload = req.body;

  // 1. Validação
  const validationError = validatePayload(payload);
  if (validationError) {
    console.warn('[WEBHOOK] Payload inválido:', validationError);
    return res.status(400).json({ ok: false, error: validationError });
  }

  // 2. Só processa user.login
  if (payload.event !== 'user.login') {
    console.log(`[WEBHOOK] Evento "${payload.event}" ignorado (sem regra ativa)`);
    return res.json({ ok: true, processed: false, reason: `evento "${payload.event}" sem regra ativa` });
  }

  // 3. Extrai dados do usuário — tenta todos os campos possíveis
  const userId   = payload.data?.userId
                || payload.data?.user_id
                || payload.data?.id
                || payload.data?._id
                || payload.data?.playerId
                || payload.userId
                || null;
  const email    = payload.data?.email    || null;
  const fullName = payload.data?.fullName || payload.data?.name || payload.data?.username || null;
  const env      = payload.metadata?.environment || payload.data?.environment || 'unknown';
  const requestId= payload.metadata?.requestId   || null;

  if (!userId) {
    // Loga o payload completo para diagnóstico
    console.warn('[WEBHOOK] userId ausente — campos disponíveis em data:', Object.keys(payload.data || {}));
    console.warn('[WEBHOOK] payload completo:', JSON.stringify(payload).substring(0, 500));
    // Aceita mesmo assim usando requestId como fallback temporário
    const fallbackId = requestId || `unknown_${Date.now()}`;
    console.warn(`[WEBHOOK] usando fallback id: ${fallbackId}`);
    return res.status(400).json({
      ok: false,
      error: 'data.userId ausente no payload',
      camposRecebidos: Object.keys(payload.data || {}),
      sugestao: 'adicione data.userId ao payload do webhook'
    });
  }

  console.log(`[WEBHOOK] user.login recebido | userId: ${userId} | env: ${env}`);

  // 4. Garante que o usuário existe no banco
  ensureUser(userId, { email, fullName });
  const user = getUser(userId);

  // 5. Aplica regra do horário dourado
  const check = goldenHourRule.check(payload, user);

  const eventLog = {
    event     : payload.event,
    userId,
    email,
    fullName,
    timestamp : payload.timestamp,
    requestId,
    environment: env,
    rule      : goldenHourRule.name,
  };

  if (!check.eligible) {
    // Fora da janela ou já bonificado hoje
    console.log(`[REGRA] Não elegível — ${check.reason}`);
    logEvent({ ...eventLog, result: 'skip', reason: check.reason });

    return res.json({
      ok        : true,
      processed : true,
      bonus     : false,
      userId,
      reason    : check.reason,
    });
  }

  // 6. Atribui pontos + free spins
  const updated = addPoints(userId, goldenHourRule.points, { bonusDate: check.bonusDate });
  console.log(`[REGRA] ✅ Bônus concedido! userId: ${userId} | +${goldenHourRule.points} pts | hora: ${check.hour}h ${check.timezone}`);

  logEvent({
    ...eventLog,
    result    : 'bonus',
    points    : goldenHourRule.points,
    freeSpins : goldenHourRule.points,
    bonusDate : check.bonusDate,
    localHour : check.hour,
    timezone  : check.timezone,
  });

  return res.json({
    ok        : true,
    processed : true,
    bonus     : true,
    userId,
    email,
    fullName,
    points    : goldenHourRule.points,
    freeSpins : goldenHourRule.points,
    totalPoints    : updated.points,
    totalFreeSpins : updated.freeSpins,
    message   : `+${goldenHourRule.points} pontos e ${goldenHourRule.points} free spins concedidos!`,
  });
});

// ── POST /webhook (aceita qualquer evento — rota genérica) ────
router.post('/', (req, res) => {
  // Redireciona para /login se for user.login
  if (req.body?.event === 'user.login') {
    req.url = '/login';
    return router.handle(req, res, () => {});
  }
  console.log('[WEBHOOK] Evento recebido em /webhook:', req.body?.event);
  res.json({ ok: true, processed: false, reason: 'sem regra para este evento' });
});

module.exports = router;

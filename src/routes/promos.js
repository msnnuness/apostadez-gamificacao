const express = require('express');
const router  = express.Router();
const { getPromos, savePromo, deletePromo } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (_req, res) => res.json({ ok: true, promos: getPromos() }));

router.post('/', (req, res) => {
  const { name, description, active, trigger, conditionType, timeStart, timeEnd,
    loginRequired, period, rewardSpins, startDate, endDate } = req.body;
  if (!name || !conditionType || !rewardSpins)
    return res.status(400).json({ ok: false, error: 'name, conditionType e rewardSpins são obrigatórios' });
  const promo = {
    id: uuidv4(), name, description: description||'',
    active: active !== false, trigger: trigger||'login',
    conditionType, timeStart: timeStart||'18:00', timeEnd: timeEnd||'19:00',
    loginRequired: parseInt(loginRequired)||3, period: period||'week',
    rewardSpins: parseInt(rewardSpins)||10,
    startDate: startDate||null, endDate: endDate||null,
    createdAt: new Date().toISOString(),
  };
  savePromo(promo);
  console.log('[PROMO] Criada:', promo.name);
  res.json({ ok: true, promo });
});

router.put('/:id', (req, res) => {
  const promos = getPromos();
  const existing = promos.find(p => p.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'promo não encontrada' });
  const updated = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  savePromo(updated);
  res.json({ ok: true, promo: updated });
});

router.delete('/:id', (req, res) => {
  deletePromo(req.params.id);
  res.json({ ok: true });
});

module.exports = router;

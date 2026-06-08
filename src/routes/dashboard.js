const express = require('express');
const router  = express.Router();
const { getAllUsers, getUser, getEvents, getStats } = require('../database');

// GET /dashboard/stats
router.get('/stats', (_req, res) => {
  res.json(getStats());
});

// GET /dashboard/users
router.get('/users', (_req, res) => {
  const users = getAllUsers();
  res.json({ total: users.length, users });
});

// GET /dashboard/users/:userId
router.get('/users/:userId', (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'usuário não encontrado' });
  res.json(user);
});

// GET /dashboard/events?limit=50
router.get('/events', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const events = getEvents(limit);
  res.json({ total: events.length, events });
});

module.exports = router;

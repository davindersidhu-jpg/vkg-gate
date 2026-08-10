const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const sites = await db.all('SELECT * FROM sites ORDER BY name');
  res.render('sites', { title: 'Sites', sites, error: null });
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, location } = req.body;
  if (!name) {
    const sites = await db.all('SELECT * FROM sites ORDER BY name');
    return res.status(400).render('sites', { title: 'Sites', sites, error: 'Site name is required.' });
  }
  await db.run('INSERT INTO sites (name, location) VALUES (?, ?)', [name.trim(), location || null]);
  res.redirect('/sites');
});

router.post('/:id/toggle-active', requireAdmin, async (req, res) => {
  const site = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
  if (!site) return res.status(404).render('error', { title: 'Not found', message: 'Site not found.' });
  await db.run('UPDATE sites SET active = ? WHERE id = ?', [site.active ? 0 : 1, site.id]);
  res.redirect('/sites');
});

module.exports = router;

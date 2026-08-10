const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

async function loadUsersAndSites() {
  const users = await db.all(`
    SELECT u.*, s.name AS site_name FROM users u
    LEFT JOIN sites s ON s.id = u.site_id
    ORDER BY u.created_at DESC
  `);
  const sites = await db.all('SELECT * FROM sites WHERE active = 1 ORDER BY name');
  return { users, sites };
}

router.get('/', requireAdmin, async (req, res) => {
  const { users, sites } = await loadUsersAndSites();
  res.render('users', { title: 'Users', users, sites, error: null });
});

router.post('/', requireAdmin, async (req, res) => {
  const { username, password, full_name, role, site_id } = req.body;

  if (!username || !password || !full_name || !role) {
    const { users, sites } = await loadUsersAndSites();
    return res.status(400).render('users', { title: 'Users', users, sites, error: 'All fields are required.' });
  }

  const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    const { users, sites } = await loadUsersAndSites();
    return res.status(400).render('users', { title: 'Users', users, sites, error: 'Username already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  await db.run(`INSERT INTO users (username, password_hash, full_name, role, site_id) VALUES (?, ?, ?, ?, ?)`,
    [username.trim(), hash, full_name.trim(), role, site_id || null]);

  res.redirect('/users');
});

router.post('/:id/toggle-active', requireAdmin, async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).render('error', { title: 'Not found', message: 'User not found.' });
  if (target.id === req.session.user.id) {
    return res.status(400).render('error', { title: 'Not allowed', message: 'You cannot deactivate your own account.' });
  }
  await db.run('UPDATE users SET active = ? WHERE id = ?', [target.active ? 0 : 1, target.id]);
  res.redirect('/users');
});

router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).render('error', { title: 'Weak password', message: 'Password must be at least 6 characters.' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
  res.redirect('/users');
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

async function loadData() {
  const sites = await db.all('SELECT * FROM sites WHERE active = 1 ORDER BY name');
  const wings = await db.all(`
    SELECT w.*, s.name AS site_name FROM wings w
    JOIN sites s ON s.id = w.site_id
    WHERE w.active = 1 ORDER BY s.name, w.name
  `);
  const flats = await db.all(`
    SELECT f.*, w.name AS wing_name, w.site_id, s.name AS site_name,
           u.id AS owner_user_id, u.username AS owner_username, u.active AS owner_active
    FROM flats f
    JOIN wings w ON w.id = f.wing_id
    JOIN sites s ON s.id = w.site_id
    LEFT JOIN users u ON u.flat_id = f.id AND u.role = 'owner'
    WHERE f.active = 1
    ORDER BY s.name, w.name, f.flat_number
  `);
  return { sites, wings, flats };
}

router.get('/', requireAdmin, async (req, res) => {
  const { sites, wings, flats } = await loadData();
  res.render('wings-flats', { title: 'Wings & Flats', sites, wings, flats, error: null });
});

router.post('/wings', requireAdmin, async (req, res) => {
  const { site_id, name } = req.body;
  if (!site_id || !name) {
    const { sites, wings, flats } = await loadData();
    return res.status(400).render('wings-flats', { title: 'Wings & Flats', sites, wings, flats, error: 'Site and wing name are required.' });
  }
  await db.run('INSERT INTO wings (site_id, name) VALUES (?, ?)', [site_id, name.trim()]);
  res.redirect('/wings-flats');
});

router.post('/flats', requireAdmin, async (req, res) => {
  const { wing_id, flat_number, owner_name, owner_phone } = req.body;
  if (!wing_id || !flat_number) {
    const { sites, wings, flats } = await loadData();
    return res.status(400).render('wings-flats', { title: 'Wings & Flats', sites, wings, flats, error: 'Wing and flat number are required.' });
  }
  await db.run(
    'INSERT INTO flats (wing_id, flat_number, owner_name, owner_phone) VALUES (?, ?, ?, ?)',
    [wing_id, flat_number.trim(), owner_name || null, owner_phone || null]
  );
  res.redirect('/wings-flats');
});

// Create a login for a flat's owner (role='owner'), so they can log in and
// approve/reject visitor entries for their own flat.
router.post('/flats/:id/create-login', requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  const flat = await db.get('SELECT * FROM flats WHERE id = ?', [req.params.id]);

  if (!flat) return res.status(404).render('error', { title: 'Not found', message: 'Flat not found.' });

  if (!username || !password || password.length < 6) {
    const { sites, wings, flats } = await loadData();
    return res.status(400).render('wings-flats', {
      title: 'Wings & Flats', sites, wings, flats,
      error: 'Username and a password of at least 6 characters are required to create a login.'
    });
  }

  const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    const { sites, wings, flats } = await loadData();
    return res.status(400).render('wings-flats', { title: 'Wings & Flats', sites, wings, flats, error: 'That username is already taken.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  await db.run(
    'INSERT INTO users (username, password_hash, full_name, role, flat_id) VALUES (?, ?, ?, ?, ?)',
    [username.trim(), hash, flat.owner_name || `Owner - Flat ${flat.flat_number}`, 'owner', flat.id]
  );

  res.redirect('/wings-flats');
});

router.post('/wings/:id/toggle-active', requireAdmin, async (req, res) => {
  const wing = await db.get('SELECT * FROM wings WHERE id = ?', [req.params.id]);
  if (!wing) return res.status(404).render('error', { title: 'Not found', message: 'Wing not found.' });
  await db.run('UPDATE wings SET active = ? WHERE id = ?', [wing.active ? 0 : 1, wing.id]);
  res.redirect('/wings-flats');
});

router.post('/flats/:id/toggle-active', requireAdmin, async (req, res) => {
  const flat = await db.get('SELECT * FROM flats WHERE id = ?', [req.params.id]);
  if (!flat) return res.status(404).render('error', { title: 'Not found', message: 'Flat not found.' });
  await db.run('UPDATE flats SET active = ? WHERE id = ?', [flat.active ? 0 : 1, flat.id]);
  res.redirect('/wings-flats');
});

module.exports = router;

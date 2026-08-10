const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Login', error: null, next: req.query.next || '/' });
});

router.post('/login', async (req, res) => {
  const { username, password, next: nextUrl } = req.body;

  const user = await db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username]);

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).render('login', {
      title: 'Login',
      error: 'Invalid username or password.',
      next: nextUrl || '/'
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    site_id: user.site_id,
    flat_id: user.flat_id
  };

  db.run('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)',
    [user.id, 'login', `User ${user.username} logged in`]).catch(() => {});

  res.redirect(nextUrl && nextUrl !== '' ? nextUrl : '/');
});

router.post('/logout', (req, res) => {
  const user = req.session.user;
  if (user) {
    db.run('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)',
      [user.id, 'logout', `User ${user.username} logged out`]).catch(() => {});
  }
  req.session = null;
  res.redirect('/login');
});

module.exports = router;

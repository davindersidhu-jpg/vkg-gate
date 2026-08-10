const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const user = req.session.user;

  let sql = `
    SELECT e.*, f.flat_number, w.name AS wing_name, s.name AS site_name
    FROM entries e
    JOIN flats f ON f.id = e.flat_id
    JOIN wings w ON w.id = f.wing_id
    JOIN sites s ON s.id = w.site_id
    WHERE e.approval_status IS NOT NULL
  `;
  const params = [];

  if (user.role === 'owner') {
    sql += ' AND f.id = ?';
    params.push(user.flat_id);
  }

  const status = req.query.status || 'pending';
  if (status !== 'all') {
    sql += ' AND e.approval_status = ?';
    params.push(status);
  }

  sql += ' ORDER BY e.in_time DESC LIMIT 100';

  const entries = await db.all(sql, params);

  res.render('approvals', {
    title: 'Approvals',
    entries,
    filterStatus: status
  });
});

router.post('/:id/approve', async (req, res) => {
  const user = req.session.user;
  const entry = await db.get(
    `SELECT e.*, f.id AS flat_id FROM entries e JOIN flats f ON f.id = e.flat_id WHERE e.id = ?`,
    [req.params.id]
  );

  if (!entry) return res.status(404).render('error', { title: 'Not found', message: 'Entry not found.' });
  if (user.role === 'owner' && entry.flat_id !== user.flat_id) {
    return res.status(403).render('error', { title: 'Access denied', message: 'This entry is not for your flat.' });
  }

  await db.run(
    `UPDATE entries SET approval_status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?`,
    [user.id, entry.id]
  );

  db.run('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)',
    [user.id, 'approve_entry', `Approved entry #${entry.id} (${entry.person_name})`]).catch(() => {});

  res.redirect('/approvals');
});

router.post('/:id/reject', async (req, res) => {
  const user = req.session.user;
  const entry = await db.get(
    `SELECT e.*, f.id AS flat_id FROM entries e JOIN flats f ON f.id = e.flat_id WHERE e.id = ?`,
    [req.params.id]
  );

  if (!entry) return res.status(404).render('error', { title: 'Not found', message: 'Entry not found.' });
  if (user.role === 'owner' && entry.flat_id !== user.flat_id) {
    return res.status(403).render('error', { title: 'Access denied', message: 'This entry is not for your flat.' });
  }

  await db.run(
    `UPDATE entries SET approval_status = 'rejected', approved_by = ?, approved_at = datetime('now') WHERE id = ?`,
    [user.id, entry.id]
  );

  db.run('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)',
    [user.id, 'reject_entry', `Rejected entry #${entry.id} (${entry.person_name})`]).catch(() => {});

  res.redirect('/approvals');
});

module.exports = router;

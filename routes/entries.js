const express = require('express');
const db = require('../db');

const router = express.Router();

const STAFF_CATEGORIES = ['Security', 'Housekeeping', 'MST', 'Pantry', 'Other Staff'];
const VISITOR_CATEGORIES = ['Maid', 'Driver', 'Delivery', 'Guest', 'Vendor', 'Other Visitor'];

function getSiteScope(req) {
  const user = req.session.user;
  if (user.role === 'guard') return user.site_id;
  return req.query.site_id ? Number(req.query.site_id) : null;
}

async function loadFlatPickerData(siteId) {
  // All wings + flats, optionally scoped to one site, for the cascading
  // Site -> Wing -> Flat picker in the New Entry modal.
  let sql = `
    SELECT w.id AS wing_id, w.name AS wing_name, w.site_id,
           f.id AS flat_id, f.flat_number, f.owner_name
    FROM wings w
    JOIN flats f ON f.wing_id = w.id
    WHERE w.active = 1 AND f.active = 1
  `;
  const params = [];
  if (siteId) { sql += ' AND w.site_id = ?'; params.push(siteId); }
  sql += ' ORDER BY w.name, f.flat_number';
  return db.all(sql, params);
}

router.get('/', async (req, res) => {
  const user = req.session.user;
  const sites = await db.all('SELECT * FROM sites WHERE active = 1 ORDER BY name');
  const siteId = getSiteScope(req);

  const status = req.query.status || '';
  const entryType = req.query.entry_type || '';
  const q = req.query.q ? `%${req.query.q}%` : null;
  const from = req.query.from || '';
  const to = req.query.to || '';

  let sql = `
    SELECT e.*, s.name AS site_name, f.flat_number, w.name AS wing_name
    FROM entries e
    JOIN sites s ON s.id = e.site_id
    LEFT JOIN flats f ON f.id = e.flat_id
    LEFT JOIN wings w ON w.id = f.wing_id
    WHERE 1=1`;
  const params = [];

  if (siteId) { sql += ' AND e.site_id = ?'; params.push(siteId); }
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  if (entryType) { sql += ' AND e.entry_type = ?'; params.push(entryType); }
  if (q) { sql += ' AND (e.person_name LIKE ? OR e.vehicle_number LIKE ? OR e.host_department LIKE ?)'; params.push(q, q, q); }
  if (from) { sql += ' AND date(e.in_time) >= ?'; params.push(from); }
  if (to) { sql += ' AND date(e.in_time) <= ?'; params.push(to); }

  sql += ' ORDER BY e.in_time DESC LIMIT 200';

  const entries = await db.all(sql, params);
  const flatPickerRows = await loadFlatPickerData(user.role === 'guard' ? user.site_id : siteId);

  res.render('entries', {
    title: 'Entry / Exit Log',
    entries,
    sites,
    selectedSiteId: siteId,
    filters: { status, entry_type: entryType, q: req.query.q || '', from, to },
    STAFF_CATEGORIES,
    VISITOR_CATEGORIES,
    flatPickerRows
  });
});

router.post('/', async (req, res) => {
  const user = req.session.user;
  const {
    site_id, entry_type, category, person_name, phone,
    host_department, flat_id, has_vehicle, vehicle_number, vehicle_type, purpose, notes
  } = req.body;

  const finalSiteId = user.role === 'guard' ? user.site_id : Number(site_id);

  if (!finalSiteId || !entry_type || !category || !person_name) {
    return res.status(400).redirect('/entries?error=missing_fields');
  }

  const hasVehicle = has_vehicle === 'on' || has_vehicle === '1' ? 1 : 0;
  const finalFlatId = flat_id ? Number(flat_id) : null;

  // If this visitor is going to a specific flat that has an active owner
  // login, the entry needs that owner's approval before it's considered
  // approved — status starts "pending" and the owner sees it on /approvals.
  let approvalStatus = null;
  if (finalFlatId) {
    const owner = await db.get(
      `SELECT id FROM users WHERE flat_id = ? AND role = 'owner' AND active = 1`,
      [finalFlatId]
    );
    if (owner) approvalStatus = 'pending';
  }

  const result = await db.run(`
    INSERT INTO entries
      (site_id, entry_type, category, person_name, phone, host_department, flat_id,
       approval_status, has_vehicle, vehicle_number, vehicle_type, purpose, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    finalSiteId, entry_type, category, person_name.trim(), phone || null,
    host_department || null, finalFlatId, approvalStatus, hasVehicle,
    hasVehicle ? (vehicle_number || null) : null,
    hasVehicle ? (vehicle_type || null) : null,
    purpose || null, user.id, notes || null
  ]);

  db.run('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)',
    [user.id, 'check_in', `Checked in ${person_name} (entry #${result.lastInsertRowid})`]).catch(() => {});

  res.redirect('/entries');
});

router.post('/:id/checkout', async (req, res) => {
  const user = req.session.user;
  const entry = await db.get('SELECT * FROM entries WHERE id = ?', [req.params.id]);

  if (!entry) return res.status(404).render('error', { title: 'Not found', message: 'Entry not found.' });
  if (user.role === 'guard' && entry.site_id !== user.site_id) {
    return res.status(403).render('error', { title: 'Access denied', message: 'This entry belongs to another site.' });
  }

  await db.run(`UPDATE entries SET out_time = datetime('now'), status = 'Checked-out' WHERE id = ?`, [entry.id]);

  db.run('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)',
    [user.id, 'check_out', `Checked out ${entry.person_name} (entry #${entry.id})`]).catch(() => {});

  res.redirect(req.headers.referer || '/entries');
});

module.exports = router;

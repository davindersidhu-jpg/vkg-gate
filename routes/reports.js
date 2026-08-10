const express = require('express');
const db = require('../db');

const router = express.Router();

function buildQuery(req) {
  const user = req.session.user;
  const siteId = user.role === 'guard' ? user.site_id : (req.query.site_id ? Number(req.query.site_id) : null);
  const entryType = req.query.entry_type || '';
  const from = req.query.from || '';
  const to = req.query.to || '';

  let sql = `SELECT e.*, s.name AS site_name, u.full_name AS logged_by,
             f.flat_number, w.name AS wing_name
             FROM entries e
             JOIN sites s ON s.id = e.site_id
             LEFT JOIN users u ON u.id = e.created_by
             LEFT JOIN flats f ON f.id = e.flat_id
             LEFT JOIN wings w ON w.id = f.wing_id
             WHERE 1=1`;
  const params = [];

  if (siteId) { sql += ' AND e.site_id = ?'; params.push(siteId); }
  if (entryType) { sql += ' AND e.entry_type = ?'; params.push(entryType); }
  if (from) { sql += ' AND date(e.in_time) >= ?'; params.push(from); }
  if (to) { sql += ' AND date(e.in_time) <= ?'; params.push(to); }

  sql += ' ORDER BY e.in_time DESC';
  return { sql, params, siteId, entryType, from, to };
}

router.get('/', async (req, res) => {
  const sites = await db.all('SELECT * FROM sites WHERE active = 1 ORDER BY name');
  const { sql, params, siteId, entryType, from, to } = buildQuery(req);
  const rows = (await db.all(sql, params)).slice(0, 500);

  res.render('reports', {
    title: 'Reports',
    sites,
    rows,
    filters: { site_id: siteId, entry_type: entryType, from, to }
  });
});

router.get('/export.csv', async (req, res) => {
  const { sql, params } = buildQuery(req);
  const rows = await db.all(sql, params);

  const headers = ['ID', 'Site', 'Type', 'Category', 'Name', 'Phone', 'Host/Flat', 'Approval',
    'Vehicle Number', 'Vehicle Type', 'Purpose', 'In Time', 'Out Time', 'Status', 'Logged By', 'Notes'];

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const lines = [headers.join(',')];
  for (const r of rows) {
    const hostOrFlat = r.flat_number ? `${r.wing_name} - ${r.flat_number}` : (r.host_department || '');
    lines.push([
      r.id, r.site_name, r.entry_type, r.category, r.person_name, r.phone || '',
      hostOrFlat, r.approval_status || '', r.vehicle_number || '', r.vehicle_type || '', r.purpose || '',
      r.in_time, r.out_time || '', r.status, r.logged_by || '', r.notes || ''
    ].map(escape).join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="vkg_gate_report_${Date.now()}.csv"`);
  res.send(lines.join('\n'));
});

module.exports = router;

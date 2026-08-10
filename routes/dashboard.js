const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const user = req.session.user;
  const sites = await db.all('SELECT * FROM sites WHERE active = 1 ORDER BY name');

  let siteId = req.query.site_id ? Number(req.query.site_id) : (user.role === 'guard' ? user.site_id : null);
  if (user.role === 'guard') siteId = user.site_id;

  const siteFilter = siteId ? 'AND site_id = ?' : '';
  const params = siteId ? [siteId] : [];

  const today = new Date().toISOString().slice(0, 10);

  const todayCount = (await db.get(
    `SELECT COUNT(*) AS c FROM entries WHERE date(in_time) = ? ${siteFilter}`, [today, ...params]
  )).c;

  const staffCheckedIn = (await db.get(
    `SELECT COUNT(*) AS c FROM entries WHERE entry_type = 'staff' AND date(in_time) = ? ${siteFilter}`, [today, ...params]
  )).c;

  const vehiclesToday = (await db.get(
    `SELECT COUNT(*) AS c FROM entries WHERE has_vehicle = 1 AND date(in_time) = ? ${siteFilter}`, [today, ...params]
  )).c;

  const currentlyInside = (await db.get(
    `SELECT COUNT(*) AS c FROM entries WHERE status = 'Inside' ${siteFilter}`, params
  )).c;

  const pendingApprovals = (await db.get(
    `SELECT COUNT(*) AS c FROM entries WHERE approval_status = 'pending' ${siteFilter}`, params
  )).c;

  const breakdown = await db.all(
    `SELECT entry_type, COUNT(*) AS c FROM entries WHERE date(in_time) = ? ${siteFilter} GROUP BY entry_type`, [today, ...params]
  );

  const recentEntries = await db.all(
    `SELECT e.*, s.name AS site_name, f.flat_number, w.name AS wing_name
     FROM entries e
     JOIN sites s ON s.id = e.site_id
     LEFT JOIN flats f ON f.id = e.flat_id
     LEFT JOIN wings w ON w.id = f.wing_id
     WHERE 1=1 ${siteFilter}
     ORDER BY e.in_time DESC LIMIT 15`, params
  );

  res.render('dashboard', {
    title: 'Dashboard',
    sites,
    selectedSiteId: siteId,
    stats: { todayCount, staffCheckedIn, vehiclesToday, currentlyInside, pendingApprovals },
    breakdown,
    recentEntries
  });
});

module.exports = router;

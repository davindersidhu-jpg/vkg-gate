// Seeds sites and a default admin user. Safe to re-run.
const bcrypt = require('bcryptjs');
const db = require('../db');

const sites = [
  { name: 'VKG Park Estate', location: 'Chakala, Mumbai' },
  { name: 'Krishna Residences', location: 'Kandivali, Mumbai' },
  { name: 'VKG Business Centre', location: 'Andheri, Mumbai' },
  { name: 'VKG Grandeur', location: 'Goregaon, Mumbai' },
  { name: 'VKG Solitaire', location: 'Thane, Mumbai' }
];

async function main() {
  const { c: siteCount } = await db.get('SELECT COUNT(*) AS c FROM sites');

  if (siteCount === 0) {
    for (const s of sites) {
      await db.run('INSERT INTO sites (name, location) VALUES (?, ?)', [s.name, s.location]);
    }
    console.log(`Seeded ${sites.length} sites.`);
  } else {
    console.log('Sites already exist, skipping.');
  }

  const admin = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);

  if (!admin) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe@123';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    const firstSite = await db.get('SELECT id FROM sites ORDER BY id LIMIT 1');

    await db.run(
      'INSERT INTO users (username, password_hash, full_name, role, site_id) VALUES (?, ?, ?, ?, ?)',
      ['admin', hash, 'Administrator', 'admin', firstSite ? firstSite.id : null]
    );

    console.log('----------------------------------------------------');
    console.log('Default admin created:');
    console.log('  username: admin');
    console.log(`  password: ${defaultPassword}`);
    console.log('CHANGE THIS PASSWORD after first login.');
    console.log('----------------------------------------------------');
  } else {
    console.log('Admin user already exists, skipping.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });

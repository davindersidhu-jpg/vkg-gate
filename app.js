require('dotenv').config();
require('express-async-errors'); // lets async route handlers throw without try/catch

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const { requireAuth, requireAdmin, requireStaff, requireOwnerOrAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const entriesRoutes = require('./routes/entries');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const sitesRoutes = require('./routes/sites');
const wingsFlatsRoutes = require('./routes/wingsFlats');
const approvalsRoutes = require('./routes/approvals');

const app = express();

app.set('view engine', 'ejs');

const viewsPath = process.env.NETLIFY
  ? path.join(process.cwd(), 'views')
  : path.join(__dirname, 'views');

app.set('views', viewsPath);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sessions are stored entirely in a signed cookie (no server-side session
// store) — required on Netlify Functions, which have no persistent disk.
app.use(cookieSession({
  name: 'vkg_session',
  secret: process.env.SESSION_SECRET || 'vkg-gate-dev-secret-change-me',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
}));

// make current user available to all views
app.use((req, res, next) => {
  res.locals.currentUser = (req.session && req.session.user) || null;
  next();
});

app.use('/', authRoutes);

// More specific mounts must be registered before the generic '/' dashboard
// mount below — app.use('/', ...) matches every path as a prefix, so if it
// ran first it would intercept requests meant for /approvals, /entries, etc.
app.use('/entries', requireAuth, requireStaff, entriesRoutes);
app.use('/reports', requireAuth, requireStaff, reportsRoutes);
app.use('/users', requireAuth, requireAdmin, usersRoutes);
app.use('/sites', requireAuth, requireAdmin, sitesRoutes);
app.use('/wings-flats', requireAuth, requireAdmin, wingsFlatsRoutes);
app.use('/approvals', requireAuth, requireOwnerOrAdmin, approvalsRoutes);

// Flat owners land on /approvals instead of the gate-staff dashboard
app.get('/', requireAuth, (req, res, next) => {
  if (req.session.user.role === 'owner') return res.redirect('/approvals');
  next();
});

// Gate staff (admin/guard) dashboard — must come last since it's mounted at '/'
app.use('/', requireAuth, requireStaff, dashboardRoutes);

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not found', message: 'Page not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type('text').send('DEBUG: ' + err.stack);
});

module.exports = app;

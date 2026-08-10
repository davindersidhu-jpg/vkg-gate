function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access denied',
      message: 'Only administrators can access this page.'
    });
  }
  next();
}

// Gate-side pages (Dashboard, Entry log, Reports, Users, Sites) are for
// admin/guard only — flat owners have their own Approvals page instead.
function requireStaff(req, res, next) {
  if (!req.session.user || !['admin', 'guard'].includes(req.session.user.role)) {
    return res.status(403).render('error', {
      title: 'Access denied',
      message: 'This page is for gate staff. Flat owners can use the Approvals page.'
    });
  }
  next();
}

function requireOwnerOrAdmin(req, res, next) {
  if (!req.session.user || !['owner', 'admin'].includes(req.session.user.role)) {
    return res.status(403).render('error', {
      title: 'Access denied',
      message: 'This page is only available to flat owners and administrators.'
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireStaff, requireOwnerOrAdmin };

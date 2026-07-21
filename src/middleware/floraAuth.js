const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Authenticate a caller using their Flora session JWT (issued by the
 * passbook-flora monolith and signed with the shared JWT_SECRET).
 *
 * Populates req.floraUser with { userId, role, fundId, companyId }.
 * Only GP, Founder (portfolio_company), and Admin roles may reach the
 * En Garde integration — matching the sidebar's gpOnly/portfolioOnly/
 * admin-in-GP-view exposure.
 */
const ALLOWED_ROLES = new Set(['gp', 'admin', 'portfolio_company']);

function floraAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing Flora bearer token' });
  }
  if (!config.JWT_SECRET) {
    logger.error('JWT_SECRET not configured — cannot verify Flora sessions');
    return res.status(500).json({ success: false, error: 'Auth not configured' });
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), config.JWT_SECRET);
    const role = String(payload.role || payload.userType || '').toLowerCase();
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ success: false, error: 'Role not permitted for En Garde' });
    }
    req.floraUser = {
      userId: payload.sub || payload.userId || payload.id,
      role,
      // GP/Admin act on a fund; a Founder acts on their company within a fund.
      fundId: payload.fundId || payload.fund_id || null,
      companyId: payload.companyId || payload.company_id || null
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired Flora token' });
  }
}

module.exports = floraAuth;

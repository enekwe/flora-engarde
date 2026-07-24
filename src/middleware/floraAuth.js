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

    // Flora's session JWT is identity-only (id, email, role, permissions) —
    // it never carries fundId/companyId. Flora's own proxy resolves the
    // caller's fund/company server-side (from its database) and forwards it
    // via these headers, authenticated by a shared internal token so a caller
    // hitting this service directly (bypassing Flora's proxy) can't spoof
    // scope. Falls back to JWT claims if a future caller puts them there
    // directly — harmless no-op today, since Flora's JWT never does.
    const internalToken = req.headers['x-flora-internal-token'];
    const trustedInternal = Boolean(config.INTERNAL_SERVICE_TOKEN) && internalToken === config.INTERNAL_SERVICE_TOKEN;

    req.floraUser = {
      userId: payload.sub || payload.userId || payload.id,
      role,
      // GP/Admin act on a fund; a Founder acts on their company within a fund.
      fundId: (trustedInternal && req.headers['x-flora-fund-id']) || payload.fundId || payload.fund_id || null,
      companyId: (trustedInternal && req.headers['x-flora-company-id']) || payload.companyId || payload.company_id || null
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired Flora token' });
  }
}

module.exports = floraAuth;

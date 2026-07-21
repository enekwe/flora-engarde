const logger = require('../config/logger');

/**
 * Audit logging for En Garde actions, mirroring the passbook-flora monolith's
 * logger.auditLog convention and the platform_admin / fund_manager
 * classification (FloraAdminGPRoadmap.md, middleware/auditLogger.js §6.1.3).
 *
 * GP and Founder (portfolio_company) actions on fund-scoped En Garde data are
 * classified `fund_manager`; an admin acting in GP view is `platform_admin`.
 */
function classify(role) {
  if (role === 'admin') return 'platform_admin';
  return 'fund_manager'; // gp, portfolio_company
}

/**
 * @param {string} action   e.g. 'engarde:connect', 'engarde:campaign_create'
 * @param {object} req       Express req (expects req.floraUser)
 * @param {object} [details] extra structured fields
 */
function record(action, req, details = {}) {
  const u = req.floraUser || {};
  logger.info('audit', {
    audit: true,
    action,
    classification: classify(u.role),
    userId: u.userId,
    role: u.role,
    fundId: u.fundId,
    companyId: u.companyId || null,
    ...details
  });
}

module.exports = { record, classify };

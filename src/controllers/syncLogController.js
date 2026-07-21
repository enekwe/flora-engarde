const logger = require('../config/logger');
const syncLogService = require('../services/syncLogService');

/**
 * GET /api/v1/integrations/engarde/sync-log
 *
 * Access model:
 * - admin  -> platform-wide operational sync log (all funds), for
 *             /admin/integrations observability. Operational metadata only.
 * - gp / portfolio_company -> their own fund's entries.
 *
 * Requires floraAuth only (NOT requireFundScope): admins have no fund in scope
 * by design, and are allowed the platform view.
 */
exports.getSyncLog = async (req, res) => {
  const user = req.floraUser || {};
  try {
    const isAdmin = user.role === 'admin';
    if (!isAdmin && !user.fundId) {
      return res.status(400).json({ success: false, error: 'No fund in scope for this user' });
    }
    const result = await syncLogService.list({
      fundId: isAdmin ? null : user.fundId,
      limit: req.query.limit,
      page: req.query.page,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`getSyncLog failed: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Error retrieving En Garde sync log' });
  }
};

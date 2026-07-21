const logger = require('../config/logger');
const EngardeSyncLog = require('../models/EngardeSyncLog');

/**
 * Records operational sync events for the En Garde integration (US-5.1.2).
 * Writes are best-effort: a logging failure must never break the request it
 * is instrumenting.
 *
 * @param {object} args
 * @param {string} args.fundId
 * @param {string} [args.userId]
 * @param {string} args.action  e.g. 'connect', 'token_refresh', 'campaign_create'
 * @param {string} [args.status] 'success' | 'error' | 'info'
 * @param {string} [args.message]
 */
async function record({ fundId, userId, action, status = 'info', message } = {}) {
  if (!fundId || !action) return;
  try {
    await EngardeSyncLog.create({ fundId, userId, action, status, message });
  } catch (err) {
    logger.warn(`Failed to write En Garde sync-log entry (${action}): ${err.message}`);
  }
}

/** Convenience: record from an Express req that carries req.floraUser. */
function recordFromReq(req, action, status, message) {
  const u = req.floraUser || {};
  return record({ fundId: u.fundId, userId: u.userId, action, status, message });
}

/**
 * Read recent sync entries.
 * - fundId set  -> that fund's entries (GP / Founder view)
 * - fundId null -> all funds (admin platform view)
 */
async function list({ fundId = null, limit = 100, page = 1 } = {}) {
  const query = fundId ? { fundId } : {};
  const capped = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * capped;
  const [entries, total] = await Promise.all([
    EngardeSyncLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(capped).lean(),
    EngardeSyncLog.countDocuments(query),
  ]);
  return { entries, total, page: Math.max(parseInt(page, 10) || 1, 1), limit: capped };
}

module.exports = { record, recordFromReq, list };

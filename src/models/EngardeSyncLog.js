const mongoose = require('mongoose');

/**
 * Operational sync/activity log for the En Garde integration (Epoch 5,
 * US-5.1.2). Records connection-lifecycle and data-sync events so admins get
 * platform observability and GPs get per-fund activity history.
 *
 * IMPORTANT: entries hold operational metadata ONLY (action, status, a short
 * message, ids) — never campaign/audience business content — so the admin
 * platform view does not cross the fund-data privacy boundary
 * (FLORA_DEVELOPMENT_RULES.md §6.3 / FloraAdminGPRoadmap.md).
 */
const engardeSyncLogSchema = new mongoose.Schema(
  {
    fundId: { type: String, required: true, index: true },
    userId: { type: String },
    action: { type: String, required: true }, // e.g. 'connect', 'token_refresh', 'campaign_create'
    status: { type: String, enum: ['success', 'error', 'info'], default: 'info', index: true },
    message: { type: String },
    // Self-cleans after 90 days.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90, index: true },
  },
  { versionKey: false }
);

engardeSyncLogSchema.index({ fundId: 1, createdAt: -1 });

module.exports = mongoose.model('EngardeSyncLog', engardeSyncLogSchema);

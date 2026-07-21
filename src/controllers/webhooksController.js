const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');
const syncLog = require('../services/syncLogService');
const analyticsCache = require('../services/analyticsCacheService');

/**
 * POST /api/v1/integrations/engarde/webhooks (US-3.1.5)
 *
 * Ingests push events from En Garde so Flora reflects campaign/analytics
 * changes without polling. Authenticated by an HMAC-SHA256 signature over the
 * raw request body, sent as `X-Engarde-Signature` (hex), keyed by the shared
 * ENGARDE_WEBHOOK_SECRET — timing-safe compared.
 *
 * Expected payload shape: { event: string, fund_id?: string, ...data }.
 * Events invalidate the fund's analytics cache and are recorded to the sync
 * log (operational metadata only).
 */
exports.handleWebhook = (req, res) => {
  const secret = config.ENGARDE_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('Webhook received but ENGARDE_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ success: false, error: 'Webhook ingestion not configured' });
  }

  const signature = req.get('X-Engarde-Signature') || '';
  const rawBody = req.rawBody;
  if (!rawBody || !signature) {
    return res.status(400).json({ success: false, error: 'Missing body or signature' });
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!valid) {
    logger.warn('Webhook rejected: invalid signature');
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  const { event, fund_id: fundId } = req.body || {};
  if (!event) {
    return res.status(400).json({ success: false, error: 'Missing event type' });
  }

  // Fresh upstream data invalidates cached analytics for the fund (or all
  // funds when the event carries no fund reference).
  analyticsCache.invalidate(fundId);

  syncLog.record({
    fundId: fundId || 'platform',
    action: `webhook:${event}`,
    status: 'info',
    message: `Webhook event received: ${event}`
  });

  logger.info('En Garde webhook processed', { event, fundId: fundId || null });
  return res.json({ success: true, data: { received: true, event } });
};

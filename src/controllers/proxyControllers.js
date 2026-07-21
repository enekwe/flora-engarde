const logger = require('../config/logger');
const api = require('../services/engardeApiClient');
const { getValidAccessToken } = require('../services/connectionService');
const audit = require('../services/auditService');
const syncLog = require('../services/syncLogService');
const analyticsCache = require('../services/analyticsCacheService');

/**
 * Wrap a proxy handler so token resolution + upstream errors are turned into
 * clean JSON responses. `fn` receives (req, res, accessToken).
 */
function proxy(fn) {
  return async (req, res) => {
    let accessToken;
    try {
      accessToken = await getValidAccessToken(req.fundId);
    } catch (err) {
      // NotConnectedError (409) / ReconnectRequiredError (401)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message,
        code: err.code
      });
    }
    try {
      const data = await fn(req, res, accessToken);
      return res.json({ success: true, data });
    } catch (err) {
      logger.warn(`En Garde proxy error on ${req.originalUrl}: ${err.message}`);
      return res.status(err.status || 502).json({ success: false, error: err.message });
    }
  };
}

// ---- Campaigns (campaigns:read / campaigns:write / campaigns:delete) ----
exports.listCampaigns = proxy((req, _res, token) => {
  const { limit, offset, status } = req.query;
  return api.get('/api/v1/campaigns', token, { limit, offset, status });
});
exports.getCampaign = proxy((req, _res, token) =>
  api.get(`/api/v1/campaigns/${encodeURIComponent(req.params.id)}`, token));
exports.createCampaign = proxy(async (req, _res, token) => {
  const result = await api.post('/api/v1/campaigns', token, req.body);
  audit.record('engarde:campaign_create', req, { campaignId: result?.id });
  analyticsCache.invalidate(req.fundId);
  syncLog.recordFromReq(req, 'campaign_create', 'success', `Campaign created${result?.id ? ` (${result.id})` : ''}`);
  return result;
});
exports.updateCampaign = proxy(async (req, _res, token) => {
  const result = await api.patch(`/api/v1/campaigns/${encodeURIComponent(req.params.id)}`, token, req.body);
  audit.record('engarde:campaign_update', req, { campaignId: req.params.id });
  analyticsCache.invalidate(req.fundId);
  syncLog.recordFromReq(req, 'campaign_update', 'success', `Campaign ${req.params.id} updated`);
  return result;
});
exports.deleteCampaign = proxy(async (req, _res, token) => {
  const result = await api.del(`/api/v1/campaigns/${encodeURIComponent(req.params.id)}`, token);
  audit.record('engarde:campaign_delete', req, { campaignId: req.params.id });
  analyticsCache.invalidate(req.fundId);
  syncLog.recordFromReq(req, 'campaign_delete', 'success', `Campaign ${req.params.id} deleted`);
  return result;
});

// ---- Audiences (audiences:read) ----
exports.listAudiences = proxy((req, _res, token) =>
  api.get('/api/v1/audiences', token, req.query));
exports.getAudience = proxy((req, _res, token) =>
  api.get(`/api/v1/audiences/${encodeURIComponent(req.params.id)}`, token));

// ---- Assets (assets:read / assets:write) ----
exports.listAssets = proxy((req, _res, token) =>
  api.get('/api/v1/assets', token, req.query));
exports.getAsset = proxy((req, _res, token) =>
  api.get(`/api/v1/assets/${encodeURIComponent(req.params.id)}`, token));
exports.uploadAsset = proxy(async (req, _res, token) => {
  if (!req.file) {
    const err = new Error('No file provided — send multipart form data with a "file" field');
    err.status = 400;
    throw err;
  }
  const result = await api.postMultipart('/api/v1/assets', token, req.file, {
    name: req.body?.name,
    asset_type: req.body?.asset_type
  });
  audit.record('engarde:asset_upload', req, { assetId: result?.id, filename: req.file.originalname });
  syncLog.recordFromReq(req, 'asset_upload', 'success', `Asset uploaded (${req.file.originalname})`);
  return result;
});

// ---- Analytics (analytics:read) — short-TTL cached per fund (US-3.1.4) ----
exports.getDashboard = proxy(async (req, _res, token) => {
  const cacheKey = `${req.fundId}:dashboard`;
  const cached = analyticsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const data = await api.get('/api/v1/analytics/dashboard', token);
  analyticsCache.set(cacheKey, data);
  return data;
});
exports.getCampaignMetrics = proxy(async (req, _res, token) => {
  const cacheKey = `${req.fundId}:campaign-metrics:${req.params.id}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const data = await api.get(`/api/v1/analytics/campaigns/${encodeURIComponent(req.params.id)}/metrics`, token);
  analyticsCache.set(cacheKey, data);
  return data;
});

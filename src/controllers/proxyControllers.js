const logger = require('../config/logger');
const api = require('../services/engardeApiClient');
const { getValidAccessToken } = require('../services/connectionService');

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
exports.createCampaign = proxy((req, _res, token) =>
  api.post('/api/v1/campaigns', token, req.body));
exports.updateCampaign = proxy((req, _res, token) =>
  api.patch(`/api/v1/campaigns/${encodeURIComponent(req.params.id)}`, token, req.body));
exports.deleteCampaign = proxy((req, _res, token) =>
  api.del(`/api/v1/campaigns/${encodeURIComponent(req.params.id)}`, token));

// ---- Audiences (audiences:read) ----
exports.listAudiences = proxy((req, _res, token) =>
  api.get('/api/v1/audiences', token, req.query));
exports.getAudience = proxy((req, _res, token) =>
  api.get(`/api/v1/audiences/${encodeURIComponent(req.params.id)}`, token));

// ---- Assets (assets:read) ----
exports.listAssets = proxy((req, _res, token) =>
  api.get('/api/v1/assets', token, req.query));
exports.getAsset = proxy((req, _res, token) =>
  api.get(`/api/v1/assets/${encodeURIComponent(req.params.id)}`, token));

// ---- Analytics (analytics:read) ----
exports.getDashboard = proxy((_req, _res, token) =>
  api.get('/api/v1/analytics/dashboard', token));
exports.getCampaignMetrics = proxy((req, _res, token) =>
  api.get(`/api/v1/analytics/campaigns/${encodeURIComponent(req.params.id)}/metrics`, token));

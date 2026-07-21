const express = require('express');
const router = express.Router();
const floraAuth = require('../middleware/floraAuth');
const requireFundScope = require('../middleware/fundScope');
const oauth = require('../controllers/oauthController');
const c = require('../controllers/proxyControllers');
const syncLog = require('../controllers/syncLogController');

/**
 * En Garde integration routes, following FLORA_DEVELOPMENT_RULES.md §7.2
 * route structure (connect / callback / status / disconnect), mounted by
 * index.js at /api/v1/integrations/engarde — matching the Carta/HubSpot
 * reference integrations.
 */

// --- OAuth connection lifecycle ---
router.get('/connect', floraAuth, oauth.initiateConnect);
// Callback is the browser redirect back from En Garde — authenticated by the
// opaque single-use state param, not a Flora bearer token.
router.get('/callback', oauth.handleCallback);
router.get('/status', floraAuth, oauth.getStatus);
router.post('/disconnect', floraAuth, oauth.disconnect);

// Sync/activity log — admin gets the platform-wide view, GP/Founder get their
// own fund's. Has its own access logic (no requireFundScope) so admins, who
// hold no fund in scope, can still read the platform observability view.
router.get('/sync-log', floraAuth, syncLog.getSyncLog);

// --- Resource proxies (all require a Flora session + a fund in scope) ---
router.use(floraAuth, requireFundScope);

// Campaigns
router.get('/campaigns', c.listCampaigns);
router.post('/campaigns', c.createCampaign);
router.get('/campaigns/:id', c.getCampaign);
router.patch('/campaigns/:id', c.updateCampaign);
router.delete('/campaigns/:id', c.deleteCampaign);

// Audiences
router.get('/audiences', c.listAudiences);
router.get('/audiences/:id', c.getAudience);

// Assets
router.get('/assets', c.listAssets);
router.get('/assets/:id', c.getAsset);

// Analytics
router.get('/analytics/dashboard', c.getDashboard);
router.get('/analytics/campaigns/:id/metrics', c.getCampaignMetrics);

module.exports = router;

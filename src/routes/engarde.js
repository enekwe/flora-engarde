const express = require('express');
const router = express.Router();
const floraAuth = require('../middleware/floraAuth');
const requireFundScope = require('../middleware/fundScope');
const c = require('../controllers/proxyControllers');

// All resource proxies require a Flora session and a fund in scope.
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

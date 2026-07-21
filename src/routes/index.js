const express = require('express');
const router = express.Router();
const oauthRoutes = require('./oauth');
const engardeRoutes = require('./engarde');

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'flora-engarde', status: 'ok' });
});

// Epoch 2 — Auth & Identity Bridge (OAuth 2.0 + PKCE against engarde-api).
router.use('/api/v1/engarde/oauth', oauthRoutes);

// Epoch 3 — Backend proxy & tenant-scoped data sync
// (campaigns / audiences / assets / analytics).
router.use('/api/v1/engarde', engardeRoutes);

module.exports = router;

const express = require('express');
const router = express.Router();
const oauthRoutes = require('./oauth');

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'flora-engarde', status: 'ok' });
});

// Epoch 2 — Auth & Identity Bridge (OAuth 2.0 + PKCE against engarde-api).
router.use('/api/v1/engarde/oauth', oauthRoutes);

// Epoch 3+: mount /campaigns, /audiences, /assets, /analytics proxy routers
// here once those controllers land. See Flora_EG_Integration_roadmap.md.

module.exports = router;

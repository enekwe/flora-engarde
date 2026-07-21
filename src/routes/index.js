const express = require('express');
const router = express.Router();
const engardeRoutes = require('./engarde');

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'flora-engarde', status: 'ok' });
});

// En Garde integration — mounted under the standard integrations path
// (FLORA_DEVELOPMENT_RULES.md §7.2), matching Carta/HubSpot:
//   /api/v1/integrations/engarde/{connect,callback,status,disconnect}
//   /api/v1/integrations/engarde/{campaigns,audiences,assets,analytics}
router.use('/api/v1/integrations/engarde', engardeRoutes);

module.exports = router;

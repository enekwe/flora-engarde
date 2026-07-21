const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'flora-engarde', status: 'ok' });
});

// Epoch 2+: mount /oauth, /campaigns, /audiences, /assets, /analytics routers here
// once the OAuth bridge and proxy controllers land. See Flora_EG_Integration_roadmap.md.

module.exports = router;

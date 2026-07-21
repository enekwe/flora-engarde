const express = require('express');
const router = express.Router();
const floraAuth = require('../middleware/floraAuth');
const ctrl = require('../controllers/oauthController');

// Start the connect flow (GP must be authenticated by Flora).
router.get('/authorize/start', floraAuth, ctrl.startAuthorization);

// En Garde redirects the browser here — no Flora bearer token on this hop;
// the request is authenticated by the opaque, single-use state parameter.
router.get('/callback', ctrl.handleCallback);

// Connection introspection + teardown (Flora-authenticated).
router.get('/status', floraAuth, ctrl.getStatus);
router.delete('/connection', floraAuth, ctrl.disconnect);

module.exports = router;

const axios = require('axios');
const config = require('../config');

/**
 * Thin OAuth 2.0 + PKCE client for the En Garde authorization server
 * (EnGardeHQ/engarde-api). Placeholder for Epoch 2 — Auth & Identity Bridge.
 */
class EngardeOAuthClient {
  constructor() {
    this.baseURL = config.ENGARDE_API_URL;
  }

  buildAuthorizationUrl(/* state, codeChallenge */) {
    throw new Error('Not implemented — see Flora_EG_Integration_roadmap.md Epoch 2 (US-2.x)');
  }

  async exchangeCodeForToken(/* code, codeVerifier */) {
    throw new Error('Not implemented — see Flora_EG_Integration_roadmap.md Epoch 2 (US-2.x)');
  }

  async refreshToken(/* refreshToken */) {
    throw new Error('Not implemented — see Flora_EG_Integration_roadmap.md Epoch 2 (US-2.x)');
  }
}

module.exports = new EngardeOAuthClient();

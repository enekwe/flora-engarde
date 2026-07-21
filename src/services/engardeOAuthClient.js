const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');
const { deriveCodeChallenge, CODE_CHALLENGE_METHOD } = require('./pkce');

/**
 * OAuth 2.0 + PKCE client for the En Garde authorization server
 * (EnGardeHQ/engarde-api). Endpoint contract mirrored from that repo's
 * app/api/v1/endpoints/oauth.py:
 *   - GET  /oauth/authorize  (query params, RFC 6749 §4.1 + PKCE)
 *   - POST /oauth/token      (application/x-www-form-urlencoded)
 *   - POST /oauth/revoke     (application/x-www-form-urlencoded, RFC 7009)
 */
class EngardeOAuthClient {
  constructor() {
    this.baseURL = config.ENGARDE_API_URL;
    this.clientId = config.ENGARDE_OAUTH_CLIENT_ID;
    this.clientSecret = config.ENGARDE_OAUTH_CLIENT_SECRET;
    this.redirectUri = config.ENGARDE_OAUTH_REDIRECT_URI;
    this.scopes = config.ENGARDE_OAUTH_SCOPES;
  }

  _assertConfigured() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error(
        'En Garde OAuth client is not configured — set ENGARDE_OAUTH_CLIENT_ID, ' +
        'ENGARDE_OAUTH_CLIENT_SECRET, and ENGARDE_OAUTH_REDIRECT_URI (see docs/ENGARDE_CLIENT_REGISTRATION.md)'
      );
    }
  }

  /**
   * Build the URL the GP's browser is redirected to in order to grant consent.
   * @param {string} state        opaque CSRF token
   * @param {string} codeVerifier PKCE verifier (challenge is derived here)
   */
  buildAuthorizationUrl(state, codeVerifier) {
    this._assertConfigured();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state,
      code_challenge: deriveCodeChallenge(codeVerifier),
      code_challenge_method: CODE_CHALLENGE_METHOD
    });
    return `${this.baseURL}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens (RFC 6749 §4.1.3).
   * Returns { access_token, token_type, expires_in, refresh_token?, scope }.
   */
  async exchangeCodeForToken(code, codeVerifier) {
    this._assertConfigured();
    return this._postToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier
    });
  }

  /**
   * Renew an access token using a refresh token (RFC 6749 §6).
   */
  async refreshAccessToken(refreshToken) {
    this._assertConfigured();
    return this._postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
  }

  /**
   * Revoke an access or refresh token (RFC 7009). Best-effort: the server
   * returns 200 even for unknown tokens, so callers should not depend on
   * the response beyond "no error thrown".
   */
  async revokeToken(token, tokenTypeHint = 'refresh_token') {
    this._assertConfigured();
    const body = new URLSearchParams({
      token,
      token_type_hint: tokenTypeHint,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    await axios.post(`${this.baseURL}/oauth/revoke`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
  }

  async _postToken(fields) {
    const body = new URLSearchParams({
      ...fields,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    try {
      const { data } = await axios.post(`${this.baseURL}/oauth/token`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      });
      return data;
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message;
      logger.error(`En Garde token endpoint error (${fields.grant_type})`, { status, detail });
      const wrapped = new Error(`En Garde token request failed: ${detail}`);
      wrapped.status = status || 502;
      throw wrapped;
    }
  }
}

module.exports = new EngardeOAuthClient();

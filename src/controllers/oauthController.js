const config = require('../config');
const logger = require('../config/logger');
const oauthClient = require('../services/engardeOAuthClient');
const encryption = require('../services/encryptionService');
const { generateState, generateCodeVerifier } = require('../services/pkce');
const EngardeConnection = require('../models/EngardeConnection');
const EngardeOAuthState = require('../models/EngardeOAuthState');

function requireFund(req, res) {
  const fundId = req.floraUser.fundId;
  if (!fundId) {
    res.status(400).json({ success: false, error: 'No fund in scope for this user' });
    return null;
  }
  return fundId;
}

function toConnectionRecord(tokenResponse, { fundId, userId }) {
  const expiresInMs = (Number(tokenResponse.expires_in) || 3600) * 1000;
  const record = {
    fundId,
    connectedByUserId: userId,
    accessToken: encryption.encrypt(tokenResponse.access_token),
    scopes: (tokenResponse.scope || '').split(' ').filter(Boolean),
    tokenType: tokenResponse.token_type || 'Bearer',
    expiresAt: new Date(Date.now() + expiresInMs),
    status: 'active',
    lastRefreshedAt: new Date()
  };
  if (tokenResponse.refresh_token) {
    record.refreshToken = encryption.encrypt(tokenResponse.refresh_token);
  }
  return record;
}

/**
 * GET /oauth/authorize/start
 * Begins the connect flow: mints PKCE + state, persists them, and redirects
 * the GP's browser to En Garde's consent screen.
 */
exports.startAuthorization = async (req, res) => {
  const fundId = requireFund(req, res);
  if (!fundId) return;

  try {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    await EngardeOAuthState.create({
      state,
      codeVerifier,
      fundId,
      userId: req.floraUser.userId
    });
    const url = oauthClient.buildAuthorizationUrl(state, codeVerifier);
    return res.redirect(url);
  } catch (err) {
    logger.error(`startAuthorization failed: ${err.message}`);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

/**
 * GET /oauth/callback
 * En Garde redirects the browser back here with ?code&state. We look up the
 * stored PKCE verifier, exchange the code, persist the encrypted tokens for
 * the fund, and bounce the user back into Flora.
 */
exports.handleCallback = async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const back = (status) => res.redirect(`${config.FLORA_APP_URL}/engarde?connection=${status}`);

  if (oauthError) {
    logger.warn(`En Garde authorization denied: ${oauthError}`);
    return back('denied');
  }
  if (!code || !state) {
    return back('invalid');
  }

  try {
    const stored = await EngardeOAuthState.findOneAndDelete({ state });
    if (!stored) {
      logger.warn('Callback with unknown/expired state');
      return back('expired');
    }

    const tokenResponse = await oauthClient.exchangeCodeForToken(code, stored.codeVerifier);

    await EngardeConnection.findOneAndUpdate(
      { fundId: stored.fundId },
      toConnectionRecord(tokenResponse, { fundId: stored.fundId, userId: stored.userId }),
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info('En Garde connection established', { fundId: stored.fundId });
    return back('success');
  } catch (err) {
    logger.error(`handleCallback failed: ${err.message}`);
    return back('error');
  }
};

/**
 * GET /oauth/status — is this fund connected to En Garde?
 */
exports.getStatus = async (req, res) => {
  const fundId = requireFund(req, res);
  if (!fundId) return;

  const conn = await EngardeConnection.findOne({ fundId });
  if (!conn || conn.status !== 'active') {
    return res.json({ success: true, data: { connected: false } });
  }
  return res.json({
    success: true,
    data: {
      connected: true,
      scopes: conn.scopes,
      expiresAt: conn.expiresAt,
      connectedByUserId: conn.connectedByUserId,
      lastRefreshedAt: conn.lastRefreshedAt
    }
  });
};

/**
 * DELETE /oauth/connection — revoke at En Garde (RFC 7009) and delete locally.
 */
exports.disconnect = async (req, res) => {
  const fundId = requireFund(req, res);
  if (!fundId) return;

  const conn = await EngardeConnection.findOne({ fundId });
  if (!conn) {
    return res.json({ success: true, data: { disconnected: true } });
  }

  try {
    if (conn.refreshToken) {
      await oauthClient.revokeToken(encryption.decrypt(conn.refreshToken), 'refresh_token');
    }
    await oauthClient.revokeToken(encryption.decrypt(conn.accessToken), 'access_token');
  } catch (err) {
    // Revocation is best-effort; we still drop the local record.
    logger.warn(`En Garde revocation returned an error (continuing): ${err.message}`);
  }

  await EngardeConnection.deleteOne({ fundId });
  logger.info('En Garde connection removed', { fundId });
  return res.json({ success: true, data: { disconnected: true } });
};

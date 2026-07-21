const config = require('../config');
const logger = require('../config/logger');
const oauthClient = require('../services/engardeOAuthClient');
const encryption = require('../services/encryptionService');
const { generateState, generateCodeVerifier } = require('../services/pkce');
const EngardeConnection = require('../models/EngardeConnection');
const EngardeOAuthState = require('../models/EngardeOAuthState');
const audit = require('../services/auditService');
const syncLog = require('../services/syncLogService');

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
 * GET /integrations/engarde/connect
 * Begins the connect flow: mints PKCE + state, persists them, and redirects
 * the GP's browser to En Garde's consent screen.
 * (FLORA_DEVELOPMENT_RULES.md §7.2 — integration route: connect)
 */
exports.initiateConnect = async (req, res) => {
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
    audit.record('engarde:connect_initiated', req);
    return res.redirect(url);
  } catch (err) {
    logger.error(`startAuthorization failed: ${err.message}`);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

/**
 * GET /integrations/engarde/callback
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
    // Callback is state-authenticated (no req.floraUser) — synthesize the
    // audit context from the stored flow. Role unknown here → fund_manager.
    audit.record('engarde:connected', { floraUser: { userId: stored.userId, fundId: stored.fundId } });
    syncLog.record({ fundId: stored.fundId, userId: stored.userId, action: 'connect', status: 'success', message: 'En Garde connection established' });
    return back('success');
  } catch (err) {
    logger.error(`handleCallback failed: ${err.message}`);
    return back('error');
  }
};

/**
 * GET /integrations/engarde/status — is this fund connected to En Garde?
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
 * POST /integrations/engarde/disconnect — revoke at En Garde (RFC 7009) and delete locally.
 */
exports.disconnect = async (req, res) => {
  const fundId = requireFund(req, res);
  if (!fundId) return;

  // Token fields are select:false (§7.3.2) — opt in explicitly to revoke them.
  const conn = await EngardeConnection.findOne({ fundId }).select('+accessToken +refreshToken');
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
  audit.record('engarde:disconnect', req, { fundId });
  syncLog.recordFromReq(req, 'disconnect', 'success', 'En Garde connection removed');
  return res.json({ success: true, data: { disconnected: true } });
};

const logger = require('../config/logger');
const encryption = require('./encryptionService');
const oauthClient = require('./engardeOAuthClient');
const EngardeConnection = require('../models/EngardeConnection');

// Refresh a little before actual expiry to avoid racing the clock.
const EXPIRY_BUFFER_MS = 60 * 1000;

class NotConnectedError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
    this.code = 'engarde_not_connected';
  }
}

class ReconnectRequiredError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
    this.code = 'engarde_reconnect_required';
  }
}

/**
 * Resolve a currently-valid En Garde access token for a fund, transparently
 * refreshing it when it is expired/near-expiry. Throws NotConnectedError if
 * the fund has never connected, or ReconnectRequiredError if the token is
 * expired and cannot be refreshed (no/invalid refresh token).
 */
async function getValidAccessToken(fundId) {
  const conn = await EngardeConnection.findOne({ fundId });
  if (!conn || conn.status !== 'active') {
    throw new NotConnectedError('This fund is not connected to En Garde');
  }

  const notExpired = conn.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now();
  if (notExpired) {
    return encryption.decrypt(conn.accessToken);
  }

  if (!conn.refreshToken) {
    conn.status = 'error';
    await conn.save();
    throw new ReconnectRequiredError('En Garde session expired — reconnect required');
  }

  try {
    const refreshed = await oauthClient.refreshAccessToken(encryption.decrypt(conn.refreshToken));
    const expiresInMs = (Number(refreshed.expires_in) || 3600) * 1000;
    conn.accessToken = encryption.encrypt(refreshed.access_token);
    if (refreshed.refresh_token) {
      // En Garde may rotate the refresh token; persist the new one if so.
      conn.refreshToken = encryption.encrypt(refreshed.refresh_token);
    }
    if (refreshed.scope) {
      conn.scopes = refreshed.scope.split(' ').filter(Boolean);
    }
    conn.expiresAt = new Date(Date.now() + expiresInMs);
    conn.lastRefreshedAt = new Date();
    conn.status = 'active';
    await conn.save();
    return refreshed.access_token;
  } catch (err) {
    logger.error(`Token refresh failed for fund ${fundId}: ${err.message}`);
    conn.status = 'error';
    await conn.save();
    throw new ReconnectRequiredError('Could not refresh En Garde session — reconnect required');
  }
}

module.exports = { getValidAccessToken, NotConnectedError, ReconnectRequiredError };

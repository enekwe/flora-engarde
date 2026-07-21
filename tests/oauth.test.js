/**
 * Route + middleware wiring tests for the En Garde OAuth bridge.
 * These exercise the auth-guard and PKCE/crypto paths that do not require a
 * live MongoDB or a real En Garde server.
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENGARDE_OAUTH_CLIENT_ID = 'test-client';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'test-secret';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/engarde/oauth/callback';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const routes = require('../src/routes');
const { generateCodeVerifier, deriveCodeChallenge } = require('../src/services/pkce');
const encryption = require('../src/services/encryptionService');
const oauthClient = require('../src/services/engardeOAuthClient');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', routes);
  return app;
}

const gpToken = (over = {}) =>
  jwt.sign({ sub: 'user-1', role: 'gp', fundId: 'fund-1', ...over }, process.env.JWT_SECRET);

describe('health', () => {
  it('reports ok', async () => {
    const res = await request(makeApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('floraAuth guard', () => {
  const app = makeApp();
  const path = '/api/v1/engarde/oauth/status';

  it('401 without a token', async () => {
    expect((await request(app).get(path)).status).toBe(401);
  });
  it('401 with a malformed token', async () => {
    expect((await request(app).get(path).set('Authorization', 'Bearer nope')).status).toBe(401);
  });
  it('403 for a disallowed role', async () => {
    const t = jwt.sign({ sub: 'u', role: 'lp', fundId: 'f' }, process.env.JWT_SECRET);
    expect((await request(app).get(path).set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
  it('400 for a GP with no fund in scope', async () => {
    const t = jwt.sign({ sub: 'u', role: 'gp' }, process.env.JWT_SECRET);
    expect((await request(app).get(path).set('Authorization', `Bearer ${t}`)).status).toBe(400);
  });
});

describe('PKCE', () => {
  it('derives an S256 challenge matching the verifier', () => {
    const v = generateCodeVerifier();
    const expected = crypto
      .createHash('sha256').update(v).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(deriveCodeChallenge(v)).toBe(expected);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });
});

describe('token vault encryption', () => {
  it('round-trips and never stores plaintext', () => {
    const secret = 'engarde-refresh-token-xyz';
    const box = encryption.encrypt(secret);
    expect(box.ciphertext).not.toContain(secret);
    expect(encryption.decrypt(box)).toBe(secret);
  });
});

describe('authorization URL', () => {
  it('targets /oauth/authorize with PKCE and leaks no secret', () => {
    const url = new URL(oauthClient.buildAuthorizationUrl('state123', generateCodeVerifier()));
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.search).not.toContain('test-secret');
  });
});

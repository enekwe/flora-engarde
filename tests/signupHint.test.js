/**
 * screen_hint=signup passthrough: /connect forwards the hint into the
 * En Garde authorize URL so account-less users land on registration.
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.ENGARDE_OAUTH_CLIENT_ID = 'cid';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'sec';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/integrations/engarde/callback';

jest.mock('../src/models/EngardeOAuthState', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/services/syncLogService', () => ({ list: jest.fn(), record: jest.fn(), recordFromReq: jest.fn() }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const routes = require('../src/routes');
const { buildAuthorizationUrl } = require('../src/services/engardeOAuthClient');

const app = express();
app.use(express.json());
app.use('/', routes);
const gpToken = jwt.sign({ sub: 'u1', role: 'gp', fundId: 'fund-1' }, process.env.JWT_SECRET);

it('forwards screen_hint=signup into the authorize redirect', async () => {
  const res = await request(app)
    .get('/api/v1/integrations/engarde/connect?screen_hint=signup')
    .set('Authorization', `Bearer ${gpToken}`);
  expect(res.status).toBe(302);
  expect(res.headers.location).toContain('/oauth/authorize?');
  expect(res.headers.location).toContain('screen_hint=signup');
});

it('omits screen_hint by default and ignores unknown hints', async () => {
  for (const qs of ['', '?screen_hint=bogus']) {
    const res = await request(app)
      .get(`/api/v1/integrations/engarde/connect${qs}`)
      .set('Authorization', `Bearer ${gpToken}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).not.toContain('screen_hint');
  }
});

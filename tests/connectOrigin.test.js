/**
 * FloraHQ.co support in the connect flow:
 *  - ?format=json returns the authorize URL as JSON (for the SPA's XHR connect)
 *  - a trusted ?return_origin is recorded on the OAuth state (so the callback
 *    returns the user to the domain they started on); untrusted origins are not.
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
const EngardeOAuthState = require('../src/models/EngardeOAuthState');
const createMock = EngardeOAuthState.create;

const app = express();
app.use(express.json());
app.use('/', routes);
const gpToken = jwt.sign({ sub: 'u1', role: 'gp', fundId: 'fund-1' }, process.env.JWT_SECRET);

beforeEach(() => createMock.mockClear());

it('returns the authorize URL as JSON when format=json', async () => {
  const res = await request(app)
    .get('/api/v1/integrations/engarde/connect?format=json&return_origin=https://florahq.co')
    .set('Authorization', `Bearer ${gpToken}`);
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data.url).toContain('/oauth/authorize?');
});

it('records a trusted return_origin on the OAuth state', async () => {
  await request(app)
    .get('/api/v1/integrations/engarde/connect?format=json&return_origin=https://florahq.co')
    .set('Authorization', `Bearer ${gpToken}`);
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ returnOrigin: 'https://florahq.co' })
  );
});

it('ignores an untrusted return_origin', async () => {
  await request(app)
    .get('/api/v1/integrations/engarde/connect?format=json&return_origin=https://evil.example.com')
    .set('Authorization', `Bearer ${gpToken}`);
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ returnOrigin: undefined })
  );
});

it('still 302-redirects a direct browser navigation (no format=json)', async () => {
  const res = await request(app)
    .get('/api/v1/integrations/engarde/connect')
    .set('Authorization', `Bearer ${gpToken}`);
  expect(res.status).toBe(302);
  expect(res.headers.location).toContain('/oauth/authorize?');
});

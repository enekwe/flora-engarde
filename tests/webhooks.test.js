/**
 * Webhook ingestion (US-3.1.5) and analytics caching (US-3.1.4).
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.ENGARDE_OAUTH_CLIENT_ID = 'cid';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'sec';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/integrations/engarde/callback';
process.env.ENGARDE_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.ANALYTICS_CACHE_TTL_SECONDS = '60';

jest.mock('../src/services/syncLogService', () => ({
  list: jest.fn(), record: jest.fn(), recordFromReq: jest.fn(),
}));
jest.mock('../src/services/connectionService', () => {
  const actual = jest.requireActual('../src/services/connectionService');
  return { ...actual, getValidAccessToken: jest.fn().mockResolvedValue('tok') };
});
jest.mock('../src/services/engardeApiClient', () => ({
  get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(),
}));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const syncLogService = require('../src/services/syncLogService');
const api = require('../src/services/engardeApiClient');
const analyticsCache = require('../src/services/analyticsCacheService');
const routes = require('../src/routes');

// Mirror server.js: capture raw body for HMAC verification.
const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use('/', routes);

const PATH = '/api/v1/integrations/engarde/webhooks';
const sign = (body) =>
  crypto.createHmac('sha256', process.env.ENGARDE_WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex');

beforeEach(() => {
  jest.clearAllMocks();
  analyticsCache.invalidate();
});

describe('webhook ingestion', () => {
  it('accepts a correctly signed event and records it', async () => {
    const body = { event: 'campaign.updated', fund_id: 'fund-1' };
    const res = await request(app).post(PATH)
      .set('X-Engarde-Signature', sign(body))
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(syncLogService.record).toHaveBeenCalledWith(expect.objectContaining({
      fundId: 'fund-1', action: 'webhook:campaign.updated',
    }));
  });

  it('rejects a bad signature', async () => {
    const body = { event: 'campaign.updated' };
    const res = await request(app).post(PATH)
      .set('X-Engarde-Signature', 'deadbeef')
      .send(body);
    expect(res.status).toBe(401);
    expect(syncLogService.record).not.toHaveBeenCalled();
  });

  it('rejects a missing signature', async () => {
    expect((await request(app).post(PATH).send({ event: 'x' })).status).toBe(400);
  });

  it('invalidates the fund analytics cache on events', async () => {
    analyticsCache.set('fund-1:dashboard', { cached: true });
    const body = { event: 'analytics.updated', fund_id: 'fund-1' };
    await request(app).post(PATH).set('X-Engarde-Signature', sign(body)).send(body);
    expect(analyticsCache.get('fund-1:dashboard')).toBeUndefined();
  });
});

describe('analytics caching', () => {
  const gpToken = jwt.sign({ sub: 'u1', role: 'gp', fundId: 'fund-1' }, process.env.JWT_SECRET);
  const DASH = '/api/v1/integrations/engarde/analytics/dashboard';

  it('serves the second dashboard request from cache', async () => {
    api.get.mockResolvedValue({ total_campaigns: 5 });
    const first = await request(app).get(DASH).set('Authorization', `Bearer ${gpToken}`);
    const second = await request(app).get(DASH).set('Authorization', `Bearer ${gpToken}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.total_campaigns).toBe(5);
    expect(api.get).toHaveBeenCalledTimes(1); // second hit came from cache
  });
});

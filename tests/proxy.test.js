/**
 * Epoch 3 proxy layer: auth/fund-scope guards, not-connected handling,
 * a mocked happy-path proxy, and connectionService auto-refresh logic.
 * No live MongoDB or En Garde server required — the data-access seams
 * (connectionService, engardeApiClient) are mocked.
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.ENGARDE_OAUTH_CLIENT_ID = 'cid';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'sec';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/engarde/oauth/callback';

jest.mock('../src/services/connectionService', () => {
  const actual = jest.requireActual('../src/services/connectionService');
  return { ...actual, getValidAccessToken: jest.fn() };
});
jest.mock('../src/services/engardeApiClient', () => ({
  get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const connectionService = require('../src/services/connectionService');
const api = require('../src/services/engardeApiClient');
const routes = require('../src/routes');

const app = express();
app.use(express.json());
app.use('/', routes);

const gp = (over = {}) => jwt.sign({ sub: 'u1', role: 'gp', fundId: 'fund-1', ...over }, process.env.JWT_SECRET);
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => jest.clearAllMocks());

describe('proxy auth & fund scope', () => {
  it('401 without a Flora token', async () => {
    expect((await request(app).get('/api/v1/engarde/campaigns')).status).toBe(401);
  });
  it('400 when the GP has no fund in scope', async () => {
    const res = await request(app).get('/api/v1/engarde/campaigns').set(auth(gp({ fundId: undefined })));
    expect(res.status).toBe(400);
  });
});

describe('not-connected handling', () => {
  it('surfaces 409 when the fund has no En Garde connection', async () => {
    connectionService.getValidAccessToken.mockRejectedValue(
      new connectionService.NotConnectedError('This fund is not connected to En Garde')
    );
    const res = await request(app).get('/api/v1/engarde/campaigns').set(auth(gp()));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('engarde_not_connected');
  });
});

describe('happy-path proxy', () => {
  it('lists campaigns with the fund token and forwards query params', async () => {
    connectionService.getValidAccessToken.mockResolvedValue('access-abc');
    api.get.mockResolvedValue({ campaigns: [{ id: 'c1' }], total: 1 });

    const res = await request(app)
      .get('/api/v1/engarde/campaigns?limit=10&status=active')
      .set(auth(gp()));

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    // fund token resolved from the caller's own fund, not a request param
    expect(connectionService.getValidAccessToken).toHaveBeenCalledWith('fund-1');
    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/campaigns',
      'access-abc',
      expect.objectContaining({ limit: '10', status: 'active' })
    );
  });

  it('maps an upstream error status through', async () => {
    connectionService.getValidAccessToken.mockResolvedValue('access-abc');
    const boom = new Error('rate limited'); boom.status = 429;
    api.get.mockRejectedValue(boom);
    const res = await request(app).get('/api/v1/engarde/audiences').set(auth(gp()));
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });
});

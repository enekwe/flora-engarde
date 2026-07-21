/**
 * Sync-log endpoint access model (Epoch 5, US-5.1.2):
 * - admin -> platform-wide (all funds)
 * - gp / founder -> own fund only
 * - fundless gp -> 400
 * The syncLogService.list seam is mocked (no live DB).
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.ENGARDE_OAUTH_CLIENT_ID = 'cid';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'sec';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/integrations/engarde/callback';

jest.mock('../src/services/syncLogService', () => ({
  list: jest.fn().mockResolvedValue({ entries: [], total: 0, page: 1, limit: 100 }),
  record: jest.fn(),
  recordFromReq: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const syncLogService = require('../src/services/syncLogService');
const routes = require('../src/routes');

const app = express();
app.use(express.json());
app.use('/', routes);

const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const PATH = '/api/v1/integrations/engarde/sync-log';

beforeEach(() => jest.clearAllMocks());

it('401s without a token', async () => {
  expect((await request(app).get(PATH)).status).toBe(401);
});

it('gp gets their own fund scope', async () => {
  const t = token({ sub: 'u', role: 'gp', fundId: 'fund-1' });
  const res = await request(app).get(PATH).set('Authorization', `Bearer ${t}`);
  expect(res.status).toBe(200);
  expect(syncLogService.list).toHaveBeenCalledWith(expect.objectContaining({ fundId: 'fund-1' }));
});

it('admin gets the platform-wide view (fundId null)', async () => {
  const t = token({ sub: 'admin', role: 'admin' });
  const res = await request(app).get(PATH).set('Authorization', `Bearer ${t}`);
  expect(res.status).toBe(200);
  expect(syncLogService.list).toHaveBeenCalledWith(expect.objectContaining({ fundId: null }));
});

it('400s a gp with no fund in scope', async () => {
  const t = token({ sub: 'u', role: 'gp' });
  const res = await request(app).get(PATH).set('Authorization', `Bearer ${t}`);
  expect(res.status).toBe(400);
  expect(syncLogService.list).not.toHaveBeenCalled();
});

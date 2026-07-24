/**
 * Flora's session JWT is identity-only (no fundId/companyId claim). Flora's
 * own proxy resolves the caller's fund/company server-side and forwards it
 * via X-Flora-Fund-Id / X-Flora-Company-Id, authenticated by
 * X-Flora-Internal-Token so an untrusted direct caller can't spoof scope.
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.ENGARDE_OAUTH_CLIENT_ID = 'cid';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'sec';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/integrations/engarde/callback';
process.env.INTERNAL_SERVICE_TOKEN = 'shared-internal-secret';

jest.mock('../src/models/EngardeConnection', () => ({ findOne: jest.fn().mockResolvedValue(null) }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const routes = require('../src/routes');
const EngardeConnection = require('../src/models/EngardeConnection');

const app = express();
app.use(express.json());
app.use('/', routes);
const path = '/api/v1/integrations/engarde/status';

// No fundId claim at all — matches Flora's real (identity-only) JWT shape.
const gpTokenNoFund = jwt.sign({ sub: 'u1', role: 'gp' }, process.env.JWT_SECRET);

beforeEach(() => EngardeConnection.findOne.mockClear());

it('still 400s a GP with no fund claim and no trusted headers', async () => {
  const res = await request(app).get(path).set('Authorization', `Bearer ${gpTokenNoFund}`);
  expect(res.status).toBe(400);
});

it('ignores fund headers without the matching internal token', async () => {
  const res = await request(app)
    .get(path)
    .set('Authorization', `Bearer ${gpTokenNoFund}`)
    .set('X-Flora-Fund-Id', 'fund-42');
  expect(res.status).toBe(400);
});

it('resolves fund scope from trusted headers when the internal token matches', async () => {
  const res = await request(app)
    .get(path)
    .set('Authorization', `Bearer ${gpTokenNoFund}`)
    .set('X-Flora-Fund-Id', 'fund-42')
    .set('X-Flora-Internal-Token', 'shared-internal-secret');
  expect(res.status).toBe(200);
  expect(EngardeConnection.findOne).toHaveBeenCalledWith({ fundId: 'fund-42' });
});

it('rejects a wrong internal token even with fund headers present', async () => {
  const res = await request(app)
    .get(path)
    .set('Authorization', `Bearer ${gpTokenNoFund}`)
    .set('X-Flora-Fund-Id', 'fund-42')
    .set('X-Flora-Internal-Token', 'not-the-secret');
  expect(res.status).toBe(400);
});

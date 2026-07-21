/**
 * Audit classification (Epoch 6, US-6.1.3) and founder company scoping
 * (US-6.1.2).
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.ENGARDE_OAUTH_CLIENT_ID = 'cid';
process.env.ENGARDE_OAUTH_CLIENT_SECRET = 'sec';
process.env.ENGARDE_OAUTH_REDIRECT_URI = 'https://flora.passbook.vc/api/v1/integrations/engarde/callback';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const audit = require('../src/services/auditService');
const logger = require('../src/config/logger');
const floraAuth = require('../src/middleware/floraAuth');
const requireFundScope = require('../src/middleware/fundScope');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe('audit classification', () => {
  it('classifies gp and founder as fund_manager, admin as platform_admin', () => {
    expect(audit.classify('gp')).toBe('fund_manager');
    expect(audit.classify('portfolio_company')).toBe('fund_manager');
    expect(audit.classify('admin')).toBe('platform_admin');
  });

  it('record() emits a structured audit log with the caller context', () => {
    const spy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    const req = { floraUser: { userId: 'u9', role: 'gp', fundId: 'f1' } };
    audit.record('engarde:connect_initiated', req, { extra: 1 });
    expect(spy).toHaveBeenCalledWith('audit', expect.objectContaining({
      audit: true,
      action: 'engarde:connect_initiated',
      classification: 'fund_manager',
      userId: 'u9',
      fundId: 'f1',
      extra: 1,
    }));
    spy.mockRestore();
  });
});

describe('founder (portfolio_company) fund + company scoping', () => {
  const app = express();
  app.use('/t', floraAuth, requireFundScope, (req, res) =>
    res.json({ fundId: req.fundId, companyId: req.companyId }));

  it('400s a founder with a fund but no company', async () => {
    const t = sign({ sub: 'u', role: 'portfolio_company', fundId: 'f1' });
    const res = await request(app).get('/t').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(400);
  });

  it('pins a founder to their fund and company', async () => {
    const t = sign({ sub: 'u', role: 'portfolio_company', fundId: 'f1', companyId: 'c1' });
    const res = await request(app).get('/t').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ fundId: 'f1', companyId: 'c1' });
  });
});

/**
 * connectionService token resolution + auto-refresh, with the Mongoose model
 * and OAuth client mocked (no live DB / server).
 */
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');

jest.mock('../src/models/EngardeConnection');
jest.mock('../src/services/engardeOAuthClient', () => ({ refreshAccessToken: jest.fn() }));

const EngardeConnection = require('../src/models/EngardeConnection');
const oauthClient = require('../src/services/engardeOAuthClient');
const encryption = require('../src/services/encryptionService');
const { getValidAccessToken, NotConnectedError, ReconnectRequiredError } =
  require('../src/services/connectionService');

function fakeConn(overrides = {}) {
  return {
    fundId: 'fund-1',
    status: 'active',
    accessToken: encryption.encrypt('current-token'),
    refreshToken: encryption.encrypt('refresh-token'),
    expiresAt: new Date(Date.now() + 3600 * 1000),
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

beforeEach(() => jest.clearAllMocks());

test('returns the stored token when it is still valid', async () => {
  EngardeConnection.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeConn()) });
  await expect(getValidAccessToken('fund-1')).resolves.toBe('current-token');
  expect(oauthClient.refreshAccessToken).not.toHaveBeenCalled();
});

test('throws NotConnected when there is no active connection', async () => {
  EngardeConnection.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
  await expect(getValidAccessToken('fund-1')).rejects.toBeInstanceOf(NotConnectedError);
});

test('refreshes an expired token and persists the new one', async () => {
  const conn = fakeConn({ expiresAt: new Date(Date.now() - 1000) });
  EngardeConnection.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(conn) });
  oauthClient.refreshAccessToken.mockResolvedValue({
    access_token: 'new-token', expires_in: 3600, scope: 'campaigns:read'
  });

  await expect(getValidAccessToken('fund-1')).resolves.toBe('new-token');
  expect(oauthClient.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
  expect(conn.save).toHaveBeenCalled();
  expect(encryption.decrypt(conn.accessToken)).toBe('new-token');
  expect(conn.status).toBe('active');
});

test('expired with no refresh token requires reconnect', async () => {
  const conn = fakeConn({ expiresAt: new Date(Date.now() - 1000), refreshToken: undefined });
  EngardeConnection.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(conn) });
  await expect(getValidAccessToken('fund-1')).rejects.toBeInstanceOf(ReconnectRequiredError);
  expect(conn.status).toBe('error');
});

test('a failed refresh marks the connection errored and requires reconnect', async () => {
  const conn = fakeConn({ expiresAt: new Date(Date.now() - 1000) });
  EngardeConnection.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(conn) });
  oauthClient.refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));
  await expect(getValidAccessToken('fund-1')).rejects.toBeInstanceOf(ReconnectRequiredError);
  expect(conn.status).toBe('error');
  expect(conn.save).toHaveBeenCalled();
});

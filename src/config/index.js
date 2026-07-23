if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// In production, Railway MUST inject PORT - fail explicitly if it doesn't
const getPort = () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.PORT) {
      throw new Error('PORT environment variable is required in production but was not provided by Railway');
    }
    return parseInt(process.env.PORT, 10);
  }
  return parseInt(process.env.PORT || '4010', 10);
};

// offline_access is required for engarde-api to issue a refresh token
// (see engarde-api oauth.py: refresh token only issued when scope includes it)
const DEFAULT_SCOPES = 'campaigns:read campaigns:write analytics:read audiences:read assets:read assets:write offline_access';

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: getPort(),
  SERVICE_NAME: process.env.SERVICE_NAME || 'flora-engarde',

  MONGODB_URI: process.env.MONGODB_URI,

  ENGARDE_API_URL: process.env.ENGARDE_API_URL || 'https://oauth.engardehq.com',
  ENGARDE_OAUTH_CLIENT_ID: process.env.ENGARDE_OAUTH_CLIENT_ID,
  ENGARDE_OAUTH_CLIENT_SECRET: process.env.ENGARDE_OAUTH_CLIENT_SECRET,
  ENGARDE_OAUTH_REDIRECT_URI: process.env.ENGARDE_OAUTH_REDIRECT_URI,
  ENGARDE_OAUTH_SCOPES: (process.env.ENGARDE_OAUTH_SCOPES || DEFAULT_SCOPES).split(' ').filter(Boolean),

  // Flora session JWT (issued by the passbook-flora monolith) — used to
  // authenticate GP/Founder/Admin callers to this microservice.
  JWT_SECRET: process.env.JWT_SECRET,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,

  // Webhook ingestion (US-3.1.5): HMAC-SHA256 shared secret for X-Engarde-Signature
  ENGARDE_WEBHOOK_SECRET: process.env.ENGARDE_WEBHOOK_SECRET,

  // Analytics cache TTL (US-3.1.4)
  ANALYTICS_CACHE_TTL_SECONDS: process.env.ANALYTICS_CACHE_TTL_SECONDS || '60',

  // AES-256-GCM key (64 hex chars = 32 bytes) for the per-fund token vault
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // Where to send the GP's browser back to in Flora after the OAuth round-trip
  // Fallback return domain when the connect flow didn't record a trusted origin.
  FLORA_APP_URL: process.env.FLORA_APP_URL || 'https://flora.passbook.vc',

  // Flora is reachable at both flora.passbook.vc and the FloraHQ.co top-level
  // domain; all are trusted origins for CORS and the post-OAuth return redirect.
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'https://flora.passbook.vc',
        'https://florahq.co',
        'https://www.florahq.co',
        'https://app.florahq.co',
      ]
};

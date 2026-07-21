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

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: getPort(),
  SERVICE_NAME: process.env.SERVICE_NAME || 'flora-engarde',

  MONGODB_URI: process.env.MONGODB_URI,

  ENGARDE_API_URL: process.env.ENGARDE_API_URL || 'https://api.engarde.com',
  ENGARDE_OAUTH_CLIENT_ID: process.env.ENGARDE_OAUTH_CLIENT_ID,
  ENGARDE_OAUTH_CLIENT_SECRET: process.env.ENGARDE_OAUTH_CLIENT_SECRET,
  ENGARDE_OAUTH_REDIRECT_URI: process.env.ENGARDE_OAUTH_REDIRECT_URI,
  ENGARDE_OAUTH_SCOPES: (process.env.ENGARDE_OAUTH_SCOPES || 'campaigns:read analytics:read audiences:read assets:read').split(' '),

  JWT_SECRET: process.env.JWT_SECRET,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,

  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://flora.passbook.vc']
};

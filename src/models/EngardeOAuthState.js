const mongoose = require('mongoose');

/**
 * Short-lived binding between an in-flight OAuth authorization request and
 * the Flora user/fund that started it. The PKCE code_verifier lives here
 * (never sent to the browser) and is consumed on callback. TTL-expired
 * after 10 minutes so abandoned flows self-clean.
 */
const engardeOAuthStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true, index: true },
    codeVerifier: { type: String, required: true },
    fundId: { type: String, required: true },
    userId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 } // 10 min TTL
  },
  { versionKey: false }
);

module.exports = mongoose.model('EngardeOAuthState', engardeOAuthStateSchema);

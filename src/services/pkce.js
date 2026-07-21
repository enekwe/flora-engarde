const crypto = require('crypto');

/**
 * PKCE (RFC 7636) + OAuth state helpers.
 * engarde-api enforces PKCE (require_pkce defaults to true) and only
 * accepts the S256 challenge method in practice, so we always use S256.
 */

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// RFC 7636 §4.1 — verifier is 43-128 chars of unreserved characters.
function generateCodeVerifier() {
  return base64url(crypto.randomBytes(32));
}

// RFC 7636 §4.2 — S256 challenge = BASE64URL(SHA256(verifier)).
function deriveCodeChallenge(codeVerifier) {
  return base64url(crypto.createHash('sha256').update(codeVerifier).digest());
}

// Opaque, unguessable CSRF/state token tying the callback to the initiating request.
function generateState() {
  return base64url(crypto.randomBytes(24));
}

module.exports = {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  CODE_CHALLENGE_METHOD: 'S256'
};

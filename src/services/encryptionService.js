/**
 * AES-256-GCM encryption for the En Garde OAuth token vault.
 * Mirrors flora-mercury-service's encryptionService so the platform has one
 * consistent at-rest encryption convention across microservices.
 */
const crypto = require('crypto');
const logger = require('../config/logger');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = this._getEncryptionKey();
  }

  _getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY is required in production for the En Garde token vault');
      }
      logger.warn('ENCRYPTION_KEY not set — using an ephemeral dev key (tokens will not survive restart)');
      return crypto.randomBytes(32);
    }
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256-GCM');
    }
    return key;
  }

  encrypt(plaintext) {
    const iv = crypto.randomBytes(12); // 96-bit nonce, recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
  }

  decrypt({ ciphertext, iv, authTag }) {
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = new EncryptionService();

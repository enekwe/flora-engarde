const mongoose = require('mongoose');

/**
 * A GP fund's connection to En Garde. One row per fund (US-2.1.3).
 * Tokens are stored AES-256-GCM encrypted (never plaintext) via
 * encryptionService — this schema only holds the ciphertext envelope.
 */
const encryptedFieldSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  { _id: false }
);

const engardeConnectionSchema = new mongoose.Schema(
  {
    // Flora fund this En Garde workspace is bound to. Unique — one connection per fund.
    fundId: { type: String, required: true, unique: true, index: true },

    // Flora user who authorized the connection (audit).
    connectedByUserId: { type: String, required: true },

    accessToken: { type: encryptedFieldSchema, required: true },
    refreshToken: { type: encryptedFieldSchema, required: false },

    scopes: { type: [String], default: [] },
    tokenType: { type: String, default: 'Bearer' },
    expiresAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ['active', 'revoked', 'error'],
      default: 'active',
      index: true
    },
    lastRefreshedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngardeConnection', engardeConnectionSchema);

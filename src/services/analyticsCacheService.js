const config = require('../config');

/**
 * Short-TTL in-memory cache for En Garde analytics responses (US-3.1.4), so
 * Flora dashboard views don't hammer En Garde's API on every page load.
 * Per-fund keys; invalidated on campaign writes and webhook events.
 *
 * In-memory is intentional: entries are tiny, per-instance staleness is
 * bounded by the TTL, and this service runs as a single Railway instance.
 */
const store = new Map();

function ttlMs() {
  return (parseInt(config.ANALYTICS_CACHE_TTL_SECONDS, 10) || 60) * 1000;
}

function get(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function set(key, value) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs() });
}

/** Drop all cached analytics for a fund (or everything when no fund given). */
function invalidate(fundId) {
  if (!fundId) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(`${fundId}:`)) store.delete(key);
  }
}

module.exports = { get, set, invalidate };

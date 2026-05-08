// utils/cache.js
// Simple in-memory TTL cache for API responses.
// Reduces redundant upstream requests for frequently-accessed data.

const store = new Map();

// Default TTLs (milliseconds)
export const TTL = {
  HOME:    5  * 60 * 1000,  // 5 min  – home/index pages change often
  LIST:    10 * 60 * 1000,  // 10 min – genre/category/browse/azlist
  ANIME:   30 * 60 * 1000,  // 30 min – anime detail pages
  EPISODE: 60 * 60 * 1000,  // 60 min – episode data is very stable
  SEARCH:  2  * 60 * 1000,  // 2 min  – search results change quickly
  NAV:     60 * 60 * 1000,  // 60 min – nav menus rarely change
};

/**
 * Get a cached value.
 * Returns the stored value or undefined if missing / expired.
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Store a value in the cache.
 * @param {string} key
 * @param {*}      value
 * @param {number} ttl   – milliseconds until expiry (use TTL.* constants)
 */
export function cacheSet(key, value, ttl) {
  store.set(key, { value, expiresAt: Date.now() + ttl });
}

/**
 * Delete a specific cache entry.
 */
export function cacheDel(key) {
  store.delete(key);
}

/**
 * Remove all expired entries.
 * Called automatically on every write; safe to call manually.
 */
export function cachePrune() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

/**
 * Convenience: return cached result or call fn(), cache it, then return it.
 *
 * @param {string}   key
 * @param {number}   ttl
 * @param {Function} fn  – async function that returns the fresh data
 */
export async function withCache(key, ttl, fn) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cacheSet(key, value, ttl);
  cachePrune();            // opportunistic cleanup
  return value;
}

/**
 * Return cache stats (useful for a /cache/stats debug endpoint).
 */
export function cacheStats() {
  const now = Date.now();
  let active = 0, expired = 0;
  for (const entry of store.values()) {
    now > entry.expiresAt ? expired++ : active++;
  }
  return { total: store.size, active, expired };
}

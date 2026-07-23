interface RateLimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitStore>();

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Basic sliding window Rate Limiting utility to prevent bot spam and DB flooding.
 * @param identifier Client IP address or request fingerprint
 * @param limit Maximum allowed requests per window (default: 5)
 * @param windowMs Time window duration in milliseconds (default: 60000ms / 1 min)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    store.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);
    return {
      success: false,
      limit,
      remaining: 0,
      resetSeconds: Math.max(resetSeconds, 1),
    };
  }

  record.count += 1;
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000);
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    resetSeconds: Math.max(resetSeconds, 1),
  };
}

/**
 * Periodically purge stale records to avoid memory leaks.
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  }, 300000); // Purge every 5 minutes
}

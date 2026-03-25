const windowStore = new Map();

function cleanupExpired(nowMs) {
  for (const [key, entry] of windowStore.entries()) {
    if (entry.resetAt <= nowMs) {
      windowStore.delete(key);
    }
  }
}

export function resolveRateLimitClientId(request, fallback = 'unknown') {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip') || '';
  if (realIp.trim()) return realIp.trim();
  return fallback;
}

export function takeRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  cleanupExpired(now);

  const current = windowStore.get(key);
  if (!current || current.resetAt <= now) {
    windowStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
      retryAfterSec: 0,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  windowStore.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSec: 0,
  };
}

export function applyRateLimitHeaders(response, limiterResult) {
  response.headers.set('X-RateLimit-Remaining', String(limiterResult.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(limiterResult.resetAt / 1000)));
  if (!limiterResult.allowed) {
    response.headers.set('Retry-After', String(limiterResult.retryAfterSec));
  }
  return response;
}


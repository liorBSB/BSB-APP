const completedStore = new Map();
const inFlightStore = new Map();

function now() {
  return Date.now();
}

function cleanupExpired(targetStore) {
  const current = now();
  for (const [key, value] of targetStore.entries()) {
    if (value.expiresAt <= current) {
      targetStore.delete(key);
    }
  }
}

function scopeKey(scope, key) {
  return `${scope}::${key}`;
}

export function readIdempotencyKey(request) {
  const raw = request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
  const normalized = String(raw || '').trim();
  return normalized || null;
}

export function getIdempotentResult(scope, key) {
  cleanupExpired(completedStore);
  const entry = completedStore.get(scopeKey(scope, key));
  if (!entry) return null;
  return {
    status: entry.status,
    body: entry.body,
  };
}

export function getInFlightPromise(scope, key) {
  cleanupExpired(inFlightStore);
  const entry = inFlightStore.get(scopeKey(scope, key));
  return entry?.promise || null;
}

export function setInFlightPromise(scope, key, promise, ttlMs = 30000) {
  inFlightStore.set(scopeKey(scope, key), {
    promise,
    expiresAt: now() + ttlMs,
  });
}

export function clearInFlightPromise(scope, key) {
  inFlightStore.delete(scopeKey(scope, key));
}

export function storeIdempotentResult(scope, key, status, body, ttlMs = 5 * 60 * 1000) {
  cleanupExpired(completedStore);
  completedStore.set(scopeKey(scope, key), {
    status: Number(status || 200),
    body,
    expiresAt: now() + ttlMs,
  });
}

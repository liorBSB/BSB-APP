const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_BASE_MS = 250;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSyncRequestId(prefix = 'sync') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getSyncConfig() {
  return {
    timeoutMs: parsePositiveInt(process.env.SHEETS_FETCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retries: parsePositiveInt(process.env.SHEETS_FETCH_RETRIES, DEFAULT_RETRY_COUNT),
    retryBaseMs: parsePositiveInt(process.env.SHEETS_FETCH_RETRY_BASE_MS, DEFAULT_RETRY_BASE_MS),
    enableRetries: process.env.SHEETS_FETCH_RETRIES_ENABLED !== 'false',
    enableReceptionDirectUpdate:
      process.env.SHEETS_RECEPTION_DIRECT_ROOM_UPDATE_ENABLED === 'true',
    receptionRoomCacheTtlMs: parsePositiveInt(
      process.env.SHEETS_RECEPTION_ROOM_CACHE_TTL_MS,
      60 * 1000,
    ),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoffMs(baseMs, attempt) {
  const expo = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * Math.max(50, Math.floor(baseMs / 2)));
  return expo + jitter;
}

function isSafeRetryMethod(method) {
  const upper = String(method || 'GET').toUpperCase();
  return upper === 'GET' || upper === 'HEAD';
}

function isRetryableStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(Number(status));
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

export class SheetsBridgeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SheetsBridgeError';
    this.code = details.code || 'SHEETS_BRIDGE_ERROR';
    this.retryable = Boolean(details.retryable);
    this.status = Number(details.status || 500);
    this.upstreamStatus = details.upstreamStatus || null;
    this.durationMs = Number(details.durationMs || 0);
    this.attempt = Number(details.attempt || 0);
    this.requestId = details.requestId || '';
    this.operation = details.operation || '';
    this.cause = details.cause;
  }
}

export function toBridgeError(error, fallback = {}) {
  if (error instanceof SheetsBridgeError) return error;
  return new SheetsBridgeError(error?.message || fallback.message || 'Sheets bridge failed', {
    code: fallback.code || 'SHEETS_BRIDGE_UNEXPECTED',
    retryable: fallback.retryable ?? false,
    status: fallback.status || 500,
    durationMs: fallback.durationMs || 0,
    requestId: fallback.requestId || '',
    operation: fallback.operation || '',
    cause: error,
  });
}

export function toErrorPayload(error, fallbackMessage = 'Sheets bridge failed') {
  const bridgeError = toBridgeError(error, { message: fallbackMessage });
  return {
    code: bridgeError.code,
    message: bridgeError.message || fallbackMessage,
    retryable: bridgeError.retryable,
    durationMs: bridgeError.durationMs,
    upstreamStatus: bridgeError.upstreamStatus,
    requestId: bridgeError.requestId || undefined,
    operation: bridgeError.operation || undefined,
  };
}

export function logSyncStep({ requestId, route, step, status = 'ok', details = {} }) {
  const payload = {
    requestId,
    route,
    step,
    status,
    ...details,
  };
  if (status === 'error') {
    console.error(`[sync:${route}]`, payload);
    return;
  }
  console.log(`[sync:${route}]`, payload);
}

export async function fetchWithPolicy(url, options = {}, policy = {}) {
  const startedAt = Date.now();
  const method = String(options.method || 'GET').toUpperCase();
  const timeoutMs = Number(policy.timeoutMs || getSyncConfig().timeoutMs);
  const retries = Number(policy.retries ?? getSyncConfig().retries);
  const retryBaseMs = Number(policy.retryBaseMs ?? getSyncConfig().retryBaseMs);
  const requestId = policy.requestId || '';
  const operation = policy.operation || 'sheets-fetch';
  const allowWriteRetries = Boolean(policy.allowWriteRetries);
  const retriesEnabled = policy.enableRetries ?? getSyncConfig().enableRetries;
  const maxAttempts = retriesEnabled ? Math.max(0, retries) + 1 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStarted = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const durationMs = Date.now() - attemptStarted;
        const retryable =
          isRetryableStatus(response.status)
          && (isSafeRetryMethod(method) || allowWriteRetries);
        if (retryable && attempt < maxAttempts) {
          await sleep(jitteredBackoffMs(retryBaseMs, attempt - 1));
          continue;
        }
        throw new SheetsBridgeError(
          `${operation} failed: HTTP ${response.status}`,
          {
            code: response.status >= 500 ? 'UPSTREAM_5XX' : 'UPSTREAM_4XX',
            retryable,
            status: 502,
            upstreamStatus: response.status,
            durationMs: Date.now() - startedAt,
            attempt,
            requestId,
            operation,
          },
        );
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      if (error instanceof SheetsBridgeError) {
        if (error.retryable && attempt < maxAttempts) {
          await sleep(jitteredBackoffMs(retryBaseMs, attempt - 1));
          continue;
        }
        throw error;
      }
      if (isAbortError(error)) {
        const timeoutError = new SheetsBridgeError(
          `${operation} timed out after ${timeoutMs}ms`,
          {
            code: 'UPSTREAM_TIMEOUT',
            retryable: isSafeRetryMethod(method) || allowWriteRetries,
            status: 504,
            durationMs,
            attempt,
            requestId,
            operation,
            cause: error,
          },
        );
        if (timeoutError.retryable && attempt < maxAttempts) {
          await sleep(jitteredBackoffMs(retryBaseMs, attempt - 1));
          continue;
        }
        throw timeoutError;
      }
      const retryable = isSafeRetryMethod(method) || allowWriteRetries;
      if (retryable && attempt < maxAttempts) {
        await sleep(jitteredBackoffMs(retryBaseMs, attempt - 1));
        continue;
      }
      throw toBridgeError(error, {
        code: 'UPSTREAM_NETWORK',
        retryable,
        status: 502,
        durationMs,
        requestId,
        operation,
      });
    }
  }

  throw new SheetsBridgeError(`${operation} failed after retries`, {
    code: 'UPSTREAM_RETRY_EXHAUSTED',
    retryable: false,
    status: 502,
    durationMs: Date.now() - startedAt,
    requestId,
    operation,
  });
}

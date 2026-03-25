import crypto from 'node:crypto';

const replayStore = new Map();
const SIGNED_WINDOW_SEC = 300;

function cleanupReplayStore(nowMs) {
  for (const [key, expiresAt] of replayStore.entries()) {
    if (expiresAt <= nowMs) replayStore.delete(key);
  }
}

function buildUnauthorized(error = 'Unauthorized') {
  return { ok: false, status: 401, error };
}

function verifySignature(secret, payload, givenSignature) {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(String(givenSignature || ''));
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

function parseTimestamp(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
}

export function verifyStatusWebhookAuth(request, rawBody, secret) {
  if (!secret) return buildUnauthorized();

  const legacySecret = request.headers.get('x-webhook-secret');
  const signature = request.headers.get('x-webhook-signature');
  const timestampHeader = request.headers.get('x-webhook-timestamp');
  const nonce = request.headers.get('x-webhook-nonce') || '';

  if (signature || timestampHeader || nonce) {
    const timestampSec = parseTimestamp(timestampHeader);
    if (!timestampSec) return buildUnauthorized('Invalid timestamp');

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestampSec) > SIGNED_WINDOW_SEC) {
      return buildUnauthorized('Stale timestamp');
    }

    const signedPayload = `${timestampSec}.${nonce}.${rawBody}`;
    if (!verifySignature(secret, signedPayload, signature)) {
      return buildUnauthorized();
    }

    const nowMs = Date.now();
    cleanupReplayStore(nowMs);
    const replayKey = `${timestampSec}:${nonce}:${signature}`;
    if (replayStore.has(replayKey)) {
      return buildUnauthorized('Replay rejected');
    }
    replayStore.set(replayKey, nowMs + SIGNED_WINDOW_SEC * 1000);
    return { ok: true, mode: 'signed' };
  }

  if (legacySecret !== secret) return buildUnauthorized();
  return { ok: true, mode: 'legacy' };
}


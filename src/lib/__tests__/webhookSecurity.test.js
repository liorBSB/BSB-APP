import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { verifyStatusWebhookAuth } from '../webhookSecurity.js';

function sign(secret, timestampSec, nonce, body) {
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestampSec}.${nonce}.${body}`)
    .digest('hex')}`;
}

function makeRequest(headers) {
  return {
    headers: {
      get: (key) => headers[key.toLowerCase()] || null,
    },
  };
}

describe('verifyStatusWebhookAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows legacy secret mode', () => {
    const result = verifyStatusWebhookAuth(
      makeRequest({ 'x-webhook-secret': 'secret-1' }),
      '{"room":"5","status":"Home"}',
      'secret-1',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects stale signed requests', () => {
    const body = '{"room":"5","status":"Home"}';
    const nowSec = Math.floor(Date.now() / 1000);
    const ts = nowSec - 1000;
    const sig = sign('secret-1', ts, 'nonce-1', body);

    const result = verifyStatusWebhookAuth(
      makeRequest({
        'x-webhook-timestamp': String(ts),
        'x-webhook-nonce': 'nonce-1',
        'x-webhook-signature': sig,
      }),
      body,
      'secret-1',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Stale timestamp');
  });

  it('rejects replayed signed requests', () => {
    const body = '{"room":"5","status":"Home"}';
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign('secret-1', ts, 'nonce-1', body);
    const request = makeRequest({
      'x-webhook-timestamp': String(ts),
      'x-webhook-nonce': 'nonce-1',
      'x-webhook-signature': sig,
    });

    const first = verifyStatusWebhookAuth(request, body, 'secret-1');
    const second = verifyStatusWebhookAuth(request, body, 'secret-1');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.error).toBe('Replay rejected');
  });
});


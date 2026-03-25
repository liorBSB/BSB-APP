import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

const mockUpdate = vi.fn().mockResolvedValue();
const mockDoc = { ref: { update: mockUpdate } };
const mockGet = vi.fn();
const mockTakeRateLimit = vi.fn();

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      where: function () { return this; },
      limit: function () { return this; },
      get: mockGet,
    }),
  }),
}));

vi.mock('@/lib/rateLimit', () => ({
  takeRateLimit: (...args) => mockTakeRateLimit(...args),
  resolveRateLimitClientId: () => 'test-ip',
  applyRateLimitHeaders: (response) => response,
}));

function sign(secret, timestampSec, nonce, body) {
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestampSec}.${nonce}.${JSON.stringify(body)}`)
    .digest('hex')}`;
}

function makeRequest(body, secret, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-webhook-secret'] = secret;
  Object.assign(headers, extraHeaders);
  return new Request('http://localhost/api/status-webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('/api/status-webhook POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    process.env.STATUS_WEBHOOK_SECRET = 'test-secret-123';
    mockUpdate.mockClear();
    mockGet.mockClear();
    mockTakeRateLimit.mockReset();
    mockTakeRateLimit.mockReturnValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 60000,
      retryAfterSec: 0,
    });

    const mod = await import('../../status-webhook/route.js');
    POST = mod.POST;
  });

  afterEach(() => {
    delete process.env.STATUS_WEBHOOK_SECRET;
  });

  it('returns 401 when webhook secret header is missing', async () => {
    const res = await POST(makeRequest({ room: '5', status: 'Home' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when webhook secret is wrong', async () => {
    const res = await POST(makeRequest({ room: '5', status: 'Home' }, 'wrong-secret'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when STATUS_WEBHOOK_SECRET env is not set', async () => {
    delete process.env.STATUS_WEBHOOK_SECRET;
    const res = await POST(makeRequest({ room: '5', status: 'Home' }, 'any-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockTakeRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
      retryAfterSec: 1,
    });

    const res = await POST(makeRequest({ room: '5', status: 'Home' }, 'test-secret-123'));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
  });

  it('returns 400 when room is missing', async () => {
    const res = await POST(makeRequest({ status: 'Home' }, 'test-secret-123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing room or status');
  });

  it('accepts signed webhook request', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: [mockDoc] });
    const body = { room: '5', status: 'Home' };
    const timestampSec = Math.floor(Date.now() / 1000);
    const nonce = 'nonce-1';
    const signature = sign('test-secret-123', timestampSec, nonce, body);

    const res = await POST(
      makeRequest(body, null, {
        'x-webhook-timestamp': String(timestampSec),
        'x-webhook-nonce': nonce,
        'x-webhook-signature': signature,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('rejects replayed signed webhook request', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: [mockDoc] });
    const body = { room: '5', status: 'Home' };
    const timestampSec = Math.floor(Date.now() / 1000);
    const nonce = 'nonce-replay';
    const signature = sign('test-secret-123', timestampSec, nonce, body);

    const req = makeRequest(body, null, {
      'x-webhook-timestamp': String(timestampSec),
      'x-webhook-nonce': nonce,
      'x-webhook-signature': signature,
    });
    const first = await POST(req.clone());
    const second = await POST(req.clone());

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    const body2 = await second.json();
    expect(body2.error).toBe('Replay rejected');
  });

  it('returns 400 when status is missing', async () => {
    const res = await POST(makeRequest({ room: '5' }, 'test-secret-123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing room or status');
  });

  it('returns 400 when status is invalid', async () => {
    const res = await POST(makeRequest({ room: '5', status: 'BadValue' }, 'test-secret-123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid status: BadValue');
  });

  it('returns success and ignores "Empty" status', async () => {
    const res = await POST(makeRequest({ room: '5', status: 'Empty' }, 'test-secret-123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Empty status ignored');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns 404 when no user found for room', async () => {
    mockGet.mockResolvedValue({ empty: true, docs: [] });

    const res = await POST(makeRequest({ room: '5', status: 'Out' }, 'test-secret-123'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain('No user found for room 5');
  });

  it('updates Firestore and returns success for valid request', async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [mockDoc],
    });

    const res = await POST(makeRequest({ room: '5', status: 'In base' }, 'test-secret-123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Status updated to In base for room 5');

    expect(mockUpdate).toHaveBeenCalledOnce();
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.status).toBe('In base');
    expect(updateArg.updatedAt).toBeDefined();
  });

  it('trims room number before querying', async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [mockDoc],
    });

    const res = await POST(makeRequest({ room: '  7  ', status: 'Home' }, 'test-secret-123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('room 7');
  });

  it('accepts all four non-Empty valid statuses', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: [mockDoc] });

    for (const status of ['Home', 'Out', 'In base', 'Abroad']) {
      mockUpdate.mockClear();
      const res = await POST(makeRequest({ room: '1', status }, 'test-secret-123'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  it('returns 500 on Firestore query error', async () => {
    mockGet.mockRejectedValue(new Error('Firestore unavailable'));

    const res = await POST(makeRequest({ room: '5', status: 'Home' }, 'test-secret-123'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  // --- Edge cases ---

  it('returns 500 when Firestore update() rejects after successful query', async () => {
    const failingDoc = {
      ref: { update: vi.fn().mockRejectedValue(new Error('Write failed')) },
    };
    mockGet.mockResolvedValue({ empty: false, docs: [failingDoc] });

    const res = await POST(makeRequest({ room: '5', status: 'Home' }, 'test-secret-123'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('rejects case-insensitive status variant "home"', async () => {
    const res = await POST(makeRequest({ room: '5', status: 'home' }, 'test-secret-123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid status: home');
  });

  it('rejects case-insensitive status variant "HOME"', async () => {
    const res = await POST(makeRequest({ room: '5', status: 'HOME' }, 'test-secret-123'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when both room and status are missing', async () => {
    const res = await POST(makeRequest({}, 'test-secret-123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing room or status');
  });

  it('writes updatedAt as an ISO string', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: [mockDoc] });

    await POST(makeRequest({ room: '5', status: 'Out' }, 'test-secret-123'));

    const updateArg = mockUpdate.mock.calls[0][0];
    expect(() => new Date(updateArg.updatedAt).toISOString()).not.toThrow();
  });

  it('handles numeric room value from webhook (coerced to string)', async () => {
    mockGet.mockResolvedValue({ empty: false, docs: [mockDoc] });

    const res = await POST(makeRequest({ room: 5, status: 'Home' }, 'test-secret-123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('room 5');
  });
});

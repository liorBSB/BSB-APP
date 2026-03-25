import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAuth = vi.fn();
const mockTakeRateLimit = vi.fn();
const mockGet = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}));

vi.mock('@/lib/rateLimit', () => ({
  takeRateLimit: (...args) => mockTakeRateLimit(...args),
  applyRateLimitHeaders: (response) => response,
  resolveRateLimitClientId: () => 'test-ip',
}));

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      where: () => ({
        get: mockGet,
      }),
    }),
  }),
}));

function makeRequest(body) {
  return new Request('http://localhost/api/check-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/check-id POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAuth.mockReset();
    mockTakeRateLimit.mockReset();
    mockGet.mockReset();
    mockTakeRateLimit.mockReturnValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60000,
      retryAfterSec: 0,
    });
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('rejects unauthenticated callers', async () => {
    mockRequireAuth.mockResolvedValue({ ok: false, status: 401, error: 'Invalid auth token' });
    const res = await POST(makeRequest({ idNumber: '123' }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockTakeRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
      retryAfterSec: 1,
    });

    const res = await POST(makeRequest({ idNumber: '123' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
  });

  it('returns 400 for missing idNumber', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns taken true when id belongs to another uid', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockGet.mockResolvedValue({ docs: [{ id: 'u2' }] });

    const res = await POST(makeRequest({ idNumber: '123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taken).toBe(true);
  });
});


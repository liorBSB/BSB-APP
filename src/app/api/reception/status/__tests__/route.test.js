import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAuth = vi.fn();
const mockFetchReceptionRows = vi.fn();
const mockTakeRateLimit = vi.fn();
const mockUserGet = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}));

vi.mock('@/lib/serverSheetsBridge', () => ({
  fetchReceptionRows: (...args) => mockFetchReceptionRows(...args),
}));

vi.mock('@/lib/rateLimit', () => ({
  takeRateLimit: (...args) => mockTakeRateLimit(...args),
  applyRateLimitHeaders: (response) => response,
  resolveRateLimitClientId: () => 'test-ip',
}));

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: mockUserGet,
      }),
    }),
  }),
}));

function makeRequest(body) {
  return new Request('http://localhost/api/reception/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/reception/status POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAuth.mockReset();
    mockFetchReceptionRows.mockReset();
    mockTakeRateLimit.mockReset();
    mockUserGet.mockReset();
    mockTakeRateLimit.mockReturnValue({
      allowed: true,
      remaining: 20,
      resetAt: Date.now() + 60000,
      retryAfterSec: 0,
    });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ userType: 'user', roomNumber: '5' }),
    });
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('rejects unauthenticated callers', async () => {
    mockRequireAuth.mockResolvedValue({ ok: false, status: 401, error: 'Invalid auth token' });
    const res = await POST(makeRequest({ roomNumber: '5' }));
    expect(res.status).toBe(401);
  });

  it('returns Home for missing roomNumber', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('Home');
  });

  it('returns 403 when non-admin requests other room', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const res = await POST(makeRequest({ roomNumber: '9' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden room access');
  });

  it('returns 429 when rate-limited', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockTakeRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
      retryAfterSec: 1,
    });

    const res = await POST(makeRequest({ roomNumber: '5' }));
    expect(res.status).toBe(429);
  });

  it('allows admin to request any room', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'admin1' });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ userType: 'admin', roomNumber: '1' }),
    });
    mockFetchReceptionRows.mockResolvedValue([{ room: '9', status: 'Out' }]);
    const res = await POST(makeRequest({ roomNumber: '9' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('Out');
  });

  it('returns Home for invalid/empty statuses', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockFetchReceptionRows.mockResolvedValue([{ room: '5', status: 'Empty' }]);

    const res = await POST(makeRequest({ roomNumber: '5' }));
    const body = await res.json();
    expect(body.status).toBe('Home');
  });

  it('returns found valid status', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockFetchReceptionRows.mockResolvedValue([{ room: '5', status: 'Out' }]);

    const res = await POST(makeRequest({ roomNumber: '5' }));
    const body = await res.json();
    expect(body.status).toBe('Out');
  });
});


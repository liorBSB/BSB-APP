import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAuth = vi.fn();
const mockSearchSoldiersInSheets = vi.fn();
const mockTakeRateLimit = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}));

vi.mock('@/lib/serverSheetsBridge', () => ({
  searchSoldiersInSheets: (...args) => mockSearchSoldiersInSheets(...args),
}));

vi.mock('@/lib/rateLimit', () => ({
  takeRateLimit: (...args) => mockTakeRateLimit(...args),
  applyRateLimitHeaders: (response) => response,
  resolveRateLimitClientId: () => 'test-ip',
}));

function makeRequest(body) {
  return new Request('http://localhost/api/soldiers/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/soldiers/search POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAuth.mockReset();
    mockSearchSoldiersInSheets.mockReset();
    mockTakeRateLimit.mockReset();
    mockTakeRateLimit.mockReturnValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60000,
      retryAfterSec: 0,
    });
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('returns auth failure from requireAuth', async () => {
    mockRequireAuth.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });

    const res = await POST(makeRequest({ searchTerm: 'ab' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing bearer token');
    expect(mockSearchSoldiersInSheets).not.toHaveBeenCalled();
  });

  it('returns empty array for short search terms', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });

    const res = await POST(makeRequest({ searchTerm: 'a' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ soldiers: [] });
    expect(mockSearchSoldiersInSheets).not.toHaveBeenCalled();
  });

  it('maps data and limits results to 20', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const rows = Array.from({ length: 25 }, (_, index) => ({
      'שם מלא                                  (מילוי אוטומטי: לא לגעת)': `Soldier ${index}`,
      מספר_זהות: `12345678${index}`,
      'מספר זהות': `12345678${index}`,
      חדר: `${index}`,
    }));
    mockSearchSoldiersInSheets.mockResolvedValue(rows);

    const res = await POST(makeRequest({ searchTerm: 'Soldier' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.soldiers).toHaveLength(20);
    expect(body.soldiers[0].fullName).toBe('Soldier 0');
    expect(body.soldiers[0].idNumber).toBe('123456780');
    expect(body.soldiers[0].roomNumber).toBe('0');
    expect(body.soldiers[0].idSuffix).toBe('6780');
    expect(body.soldiers[0].raw).toBeUndefined();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockTakeRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
      retryAfterSec: 1,
    });

    const res = await POST(makeRequest({ searchTerm: 'ab' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
  });

  it('returns 500 when sheets bridge throws', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockSearchSoldiersInSheets.mockRejectedValue(new Error('bridge down'));

    const res = await POST(makeRequest({ searchTerm: 'ab' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('bridge down');
  });
});

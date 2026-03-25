import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAdmin = vi.fn();
const mockFetchReceptionRows = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
}));

vi.mock('@/lib/serverSheetsBridge', () => ({
  fetchReceptionRows: (...args) => mockFetchReceptionRows(...args),
}));

describe('/api/reception/all GET', () => {
  let GET;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAdmin.mockReset();
    mockFetchReceptionRows.mockReset();
    const mod = await import('../route.js');
    GET = mod.GET;
  });

  it('rejects non-admin callers', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 403, error: 'Admin access required' });

    const res = await GET(new Request('http://localhost/api/reception/all'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Admin access required');
  });

  it('returns rows for admin callers', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, uid: 'admin-1' });
    mockFetchReceptionRows.mockResolvedValue([{ room: '5', status: 'Home' }]);

    const res = await GET(new Request('http://localhost/api/reception/all'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([{ room: '5', status: 'Home' }]);
  });

  it('returns 500 when sheets bridge fails', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, uid: 'admin-1' });
    mockFetchReceptionRows.mockRejectedValue(new Error('unavailable'));

    const res = await GET(new Request('http://localhost/api/reception/all'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('unavailable');
    expect(body.code).toBeDefined();
  });
});

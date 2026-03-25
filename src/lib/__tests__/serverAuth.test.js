import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVerifyIdToken = vi.fn();
const mockGet = vi.fn();

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: mockGet,
      }),
    }),
  }),
}));

function makeRequest(authHeader) {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set('authorization', authHeader);
  }
  return new Request('http://localhost/api/test', { headers });
}

describe('serverAuth', () => {
  beforeEach(() => {
    mockVerifyIdToken.mockReset();
    mockGet.mockReset();
  });

  it('requireAuth returns 401 for missing bearer token', async () => {
    const { requireAuth } = await import('../serverAuth.js');
    const result = await requireAuth(makeRequest());
    expect(result).toEqual({ ok: false, status: 401, error: 'Missing bearer token' });
  });

  it('requireAuth returns 401 for malformed bearer header', async () => {
    const { requireAuth } = await import('../serverAuth.js');
    const result = await requireAuth(makeRequest('Bearer'));
    expect(result).toEqual({ ok: false, status: 401, error: 'Missing bearer token' });
  });

  it('requireAuth returns uid for valid token', async () => {
    const { requireAuth } = await import('../serverAuth.js');
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1' });

    const result = await requireAuth(makeRequest('Bearer token-1'));
    expect(result.ok).toBe(true);
    expect(result.uid).toBe('u1');
  });

  it('requireAuth returns 401 for invalid token', async () => {
    const { requireAuth } = await import('../serverAuth.js');
    mockVerifyIdToken.mockRejectedValue(new Error('bad token'));

    const result = await requireAuth(makeRequest('Bearer token-1'));
    expect(result).toEqual({ ok: false, status: 401, error: 'Invalid auth token' });
  });

  it('requireAdmin allows admin users', async () => {
    const { requireAdmin } = await import('../serverAuth.js');
    mockVerifyIdToken.mockResolvedValue({ uid: 'admin-1' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ userType: 'admin' }),
    });

    const result = await requireAdmin(makeRequest('Bearer token-1'));
    expect(result).toEqual({ ok: true, uid: 'admin-1' });
  });

  it('requireAdmin rejects non-admin users', async () => {
    const { requireAdmin } = await import('../serverAuth.js');
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ userType: 'user' }),
    });

    const result = await requireAdmin(makeRequest('Bearer token-1'));
    expect(result).toEqual({ ok: false, status: 403, error: 'Admin access required' });
  });

  it('requireAdmin returns 500 when role lookup fails', async () => {
    const { requireAdmin } = await import('../serverAuth.js');
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mockGet.mockRejectedValue(new Error('db down'));

    const result = await requireAdmin(makeRequest('Bearer token-1'));
    expect(result).toEqual({ ok: false, status: 500, error: 'Failed to verify role' });
  });

  it('requireOwnerOrAdmin allows owner directly', async () => {
    const { requireOwnerOrAdmin } = await import('../serverAuth.js');
    mockVerifyIdToken.mockResolvedValue({ uid: 'owner-1' });

    const result = await requireOwnerOrAdmin(makeRequest('Bearer token-1'), 'owner-1');
    expect(result).toEqual({ ok: true, uid: 'owner-1' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

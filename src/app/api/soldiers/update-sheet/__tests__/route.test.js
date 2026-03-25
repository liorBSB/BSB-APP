import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireOwnerOrAdmin = vi.fn();
const mockGet = vi.fn();
const mockUpdateSoldierInSheets = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireOwnerOrAdmin: (...args) => mockRequireOwnerOrAdmin(...args),
}));

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: mockGet,
      }),
    }),
  }),
}));

vi.mock('@/lib/serverSheetsBridge', () => ({
  updateSoldierInSheets: (...args) => mockUpdateSoldierInSheets(...args),
}));

vi.mock('@/lib/sheetFieldMap', () => ({
  PRIMARY_KEY_APP: 'idNumber',
  PRIMARY_KEY_SHEET: 'מספר זהות',
  appToSheetRow: (data) => data,
}));

function makeRequest(body) {
  return new Request('http://localhost/api/soldiers/update-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeIdempotentRequest(body, key) {
  return new Request('http://localhost/api/soldiers/update-sheet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(body),
  });
}

describe('/api/soldiers/update-sheet POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireOwnerOrAdmin.mockReset();
    mockGet.mockReset();
    mockUpdateSoldierInSheets.mockReset();
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('returns 400 for missing payload fields', async () => {
    const res = await POST(makeRequest({ userId: 'u1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing userId or updateData');
  });

  it('returns auth failure from requireOwnerOrAdmin', async () => {
    mockRequireOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: 'Admin access required' });

    const res = await POST(makeRequest({ userId: 'u1', updateData: { roomNumber: '4' } }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Admin access required');
  });

  it('returns success false when no ID can be derived', async () => {
    mockRequireOwnerOrAdmin.mockResolvedValue({ ok: true, uid: 'u1' });
    mockGet.mockResolvedValue({ exists: true, data: () => ({}) });

    const res = await POST(makeRequest({ userId: 'u1', updateData: { roomNumber: '4' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('No ID number');
    expect(mockUpdateSoldierInSheets).not.toHaveBeenCalled();
  });

  it('updates sheets when payload is valid', async () => {
    mockRequireOwnerOrAdmin.mockResolvedValue({ ok: true, uid: 'u1' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ idNumber: '123456789', fullName: 'Test User' }),
    });
    mockUpdateSoldierInSheets.mockResolvedValue({ message: 'ok' });

    const res = await POST(
      makeRequest({ userId: 'u1', updateData: { roomNumber: '4', idNumber: '123456789' } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('ok');
  });

  it('replays cached response for same idempotency key', async () => {
    mockRequireOwnerOrAdmin.mockResolvedValue({ ok: true, uid: 'u1' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ idNumber: '123456789', fullName: 'Test User' }),
    });
    mockUpdateSoldierInSheets.mockResolvedValue({ message: 'ok' });

    const payload = { userId: 'u1', updateData: { roomNumber: '4', idNumber: '123456789' } };
    const first = await POST(makeIdempotentRequest(payload, 'key-1'));
    const second = await POST(makeIdempotentRequest(payload, 'key-1'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockUpdateSoldierInSheets).toHaveBeenCalledTimes(1);
  });
});

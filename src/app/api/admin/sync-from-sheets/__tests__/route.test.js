import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAdmin = vi.fn();
const mockFetchAllSoldiersFromSheets = vi.fn();
const mockUsersGet = vi.fn();
const mockUserUpdate = vi.fn();
const mockDepartureGet = vi.fn();
const mockDepartureAdd = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
}));

vi.mock('@/lib/serverSheetsBridge', () => ({
  fetchAllSoldiersFromSheets: (...args) => mockFetchAllSoldiersFromSheets(...args),
}));

vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: () => ({
    collection: (name) => {
      if (name === 'users') {
        return {
          where: () => ({
            get: mockUsersGet,
          }),
          doc: () => ({
            update: mockUserUpdate,
          }),
        };
      }
      if (name === 'departureRequests') {
        return {
          where: () => ({
            where: () => ({
              limit: () => ({
                get: mockDepartureGet,
              }),
            }),
          }),
          add: mockDepartureAdd,
        };
      }
      return {};
    },
  }),
}));

vi.mock('@/lib/sheetFieldMap', () => ({
  PRIMARY_KEY_APP: 'idNumber',
  PRIMARY_KEY_SHEET: 'מספר זהות',
  sheetRowToApp: (row) => ({
    fullName: row.fullName || '',
    idNumber: row['מספר זהות'] || '',
    roomNumber: row.roomNumber || '',
  }),
}));

describe('/api/admin/sync-from-sheets POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAdmin.mockReset();
    mockFetchAllSoldiersFromSheets.mockReset();
    mockUsersGet.mockReset();
    mockUserUpdate.mockReset();
    mockDepartureGet.mockReset();
    mockDepartureAdd.mockReset();
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('rejects non-admin callers', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 403, error: 'Admin access required' });
    const res = await POST(new Request('http://localhost/api/admin/sync-from-sheets', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('returns success summary for no-change sync', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, uid: 'admin1' });
    mockFetchAllSoldiersFromSheets.mockResolvedValue([]);
    mockUsersGet.mockResolvedValue({ docs: [] });

    const res = await POST(new Request('http://localhost/api/admin/sync-from-sheets', { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(0);
    expect(body.flagged).toBe(0);
  });

  it('returns 500 on bridge failure', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, uid: 'admin1' });
    mockFetchAllSoldiersFromSheets.mockRejectedValue(new Error('bridge down'));

    const res = await POST(new Request('http://localhost/api/admin/sync-from-sheets', { method: 'POST' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('bridge down');
  });
});


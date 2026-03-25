import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAdmin = vi.fn();
const mockArchiveSoldierToSheet = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
}));

vi.mock('@/lib/serverSheetsBridge', () => ({
  archiveSoldierToSheet: (...args) => mockArchiveSoldierToSheet(...args),
}));

function makeRequest(body) {
  return new Request('http://localhost/api/soldiers/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/soldiers/archive POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAdmin.mockReset();
    mockArchiveSoldierToSheet.mockReset();
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('rejects non-admin callers', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, status: 403, error: 'Admin access required' });
    const res = await POST(makeRequest({ exportData: { name: 'A' } }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing exportData', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, uid: 'admin1' });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns bridge result on success', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, uid: 'admin1' });
    mockArchiveSoldierToSheet.mockResolvedValue({ success: true });
    const res = await POST(makeRequest({ exportData: { idNumber: '123' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});


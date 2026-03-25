import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/authFetch', () => ({
  authedFetch: vi.fn((...args) => fetch(...args)),
}));

describe('receptionSync', () => {
  let normalizeStatus;
  let fetchStatusFromSheet;
  let syncStatusToReceptionSheet;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('../receptionSync.js');
    normalizeStatus = mod.normalizeStatus;
    fetchStatusFromSheet = mod.fetchStatusFromSheet;
    syncStatusToReceptionSheet = mod.syncStatusToReceptionSheet;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes legacy status values', () => {
    expect(normalizeStatus('home')).toBe('Home');
    expect(normalizeStatus('away')).toBe('Out');
    expect(normalizeStatus('in base')).toBe('In base');
  });

  it('returns Home when room number is missing', async () => {
    expect(await fetchStatusFromSheet('')).toBe('Home');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches status from internal reception API', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'Out' }),
    });

    const status = await fetchStatusFromSheet('5');
    expect(status).toBe('Out');
    expect(fetch).toHaveBeenCalledWith('/api/reception/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNumber: '5' }),
    });
  });

  it('falls back to Home when API fails', async () => {
    fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('validates status before syncing', async () => {
    const result = await syncStatusToReceptionSheet('5', 'bad');
    expect(result).toEqual({ success: false, message: 'Invalid status' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('syncs status using internal API', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    const result = await syncStatusToReceptionSheet('5', 'Home');
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith('/api/sync-to-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNumber: '5', newStatus: 'Home' }),
    });
  });

  it('handles rapid repeated sync calls without throwing', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    const results = await Promise.all([
      syncStatusToReceptionSheet('5', 'Home'),
      syncStatusToReceptionSheet('5', 'Out'),
      syncStatusToReceptionSheet('5', 'In base'),
    ]);

    expect(results).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('falls back to Home when reception API returns invalid status payload', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'Unknown' }),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });
});

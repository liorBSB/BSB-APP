import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('serverSheetsBridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    process.env.SOLDIER_SHEETS_SCRIPT_URL = 'https://example.com/soldiers';
    process.env.RECEPTION_SCRIPT_URL = 'https://example.com/reception';
    process.env.LEFT_SOLDIERS_SCRIPT_URL = 'https://example.com/archive';
    process.env.SHEETS_FETCH_TIMEOUT_MS = '200';
    process.env.SHEETS_FETCH_RETRIES = '1';
    process.env.SHEETS_FETCH_RETRY_BASE_MS = '1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOLDIER_SHEETS_SCRIPT_URL;
    delete process.env.RECEPTION_SCRIPT_URL;
    delete process.env.LEFT_SOLDIERS_SCRIPT_URL;
    delete process.env.SHEETS_FETCH_TIMEOUT_MS;
    delete process.env.SHEETS_FETCH_RETRIES;
    delete process.env.SHEETS_FETCH_RETRY_BASE_MS;
  });

  it('retries reception reads on transient 503 errors', async () => {
    fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: '5', status: 'Home' }]),
      });

    const { fetchReceptionRows } = await import('@/lib/serverSheetsBridge');
    const rows = await fetchReceptionRows({ requestId: 't1' });
    expect(rows).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries write when timeout occurs and retries are enabled', async () => {
    fetch
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

    const { updateReceptionStatusById } = await import('@/lib/serverSheetsBridge');
    const result = await updateReceptionStatusById('row-5', 'Out', { requestId: 't2' });
    expect(result.status).toBe('success');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable upstream 400 errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    const { updateSoldierInSheets } = await import('@/lib/serverSheetsBridge');
    await expect(updateSoldierInSheets({ id: '1' }, { requestId: 't3' })).rejects.toMatchObject({
      code: 'UPSTREAM_4XX',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

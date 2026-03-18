import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// normalizeStatus — pure function, no mocking needed
// ---------------------------------------------------------------------------

describe('normalizeStatus', () => {
  let normalizeStatus;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../receptionSync.js');
    normalizeStatus = mod.normalizeStatus;
  });

  it('maps legacy "home" to "Home"', () => {
    expect(normalizeStatus('home')).toBe('Home');
  });

  it('maps legacy "away" to "Out"', () => {
    expect(normalizeStatus('away')).toBe('Out');
  });

  it('maps legacy "in base" to "In base"', () => {
    expect(normalizeStatus('in base')).toBe('In base');
  });

  it('maps legacy "abroad" to "Abroad"', () => {
    expect(normalizeStatus('abroad')).toBe('Abroad');
  });

  it('maps legacy "left" to "Empty"', () => {
    expect(normalizeStatus('left')).toBe('Empty');
  });

  it('returns "Home" for null', () => {
    expect(normalizeStatus(null)).toBe('Home');
  });

  it('returns "Home" for undefined', () => {
    expect(normalizeStatus(undefined)).toBe('Home');
  });

  it('returns "Home" for empty string', () => {
    expect(normalizeStatus('')).toBe('Home');
  });

  it('passes through already-valid "Home"', () => {
    expect(normalizeStatus('Home')).toBe('Home');
  });

  it('passes through already-valid "Out"', () => {
    expect(normalizeStatus('Out')).toBe('Out');
  });

  it('passes through already-valid "In base"', () => {
    expect(normalizeStatus('In base')).toBe('In base');
  });

  it('passes through already-valid "Abroad"', () => {
    expect(normalizeStatus('Abroad')).toBe('Abroad');
  });

  it('passes through unknown values as-is', () => {
    expect(normalizeStatus('SomethingElse')).toBe('SomethingElse');
  });

  it('treats 0 as falsy — returns "Home"', () => {
    expect(normalizeStatus(0)).toBe('Home');
  });

  it('treats false as falsy — returns "Home"', () => {
    expect(normalizeStatus(false)).toBe('Home');
  });

  it('does not match case-insensitive variants like "Home" vs "HOME"', () => {
    expect(normalizeStatus('HOME')).toBe('HOME');
    expect(normalizeStatus('Away')).toBe('Away');
  });
});

// ---------------------------------------------------------------------------
// fetchStatusFromSheet — needs fetch mock + env var control
// ---------------------------------------------------------------------------

describe('fetchStatusFromSheet', () => {
  const FAKE_URL = 'https://script.google.com/fake';
  let fetchStatusFromSheet;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    process.env.NEXT_PUBLIC_RECEPTION_SCRIPT_URL = FAKE_URL;
    const mod = await import('../receptionSync.js');
    fetchStatusFromSheet = mod.fetchStatusFromSheet;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_RECEPTION_SCRIPT_URL;
  });

  it('returns correct status when room is found with valid status', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5', status: 'Out' },
        { room: '10', status: 'Home' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Out');
  });

  it('returns "Home" when room is not found', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5', status: 'Out' },
      ]),
    });

    expect(await fetchStatusFromSheet('99')).toBe('Home');
  });

  it('returns "Home" when sheet status is "Empty"', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5', status: 'Empty' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('returns "Home" when status is not in VALID_STATUSES', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5', status: 'InvalidValue' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('returns "Home" when roomNumber is falsy', async () => {
    expect(await fetchStatusFromSheet(null)).toBe('Home');
    expect(await fetchStatusFromSheet('')).toBe('Home');
    expect(await fetchStatusFromSheet(undefined)).toBe('Home');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns "Home" when RECEPTION_SCRIPT_URL is not set', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_RECEPTION_SCRIPT_URL;
    const mod = await import('../receptionSync.js');

    expect(await mod.fetchStatusFromSheet('5')).toBe('Home');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns "Home" on network error', async () => {
    fetch.mockRejectedValue(new Error('Network failure'));

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('returns "Home" when fetch returns non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('trims room numbers for matching', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '  5  ', status: 'Abroad' },
      ]),
    });

    expect(await fetchStatusFromSheet(' 5 ')).toBe('Abroad');
  });

  it('handles room with no status field', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('handles numeric room number argument (coerces to string for matching)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5', status: 'Abroad' },
      ]),
    });

    expect(await fetchStatusFromSheet(5)).toBe('Abroad');
  });

  it('handles numeric room value in sheet data', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: 5, status: 'Out' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Out');
  });

  it('returns "Home" when sheet returns empty array', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('returns "Home" when sheet returns non-array (object)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'something' }),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('returns "Home" when sheet returns null', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Home');
  });

  it('returns first match when multiple rows have the same room', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: '5', status: 'Out' },
        { room: '5', status: 'Abroad' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('Out');
  });

  it('handles room with null room field in sheet data', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { room: null, status: 'Out' },
        { room: '5', status: 'In base' },
      ]),
    });

    expect(await fetchStatusFromSheet('5')).toBe('In base');
  });
});

// ---------------------------------------------------------------------------
// syncStatusToReceptionSheet — needs fetch mock
// ---------------------------------------------------------------------------

describe('syncStatusToReceptionSheet', () => {
  let syncStatusToReceptionSheet;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('../receptionSync.js');
    syncStatusToReceptionSheet = mod.syncStatusToReceptionSheet;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns failure when no room number provided', async () => {
    const result = await syncStatusToReceptionSheet(null, 'Home');
    expect(result).toEqual({ success: false, message: 'No room number' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns failure when room number is empty string', async () => {
    const result = await syncStatusToReceptionSheet('', 'Home');
    expect(result).toEqual({ success: false, message: 'No room number' });
  });

  it('returns failure when status is invalid', async () => {
    const result = await syncStatusToReceptionSheet('5', 'BadStatus');
    expect(result).toEqual({ success: false, message: 'Invalid status' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns failure for "Empty" status (not in VALID_STATUSES)', async () => {
    const result = await syncStatusToReceptionSheet('5', 'Empty');
    expect(result).toEqual({ success: false, message: 'Invalid status' });
  });

  it('calls /api/sync-to-sheet with correct payload on valid input', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    await syncStatusToReceptionSheet('5', 'Out');

    expect(fetch).toHaveBeenCalledWith('/api/sync-to-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNumber: '5', newStatus: 'Out' }),
    });
  });

  it('returns success result from API', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    const result = await syncStatusToReceptionSheet('5', 'Home');
    expect(result).toEqual({ success: true });
  });

  it('returns failure result from API', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false, message: 'Room not found' }),
    });

    const result = await syncStatusToReceptionSheet('5', 'Home');
    expect(result).toEqual({ success: false, message: 'Room not found' });
  });

  it('handles fetch failure gracefully', async () => {
    fetch.mockRejectedValue(new Error('Network down'));

    const result = await syncStatusToReceptionSheet('5', 'Home');
    expect(result).toEqual({ success: false, message: 'Network down' });
  });

  it('accepts all four valid statuses', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    for (const status of ['Home', 'Out', 'In base', 'Abroad']) {
      const result = await syncStatusToReceptionSheet('5', status);
      expect(result.success).toBe(true);
    }
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('rejects case-insensitive status variants like "home"', async () => {
    const result = await syncStatusToReceptionSheet('5', 'home');
    expect(result).toEqual({ success: false, message: 'Invalid status' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects null status', async () => {
    const result = await syncStatusToReceptionSheet('5', null);
    expect(result).toEqual({ success: false, message: 'Invalid status' });
  });

  it('rejects undefined status', async () => {
    const result = await syncStatusToReceptionSheet('5', undefined);
    expect(result).toEqual({ success: false, message: 'Invalid status' });
  });

  it('handles numeric room number (coerces to truthy)', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    const result = await syncStatusToReceptionSheet(5, 'Home');
    expect(result.success).toBe(true);

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.roomNumber).toBe(5);
  });

  it('handles res.json() throwing', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const result = await syncStatusToReceptionSheet('5', 'Home');
    expect(result).toEqual({ success: false, message: 'Invalid JSON' });
  });
});

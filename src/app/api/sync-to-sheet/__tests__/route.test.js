import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: vi.fn(async () => ({ ok: true, uid: 'test-user' })),
}));

function makeRequest(body) {
  return new Request('http://localhost/api/sync-to-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/sync-to-sheet POST', () => {
  const FAKE_URL = 'https://script.google.com/fake-reception';
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    process.env.RECEPTION_SCRIPT_URL = FAKE_URL;
    const mod = await import('../../sync-to-sheet/route.js');
    POST = mod.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RECEPTION_SCRIPT_URL;
  });

  it('returns 500 when RECEPTION_SCRIPT_URL is not configured', async () => {
    vi.resetModules();
    delete process.env.RECEPTION_SCRIPT_URL;
    const mod = await import('../../sync-to-sheet/route.js');

    const res = await mod.POST(makeRequest({ roomNumber: '5', newStatus: 'Home' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain('not configured');
  });

  it('returns 400 when roomNumber is missing', async () => {
    const res = await POST(makeRequest({ newStatus: 'Home' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('No room number');
  });

  it('returns 400 when newStatus is invalid', async () => {
    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'BadStatus' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Invalid status');
  });

  it('returns 404 when room not found in sheet', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ room: '10', id: 'row-10', status: 'Home' }]),
    });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain('Room 5 not found');
  });

  it('returns success when room found and POST succeeds', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: '5', id: 'row-5', status: 'Home' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const postCall = fetch.mock.calls[1];
    expect(postCall[0]).toBe(FAKE_URL);
    expect(postCall[1].method).toBe('POST');
    const postBody = JSON.parse(postCall[1].body);
    expect(postBody).toEqual({ id: 'row-5', status: 'Out' });
  });

  it('returns 500 when GET to sheet fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 502 });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Home' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain('Reception read failed');
  });

  it('returns 500 when POST to sheet fails', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: '5', id: 'row-5', status: 'Home' }]),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain('Reception update failed');
  });

  it('returns 500 when sheet POST returns non-success status', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: '5', id: 'row-5', status: 'Home' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'error', message: 'Sheet locked' }),
      });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Sheet locked');
  });

  it('returns 500 on network error', async () => {
    fetch.mockRejectedValueOnce(new Error('DNS resolution failed'));

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Home' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('DNS resolution failed');
  });

  it('trims room numbers when matching', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: ' 5 ', id: 'row-5', status: 'Home' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Abroad' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // --- Edge cases ---

  it('returns 422 when sheet row has no id field', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ room: '5', status: 'Home' }]),
    });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toContain('no id');
  });

  it('returns 400 when body is empty object (no roomNumber)', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('No room number');
  });

  it('uses first match when sheet has duplicate rooms', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { room: '5', id: 'first-row', status: 'Home' },
          { room: '5', id: 'second-row', status: 'Out' },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Abroad' }));
    expect(res.status).toBe(200);

    const postBody = JSON.parse(fetch.mock.calls[1][1].body);
    expect(postBody.id).toBe('first-row');
  });

  it('returns 500 with "Unknown error" when sheet response has no message', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: '5', id: 'row-5', status: 'Home' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'error' }),
      });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Reception update failed');
  });

  it('handles sheet returning empty array', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Home' }));
    expect(res.status).toBe(404);
  });

  it('rejects case-insensitive status like "home"', async () => {
    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'home' }));
    expect(res.status).toBe(400);
  });

  it('handles numeric room values in sheet data', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ room: 5, id: 'row-5', status: 'Home' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

    const res = await POST(makeRequest({ roomNumber: '5', newStatus: 'Out' }));
    expect(res.status).toBe(200);
  });
});

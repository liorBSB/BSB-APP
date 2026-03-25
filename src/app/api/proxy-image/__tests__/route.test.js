import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('/api/proxy-image GET', () => {
  let GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('../route.js');
    GET = mod.GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when URL parameter is missing', async () => {
    const res = await GET(new Request('http://localhost/api/proxy-image'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid URL values', async () => {
    const res = await GET(new Request('http://localhost/api/proxy-image?url=bad-url'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid URL');
  });

  it('returns 403 for non-allowed hosts', async () => {
    const blocked = encodeURIComponent('https://example.com/photo.jpg');
    const res = await GET(new Request(`http://localhost/api/proxy-image?url=${blocked}`));
    expect(res.status).toBe(403);
  });

  it('returns 400 when upstream content is not an image', async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/plain' },
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('x').buffer),
    });

    const allowed = encodeURIComponent('https://firebasestorage.googleapis.com/photo.jpg');
    const res = await GET(new Request(`http://localhost/api/proxy-image?url=${allowed}`));
    expect(res.status).toBe(400);
  });

  it('returns image bytes for allowed host', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    });

    const allowed = encodeURIComponent('https://firebasestorage.googleapis.com/photo.jpg');
    const res = await GET(new Request(`http://localhost/api/proxy-image?url=${allowed}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('accepts storage.googleapis.com host', async () => {
    const bytes = new Uint8Array([1, 2]);
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    });

    const allowed = encodeURIComponent('https://storage.googleapis.com/path/photo.png');
    const res = await GET(new Request(`http://localhost/api/proxy-image?url=${allowed}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns 502 when upstream request fails', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => 'text/plain' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    const allowed = encodeURIComponent('https://firebasestorage.googleapis.com/photo.jpg');
    const res = await GET(new Request(`http://localhost/api/proxy-image?url=${allowed}`));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('Upstream returned 503');
  });
});

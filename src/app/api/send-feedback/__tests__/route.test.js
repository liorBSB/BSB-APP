import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAuth = vi.fn();
const mockTakeRateLimit = vi.fn();
const mockSendMail = vi.fn();

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}));

vi.mock('@/lib/rateLimit', () => ({
  takeRateLimit: (...args) => mockTakeRateLimit(...args),
  applyRateLimitHeaders: (response) => response,
  resolveRateLimitClientId: () => 'test-ip',
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: (...args) => mockSendMail(...args),
    }),
  },
}));

function makeRequest(body) {
  return new Request('http://localhost/api/send-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/send-feedback POST', () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockRequireAuth.mockReset();
    mockTakeRateLimit.mockReset();
    mockSendMail.mockReset();
    mockTakeRateLimit.mockReturnValue({
      allowed: true,
      remaining: 5,
      resetAt: Date.now() + 60000,
      retryAfterSec: 0,
    });
    mockSendMail.mockResolvedValue({});
    const mod = await import('../route.js');
    POST = mod.POST;
  });

  it('rejects unauthenticated callers', async () => {
    mockRequireAuth.mockResolvedValue({ ok: false, status: 401, error: 'Missing bearer token' });
    const res = await POST(makeRequest({ subject: 's', body: 'b' }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    mockTakeRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
      retryAfterSec: 1,
    });

    const res = await POST(makeRequest({ subject: 's', body: 'b' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for missing subject/body', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const res = await POST(makeRequest({ subject: ' ', body: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects oversized feedback payload', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const longBody = 'x'.repeat(6000);
    const res = await POST(makeRequest({
      subject: 'Long Subject',
      body: longBody,
      screenshots: Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.png`),
    }));
    expect(res.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('accepts valid payload and sends email', async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, uid: 'u1' });
    const res = await POST(makeRequest({
      subject: 'Long Subject',
      body: 'Legit message',
      screenshots: Array.from({ length: 3 }, (_, i) => `https://example.com/${i}.png`),
    }));
    expect(res.status).toBe(200);
    expect(mockSendMail).toHaveBeenCalledOnce();
  });
});


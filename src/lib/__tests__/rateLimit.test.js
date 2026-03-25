import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { takeRateLimit, resolveRateLimitClientId } from '../rateLimit.js';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks calls over the limit in same window', () => {
    const first = takeRateLimit({ key: 'k1', limit: 2, windowMs: 60000 });
    const second = takeRateLimit({ key: 'k1', limit: 2, windowMs: 60000 });
    const third = takeRateLimit({ key: 'k1', limit: 2, windowMs: 60000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after window passes', () => {
    takeRateLimit({ key: 'k2', limit: 1, windowMs: 1000 });
    const blocked = takeRateLimit({ key: 'k2', limit: 1, windowMs: 1000 });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    const reset = takeRateLimit({ key: 'k2', limit: 1, windowMs: 1000 });
    expect(reset.allowed).toBe(true);
  });

  it('extracts first client ip from forwarded headers', () => {
    const request = {
      headers: {
        get: (name) => (name === 'x-forwarded-for' ? '1.1.1.1, 2.2.2.2' : null),
      },
    };
    expect(resolveRateLimitClientId(request)).toBe('1.1.1.1');
  });
});

